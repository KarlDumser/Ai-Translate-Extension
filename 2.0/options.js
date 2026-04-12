/* options.js — JPN-DE Hover Dictionary v2.0 */
(async () => {
  const apiInput   = document.getElementById('apiKey');
  const deeplInput = document.getElementById('deeplKey');
  const saveBtn    = document.getElementById('save');
  const msg        = document.getElementById('msg');

  // Gespeicherte Keys laden
  const stored = await chrome.storage.sync.get(['apiKey', 'deeplKey']);
  if (stored.apiKey)   apiInput.value   = stored.apiKey;
  if (stored.deeplKey) deeplInput.value = stored.deeplKey;

  saveBtn.addEventListener('click', async () => {
    const apiKey   = apiInput.value.trim();
    const deeplKey = deeplInput.value.trim();

    await chrome.storage.sync.set({ apiKey, deeplKey });

    msg.textContent = '✓ Gespeichert';
    msg.className   = '';
    setTimeout(() => { msg.textContent = ''; }, 2500);
  });
})();
