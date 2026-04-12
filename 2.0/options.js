/* options.js — JPN-DE/EN Hover Dictionary v2.0 */
(async () => {
  // ── I18n Strings ───────────────────────────────────────────────
  const i18n = {
    de: {
      title: '⚙ JPN-DE/EN Einstellungen',
      modeLabel: 'Übersetzungsmodus',
      modeHint: 'Hover: Sofort beim Überfahren. Select: Wort markieren + Button.',
      modeHover: 'Hover (sofort)',
      modeSelect: 'Select (mit Button)',
      sourceLabel: 'Quellsprache',
      sourceHint: 'Von welcher Sprache möchten Sie übersetzen?',
      sourceAuto: 'Auto-Erkennung (KI)',
      targetLabel: 'Zielsprache',
      targetHint: 'In welche Sprache möchten Sie übersetzen?',
      displayLabel: 'Anzeigesprache (UI-Sprache)',
      displayHint: 'In welcher Sprache soll die Erweiterung angezeigt werden?',
      targetDE: 'Deutsch',
      targetEN: 'English',
      targetJA: '日本語',
      targetFR: 'Français',
      targetES: 'Español',
      targetIT: 'Italiano',
      targetPT: 'Português',
      targetRU: 'Русский',
      targetZH: '中文 (简体)',
      targetKO: '한국어',
      apiLabel: 'OpenAI API-Key (für KI-Chat)',
      apiHint: 'Nur für den Chat-Bereich nötig. Hol dir einen Key auf platform.openai.com',
      deeplLabel: 'DeepL API-Key (optional, bessere Übersetzung)',
      deeplHint: 'Kostenlos bis 500.000 Zeichen/Monat. deepl.com/pro-api\nOhne diesen Key wird MyMemory als Fallback genutzt.',
      save: 'Speichern',
      saved: '✓ Gespeichert',
      savedReload: '✓ Gespeichert. Seite neu laden: F5/Ctrl+R, Mac: Cmd+R',
      reloadNotice: 'Nach Wechsel der Quellsprache die aktuelle Website neu laden: F5 oder Ctrl+R. Auf Macbook: Cmd+R.',
      reportLabel: 'Fehler gefunden? Senden Sie bitte einen Bug-Report.',
      reportButton: 'Bug melden',
      reportSubject: 'Bug Report: JPN-DE/EN Hover Dictionary',
      shortcutInfo: 'Schnell-Toggle: Ctrl+Shift+Y (Macbook: Cmd+Shift+Y). Tastenkombi anpassen unter chrome://extensions/shortcuts',
    },
    en: {
      title: '⚙ JPN-EN Settings',
        modeLabel: 'Translation Mode',
        modeHint: 'Hover: Translate instantly. Select: Mark word + click button.',
        modeHover: 'Hover (instant)',
        modeSelect: 'Select (with button)',
      sourceLabel: 'Language to translate',
      sourceHint: 'Which language do you want to translate from?',
        sourceAuto: 'Auto-Detect (AI)',
        targetLabel: 'Target Language',
        targetHint: 'Which language do you want to translate to?',
      displayLabel: 'Display Language (UI)',
      displayHint: 'In which language should the extension be displayed?',
        targetDE: 'Deutsch',
        targetEN: 'English',
        targetJA: '日本語',
        targetFR: 'Français',
        targetES: 'Español',
        targetIT: 'Italiano',
        targetPT: 'Português',
        targetRU: 'Русский',
        targetZH: '中文 (简体)',
        targetKO: '한국어',
      apiLabel: 'OpenAI API-Key (for AI chat)',
      apiHint: 'Only needed for chat. Get a key at platform.openai.com',
      deeplLabel: 'DeepL API-Key (optional, better translation)',
      deeplHint: 'Free up to 500,000 characters/month. deepl.com/pro-api\nWithout this key, MyMemory is used as fallback.',
      save: 'Save',
      saved: '✓ Saved',
      savedReload: '✓ Saved. Reload the page: F5/Ctrl+R, on Mac: Cmd+R',
      reloadNotice: 'After changing source language, reload the current website: F5 or Ctrl+R. On Macbook: Cmd+R.',
      reportLabel: 'Found a bug? Please send a bug report.',
      reportButton: 'Report a bug',
      reportSubject: 'Bug Report: JPN-DE/EN Hover Dictionary',
      shortcutInfo: 'Quick toggle: Ctrl+Shift+Y (Macbook: Cmd+Shift+Y). You can customize it in chrome://extensions/shortcuts',
    },
    ja: {
      title: '⚙ JPN-EN 設定',
        modeLabel: '翻訳モード',
        modeHint: 'ホバー：ホバーする際に即座に翻訳します。セレクト：単語をマークして+クリックします。',
        modeHover: 'ホバー (即座)',
        modeSelect: 'セレクト (ボタン付き)',
      sourceLabel: '翻訳対象言語',
      sourceHint: 'どの言語から翻訳しますか？',
        sourceAuto: '自動検出 (AI)',
        targetLabel: 'ターゲット言語',
        targetHint: 'どの言語に翻訳したいですか？',
      displayLabel: '表示言語 (UI)',
      displayHint: '拡張機能をどの言語で表示しますか？',
        targetDE: 'Deutsch',
        targetEN: 'English',
        targetJA: '日本語',
        targetFR: 'Français',
        targetES: 'Español',
        targetIT: 'Italiano',
        targetPT: 'Português',
        targetRU: 'Русский',
        targetZH: '中文 (简体)',
        targetKO: '한국어',
      apiLabel: 'OpenAI API-Key (AI チャット用)',
      apiHint: 'チャットのみ必要です。platform.openai.com でキーを取得してください',
      deeplLabel: 'DeepL API-Key (オプション、より良い翻訳)',
      deeplHint: '月あたり50万文字までお得です。deepl.com/pro-api\nこのキーがない場合は MyMemory がフォールバックとして使用されます。',
      save: '保存',
      saved: '✓ 保存しました',
      savedReload: '✓ 保存しました。ページ再読み込み: F5/Ctrl+R、Mac: Cmd+R',
      reloadNotice: '翻訳元言語を変更した後、現在のWebサイトを再読み込みしてください: F5 または Ctrl+R。Macbook は Cmd+R。',
      reportLabel: '不具合を見つけましたか？バグレポートを送信してください。',
      reportButton: 'バグを報告',
      reportSubject: 'Bug Report: JPN-DE/EN Hover Dictionary',
      shortcutInfo: 'クイック切替: Ctrl+Shift+Y (Macbook: Cmd+Shift+Y)。chrome://extensions/shortcuts で変更できます',
    },
  };

  let currentLang = 'en';
  let initialSourceLanguage = 'en';
    let hasOpenAIKey = false;

  const apiInput          = document.getElementById('apiKey');
  const deeplInput        = document.getElementById('deeplKey');
  const sourceLanguage    = document.getElementById('sourceLanguage');
    const translationMode   = document.getElementById('translationMode');
    const targetLanguage    = document.getElementById('targetLanguage');
  const displayLanguage   = document.getElementById('displayLanguage');
  const reloadNotice      = document.getElementById('reloadNotice');
  const reportBugBtn      = document.getElementById('reportBug');
  const saveBtn           = document.getElementById('save');
  const msg               = document.getElementById('msg');

  function t(key) {
    return (i18n[currentLang] || i18n.en)[key] || key;
  }

  function updateUIText() {
    document.querySelector('h1').textContent = t('title');
    
    const labels = {
      'source-label': t('sourceLabel'),
      'source-hint': t('sourceHint'),
      'mode-label': t('modeLabel'),
      'mode-hint': t('modeHint'),
      'target-label': t('targetLabel'),
      'target-hint': t('targetHint'),
      'display-label': t('displayLabel'),
      'display-hint': t('displayHint'),
      'api-label': t('apiLabel'),
      'api-hint': t('apiHint'),
      'deepl-label': t('deeplLabel'),
      'deepl-hint': t('deeplHint'),
      'report-label': t('reportLabel'),
      'toggle-shortcut-label': t('shortcutInfo'),
    };

    for (const [id, text] of Object.entries(labels)) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    saveBtn.textContent = t('save');
    if (reportBugBtn) reportBugBtn.textContent = t('reportButton');

    if (reloadNotice && reloadNotice.style.display !== 'none') {
      reloadNotice.textContent = t('reloadNotice');
    }
  }

  function showReloadNotice(show) {
    if (!reloadNotice) return;
    if (show) {
      reloadNotice.textContent = t('reloadNotice');
      reloadNotice.style.display = 'block';
    } else {
      reloadNotice.style.display = 'none';
      reloadNotice.textContent = '';
    }
  }

  function buildBugReportMailto() {
    const to = 'karl@dumser.net';
    const subject = t('reportSubject');
    const body = [
      'Please describe the bug:',
      '',
      '- What did you do?',
      '- What happened?',
      '- What did you expect?',
      '',
      'Technical info:',
      `- Source language: ${sourceLanguage.value}`,
      `- Display language: ${displayLanguage.value}`,
      `- User agent: ${navigator.userAgent}`,
      '',
      'Thanks!'
    ].join('\n');

    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  // Gespeicherte Einstellungen laden
  const stored = await chrome.storage.sync.get([
    'apiKey', 
    'deeplKey', 
    'sourceLanguage', 
    'translationMode',
    'targetLanguage',
    'displayLanguage'
  ]);
  
  if (stored.apiKey)          apiInput.value          = stored.apiKey;
  if (stored.deeplKey)        deeplInput.value        = stored.deeplKey;
  if (stored.sourceLanguage)  sourceLanguage.value    = stored.sourceLanguage;
  if (stored.translationMode) translationMode.value   = stored.translationMode;
  if (stored.targetLanguage)  targetLanguage.value    = stored.targetLanguage;
  if (stored.displayLanguage) displayLanguage.value   = stored.displayLanguage;

  // Defaults setzen
  if (!sourceLanguage.value)  sourceLanguage.value  = 'en';
  if (!translationMode.value) translationMode.value = 'hover';
  if (!targetLanguage.value)  targetLanguage.value  = 'de';
  if (!displayLanguage.value) displayLanguage.value = 'en';

  // "Auto-Erkennung" Option nur anzeigen wenn OpenAI API Key
  function updateSourceLanguageOptions() {
    hasOpenAIKey = apiInput.value.trim().length > 0;
    const autoOption = sourceLanguage.querySelector('option[value="auto"]');
    
    if (hasOpenAIKey && !autoOption) {
      const opt = document.createElement('option');
      opt.value = 'auto';
      opt.textContent = t('sourceAuto');
      sourceLanguage.appendChild(opt);
    } else if (!hasOpenAIKey && autoOption) {
      autoOption.remove();
    }
  }

  initialSourceLanguage = sourceLanguage.value;
  
  currentLang = displayLanguage.value;
  updateUIText();
  showReloadNotice(false);
  updateSourceLanguageOptions();

  // Event-Listener für Anzeigesprache-Änderung
  displayLanguage.addEventListener('change', () => {
    currentLang = displayLanguage.value;
    updateUIText();
  });

  sourceLanguage.addEventListener('change', () => {
    showReloadNotice(sourceLanguage.value !== initialSourceLanguage);
  });

  apiInput.addEventListener('change', () => {
    updateSourceLanguageOptions();
  });

  if (reportBugBtn) {
    reportBugBtn.addEventListener('click', () => {
      window.location.href = buildBugReportMailto();
    });
  }

  saveBtn.addEventListener('click', async () => {
    const apiKey          = apiInput.value.trim();
    const deeplKey        = deeplInput.value.trim();
    const sourceLang      = sourceLanguage.value;
    const mode            = translationMode.value;
    const targetLang      = targetLanguage.value;
    const displayLang     = displayLanguage.value;

    await chrome.storage.sync.set({ 
      apiKey, 
      deeplKey, 
      sourceLanguage: sourceLang,
      translationMode: mode,
      targetLanguage: targetLang,
      displayLanguage: displayLang
    });

    const sourceChanged = sourceLang !== initialSourceLanguage;
    msg.textContent = sourceChanged ? t('savedReload') : t('saved');
    msg.className   = '';
    initialSourceLanguage = sourceLang;
    showReloadNotice(false);
    setTimeout(() => { msg.textContent = ''; }, 2500);
  });
})();
