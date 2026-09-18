const IDLE_DELAY = 2800;

/**
 * The toolbar, turn arrows and progress rail float over the page and step out
 * of the way while reading, the way a video player does. A tap in the middle
 * of the page brings them back; they leave again after a moment of stillness.
 */
export function createChromeController(root, { idleDelay = IDLE_DELAY } = {}) {
  let timer = 0;
  let pinned = false;

  function set(shown) {
    root.dataset.chrome = shown ? "shown" : "hidden";
  }

  function isShown() {
    return root.dataset.chrome !== "hidden";
  }

  function schedule() {
    window.clearTimeout(timer);
    if (pinned) return;
    timer = window.setTimeout(() => set(false), idleDelay);
  }

  function show() {
    set(true);
    schedule();
  }

  function hide() {
    window.clearTimeout(timer);
    if (pinned) return;
    set(false);
  }

  function toggle() {
    if (isShown()) hide();
    else show();
  }

  /** Held open while a panel is in use, such as the page thumbnails. */
  function pin(value) {
    pinned = value;
    if (pinned) {
      window.clearTimeout(timer);
      set(true);
    } else {
      schedule();
    }
  }

  /** Someone is using the controls; give them the full delay again. */
  function keepAlive() {
    if (isShown()) schedule();
  }

  function stop() {
    window.clearTimeout(timer);
  }

  return { show, hide, toggle, isShown, pin, keepAlive, stop };
}
