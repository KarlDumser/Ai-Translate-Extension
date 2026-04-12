/* content.js — JPN-DE Hover Dictionary v2.0
 * Hover über japanische Wörter → Kana + deutsche Bedeutung + KI-Chat
 */
(() => {
  'use strict';

  // ── Konfiguration ──────────────────────────────────────────────
  const CARD_WIDTH   = 360;
  const DEBOUNCE_MS  = 380;
  const CLOSE_DELAY  = 700;

  // ── Zustands-Variablen ─────────────────────────────────────────
  let currentWord  = null;
  let card         = null;
  let hoverTimer   = null;
  let closeTimer   = null;
  let cardHovered  = false;
  let lastX = 0, lastY = 0;
  let chatHistory  = [];   // pro Wort neu

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
    if (card && card.contains(e.target)) return;
    lastX = e.clientX;
    lastY = e.clientY;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => processHover(e.clientX, e.clientY), DEBOUNCE_MS);
  });

  document.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimer);
    scheduleClose();
  });

  // ── Hover verarbeiten ──────────────────────────────────────────
  function processHover(x, y) {
    const hit = getWordAtPoint(x, y);
    if (!hit) { scheduleClose(); return; }

    const { word, range } = hit;
    if (word === currentWord) return;

    cancelClose();
    currentWord = word;
    chatHistory  = [];

    applyHighlight(range);
    openCard(x, y, word);

    sendRuntimeMessage({ type: 'lookup', word })
      .then(data => fillCard(data))
      .catch(err => {
        if (isContextInvalidatedError(err)) {
          forceClose();
          return;
        }
        fillCard({ error: err.message });
      });
  }

  // ── Wort am Cursor ermitteln ────────────────────────────────────
  //
  // caretRangeFromPoint liefert eine Position ZWISCHEN zwei Zeichen.
  // Wir prüfen text[rawOff] UND text[rawOff-1] um das Zeichen
  // tatsächlich unter dem Cursor zu finden.
  // Expansion dann NUR innerhalb desselben Schriftsystems:
  //   Kanji / Hiragana / Katakana werden getrennt behandelt.
  // Ergebnis: の wird nie an 閉山中 angehängt.
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

    let center = -1;
    if (rawOff < text.length && isJapaneseCh(text[rawOff])) {
      center = rawOff;
    } else if (rawOff > 0 && isJapaneseCh(text[rawOff - 1])) {
      center = rawOff - 1;
    }
    if (center < 0) return null;

    const type = scriptOf(text[center]);

    let start = center;
    let end   = center + 1;
    while (start > 0 && scriptOf(text[start - 1]) === type) start--;
    while (end < text.length && scriptOf(text[end]) === type) end++;

    // Einzelnes Kanji: Hiragana-Okurigana anhängen (食べる → 食べる, max. 4)
    if (type === 'kanji' && (end - start) === 1) {
      let n = 0;
      while (end < text.length && scriptOf(text[end]) === 'hiragana' && n < 4) {
        end++;
        n++;
      }
    }

    const word = text.slice(start, end).trim();
    if (!word) return null;

    const r = document.createRange();
    r.setStart(node, start);
    r.setEnd(node, end);
    return { word, range: r };
  }

  function scriptOf(c) {
    if (!c) return 'none';
    const code = c.charCodeAt(0);
    if ((code >= 0x4e00 && code <= 0x9faf) ||
        (code >= 0x3400 && code <= 0x4dbf)) return 'kanji';
    if (code >= 0x3040 && code <= 0x309f)  return 'hiragana';
    if ((code >= 0x30a0 && code <= 0x30ff) ||
        (code >= 0xff65 && code <= 0xff9f)) return 'katakana';
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

    card.innerHTML = buildShellHTML(word);
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

  function buildShellHTML(word) {
    return `
      <div style="padding:12px 14px 10px;border-bottom:1px solid #313244;
                  display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span style="font-size:24px;font-weight:700;color:#cba6f7;
                     letter-spacing:0.05em;">${escHtml(word)}</span>
        <button id="jpde-close" style="all:unset;cursor:pointer;color:#585b70;
                font-size:18px;padding:2px 7px;border-radius:6px;
                transition:color 0.1s;" title="Schließen">✕</button>
      </div>
      <div id="jpde-body" style="padding:12px 14px 8px;min-height:60px;">
        <div style="color:#585b70;text-align:center;padding:14px 0;">
          ⏳ Wird gesucht…
        </div>
      </div>
      <div style="border-top:1px solid #313244;padding:8px 14px 10px;">
        <div id="jpde-chat-log" style="max-height:130px;overflow-y:auto;
             font-size:13px;margin-bottom:7px;"></div>
        <div style="display:flex;gap:6px;align-items:center;">
          <input id="jpde-input" type="text" placeholder="Frag die KI zu diesem Wort…"
            style="all:unset;flex:1;background:#313244;color:#cdd6f4;
                   border:1px solid #45475a;border-radius:7px;
                   padding:6px 10px;font-size:13px;font-family:inherit;" />
          <button id="jpde-send"
            style="all:unset;cursor:pointer;background:#cba6f7;color:#1e1e2e;
                   border-radius:7px;padding:6px 12px;font-size:13px;
                   font-weight:700;white-space:nowrap;">→</button>
        </div>
      </div>
    `;
  }

  // ── Karten-Inhalt befüllen ─────────────────────────────────────
  function fillCard(data) {
    if (!card) return;
    const body = card.querySelector('#jpde-body');
    if (!body) return;

    if (data.error) {
      body.innerHTML = `<div style="color:#f38ba8;">⛔ ${escHtml(data.error)}</div>`;
      return;
    }
    if (!data.found) {
      body.innerHTML = `<div style="color:#585b70;">Kein Wörterbuch-Eintrag gefunden.</div>`;
      return;
    }

    let html = '';

    if (data.kana && data.kana !== data.word) {
      html += `<div style="font-size:20px;color:#89b4fa;margin-bottom:2px;
                           letter-spacing:0.08em;">${escHtml(data.kana)}</div>`;
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
                      letter-spacing:0.6px;margin-bottom:4px;">🇩🇪 Bedeutung</div>
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
                      letter-spacing:0.6px;margin-bottom:4px;">🇬🇧 Bedeutung (EN)</div>
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
                      text-transform:uppercase;letter-spacing:0.6px;">Beispiel</div>
          <div style="color:#89dceb;">${escHtml(data.example.jp)}</div>
          <div style="color:#a6adc8;">${escHtml(data.example.de || data.example.en)}</div>
        </div>`;
    }

    body.innerHTML = html;
  }

  // ── Chat ───────────────────────────────────────────────────────
  function sendChat(input, word) {
    const question = input.value.trim();
    if (!question) return;
    input.value = '';

    const meaning = card?.querySelector('#jpde-meaning')?.textContent || '';
    appendChatMsg('Du', question, '#cba6f7');
    chatHistory.push({ role: 'user', content: question });

    sendRuntimeMessage({
      type: 'chat',
      word,
      meaning,
      history: chatHistory,
    }).then(res => {
      chatHistory.push({ role: 'assistant', content: res.answer });
      appendChatMsg('KI', res.answer, '#a6e3a1');
    }).catch(err => {
      if (isContextInvalidatedError(err)) {
        appendChatMsg('KI', 'ℹ Erweiterung wurde neu geladen. Seite neu laden.', '#f9e2af');
        return;
      }
      appendChatMsg('KI', '⛔ Verbindungsfehler', '#f38ba8');
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
    try {
      return Promise.resolve(chrome.runtime.sendMessage(message));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  function isExtensionContextValid() {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  }

  function isContextInvalidatedError(err) {
    const msg = String(err?.message || err || '').toLowerCase();
    return msg.includes('extension context invalidated') ||
           msg.includes('receiving end does not exist');
  }

})();
