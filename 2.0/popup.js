/* popup.js — JPN-DE Hover Dictionary v2.0 */
(async () => {
  const keyStatus = document.getElementById('key-status');
  const optBtn    = document.getElementById('options-btn');

  // Status der gespeicherten Keys anzeigen
  const { apiKey, deeplKey } = await chrome.storage.sync.get(['apiKey', 'deeplKey']);

  const parts = [];
  if (apiKey)   parts.push('✓ OpenAI');
  else          parts.push('✗ OpenAI (kein Key)');
  if (deeplKey) parts.push('✓ DeepL');
  else          parts.push('~ DeepL (MyMemory-Fallback)');

  keyStatus.textContent = parts.join(' · ');
  keyStatus.style.color = apiKey ? '#a6e3a1' : '#f38ba8';

  optBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
})();
