/**
 * The judgement calls behind touch reading — which tap turns the page, when a
 * drag becomes a turn, how far a pinch may overshoot — kept free of the DOM so
 * they can be tested and tuned on their own.
 */

const EDGE_ZONE = 0.3;
const DOUBLE_TAP_DELAY = 300;
const DOUBLE_TAP_DISTANCE = 36;
const VELOCITY_WINDOW = 100;
const TURN_DISTANCE = 0.18;
const FLICK_VELOCITY = 0.35;
const FLICK_MINIMUM_OFFSET = 16;
const EDGE_RESISTANCE = 0.3;
const UNDERSHOOT_GIVE = 0.45;
const UNDERSHOOT_FLOOR = 0.6;
const OVERSHOOT_GIVE = 0.3;
const OVERSHOOT_CEILING = 1.25;
const SNAP_HOME = 0.05;

/** Left third turns back, right third turns forward, the middle opens the menu. */
export function tapZone(x, width) {
  if (!(width > 0)) return "menu";
  const ratio = x / width;
  if (ratio < EDGE_ZONE) return "previous";
  if (ratio > 1 - EDGE_ZONE) return "next";
  return "menu";
}

/** Interactive controls always win over the page's edge-turn zones. */
export function followsLink({ interactive }) {
  return Boolean(interactive);
}

export function isDoubleTap(first, second) {
  if (!first || !second) return false;
  const delay = second.time - first.time;
  if (delay < 0 || delay > DOUBLE_TAP_DELAY) return false;
  return Math.hypot(second.x - first.x, second.y - first.y) <= DOUBLE_TAP_DISTANCE;
}

/** Horizontal speed, px/ms, over the last moments of a gesture. */
export function swipeVelocity(samples) {
  if (!samples || samples.length < 2) return 0;
  const last = samples.at(-1);
  const first = samples.find((sample) => sample.time >= last.time - VELOCITY_WINDOW) ?? samples[0];
  const elapsed = last.time - first.time;
  if (elapsed <= 0) return 0;
  return (last.x - first.x) / elapsed;
}

/**
 * -1 turns back, 1 turns forward, 0 settles where it was. A long drag turns; so
 * does a short, quick flick. A flick back against the drag cancels it.
 */
export function resolveSwipe({ offset, velocity, width, canPrevious, canNext }) {
  const flicking = Math.abs(velocity) >= FLICK_VELOCITY;
  if (flicking && Math.sign(velocity) !== Math.sign(offset)) return 0;

  let direction = 0;
  if (Math.abs(offset) >= width * TURN_DISTANCE) direction = offset < 0 ? 1 : -1;
  else if (flicking && Math.abs(offset) >= FLICK_MINIMUM_OFFSET) direction = offset < 0 ? 1 : -1;

  if (direction === 1 && !canNext) return 0;
  if (direction === -1 && !canPrevious) return 0;
  return direction;
}

/** At either end of the book the page drags heavily instead of following freely. */
export function resistEdge(offset, { canPrevious, canNext }) {
  if (offset < 0 && !canNext) return offset * EDGE_RESISTANCE;
  if (offset > 0 && !canPrevious) return offset * EDGE_RESISTANCE;
  return offset;
}

/** A pinch may overshoot either limit a little, the way a page gives under the hand. */
export function rubberBandZoom(raw, { minimum, maximum }) {
  if (raw < minimum) {
    return Math.max(minimum - (minimum - raw) * UNDERSHOOT_GIVE, minimum * UNDERSHOOT_FLOOR);
  }
  if (raw > maximum) {
    return Math.min(maximum + (raw - maximum) * OVERSHOOT_GIVE, maximum * OVERSHOOT_CEILING);
  }
  return raw;
}

/** Where a zoom comes to rest once the fingers lift. */
export function settleZoom(zoom, { minimum, maximum }) {
  if (zoom < minimum + SNAP_HOME) return minimum;
  if (zoom > maximum) return maximum;
  return zoom;
}
