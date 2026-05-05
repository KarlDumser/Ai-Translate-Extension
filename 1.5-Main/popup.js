chrome.storage.local.get("lastTranslation").then(({ lastTranslation }) => {
    document.getElementById("out").textContent = lastTranslation || "–";
  });