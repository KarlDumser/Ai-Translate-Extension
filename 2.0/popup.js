/* popup.js — JPN-DE Hover Dictionary v2.0 */
(async () => {
  const i18n = {
    de: {
      title: 'JPN-DE Hover Dictionary',
      subtitle: 'Hover einfach über ein japanisches Wort auf einer beliebigen Webseite.',
      tip: '💡 Die Karte erscheint automatisch — kein Klicken nötig!',
      keysLoading: 'Prüfe API-Keys…',
      openaiMissing: '✗ OpenAI (kein Key)',
      deeplFallback: '~ DeepL (MyMemory-Fallback)',
      shortcutHint: 'Shortcut Toggle: Ctrl+Shift+Y / Mac: Cmd+Shift+Y',
      statusOn: 'Status: Aktiv',
      statusOff: 'Status: Deaktiviert',
      disable: 'Deaktivieren',
      enable: 'Aktivieren',
      openSettings: '⚙ Einstellungen öffnen',
    },
    en: {
      title: 'JPN-DE Hover Dictionary',
      subtitle: 'Hover over a Japanese word on any website.',
      tip: '💡 The card appears automatically — no click needed!',
      keysLoading: 'Checking API keys…',
      openaiMissing: '✗ OpenAI (no key)',
      deeplFallback: '~ DeepL (MyMemory fallback)',
      shortcutHint: 'Shortcut toggle: Ctrl+Shift+Y / Mac: Cmd+Shift+Y',
      statusOn: 'Status: Enabled',
      statusOff: 'Status: Disabled',
      disable: 'Disable',
      enable: 'Enable',
      openSettings: '⚙ Open settings',
    },
    ja: {
      title: 'JPN-DE Hover Dictionary',
      subtitle: '任意のWebサイトで日本語の単語にホバーしてください。',
      tip: '💡 カードは自動表示されます。クリック不要です。',
      keysLoading: 'APIキーを確認中…',
      openaiMissing: '✗ OpenAI (キーなし)',
      deeplFallback: '~ DeepL (MyMemoryフォールバック)',
      shortcutHint: 'ショートカット切替: Ctrl+Shift+Y / Mac: Cmd+Shift+Y',
      statusOn: '状態: 有効',
      statusOff: '状態: 無効',
      disable: '無効化',
      enable: '有効化',
      openSettings: '⚙ 設定を開く',
    },
  };

  const titleEl = document.getElementById('title');
  const subtitleEl = document.getElementById('subtitle');
  const tipEl = document.getElementById('tip-text');
  const keyStatus = document.getElementById('key-status');
  const shortcutHint = document.getElementById('shortcut-hint');
  const optBtn = document.getElementById('options-btn');
  const toggleBtn = document.getElementById('toggle-btn');
  const switchState = document.getElementById('switch-state');

  const { displayLanguage = 'en' } = await chrome.storage.sync.get({ displayLanguage: 'en' });
  const lang = i18n[displayLanguage] ? displayLanguage : 'en';
  const t = key => i18n[lang][key] || i18n.en[key] || key;

  if (titleEl) titleEl.textContent = t('title');
  if (subtitleEl) subtitleEl.textContent = t('subtitle');
  if (tipEl) tipEl.textContent = t('tip');
  if (shortcutHint) shortcutHint.textContent = t('shortcutHint');
  if (optBtn) optBtn.textContent = t('openSettings');
  if (keyStatus) keyStatus.textContent = t('keysLoading');

  function renderEnabledState(enabled) {
    if (!switchState || !toggleBtn) return;
    switchState.textContent = enabled ? t('statusOn') : t('statusOff');
    switchState.style.color = enabled ? '#a6e3a1' : '#f9e2af';
    toggleBtn.textContent = enabled ? t('disable') : t('enable');
  }

  // Status der gespeicherten Keys anzeigen
  const { apiKey, deeplKey } = await chrome.storage.sync.get(['apiKey', 'deeplKey']);

  const parts = [];
  if (apiKey) parts.push('✓ OpenAI');
  else parts.push(t('openaiMissing'));
  if (deeplKey) parts.push('✓ DeepL');
  else parts.push(t('deeplFallback'));

  keyStatus.textContent = parts.join(' · ');
  keyStatus.style.color = apiKey ? '#a6e3a1' : '#f38ba8';

  const enabledStored = await chrome.storage.sync.get({ extensionEnabled: true });
  renderEnabledState(enabledStored.extensionEnabled !== false);

  toggleBtn?.addEventListener('click', async () => {
    const current = await chrome.storage.sync.get({ extensionEnabled: true });
    const nextState = !(current.extensionEnabled !== false);
    await chrome.storage.sync.set({ extensionEnabled: nextState });
    renderEnabledState(nextState);
  });

  optBtn?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
})();
