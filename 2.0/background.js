/* background.js — JPN-DE Hover Dictionary v2.0
 *
 * Nachrichten-Typen:
 *   { type: 'lookup', word }  → Dictionary-Daten
 *   { type: 'chat', word, meaning, history } → KI-Antwort
 */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'lookup') {
    lookupWord(msg.word)
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
});

// ── Wörterbuch-Abfrage ─────────────────────────────────────────────
async function lookupWord(word) {
  const url = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Jisho antwortet nicht (${res.status})`);

  const json    = await res.json();
  const entries = json?.data;
  if (!entries?.length) return { found: false };

  const entry   = entries[0];
  const jpEntry = entry.japanese?.[0] ?? {};
  const senses  = entry.senses  ?? [];

  const wordText = jpEntry.word    ?? word;
  const kana     = jpEntry.reading ?? jpEntry.word ?? word;

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

  // Deutsche Übersetzung
  const german = english.length ? await translateToGerman(english.slice(0, 3)) : [];

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

// ── Englisch → Deutsch ────────────────────────────────────────────
async function translateToGerman(definitions) {
  const text = definitions.join('; ');

  // 1. DeepL (falls API-Key vorhanden)
  const { deeplKey } = await chrome.storage.sync.get('deeplKey');
  if (deeplKey) {
    try {
      const body = new URLSearchParams({
        auth_key:    deeplKey,
        text,
        source_lang: 'EN',
        target_lang: 'DE',
      });
      const r = await fetch('https://api-free.deepl.com/v2/translate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
      });
      if (r.ok) {
        const d  = await r.json();
        const t  = d.translations?.[0]?.text ?? '';
        if (t) return t.split(';').map(s => s.trim()).filter(Boolean);
      }
    } catch { /* fällt durch */ }
  }

  // 2. Fallback: MyMemory (kostenlos, ~5000 Zeichen/Tag)
  try {
    const r = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|de`
    );
    if (r.ok) {
      const d = await r.json();
      const t = d.responseData?.translatedText ?? '';
      if (t && d.responseStatus === 200) {
        return t.split(/[;,]/).map(s => s.trim()).filter(Boolean);
      }
    }
  } catch { /* fällt durch */ }

  return []; // kein Ergebnis → UI zeigt Englisch als Fallback
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
