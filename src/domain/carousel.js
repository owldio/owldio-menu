export function advanceCarouselIndex(currentIndex, direction, itemCount) {
  if (itemCount <= 0) return 0;
  return (currentIndex + direction + itemCount) % itemCount;
}

export function relativeCarouselOffset(itemIndex, activeIndex, itemCount) {
  if (itemCount <= 0) return 0;
  const forwardOffset = (itemIndex - activeIndex + itemCount) % itemCount;
  return forwardOffset > itemCount / 2 ? forwardOffset - itemCount : forwardOffset;
}

export function normalizeMarqueeOffset(offset, cycleWidth) {
  const width = Number(cycleWidth);
  if (!Number.isFinite(width) || width <= 0) return 0;
  const wrapped = ((Number(offset) % width) + width) % width;
  return wrapped === 0 ? 0 : wrapped - width;
}

export function resolveMarqueeOffset({
  offset,
  elapsedMs,
  pixelsPerSecond,
  cycleWidth,
  interaction = "idle",
  dragStartOffset,
  dragStartX,
  pointerX,
}) {
  const currentOffset = Number(offset) || 0;
  if (interaction === "dragging") {
    const originOffset = Number(dragStartOffset) || 0;
    const pointerDelta = (Number(pointerX) || 0) - (Number(dragStartX) || 0);
    return normalizeMarqueeOffset(originOffset + pointerDelta, cycleWidth);
  }
  if (interaction !== "idle") return normalizeMarqueeOffset(currentOffset, cycleWidth);
  const distance = ((Number(elapsedMs) || 0) / 1_000) * (Number(pixelsPerSecond) || 0);
  return normalizeMarqueeOffset(currentOffset - distance, cycleWidth);
}

function rounded(value) {
  const result = Math.round(value * 1_000) / 1_000;
  return Object.is(result, -0) ? 0 : result;
}

export function resolveOrbitPose({
  itemIndex,
  itemCount,
  orbitProgress = 0,
  radiusX,
  radiusY,
  radiusZ,
}) {
  if (!Number.isFinite(itemCount) || itemCount <= 0) {
    return {
      x: 0,
      y: 0,
      z: 0,
      rotationY: 0,
      scale: 1,
      opacity: 1,
      brightness: 1,
      depth: 1,
      zIndex: 1010,
    };
  }

  const angle = Math.PI * 2 * (itemIndex / itemCount + orbitProgress);
  const depth = Math.cos(angle);
  const frontness = (depth + 1) / 2;

  return {
    x: rounded(Math.sin(angle) * radiusX),
    y: rounded(depth * radiusY),
    z: rounded(depth * radiusZ),
    rotationY: rounded(Math.sin(angle) * -42),
    scale: rounded(0.66 + frontness * 0.34),
    opacity: rounded(0.36 + frontness * 0.64),
    brightness: rounded(0.72 + frontness * 0.28),
    depth: rounded(depth),
    zIndex: Math.round(frontness * 1_000) + 10,
  };
}

export function frontmostOrbitIndex({ itemCount, orbitProgress = 0 }) {
  const count = Math.max(0, Math.floor(Number(itemCount) || 0));
  if (!count) return 0;
  const nearestIndex = Math.round(-Number(orbitProgress) * count);
  return ((nearestIndex % count) + count) % count;
}

export function resolveOrbitTransition({
  fromOffset,
  toOffset,
  elapsedMs,
  durationMs,
}) {
  const start = Number(fromOffset) || 0;
  const end = Number(toOffset) || 0;
  const duration = Math.max(0, Number(durationMs) || 0);
  const progress = duration === 0
    ? 1
    : Math.min(1, Math.max(0, (Number(elapsedMs) || 0) / duration));
  const easedProgress = progress < 0.5
    ? 4 * progress ** 3
    : 1 - ((-2 * progress + 2) ** 3) / 2;

  return {
    offset: rounded(start + (end - start) * easedProgress),
    progress: rounded(progress),
    complete: progress >= 1,
  };
}
