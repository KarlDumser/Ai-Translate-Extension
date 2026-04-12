/* content.js — JPN-DE/EN Hover Dictionary v2.0
 * Hover über Wörter → Kana + Bedeutung + KI-Chat
 * Unterstützt Japanisch, Deutsch, Englisch
 */
(() => {
  'use strict';

  // ── I18n Meldungen ─────────────────────────────────────────────
  const i18n = {
    de: {
      searching: '⏳ Wird gesucht…',
      notFound: 'Kein Wörterbuch-Eintrag gefunden.',
      meaning: '🇩🇪 Bedeutung',
      meaningEn: '🇬🇧 Bedeutung (EN)',
      example: 'Beispiel',
      ask: 'Frag die KI zu diesem Wort…',
      reload: 'ℹ Erweiterung wurde neu geladen. Bitte Seite neu laden.',
      connectionError: '⛔ Verbindungsfehler',
      close: 'Schließen',
      send: '→',
      you: 'Du',
      ai: 'KI',
    },
    en: {
      searching: '⏳ Searching…',
      notFound: 'No dictionary entry found.',
      meaning: '🇬🇧 Meaning',
      meaningEn: '🇬🇧 Meaning (EN)',
      example: 'Example',
      ask: 'Ask AI about this word…',
      reload: 'ℹ Extension reloaded. Please reload the page.',
      connectionError: '⛔ Connection error',
      close: 'Close',
      send: '→',
      you: 'You',
      ai: 'AI',
    },
    ja: {
      searching: '⏳ 検索中…',
      notFound: '辞書エントリが見つかりません.',
      meaning: '🇯🇵 意味',
      meaningEn: '🇬🇧 意味 (EN)',
      example: '例',
      ask: 'このワードについてAIに質問…',
      reload: 'ℹ 拡張機能がリロードされました。ページを再読み込みしてください。',
      connectionError: '⛔ 接続エラー',
      close: '閉じる',
      send: '→',
      you: 'あなた',
      ai: 'AI',
    },
  };

  let displayLanguage = 'en';
  let sourceLanguage = 'en';
  let extensionEnabled = true;

  async function loadSettings() {
    try {
      const settings = await chrome.storage.sync.get({
        displayLanguage: 'en',
        sourceLanguage: 'en',
        extensionEnabled: true,
      });
      if (settings.displayLanguage) displayLanguage = settings.displayLanguage;
      if (settings.sourceLanguage) sourceLanguage = settings.sourceLanguage;
      extensionEnabled = settings.extensionEnabled !== false;
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  }

  function t(key) {
    return (i18n[displayLanguage] || i18n.de)[key] || key;
  }

  // ── Konfiguration ──────────────────────────────────────────────
  const CARD_WIDTH   = 360;
  const DEBOUNCE_MS  = 380;
  const CLOSE_DELAY  = 700;

  // ── Zustands-Variablen ─────────────────────────────────────────
  let currentWord  = null;
  let currentHoverKey = null;
  let card         = null;
  let hoverTimer   = null;
  let closeTimer   = null;
  let cardHovered  = false;
  let lastX = 0, lastY = 0;
  let chatHistory  = [];   // pro Wort neu
  let extensionContextDead = false;

  // Settings laden beim Start (ohne zu warten - async)
  void loadSettings();

  // ── CSS Custom Highlight API (Chrome 105+) ─────────────────────
  const HIGHLIGHT_NAME = 'jpde-hover';
  const supportsHL = typeof CSS !== 'undefined' && CSS.highlights;

  if (supportsHL) {
    const s = document.createElement('style');
    s.textContent = `::highlight(${HIGHLIGHT_NAME}) {
      background-color: rgba(203, 166, 247, 0.25);
      border-radius: 2px;
    }`;
    (document.head || document.documentElement).appendChild(s);
  }

  // ── Haupt-Listener ─────────────────────────────────────────────
  document.addEventListener('mousemove', e => {
    if (extensionContextDead) return;
    if (!extensionEnabled) return;
    if (card && card.contains(e.target)) return;
    lastX = e.clientX;
    lastY = e.clientY;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      void processHover(e.clientX, e.clientY);
    }, DEBOUNCE_MS);
  });

  document.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimer);
    scheduleClose();
  });

  // ── Hover verarbeiten ──────────────────────────────────────────
  async function processHover(x, y) {
    try {
      if (extensionContextDead) return;
      if (!extensionEnabled) return;
      const hit = getWordAtPoint(x, y);
      if (!hit) { scheduleClose(); return; }

      const { word, range, focusIndex, scriptType } = hit;
      const hoverKey = `${word}:${focusIndex}`;
      if (hoverKey === currentHoverKey) return;

      cancelClose();
      currentWord = word;
      currentHoverKey = hoverKey;
      chatHistory  = [];

      applyHighlight(range);
      openCard(x, y, word);

      const data = await sendRuntimeMessage({ type: 'lookup', word, focusIndex, scriptType });
      fillCard(data);
    } catch (err) {
      if (isContextInvalidatedError(err)) {
        handleInvalidatedContext();
        return;
      }
      fillCard({ error: err?.message || String(err) });
    }
  }

  // ── Wort am Cursor ermitteln ────────────────────────────────────
  function getWordAtPoint(x, y) {
    let caretRange = null;
    if (document.caretRangeFromPoint) {
      caretRange = document.caretRangeFromPoint(x, y);
    }
    if (!caretRange) return null;

    const node = caretRange.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return null;

    const text   = node.textContent;
    const rawOff = caretRange.startOffset;

    // ZUERST: Immer Japanisch versuchen (unabhängig von sourceLanguage)
    let center = -1;
    if (rawOff < text.length && isJapaneseCh(text[rawOff])) {
      center = rawOff;
    } else if (rawOff > 0 && isJapaneseCh(text[rawOff - 1])) {
      center = rawOff - 1;
    }

    if (center >= 0) {
      // Japanisch erkannt!
      const type = scriptOf(text[center]);
      let start = center;
      let end   = center + 1;
      while (start > 0 && scriptOf(text[start - 1]) === type) start--;
      while (end < text.length && scriptOf(text[end]) === type) end++;

      // Einzelnes Kanji: Hiragana-Okurigana anhängen
      if (type === 'kanji' && (end - start) === 1) {
        let n = 0;
        while (end < text.length && scriptOf(text[end]) === 'hiragana' && n < 4) {
          end++;
          n++;
        }
      }

      const word = text.slice(start, end).trim();
      if (word) {
        const r = document.createRange();
        r.setStart(node, start);
        r.setEnd(node, end);
        return { word, range: r, focusIndex: center - start, scriptType: type };
      }
    }

    // FALLBACK: Deutsch/Englisch-Modus (nur für Latin-Text)
    if (sourceLanguage === 'de' || sourceLanguage === 'en') {
      let latinCenter = rawOff;
      if (latinCenter > 0 && !isWordChar(text[latinCenter]) && isWordChar(text[latinCenter - 1])) {
        latinCenter = rawOff - 1;
      }
      if (!isWordChar(text[latinCenter])) return null;

      let start = latinCenter;
      let end = latinCenter + 1;
      while (start > 0 && isWordChar(text[start - 1])) start--;
      while (end < text.length && isWordChar(text[end])) end++;

      const word = text.slice(start, end).toLowerCase().trim();
      if (!word || word.length < 2) return null;

      const r = document.createRange();
      r.setStart(node, start);
      r.setEnd(node, end);
      return { word, range: r, focusIndex: latinCenter - start, scriptType: 'latin' };
    }

    return null;
  }

  function isWordChar(c) {
    if (!c) return false;
    const code = c.charCodeAt(0);
    // a-z, A-Z, 0-9, Umlaute (äöüÄÖÜß), Bindestrich, Apostroph
    return (code >= 97 && code <= 122) ||   // a-z
           (code >= 65 && code <= 90) ||    // A-Z
           (code >= 48 && code <= 57) ||    // 0-9
           (code === 45) ||                 // -
           (code === 39) ||                 // '
           (code >= 192 && code <= 255);    // Accented chars (ä, ö, ü, etc.)
  }

  function scriptOf(c) {
    if (!c) return 'none';
    const code = c.charCodeAt(0);
    if (code === 0x30fb || code === 0xff65) return 'none';
    if (code === 0x30fc) return 'katakana';
    if ((code >= 0x4e00 && code <= 0x9faf) ||
        (code >= 0x3400 && code <= 0x4dbf)) return 'kanji';
    if (code >= 0x3040 && code <= 0x309f)  return 'hiragana';
    if ((code >= 0x30a0 && code <= 0x30ff) ||
      (code >= 0xff66 && code <= 0xff9f)) return 'katakana';
    return 'none';
  }

  function isJapaneseCh(c) { return scriptOf(c) !== 'none'; }

  // ── Highlight ──────────────────────────────────────────────────
  function applyHighlight(range) {
    if (!supportsHL) return;
    CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range));
  }
  function clearHighlight() {
    if (!supportsHL) return;
    CSS.highlights.delete(HIGHLIGHT_NAME);
  }

  // ── Karte öffnen ──────────────────────────────────────────────
  function openCard(x, y, word) {
    closeCard();

    card = document.createElement('div');
    card.setAttribute('style', [
      'all:initial',
      'position:fixed',
      `width:${CARD_WIDTH}px`,
      'background:#1e1e2e',
      'color:#cdd6f4',
      'font-family:"Noto Sans JP","Yu Gothic","Hiragino Sans",Arial,sans-serif',
      'font-size:14px',
      'line-height:1.5',
      'border-radius:12px',
      'box-shadow:0 12px 40px rgba(0,0,0,0.55)',
      'border:1px solid #45475a',
      'z-index:2147483647',
      'overflow:hidden',
      'opacity:0',
      'transition:opacity 0.15s ease',
    ].join(';'));

    card.innerHTML = buildShellHTML();
    document.body.appendChild(card);
    positionCard(x, y);
    requestAnimationFrame(() => { if (card) card.style.opacity = '1'; });

    card.addEventListener('mouseenter', () => { cardHovered = true;  cancelClose(); });
    card.addEventListener('mouseleave', () => { cardHovered = false; scheduleClose(); });
    card.querySelector('#jpde-close').addEventListener('click', forceClose);

    const input = card.querySelector('#jpde-input');
    const btn   = card.querySelector('#jpde-send');
    const doSend = () => sendChat(input, word);
    btn.addEventListener('click', doSend);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
  }

  function buildShellHTML() {
    return `
      <div style="padding:12px 14px 10px;border-bottom:1px solid #313244;
                  display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span id="jpde-word" style="font-size:24px;font-weight:700;color:#cba6f7;
                     letter-spacing:0.05em;opacity:0.75;">…</span>
        <button id="jpde-close" style="all:unset;cursor:pointer;color:#585b70;
                font-size:18px;padding:2px 7px;border-radius:6px;
                transition:color 0.1s;" title="${escHtml(t('close'))}">${escHtml(t('close'))}</button>
      </div>
      <div id="jpde-body" style="padding:12px 14px 8px;min-height:60px;">
        <div style="color:#585b70;text-align:center;padding:14px 0;">
          ${escHtml(t('searching'))}
        </div>
      </div>
      <div style="border-top:1px solid #313244;padding:8px 14px 10px;">
        <div id="jpde-chat-log" style="max-height:130px;overflow-y:auto;
             font-size:13px;margin-bottom:7px;"></div>
        <div style="display:flex;gap:6px;align-items:center;">
          <input id="jpde-input" type="text" placeholder="${escHtml(t('ask'))}"
            style="all:unset;flex:1;background:#313244;color:#cdd6f4;
                   border:1px solid #45475a;border-radius:7px;
                   padding:6px 10px;font-size:13px;font-family:inherit;" />
          <button id="jpde-send"
            style="all:unset;cursor:pointer;background:#cba6f7;color:#1e1e2e;
                   border-radius:7px;padding:6px 12px;font-size:13px;
                   font-weight:700;white-space:nowrap;">${escHtml(t('send'))}</button>
        </div>
      </div>
    `;
  }

  // ── Karten-Inhalt befüllen ─────────────────────────────────────
  function fillCard(data) {
    if (!card) return;
    const body = card.querySelector('#jpde-body');
    const title = card.querySelector('#jpde-word');
    if (!body) return;

    if (title && data.word) {
      title.textContent = data.word;
      title.style.opacity = '1';
    }

    if (data.error) {
      body.innerHTML = `<div style="color:#f38ba8;">⛔ ${escHtml(data.error)}</div>`;
      return;
    }
    if (!data.found) {
      body.innerHTML = `<div style="color:#585b70;">${escHtml(t('notFound'))}</div>`;
      return;
    }

    let html = '';

    // Für Japanisch (Jisho-Format)
    if (data.kana) {
      // Kana anzeigen (aber nicht das Wort nochmal - das ist bereits im Title)
      if (data.kana && data.kana !== data.word) {
        html += `
          <div style="margin-bottom:8px;">
            <div style="font-size:16px;color:#89b4fa;letter-spacing:0.08em;">${escHtml(data.kana)}</div>
          </div>`;
      }
      
      if (data.romaji) {
        html += `<div style="font-size:12px;color:#6c7086;margin-bottom:8px;">
                   ${escHtml(data.romaji)}</div>`;
      }
      if (data.tags?.length) {
        html += `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">
          ${data.tags.map(t => `
            <span style="background:#313244;color:#a6e3a1;border-radius:5px;
                         padding:1px 7px;font-size:11px;">${escHtml(t)}</span>
          `).join('')}
        </div>`;
      }
      if (data.german?.length) {
        html += `
          <div style="margin-bottom:8px;">
            <div style="font-size:11px;color:#585b70;text-transform:uppercase;
                        letter-spacing:0.6px;margin-bottom:4px;">${escHtml(t('meaning'))}</div>
            ${data.german.slice(0, 4).map((m, i) =>
              `<div id="${i === 0 ? 'jpde-meaning' : ''}"
                    style="color:${i === 0 ? '#cdd6f4' : '#a6adc8'};
                           padding-left:${i > 0 ? '10px' : '0'};
                           font-size:${i === 0 ? '15px' : '14px'};">
                 ${i > 0 ? '• ' : ''}${escHtml(m)}
               </div>`
            ).join('')}
          </div>`;
      } else if (data.english?.length) {
        html += `
          <div style="margin-bottom:8px;">
            <div style="font-size:11px;color:#585b70;text-transform:uppercase;
                        letter-spacing:0.6px;margin-bottom:4px;">${escHtml(t('meaningEn'))}</div>
            ${data.english.slice(0, 3).map((m, i) =>
              `<div id="${i === 0 ? 'jpde-meaning' : ''}"
                    style="color:${i === 0 ? '#cdd6f4' : '#a6adc8'};
                           padding-left:${i > 0 ? '10px' : '0'};">
                 ${i > 0 ? '• ' : ''}${escHtml(m)}
               </div>`
            ).join('')}
          </div>`;
      }
      if (data.example) {
        html += `
          <div style="border-top:1px solid #313244;padding-top:8px;margin-top:4px;
                      font-size:12px;">
            <div style="color:#585b70;font-size:11px;margin-bottom:3px;
                        text-transform:uppercase;letter-spacing:0.6px;">${escHtml(t('example'))}</div>
            <div style="color:#89dceb;">${escHtml(data.example.jp)}</div>
            <div style="color:#a6adc8;">${escHtml(data.example.de || data.example.en)}</div>
          </div>`;
      }
    }
    // Für Deutsch/Englisch (Translation-Format)
    else if (data.translations) {
      html += `<div style="margin-bottom:8px;">`;
      
      if (data.translations.en) {
        html += `
          <div style="margin-bottom:8px;">
            <div style="font-size:11px;color:#585b70;text-transform:uppercase;
                        letter-spacing:0.6px;margin-bottom:4px;">🇬🇧 English</div>
            <div id="jpde-meaning" style="color:#cdd6f4;font-size:15px;">
              ${escHtml(Array.isArray(data.translations.en) ? data.translations.en[0] : data.translations.en)}
            </div>
          </div>`;
      }
      
      if (data.translations.de) {
        html += `
          <div style="margin-bottom:8px;">
            <div style="font-size:11px;color:#585b70;text-transform:uppercase;
                        letter-spacing:0.6px;margin-bottom:4px;">🇩🇪 Deutsch</div>
            <div style="color:#cdd6f4;font-size:15px;">
              ${escHtml(Array.isArray(data.translations.de) ? data.translations.de[0] : data.translations.de)}
            </div>
          </div>`;
      }
      
      if (data.translations.ja) {
        html += `
          <div>
            <div style="font-size:11px;color:#585b70;text-transform:uppercase;
                        letter-spacing:0.6px;margin-bottom:4px;">🇯🇵 日本語</div>
            <div style="color:#cdd6f4;font-size:15px;">
              ${escHtml(Array.isArray(data.translations.ja) ? data.translations.ja[0] : data.translations.ja)}
            </div>
          </div>`;
      }
      
      html += `</div>`;
    }

    body.innerHTML = html;
  }

  // ── Chat ───────────────────────────────────────────────────────
  function sendChat(input, word) {
    const question = input.value.trim();
    if (!question) return;
    input.value = '';

    const meaning = card?.querySelector('#jpde-meaning')?.textContent || '';
    appendChatMsg(t('you'), question, '#cba6f7');
    chatHistory.push({ role: 'user', content: question });

    sendRuntimeMessage({
      type: 'chat',
      word,
      meaning,
      history: chatHistory,
    }).then(res => {
      chatHistory.push({ role: 'assistant', content: res.answer });
      appendChatMsg(t('ai'), res.answer, '#a6e3a1');
    }).catch(err => {
      if (isContextInvalidatedError(err)) {
        handleInvalidatedContext();
        return;
      }
      appendChatMsg(t('ai'), t('connectionError'), '#f38ba8');
    });
  }

  function appendChatMsg(sender, text, color) {
    if (!card) return;
    const log = card.querySelector('#jpde-chat-log');
    if (!log) return;
    const el = document.createElement('div');
    el.style.cssText = 'margin-bottom:5px;line-height:1.4;';
    el.innerHTML = `<span style="color:${color};font-weight:600;">${escHtml(sender)}:</span> ${escHtml(text)}`;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  // ── Karte positionieren ────────────────────────────────────────
  function positionCard(x, y) {
    if (!card) return;
    const GAP = 12;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    requestAnimationFrame(() => {
      if (!card) return;
      const h = card.offsetHeight || 220;
      let left = x + 16;
      let top  = y + 16;
      if (left + CARD_WIDTH + GAP > vw) left = x - CARD_WIDTH - 10;
      if (top  + h + GAP        > vh) top  = y - h - 10;
      card.style.left = `${Math.max(GAP, left)}px`;
      card.style.top  = `${Math.max(GAP, top)}px`;
    });
  }

  // ── Close-Logik ────────────────────────────────────────────────
  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { if (!cardHovered) closeCard(); }, CLOSE_DELAY);
  }
  function cancelClose()  { clearTimeout(closeTimer); }
  function forceClose()   { cancelClose(); closeCard(); }

  function closeCard() {
    if (card) { card.remove(); card = null; }
    clearHighlight();
    currentWord  = null;
    currentHoverKey = null;
    chatHistory  = [];
  }

  // ── Hilfsfunktionen ────────────────────────────────────────────
  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function sendRuntimeMessage(message) {
    if (!isExtensionContextValid()) {
      return Promise.reject(new Error('Extension context invalidated'));
    }
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, response => {
          try {
            const lastError = chrome.runtime?.lastError;
            if (lastError) {
              reject(new Error(lastError.message || 'Runtime message failed'));
              return;
            }
            resolve(response);
          } catch (callbackErr) {
            reject(callbackErr);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  function isExtensionContextValid() {
    try {
      return typeof chrome !== 'undefined' && !!(chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  function isContextInvalidatedError(err) {
    const msg = String(err?.message || err || '').toLowerCase();
    return msg.includes('extension context invalidated') ||
           msg.includes('context invalidated') ||
           msg.includes('receiving end does not exist');
  }

  function handleInvalidatedContext() {
    extensionContextDead = true;
    clearTimeout(hoverTimer);
    clearTimeout(closeTimer);
    clearHighlight();
    if (card) {
      const body = card.querySelector('#jpde-body');
      if (body) {
        body.innerHTML = `<div style="color:#f9e2af;">${escHtml(t('reload'))}</div>`;
      }
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;

    if (changes.displayLanguage) {
      displayLanguage = changes.displayLanguage.newValue || displayLanguage;
    }

    if (changes.sourceLanguage) {
      sourceLanguage = changes.sourceLanguage.newValue || sourceLanguage;
    }

    if (changes.extensionEnabled) {
      extensionEnabled = changes.extensionEnabled.newValue !== false;
      if (!extensionEnabled) {
        clearTimeout(hoverTimer);
        clearTimeout(closeTimer);
        closeCard();
      }
    }
  });

})();
