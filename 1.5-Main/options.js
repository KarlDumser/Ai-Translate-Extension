// Beim Laden vorhandenen Schlüssel anzeigen (falls vorhanden)
chrome.storage.sync.get("apiKey").then(({ apiKey }) => {
    if (apiKey) document.getElementById("key").value = apiKey;
  });
  
  // Speichern‑Button
  function showMessage(text, ok = true) {
    const el = document.getElementById("msg");
    el.textContent = text;
    el.style.color = ok ? "#4caf50" : "#f44336";
    setTimeout(() => (el.textContent = ""), 3000);
  }
  
  document.getElementById("save").addEventListener("click", async () => {
    const apiKey = document.getElementById("key").value.trim();
  
    if (!/^sk-[a-zA-Z0-9_-]{30,}$/.test(apiKey)) {
      showMessage("Ungültiger Schlüssel", false);
      return;
    }
  
    await chrome.storage.sync.set({ apiKey });
    showMessage("Gespeichert ✔️");
  });