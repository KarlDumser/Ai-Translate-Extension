/* popup.js — JPN-DE Hover Dictionary v2.0 */
(async () => {
  const keyStatus = document.getElementById('key-status');
  const optBtn    = document.getElementById('options-btn');
  const toggleBtn = document.getElementById('toggle-btn');
  const switchState = document.getElementById('switch-state');

  function renderEnabledState(enabled) {
    if (!switchState || !toggleBtn) return;
    switchState.textContent = enabled ? 'Status: Aktiv' : 'Status: Deaktiviert';
    switchState.style.color = enabled ? '#a6e3a1' : '#f9e2af';
    toggleBtn.textContent = enabled ? 'Deaktivieren' : 'Aktivieren';
  }

  // Status der gespeicherten Keys anzeigen
  const { apiKey, deeplKey } = await chrome.storage.sync.get(['apiKey', 'deeplKey']);

  const parts = [];
  if (apiKey)   parts.push('✓ OpenAI');
  else          parts.push('✗ OpenAI (kein Key)');
  if (deeplKey) parts.push('✓ DeepL');
  else          parts.push('~ DeepL (MyMemory-Fallback)');

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

  optBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
})();
