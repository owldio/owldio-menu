import { followsLink, isDoubleTap, swipeVelocity, tapZone } from "./domain/reader-gestures.js";

const MOVE_SLOP = 10;
const PAN_SLOP = 4;
const HORIZONTAL_BIAS = 1.2;
const TAP_MAX_DURATION = 500;
const SINGLE_TAP_DELAY = 260;
const VELOCITY_SAMPLES = 8;
const WHEEL_SENSITIVITY = 0.002;

function isInteractive(target) {
  return Boolean(target?.closest?.("button, a, input, select, textarea, label"));
}

function distanceBetween(first, second) {
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

function midpointOf(first, second) {
  return {
    clientX: (first.clientX + second.clientX) / 2,
    clientY: (first.clientY + second.clientY) / 2,
  };
}

/**
 * Touch reading, the way comic and e-book readers do it: tap the edges to turn,
 * tap the middle for the menu, drag to pull the next page in, double-tap to
 * zoom, pinch freely. The stage decides nothing itself — it reports intent to
 * the controller, and the thresholds live in domain/reader-gestures.
 */
export function bindNotesGestures(stage, controller) {
  const pointers = new Map();

  let mode = "idle";
  let start = null;
  let last = null;
  let samples = [];
  let pinch = null;
  let lastTap = null;
  let tapTimer = 0;
  let suppressClick = false;

  function stageRect() {
    return stage.getBoundingClientRect();
  }

  /** Relative to the stage centre, which is where the book scales from. */
  function focalFrom(clientX, clientY) {
    const rect = stageRect();
    return {
      x: clientX - (rect.left + rect.width / 2),
      y: clientY - (rect.top + rect.height / 2),
    };
  }

  function clearTapTimer() {
    window.clearTimeout(tapTimer);
    tapTimer = 0;
  }

  function reset() {
    mode = "idle";
    start = null;
    last = null;
    samples = [];
    pinch = null;
  }

  function beginPinch() {
    const [first, second] = [...pointers.values()];
    if (!first || !second) return;

    if (mode === "dragging") controller.onDragEnd({ offset: 0, velocity: 0, width: stageRect().width });
    clearTapTimer();
    lastTap = null;

    const centre = midpointOf(first, second);
    mode = "pinching";
    pinch = { distance: distanceBetween(first, second) || 1 };
    controller.onPinchStart(focalFrom(centre.clientX, centre.clientY));
  }

  function seed(event) {
    start = { x: event.clientX, y: event.clientY, time: event.timeStamp, pointerType: event.pointerType };
    last = { x: event.clientX, y: event.clientY };
    samples = [{ x: event.clientX, time: event.timeStamp }];
    mode = "pending";
  }

  function handleTap(event) {
    const rect = stageRect();
    const tap = { x: event.clientX, y: event.clientY, time: event.timeStamp };

    if (isDoubleTap(lastTap, tap)) {
      clearTapTimer();
      lastTap = null;
      controller.onDoubleTap(focalFrom(event.clientX, event.clientY));
      return;
    }

    lastTap = tap;
    const zone = tapZone(event.clientX - rect.left, rect.width);
    clearTapTimer();
    // Wait long enough to tell a single tap from the first half of a double tap.
    tapTimer = window.setTimeout(() => {
      tapTimer = 0;
      lastTap = null;
      controller.onTap(zone);
    }, SINGLE_TAP_DELAY);
  }

  stage.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // A drag does not always produce a click, so a leftover guard must not eat the next one.
    if (!pointers.size) suppressClick = false;

    // Buttons and links always keep their own action; only bare page space turns a leaf.
    if (!pointers.size && followsLink({ interactive: isInteractive(event.target) })) return;

    pointers.set(event.pointerId, event);

    if (pointers.size === 2 && event.pointerType !== "mouse") {
      beginPinch();
      return;
    }
    if (pointers.size === 1) seed(event);
  });

  stage.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, event);

    if (mode === "pinching" && pointers.size >= 2) {
      const [first, second] = [...pointers.values()];
      const centre = midpointOf(first, second);
      event.preventDefault();
      controller.onPinch({
        scale: distanceBetween(first, second) / pinch.distance,
        focal: focalFrom(centre.clientX, centre.clientY),
      });
      return;
    }

    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    if (mode === "pending") {
      const moved = Math.hypot(deltaX, deltaY);

      if (controller.isZoomed()) {
        if (moved < PAN_SLOP) return;
        mode = "panning";
        clearTapTimer();
        stage.setPointerCapture?.(event.pointerId);
      } else {
        if (moved < MOVE_SLOP) return;
        // A mouse drag belongs to text selection; turning by drag is for touch and pen.
        const horizontal = Math.abs(deltaX) > Math.abs(deltaY) * HORIZONTAL_BIAS;
        if (!horizontal || start.pointerType === "mouse") {
          mode = "ignored";
          return;
        }
        mode = "dragging";
        stage.setPointerCapture?.(event.pointerId);
        clearTapTimer();
        controller.onDragStart();
      }
    }

    if (mode === "dragging") {
      event.preventDefault();
      samples.push({ x: event.clientX, time: event.timeStamp });
      if (samples.length > VELOCITY_SAMPLES) samples.shift();
      controller.onDrag(deltaX);
      return;
    }

    if (mode === "panning") {
      event.preventDefault();
      controller.onPan(event.clientX - last.x, event.clientY - last.y);
      last = { x: event.clientX, y: event.clientY };
    }
  });

  function finish(event, { cancelled = false } = {}) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    stage.releasePointerCapture?.(event.pointerId);

    if (mode === "pinching") {
      if (pointers.size < 2) {
        controller.onPinchEnd();
        suppressClick = true;
        // One finger left: carry on as a pan from where it now rests.
        const [remaining] = [...pointers.values()];
        if (remaining) {
          seed(remaining);
          mode = controller.isZoomed() ? "panning" : "ignored";
        } else {
          reset();
        }
      }
      return;
    }

    if (mode === "dragging") {
      const offset = start ? event.clientX - start.x : 0;
      controller.onDragEnd({
        offset: cancelled ? 0 : offset,
        velocity: cancelled ? 0 : swipeVelocity(samples),
        width: stageRect().width,
      });
      suppressClick = true;
      reset();
      return;
    }

    if (mode === "panning") {
      suppressClick = true;
      reset();
      return;
    }

    if (mode === "pending" && !cancelled && start) {
      const duration = event.timeStamp - start.time;
      if (duration <= TAP_MAX_DURATION) handleTap(event);
    }

    reset();
  }

  stage.addEventListener("pointerup", (event) => finish(event));
  stage.addEventListener("pointercancel", (event) => finish(event, { cancelled: true }));

  // A drag that ends over a link must not also follow it.
  stage.addEventListener(
    "click",
    (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );

  stage.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      controller.onWheelZoom(1 - event.deltaY * WHEEL_SENSITIVITY, focalFrom(event.clientX, event.clientY));
    },
    { passive: false },
  );

  return {
    cancelPendingTap() {
      clearTapTimer();
      lastTap = null;
    },
  };
}
