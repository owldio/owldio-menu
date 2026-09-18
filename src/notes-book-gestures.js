const DRAG_THRESHOLD = 12;
const DOUBLE_TAP_ZOOM = 2;
const WHEEL_SENSITIVITY = 0.002;

function distanceBetween(first, second) {
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

function midpointOf(first, second) {
  return {
    clientX: (first.clientX + second.clientX) / 2,
    clientY: (first.clientY + second.clientY) / 2,
  };
}

function isInteractive(target) {
  return Boolean(target?.closest?.("button, a, input, select, textarea"));
}

/**
 * Pointer handling for the notes book: drag to turn while the page is fitted,
 * drag to pan once zoomed, pinch or double-tap to zoom.
 */
export function bindNotesGestures(stage, controller) {
  const pointers = new Map();

  let mode = "idle";
  let start = null;
  let last = null;
  let pinch = null;

  function focalFrom(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    return {
      x: clientX - (rect.left + rect.width / 2),
      y: clientY - (rect.top + rect.height / 2),
    };
  }

  function reset() {
    mode = "idle";
    start = null;
    last = null;
    pinch = null;
  }

  function beginPinch() {
    const [first, second] = [...pointers.values()];
    if (!first || !second) return;
    mode = "pinch";
    pinch = { distance: distanceBetween(first, second) || 1, zoom: controller.zoom() };
  }

  function seedDrag(event) {
    start = { x: event.clientX, y: event.clientY };
    last = { x: event.clientX, y: event.clientY };
    mode = controller.zoom() > controller.minZoom ? "pan" : "pending";
  }

  stage.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (isInteractive(event.target) && controller.zoom() <= controller.minZoom) return;

    pointers.set(event.pointerId, event);

    if (pointers.size === 2) {
      beginPinch();
      return;
    }
    if (pointers.size === 1) seedDrag(event);
  });

  stage.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, event);

    if (pointers.size >= 2) {
      if (mode !== "pinch") beginPinch();
      const [first, second] = [...pointers.values()];
      const spread = distanceBetween(first, second);
      const centre = midpointOf(first, second);
      event.preventDefault();
      controller.setZoom(
        pinch.zoom * (spread / pinch.distance),
        focalFrom(centre.clientX, centre.clientY),
      );
      return;
    }

    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    if (mode === "pending") {
      if (Math.abs(deltaX) < DRAG_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) return;
      mode = "turn";
      stage.setPointerCapture?.(event.pointerId);
    }

    if (mode === "turn") {
      event.preventDefault();
      controller.previewTurn(deltaX);
      return;
    }

    if (mode === "pan") {
      event.preventDefault();
      controller.panBy(event.clientX - last.x, event.clientY - last.y);
      last = { x: event.clientX, y: event.clientY };
    }
  });

  function finish(event) {
    if (!pointers.has(event.pointerId)) return;

    const wasTurning = mode === "turn";
    const offset = start ? event.clientX - start.x : 0;

    pointers.delete(event.pointerId);
    stage.releasePointerCapture?.(event.pointerId);

    if (wasTurning) controller.releaseTurn(offset);

    if (pointers.size === 0) {
      reset();
      return;
    }

    // One finger left after a pinch: carry on as a pan from where it now sits.
    const [remaining] = [...pointers.values()];
    seedDrag(remaining);
  }

  stage.addEventListener("pointerup", finish);
  stage.addEventListener("pointercancel", finish);

  stage.addEventListener("dblclick", (event) => {
    if (isInteractive(event.target)) return;
    event.preventDefault();
    const zoomed = controller.zoom() > controller.minZoom;
    controller.setZoom(
      zoomed ? controller.minZoom : DOUBLE_TAP_ZOOM,
      focalFrom(event.clientX, event.clientY),
    );
  });

  stage.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const factor = 1 - event.deltaY * WHEEL_SENSITIVITY;
      controller.setZoom(controller.zoom() * factor, focalFrom(event.clientX, event.clientY));
    },
    { passive: false },
  );
}
