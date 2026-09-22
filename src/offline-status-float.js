const STORAGE_KEY = "owldio-offline-status-position";
const EDGE_MARGIN = 8;
const DRAG_THRESHOLD_PX = 4;
const FALLBACK_CHROME_PX = 58;

/** Where the pill sits until the reader drags it somewhere else. */
export const DEFAULT_STATUS_POSITION = Object.freeze({ x: EDGE_MARGIN, y: EDGE_MARGIN });

function clampAxis(value, size, limit) {
  const max = Math.max(EDGE_MARGIN, limit - size - EDGE_MARGIN);
  return Math.min(max, Math.max(EDGE_MARGIN, value));
}

/**
 * @param {{ x: number, y: number }} position
 * @param {{ width: number, height: number }} size
 * @param {{ width: number, height: number }} viewport
 * @returns {{ x: number, y: number }}
 */
export function clampStatusPosition(position, size, viewport) {
  return {
    x: clampAxis(position.x, size.width, viewport.width),
    y: clampAxis(position.y, size.height, viewport.height),
  };
}

/**
 * Which reader chrome the pill would sit under, so CSS can step it aside while
 * the toolbar or the progress rail is showing.
 *
 * @param {{ y: number }} position
 * @param {{ height: number }} size
 * @param {{ height: number }} viewport
 * @param {{ top: number, bottom: number }} chrome toolbar and rail heights
 * @returns {"top" | "bottom" | "free"}
 */
export function statusDock(position, size, viewport, chrome) {
  if (position.y < chrome.top) return "top";
  if (position.y + size.height > viewport.height - chrome.bottom) return "bottom";
  return "free";
}

/**
 * @param {Storage | undefined} storage
 * @returns {{ x: number, y: number } | null}
 */
export function readStoredPosition(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { x, y } = JSON.parse(raw);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  } catch {
    return null;
  }
}

/**
 * @param {Storage | undefined} storage
 * @param {{ x: number, y: number }} position
 */
export function writeStoredPosition(storage, position) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ x: Math.round(position.x), y: Math.round(position.y) }));
  } catch {
    // Private mode or blocked storage: the pill simply starts in the corner next time.
  }
}

function localStorageOf(windowRef) {
  try {
    return windowRef?.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Makes the offline pill a floating chip the reader can drag out of the way.
 * The spot is remembered on this device and kept on screen through rotations.
 *
 * @param {HTMLElement} root
 * @param {{ windowRef?: Window, documentRef?: Document, storage?: Storage }} [options]
 */
export function attachFloatingStatus(
  root,
  {
    windowRef = globalThis.window,
    documentRef = globalThis.document,
    storage = localStorageOf(windowRef),
  } = {},
) {
  let position = readStoredPosition(storage) || DEFAULT_STATUS_POSITION;
  let drag = null;
  let idleCallbacks = [];

  const viewport = () => ({ width: windowRef.innerWidth, height: windowRef.innerHeight });
  const size = () => ({ width: root.offsetWidth, height: root.offsetHeight });

  function chromeHeights() {
    const book = documentRef.querySelector(".view--notes-book");
    return {
      top: book?.querySelector(".publication-toolbar")?.offsetHeight || FALLBACK_CHROME_PX,
      bottom: book?.querySelector(".publication-rail")?.offsetHeight || FALLBACK_CHROME_PX,
    };
  }

  function place(next, { docked = true } = {}) {
    position = clampStatusPosition(next, size(), viewport());
    root.style.setProperty("--offline-x", `${position.x}px`);
    root.style.setProperty("--offline-y", `${position.y}px`);
    root.dataset.offlineDock = docked
      ? statusDock(position, size(), viewport(), chromeHeights())
      : "free";
  }

  function onPointerDown(event) {
    if (event.button > 0 || event.target.closest?.("button")) return;
    const rect = root.getBoundingClientRect();
    drag = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
    root.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

    event.preventDefault();
    if (!drag.moved) {
      drag = { ...drag, moved: true };
      root.dataset.dragging = "true";
    }
    // Follow the finger from where the pill visibly was, so it never jumps under it.
    place({ x: drag.originX + dx, y: drag.originY + dy }, { docked: false });
  }

  function onPointerEnd(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const { moved, originX, originY, startX, startY } = drag;
    drag = null;
    if (root.hasPointerCapture?.(event.pointerId)) root.releasePointerCapture(event.pointerId);
    if (!moved) return;

    delete root.dataset.dragging;
    // A quick flick can coalesce its last moves away; settle where the finger lifted.
    const lifted = event.type === "pointerup"
      ? { x: originX + event.clientX - startX, y: originY + event.clientY - startY }
      : position;
    place(lifted);
    writeStoredPosition(storage, position);
    const callbacks = idleCallbacks;
    idleCallbacks = [];
    callbacks.forEach((callback) => callback());
  }

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerup", onPointerEnd);
  root.addEventListener("pointercancel", onPointerEnd);
  windowRef.addEventListener("resize", () => place(position));
  // The pill changes width with its message; keep its far edge on screen.
  if (typeof windowRef.ResizeObserver === "function") {
    new windowRef.ResizeObserver(() => {
      if (!drag?.moved) place(position);
    }).observe(root);
  }
  place(position);

  return {
    refresh: () => place(position),
    isDragging: () => Boolean(drag?.moved),
    /** Runs now, or once the reader lets go of the pill. */
    whenIdle(callback) {
      if (drag?.moved) idleCallbacks = [...idleCallbacks, callback];
      else callback();
    },
  };
}
