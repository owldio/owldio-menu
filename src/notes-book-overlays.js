const HINT_KEY = "owldio-notes-hint-seen";
const HINT_DURATION = 4200;

function hintSeen() {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    // Storage can be blocked; showing the hint again is the harmless outcome.
    return false;
  }
}

function rememberHint() {
  try {
    window.localStorage.setItem(HINT_KEY, "1");
  } catch {
    // Without storage the hint simply returns next visit.
  }
}

/**
 * The reading room's two overlays: the loading veil that hides a book still
 * being set, and the one-time hint that shows where to tap, as reading apps do
 * on first open.
 */
export function createOverlays(root) {
  const loading = root.querySelector("#notes-loading");
  const hint = root.querySelector("#notes-hint");
  let hintTimer = 0;

  function setReady(ready) {
    root.dataset.ready = ready ? "true" : "false";
    loading?.setAttribute("aria-hidden", ready ? "true" : "false");
  }

  function isReady() {
    return root.dataset.ready === "true";
  }

  function dismissHint() {
    if (!hint || hint.hidden) return false;
    window.clearTimeout(hintTimer);
    hint.hidden = true;
    return true;
  }

  function showHint() {
    if (!hint || hintSeen()) return;
    hint.hidden = false;
    rememberHint();
    hintTimer = window.setTimeout(dismissHint, HINT_DURATION);
  }

  setReady(false);

  return { setReady, isReady, showHint, dismissHint };
}
