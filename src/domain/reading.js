const READING_SIZES = ["standard", "large", "extra-large"];

export function normalizeReadingSize(value) {
  return READING_SIZES.includes(value) ? value : "standard";
}

export function cycleReadingSize(current) {
  const normalized = normalizeReadingSize(current);
  const nextIndex = (READING_SIZES.indexOf(normalized) + 1) % READING_SIZES.length;
  return READING_SIZES[nextIndex];
}

export function resetReadingPosition({ scrollingElement, body, activeElement, scrollTo }) {
  activeElement?.blur?.();
  if (scrollingElement) scrollingElement.scrollTop = 0;
  if (body) body.scrollTop = 0;
  scrollTo?.(0, 0);
}
