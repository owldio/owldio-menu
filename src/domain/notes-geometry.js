/**
 * An e-book page is the screen it is read on. Type is set at its true size and
 * the page fills whatever room there is; a line that would run too long is
 * reined in by wider margins, never by shrinking the type.
 */
export const SPREAD_GUTTER = 2;

/**
 * The strip a reader glimpses between pages mid-swipe. Narrow: a wide one
 * reads as a hole in the book rather than as the next leaf arriving.
 */
export const SPREAD_GAP = 18;

/** The steps the A− / A+ controls move through, in CSS pixels. */
export const TEXT_SIZES = [15, 16, 17, 18, 20, 22, 24];

export const LINE_HEIGHT_RATIO = 1.9;

/**
 * The toolbar and progress rail float over the page when they are shown. The
 * text block starts and ends clear of both, and beyond that the top and bottom
 * margins barely grow with the type — as in a reading app, larger text gets the
 * page, not wider margins.
 */
export const CHROME_CLEARANCE = 58;

const MAX_LINE_CHARACTERS = 34;
const MIN_MARGIN_EMS = 1.35;
const TOP_AIR_EMS = 0.25;
const BOTTOM_AIR_EMS = 0.4;
const COMPACT_WIDTH = 600;
const FALLBACK_STAGE = { width: 375, height: 667 };

/**
 * A page that holds fewer lines than this is short — a small phone, a phone on
 * its side, or large text on any phone. Its banner and posters keep to their
 * essentials there, so a note's opening page still has room to begin the note.
 */
const COMPACT_PAGE_LINES = 16.5;

/** Phones start a step smaller than wide screens, where the eye sits further away. */
export function defaultTextSize(stageWidth) {
  return stageWidth < COMPACT_WIDTH ? 17 : 18;
}

export function nextTextSize(current, direction) {
  if (direction > 0) return TEXT_SIZES.find((size) => size > current) ?? TEXT_SIZES.at(-1);
  if (direction < 0) return [...TEXT_SIZES].reverse().find((size) => size < current) ?? TEXT_SIZES[0];
  return current;
}

export function resolveLayout({ stageWidth, stageHeight, twoUp, textSize }) {
  const stage = stageWidth > 0 && stageHeight > 0
    ? { width: stageWidth, height: stageHeight }
    : FALLBACK_STAGE;

  const width = Math.max(1, Math.floor(twoUp ? (stage.width - SPREAD_GUTTER) / 2 : stage.width));
  const height = Math.max(1, Math.floor(stage.height));
  const font = textSize;
  // A whole number of characters to the line: a line of Chinese then meets both
  // margins as it stands, without its characters being pulled apart to fit.
  const characters = Math.max(
    1,
    Math.min(MAX_LINE_CHARACTERS, Math.floor((width - 2 * font * MIN_MARGIN_EMS) / font)),
  );
  const padX = (width - characters * font) / 2;
  const padTop = Math.round(CHROME_CLEARANCE + font * TOP_AIR_EMS);
  const padBottom = Math.round(CHROME_CLEARANCE + font * BOTTOM_AIR_EMS);
  const lines = (height - padTop - padBottom) / (font * LINE_HEIGHT_RATIO);

  return {
    width,
    height,
    font,
    padX,
    padTop,
    padBottom,
    compact: lines < COMPACT_PAGE_LINES,
  };
}

export function spreadWidth({ twoUp, pageWidth }) {
  return twoUp ? pageWidth * 2 + SPREAD_GUTTER : pageWidth;
}

/**
 * Where a page sits in the reading strip, relative to the spread on screen.
 * Every page gets a place, so a drag can pull the next one in from the side
 * instead of swapping it in once the gesture is over.
 */
export function pageOffset({ spreadDelta, slot, spreadLength, twoUp, pageWidth }) {
  const spread = spreadWidth({ twoUp, pageWidth });
  const base = spreadDelta * (spread + SPREAD_GAP);

  if (twoUp && spreadLength === 1) return base + (spread - pageWidth) / 2;
  return base + slot * (pageWidth + SPREAD_GUTTER);
}

/**
 * Only the spread in hand and its two neighbours need a transform. Giving
 * every leaf a 3D transform makes WebKit allocate backing layers for a whole
 * book at once, which can exceed an iPhone WebContent process' memory limit.
 */
export function pageRenderPlacement({
  spreadDelta,
  slot,
  spreadLength,
  twoUp,
  pageWidth,
  dragOffset = 0,
}) {
  const near = Math.abs(spreadDelta) <= 1;
  if (!near) return { near: false, transform: null };

  const x = pageOffset({ spreadDelta, slot, spreadLength, twoUp, pageWidth }) + dragOffset;
  return { near: true, transform: `translateX(${x}px)` };
}

/**
 * A newly revealed standby leaf has no previous off-screen transform. If it is
 * allowed to transition from `none`, it visibly travels from the centre toward
 * its parking place — opposite to the page the reader just turned. Only leaves
 * that were already in the three-spread window can take part in the turn.
 */
export function shouldTransitionPage({ animate, wasNear, isNear }) {
  return Boolean(animate && wasNear && isNear);
}

/** The cover counts as the first physical leaf but carries no printed folio. */
export function shouldShowFolio(pageKind) {
  return pageKind !== "cover";
}
