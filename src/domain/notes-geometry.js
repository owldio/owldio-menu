/**
 * The page keeps a fixed width so the line length — and with it the reading
 * density — never changes. Its height follows the screen instead, so the leaf
 * fills the stage rather than floating in the middle of it.
 */
export const PAGE_WIDTH = 800;
export const SPREAD_GUTTER = 2;

export const PAGE_HEIGHT_BOUNDS = { minimum: 900, maximum: 2400 };

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function spreadWidth(twoUp) {
  return twoUp ? PAGE_WIDTH * 2 + SPREAD_GUTTER : PAGE_WIDTH;
}

export function resolvePageHeight({ stageWidth, stageHeight, twoUp }) {
  const middle = Math.round((PAGE_HEIGHT_BOUNDS.minimum + PAGE_HEIGHT_BOUNDS.maximum) / 2);
  if (!(stageWidth > 0) || !(stageHeight > 0)) return middle;

  const target = (spreadWidth(twoUp) * stageHeight) / stageWidth;
  return Math.round(clamp(target, PAGE_HEIGHT_BOUNDS.minimum, PAGE_HEIGHT_BOUNDS.maximum));
}
