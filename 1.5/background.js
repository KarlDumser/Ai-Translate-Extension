/* background.js – liefert Übersetzung zurück */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg.selectedText) return;
  translate(msg.selectedText)
    .then(t => sendResponse({ translation: t }))
    .catch(err => sendResponse({ translation: "⛔︎ " + err.message }));
  return true;
});

async function translate(text) {
  const { apiKey } = await chrome.storage.sync.get("apiKey");
  if (!apiKey)  throw new Error("Kein API-Key hinterlegt (Optionen öffnen)");

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":`Bearer ${apiKey}`
    },
    body:JSON.stringify({
      model:"gpt-3.5-turbo",
      messages:[
        {role:"system",content:"Übersetze ins Deutsche, knapp & korrekt."},
        {role:"user",content:text}
      ]
    })
  });
  if(!r.ok) throw new Error("OpenAI-Fehler "+r.status);
  const data = await r.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "⚠︎ Keine Antwort";
}
