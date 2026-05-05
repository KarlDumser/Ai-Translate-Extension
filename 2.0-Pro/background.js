/* background.js — JPN-DE/EN Hover Dictionary v2.0
 *
 * Unterstützt Übersetzungen zwischen Japanisch, Deutsch, Englisch
 * Nachrichten-Typen:
 *   { type: 'lookup', word, focusIndex, scriptType }  → Dictionary-Daten
 *   { type: 'chat', word, meaning, history } → KI-Antwort
 */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'ping') {
    sendResponse({ ok: true, ts: Date.now() });
    return;
  }

  if (msg.type === 'lookup') {
    lookupWord(msg.word, msg.focusIndex, msg.scriptType, msg.targetLanguage)
      .then(sendResponse)
      .catch(err => sendResponse({ found: false, error: err.message }));
    return true; // async
  }

  if (msg.type === 'chat') {
    askAI(msg.word, msg.meaning, msg.history)
      .then(sendResponse)
      .catch(err => sendResponse({ answer: '⛔ ' + err.message }));
    return true;
  }

  if (msg.type === 'translate_sentence') {
    translateSentence(msg.text, msg.sourceLanguage, msg.targetLanguage)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message, found: false }));
    return true;
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get('extensionEnabled');
  if (typeof stored.extensionEnabled !== 'boolean') {
    await chrome.storage.sync.set({ extensionEnabled: true });
  }
});

chrome.commands.onCommand.addListener(async command => {
  if (command !== 'toggle-extension') return;

  const stored = await chrome.storage.sync.get({ extensionEnabled: true });
  const nextState = !stored.extensionEnabled;
  await chrome.storage.sync.set({ extensionEnabled: nextState });
});

const LOOKUP_TTL_MS = 10 * 60 * 1000;
const lookupCache = new Map();
const lookupResultCache = new Map();
const inFlightSearches = new Map();

// DeepL-Key einmal laden und bei Änderungen aktualisieren
let _deeplKey = undefined;
async function getDeeplKey() {
  if (_deeplKey !== undefined) return _deeplKey;
  const stored = await chrome.storage.sync.get('deeplKey');
  _deeplKey = stored.deeplKey || '';
  return _deeplKey;
}
chrome.storage.onChanged.addListener(changes => {
  if (changes.deeplKey) _deeplKey = changes.deeplKey.newValue || '';
});

// ── Wörterbuch-Abfrage ─────────────────────────────────────────────
async function lookupWord(word, focusIndex, scriptType, targetLanguage) {
  // Japanisch erkennen: Wenn scriptType Japanisch ist, Jisho verwenden
  if (scriptType === 'kanji' || scriptType === 'hiragana' || scriptType === 'katakana') {
    return await lookupJapanese(word, focusIndex, scriptType);
  }
  
  // Deutsch/Englisch: Übersetzung verwenden
  const settings = await chrome.storage.sync.get({ 
    sourceLanguage: 'auto',
    apiKey: '',
  });
  const sourceLanguage = settings.sourceLanguage || 'auto';
  const apiKey = settings.apiKey || '';
  const target = targetLanguage || 'en';
  
  if (sourceLanguage === 'auto') {
    // Auto-Erkennung: mit OpenAI, sonst Heuristik-Fallback
    let detectedLang = 'en';
    if (apiKey) {
      detectedLang = await detectLanguage(word, apiKey);
    } else {
      const hasJapanese = /[\u3040-\u30ff\u3400-\u9faf]/.test(word);
      detectedLang = hasJapanese ? 'ja' : 'en';
    }
    return await lookupTranslation(word, detectedLang, target);
  }
  
  if (sourceLanguage === 'de' || sourceLanguage === 'en' || sourceLanguage === 'ja') {
    return await lookupTranslation(word, sourceLanguage, target);
  }
  
  return { found: false, error: 'Unknown source language' };
}

// Japanisch-Lookup via Jisho
async function lookupJapanese(word, focusIndex, scriptType, targetLanguage) {
  const cacheKey = `${word}|${focusIndex}|${scriptType}|${targetLanguage||'de'}`;
  const cachedResult = getFreshCache(lookupResultCache, cacheKey);
  if (cachedResult) return cachedResult;

  const candidates = buildLookupCandidates(word, focusIndex, scriptType);

  // Alle Kandidaten parallel abrufen (inFlightSearches dedupliziert gleiche Wörter)
  const searchResults = await Promise.all(
    candidates.map(c =>
      searchJisho(c)
        .then(entries => ({ candidate: c, entries }))
        .catch(() => ({ candidate: c, entries: [] }))
    )
  );

  let bestExact = null;
  let fallbackEntry = null;
  let fallbackCandidate = word;

  for (const { candidate, entries } of searchResults) {
    if (!entries.length) continue;

    const exactEntry = selectExactEntry(entries, candidate);
    if (exactEntry) {
      const candidateScore = scoreCandidate(candidate, focusIndex, scriptType, word.length);
      const totalScore = exactEntry.score + candidateScore;
      if (!bestExact || totalScore > bestExact.totalScore) {
        bestExact = {
          entry: exactEntry.entry,
          candidate,
          totalScore,
        };
      }
    }

    if (!fallbackEntry) {
      fallbackEntry = entries[0];
      fallbackCandidate = candidate;
    }
  }

  if (bestExact) {
    const result = await formatLookupResult(bestExact.entry, bestExact.candidate, targetLanguage);
    setCache(lookupResultCache, cacheKey, result);
    return result;
  }

  if (!fallbackEntry) {
    const result = { found: false };
    setCache(lookupResultCache, cacheKey, result);
    return result;
  }

  const result = await formatLookupResult(fallbackEntry, fallbackCandidate, targetLanguage);
  setCache(lookupResultCache, cacheKey, result);
  return result;
}

// Deutsch/Englisch-Lookup via Übersetzung
async function lookupTranslation(word, sourceLang, targetLanguage) {
  const cacheKey = `trans|${word}|${sourceLang}|${targetLanguage || 'auto'}`;
  const cachedResult = getFreshCache(lookupResultCache, cacheKey);
  if (cachedResult) return cachedResult;

  // Zielsprachen bestimmen
  // Wenn der erkannte/gewählte Text nicht der eingestellten Zielsprache entspricht,
  // übersetzen wir in die Zielsprache. 
  // Entspricht er der Zielsprache (z.B. Zielsprache=de, erkannter Text=de),
  // dann übersetzen wir in die Gegenrichtung (z.B. 'ja').
  let targetLangs = [targetLanguage || 'de'];
  if (sourceLang === targetLanguage || sourceLang === (targetLanguage || 'de')) {
    targetLangs = (sourceLang === 'ja') ? ['de', 'en'] : ['ja'];
  }
  
  // Alle Übersetzungen parallel starten
  const settled = await Promise.allSettled(
    targetLangs.map(lang => performTranslation(word, sourceLang, lang))
  );
  const translations = {};
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value?.length > 0) {
      translations[targetLangs[i]] = r.value;
    } else if (r.status === 'rejected') {
      console.warn(`Translation error ${sourceLang}→${targetLangs[i]}:`, r.reason);
    }
  });

  const result = {
    found: Object.keys(translations).length > 0,
    word,
    translations,
    sourceLanguage: sourceLang,
    targetLanguages: targetLangs,
  };

  setCache(lookupResultCache, cacheKey, result);
  return result;
}

async function detectLanguage(text, apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: `Detect the language of this text and respond ONLY with the ISO 639-1 code (e.g., "de", "en", "ja", "fr", "es"). Text: "${text}"`,
        }],
        temperature: 0,
        max_tokens: 5,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const detected = data.choices[0]?.message?.content?.trim().toLowerCase() || 'en';
    return detected;
  } catch (err) {
    console.error('Language detection failed:', err);
    return 'en'; // Fallback zu Englisch
  }
}
async function searchJisho(word) {
  const cachedEntries = getFreshCache(lookupCache, word);
  if (cachedEntries) return cachedEntries;
  if (inFlightSearches.has(word)) return inFlightSearches.get(word);

  const request = (async () => {
    const url = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;
    const res  = await fetch(url);
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error('Jisho-Limit erreicht, bitte kurz warten');
      }
      throw new Error(`Jisho antwortet nicht (${res.status})`);
    }

    const json = await res.json();
    const entries = json?.data ?? [];
    setCache(lookupCache, word, entries);
    return entries;
  })();

  inFlightSearches.set(word, request);
  try {
    return await request;
  } finally {
    inFlightSearches.delete(word);
  }
}

async function formatLookupResult(entry, fallbackWord, targetLanguage) {
  const jpEntry = entry.japanese?.[0] ?? {};
  const senses  = entry.senses  ?? [];

  const wordText = jpEntry.word    ?? fallbackWord;
  const kana     = jpEntry.reading ?? jpEntry.word ?? fallbackWord;

  // Romaji aus erster Sense (tag: "Usually written using kana alone" etc.)
  // Kein direkter Romaji in Jisho-API – wir leiten ihn nicht ab.

  // Tags
  const tags = [];
  if (entry.is_common) tags.push('häufig');
  (entry.jlpt ?? []).forEach(j => tags.push(j.toUpperCase().replace('JLPT', 'JLPT ')));
  const pos = senses[0]?.parts_of_speech ?? [];
  pos.slice(0, 2).forEach(p => tags.push(shortenPOS(p)));

  // Englische Bedeutungen (alle Senses, max. 5)
  const english = senses.flatMap(s => s.english_definitions ?? []).slice(0, 5);

  // Deutsche Übersetzung (jetzt dynamische Zielsprache, Property heißt historisch 'german')
  const tl = targetLanguage || 'de';
  const german = english.length ? await translateFromEnglish(english.slice(0, 3), tl) : [];

  // Beispielsatz – Jisho-API liefert keine Beispiele direkt;
  // wir überspringen das für eine saubere Implementierung.

  return {
    found: true,
    word:    wordText,
    kana,
    tags,
    english,
    german,
  };
}

function buildLookupCandidates(word, focusIndex, scriptType) {
  const source = String(word ?? '').trim();
  if (!source) return [];

  const unique = new Set();
  const candidates = [];
  const add = value => {
    const candidate = String(value ?? '').trim();
    if (!candidate || unique.has(candidate)) return;
    unique.add(candidate);
    candidates.push(candidate);
  };

  add(source);

  if (!Number.isInteger(focusIndex) || focusIndex < 0 || focusIndex >= source.length) {
    return candidates;
  }

  const maxLen = Math.min(source.length, scriptType === 'kanji' ? 8 : 12);
  const scored = [];

  for (let start = 0; start <= focusIndex; start++) {
    for (let end = focusIndex + 1; end <= source.length; end++) {
      const len = end - start;
      if (len > maxLen) continue;
      const touchesEdge = start === focusIndex || end === focusIndex + 1;
      const edgeDistance = Math.min(focusIndex - start, end - focusIndex - 1);
      scored.push({
        candidate: source.slice(start, end),
        len,
        start,
        end,
        edgeDistance,
        touchesEdge,
      });
    }
  }

  scored.sort((a, b) => {
    const aScore = scoreCandidate(a.candidate, focusIndex, scriptType, source.length, a.start, a.end);
    const bScore = scoreCandidate(b.candidate, focusIndex, scriptType, source.length, b.start, b.end);
    return bScore - aScore;
  });

  for (const item of scored) {
    add(item.candidate);
    if (candidates.length >= 18) break;
  }

  return candidates;
}

function selectExactEntry(entries, candidate) {
  const scored = entries
    .map(entry => ({ entry, score: scoreExactEntry(entry, candidate) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0] ?? null;
}

function scoreExactEntry(entry, candidate) {
  let score = 0;
  if (entry.slug === candidate) score = Math.max(score, 5);

  for (const jp of entry.japanese ?? []) {
    if (jp.word === candidate) score = Math.max(score, 6);
    if (jp.reading === candidate) score = Math.max(score, jp.word ? 4 : 5);
  }

  if (entry.is_common) score += 1;
  return score;
}

function scoreCandidate(candidate, focusIndex, scriptType, sourceLength, start = null, end = null) {
  const len = candidate.length;
  const actualStart = start ?? 0;
  const actualEnd = end ?? len;
  const edgeDistance = Math.min(focusIndex - actualStart, actualEnd - focusIndex - 1);
  const touchesHoveredEdge = actualStart === focusIndex || actualEnd === focusIndex + 1;

  let score = 0;

  if (scriptType === 'kanji') {
    // Bevorzuge längere Matches, die näher an der Gesamtlänge (sourceLength) sind
    const lengthScore = len === sourceLength ? 80 : len * 10;
    score += lengthScore;
  } else {
    score += len === sourceLength ? 60 : Math.max(0, 40 - (sourceLength - len) * 6);
  }

  score += touchesHoveredEdge ? 12 : 0;
  score += Math.max(0, 8 - edgeDistance * 4);
  score += Math.max(0, 6 - Math.abs((actualStart + actualEnd - 1) / 2 - focusIndex) * 2);

  return score;
}

function getFreshCache(cache, key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > LOOKUP_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCache(cache, key, value) {
  cache.set(key, { value, ts: Date.now() });
}

// ── Englisch → Deutsch/andere Sprachen ────────────────────────────
async function performTranslation(text, sourceLang, targetLang) {
  // Mapping für API
  const langMap = { de: 'DE', en: 'EN', ja: 'JA' };
  const source = langMap[sourceLang];
  const target = langMap[targetLang];

  if (!source || !target) {
    throw new Error(`Ungültige Sprachkombination: ${sourceLang} → ${targetLang}`);
  }

  // 1. DeepL (falls API-Key vorhanden)
  const deeplKey = await getDeeplKey();
  if (deeplKey) {
    try {
      const body = new URLSearchParams({
        auth_key: deeplKey,
        text,
        source_lang: source,
        target_lang: target,
      });
      const r = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (r.ok) {
        const d = await r.json();
        const t = d.translations?.[0]?.text ?? '';
        if (t) return [t];
      }
    } catch (e) {
      console.warn('DeepL error:', e);
    }
  }

  // 2. Fallback: MyMemory (kostenlos)
  const langPairMap = {
    'de|en': 'de|en',
    'en|de': 'en|de',
    'ja|de': 'ja|de', 
    'ja|en': 'ja|en',
    'de|ja': 'de|ja',
    'en|ja': 'en|ja',
  };
  const pair = langPairMap[`${sourceLang}|${targetLang}`] || `${sourceLang}|${targetLang}`;

  try {
    const r = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`
    );
    if (r.ok) {
      const d = await r.json();
      const t = d.responseData?.translatedText ?? '';
      if (t && d.responseStatus === 200) {
        return [t];
      }
    }
  } catch (e) {
    console.warn('MyMemory error:', e);
  }

  throw new Error(`Keine Übersetzung für ${sourceLang}→${targetLang} verfügbar`);
}

async function translateFromEnglish(definitions, targetLang) {
  const text = definitions.join('; ');
  try {
    // Falls targetLang 'en' ist, brauchen wir nicht eigens übersetzen
    if (targetLang === 'en') return definitions;
    const result = await performTranslation(text, 'en', targetLang);
    return result;
  } catch (e) {
    return [];
  }
}

// ── Satz-Übersetzung ──────────────────────────────────────────────
async function translateSentence(text, sourceLang, targetLanguage) {
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  const target = targetLanguage || 'de';

  if (!apiKey) {
    // Ohne API-Key einfache Übersetzung ohne Word-Breakdown
    const tl = target;
    const sl = sourceLang === 'auto' ? '' : sourceLang;
    try {
      const translated = await performTranslation(text, sl || 'en', tl); // Heuristik falls sl='' in performTranslation
      return { 
        found: true, 
        isSentence: true, 
        originalText: text, 
        translation: typeof translated === 'string' ? translated : translated.join(' '),
        words: []
      };
    } catch(e) {
      return { found: false, error: e.message };
    }
  }

  // Mit OpenAI: Satz aufbrechen und mappen
  const systemPrompt = `Du bist ein Übersetzer. Übersetze den Text natürlich nach "${target}".
Liefere AUSSCHLIESSLICH ein JSON-Objekt.
Format:
{
  "translation": "Der komplette fließend übersetzte Satz",
  "words": [
    {
      "o": "Originalwort",
      "t": "Exakter passender String aus 'translation' (oder leer)",
      "e": "Kurze Bedeutung / Grundform"
    }
  ]
}
Regeln:
- WICHTIG: KEINE Zeichen weglassen! Satzzeichen, Leerzeichen, Klammern wie 「 」, 【 】 müssen in 'o' vorkommen (als eigenes Wort oder angehängt).
- Alle 'o' aneinandergereiht MÜSSEN zu 100% exakt den Quelltext ergeben.
- t: Welcher Teil der Übersetzung gehört dazu? (Muss exakt als Substring in "translation" vorkommen, sonst leer)
- e: Ganz kurze Wort-Erklärung (max 3 Wörter).`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: text }
  ];

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  if (!r.ok) {
    const errBody = await r.text().catch(() => '');
    throw new Error(`OpenAI-Fehler ${r.status}: ${errBody.slice(0, 120)}`);
  }

  const d = await r.json();
  const answer = d.choices?.[0]?.message?.content?.trim();
  
  if (!answer) throw new Error("Keine Antwort von OpenAI");
  
  try {
    const json = JSON.parse(answer);
    return {
      found: true,
      isSentence: true,
      originalText: text,
      translation: json.translation,
      words: json.words || []
    };
  } catch (e) {
    throw new Error("Fehler beim Parsen des KI-Ergebnisses");
  }
}

// ── KI-Chat ───────────────────────────────────────────────────────
async function askAI(word, meaning, history) {
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  if (!apiKey) throw new Error('Kein OpenAI-Key gespeichert (Optionen öffnen)');

  const systemPrompt =
    `Du bist ein präziser Japanisch-Lehrer. Der Nutzer schaut sich gerade das Wort ` +
    `"${word}" an. Bekannte Bedeutung: "${meaning}". ` +
    `Antworte immer auf Deutsch, kurz und klar (max. 3 Sätze).`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history ?? []),
  ];

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:      'gpt-4o-mini',
      messages,
      max_tokens: 350,
    }),
  });

  if (!r.ok) {
    const errBody = await r.text().catch(() => '');
    throw new Error(`OpenAI-Fehler ${r.status}: ${errBody.slice(0, 120)}`);
  }

  const d = await r.json();
  const answer = d.choices?.[0]?.message?.content?.trim() ?? '⚠ Keine Antwort';
  return { answer };
}

// ── Hilfsfunktionen ───────────────────────────────────────────────
function shortenPOS(pos) {
  // Kürzt lange Wortart-Bezeichnungen (Jisho gibt sehr lange englische Strings)
  const map = {
    'Noun':                       'Nomen',
    'Suru verb':                  'Suru-Verb',
    'Ichidan verb':               'Ichidan-Verb',
    'Godan verb':                 'Godan-Verb',
    'I-adjective':                'i-Adjektiv',
    'Na-adjective':               'na-Adjektiv',
    'Adverb':                     'Adverb',
    'Particle':                   'Partikel',
    'Expression':                 'Ausdruck',
    'Interjection':               'Interjektion',
    'Pronoun':                    'Pronomen',
    'Conjunction':                'Konjunktion',
    'Numeric':                    'Zahl',
    'Counter':                    'Zählwort',
    'Prefix':                     'Präfix',
    'Suffix':                     'Suffix',
  };
  for (const [en, de] of Object.entries(map)) {
    if (pos.includes(en)) return de;
  }
  return pos.split(' ').slice(0, 3).join(' ');
}
