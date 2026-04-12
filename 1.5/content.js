/* content.js – Version 7
 * Mini-Panel: nur 4 px Abstand oben/unten, kein Leerraum darunter.
 */
(() => {
  const GAP = 8, BTN = 28, W = 320;
  let bubble = null, panel = null;

  /*── Markierung erkannt ────────────────────────────────────────*/
  document.addEventListener("mouseup", () => {
    const sel = window.getSelection();
    if (!sel || sel.toString().trim() === "") { removeBubble(); return; }

    const r = sel.getRangeAt(0).getBoundingClientRect();
    const xB = clamp(r.left + r.width/2 - BTN/2, GAP, innerWidth - BTN - GAP);
    const above = r.top - BTN - GAP >= 0;
    const yB = above ? r.top - BTN - GAP : r.bottom + GAP;

    showBubble(xB, yB, sel.toString(), r, above);
  });

  /*── Button ────────────────────────────────────────────────────*/
  function showBubble(x, y, text, rect, above) {
    removeBubble();
    bubble = Object.assign(document.createElement("button"), {
      textContent: "🌐",
      style: `
        all:unset; position:fixed; left:${x}px; top:${y}px;
        width:${BTN}px; height:${BTN}px; border-radius:50%;
        background:#2196f3; color:#fff; font-size:16px; line-height:${BTN-2}px;
        text-align:center; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,.3);
        z-index:2147483647;
      `
    });
    bubble.onmousedown = e => {
      e.stopPropagation();
      window.getSelection().removeAllRanges();
      openPanel(rect, above, text);
      removeBubble();
    };
    document.body.appendChild(bubble);
  }

  /*── Panel ─────────────────────────────────────────────────────*/
  function openPanel(selRect, btnAbove, srcText) {
    closePanel();

    panel = document.createElement("div");
    panel.style = `
      position:fixed; width:${W}px;
      background:#fff; color:#111; font:16px/1.35 Arial,Helvetica,sans-serif;
      border:1px solid #ddd; border-radius:3px;
      box-shadow:0 4px 12px rgba(0,0,0,.25); z-index:2147483647;
      padding:4px 8px; white-space:pre-line;
    `;
    panel.innerHTML = `
      <div id="result" style="font-size:18px;margin:0;">⏳</div>
      <button id="x" style="
        all:unset; cursor:pointer; font-size:16px;
        position:absolute; top:3px; right:6px;">✕</button>
    `;
    document.body.appendChild(panel);

    /* Positionieren */
    const h   = panel.offsetHeight;
    const xP  = clamp(selRect.left + selRect.width/2 - W/2, GAP, innerWidth - W - GAP);
    const yP  = btnAbove ? selRect.bottom + GAP : selRect.top - h - GAP;
    panel.style.left = `${xP}px`;
    panel.style.top  = `${clamp(yP, GAP, innerHeight - h - GAP)}px`;

    panel.querySelector("#x").onclick = closePanel;

    /* Übersetzung holen */
    chrome.runtime.sendMessage({ selectedText: srcText })
      .then(({ translation }) =>
        panel.querySelector("#result").textContent = translation.trim()
      );
  }

  /*── Helpers ───────────────────────────────────────────────────*/
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const removeBubble = () => { if (bubble) { bubble.remove(); bubble = null; } };
  const closePanel   = () => { if (panel)  { panel.remove();  panel = null; } };
  document.addEventListener("mousedown", e => panel && !panel.contains(e.target) && closePanel());
  document.addEventListener("keyup",     e => e.key === "Escape" && closePanel());
})();
