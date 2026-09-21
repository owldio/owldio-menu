function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Maps any press or drag on the visible track to its nearest discrete page. */
export function scrubberValueAtClientX(clientX, bounds, minimum, maximum) {
  const min = Number.isFinite(Number(minimum)) ? Number(minimum) : 0;
  const max = Math.max(min, Number.isFinite(Number(maximum)) ? Number(maximum) : min);
  const left = Number(bounds?.left) || 0;
  const width = Number(bounds?.width) || 0;
  if (width <= 0 || max === min) return min;

  const ratio = clamp((Number(clientX) - left) / width, 0, 1);
  return Math.round(min + ratio * (max - min));
}
