import { buildNoteFlow } from "./domain/notes-flow.js";
import { buildSpreads, packAtoms } from "./domain/notes-pagination.js";
import {
  LINE_HEIGHT_RATIO,
  TEXT_SIZES,
  defaultTextSize,
  nextTextSize,
  pageRenderPlacement,
  resolveLayout,
  shouldTransitionPage,
  spreadWidth,
} from "./domain/notes-geometry.js";
import { pageHoldingAnchor, pageIndexForNote, readingAnchorForPage } from "./domain/notes-position.js";
import {
  resistEdge,
  resolveSwipe,
  rubberBandZoom,
  settleZoom,
} from "./domain/reader-gestures.js";
import { renderPage } from "./notes-book-render.js";
import { createMeasurer } from "./notes-book-measure.js";
import { bindNotesGestures } from "./notes-book-gestures.js";
import { createChromeController } from "./notes-book-chrome.js";
import { createOverlays } from "./notes-book-overlays.js";
import { createElement } from "./lib/dom.js";

const ZOOM_LIMITS = { minimum: 1, maximum: 4 };
const ZOOM_STEP = 0.5;
const DOUBLE_TAP_ZOOM = 2.5;
const ZOOMED = 1.01;
const TWO_UP_MIN_WIDTH = 900;
const RELAYOUT_DELAY = 180;
const HEIGHT_TOLERANCE = 24;
const FONT_TIMEOUT = 3500;
const JUMP_FADE = 240;
const MOUSE_WAKE_INTERVAL = 250;
// Versioned so the new 15px commissioned default is not masked by the former default.
const TEXT_SIZE_KEY = "owldio-notes-text-size-v2";
const THUMB_HEIGHT = 80;
// A 40px arrow set 6px in from the edge, with a little air before the text.
const TURN_BUTTON_ROOM = 52;

function storedTextSize() {
  try {
    const value = Number(window.localStorage.getItem(TEXT_SIZE_KEY));
    return TEXT_SIZES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function rememberTextSize(value) {
  try {
    window.localStorage.setItem(TEXT_SIZE_KEY, String(value));
  } catch {
    // Without storage the reader's choice lasts for this visit only.
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function folio(index) {
  return String(index + 1).padStart(2, "0");
}

export function createNotesBook(root, { onError, onPageChange } = {}) {
  const stage = root.querySelector("#notes-stage");
  const book = root.querySelector("#notes-book");
  const status = root.querySelector("#notes-status");
  const pageLabel = root.querySelector("#notes-page-label");
  const scrubber = root.querySelector("#notes-scrubber");
  const progress = root.querySelector("#notes-progress");
  const zoomLabel = root.querySelector("#notes-zoom-label");
  const previousButton = root.querySelector("#notes-prev");
  const nextButton = root.querySelector("#notes-next");
  const thumbnails = root.querySelector("#notes-thumbnails");
  const thumbnailRail = root.querySelector("#notes-thumbnail-rail");
  const thumbnailsToggle = root.querySelector("#notes-thumbnails-toggle");
  const textSizeLabel = root.querySelector("#notes-text-size");
  const textSmaller = root.querySelector("#notes-text-smaller");
  const textLarger = root.querySelector("#notes-text-larger");

  const chrome = createChromeController(root);
  const overlays = createOverlays(root);
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

  let atoms = [];
  let pages = [];
  let pageElements = [];
  let placements = [];
  let spreads = [];
  let spreadIndex = 0;
  let thumbnailsStale = true;
  let twoUp = false;
  let zoom = ZOOM_LIMITS.minimum;
  let pan = { x: 0, y: 0 };
  let fitScale = 1;
  let dragOffset = 0;
  let pinchStart = null;
  let noteTitles = new Map();
  let layout = null;
  let textSize = storedTextSize();
  let active = false;
  let paginated = false;
  let resizeObserver = null;
  let relayoutTimer = 0;
  let jumpTimer = 0;
  let lastMouseWake = 0;
  let positionAnchor = null;

  function prefersReducedMotion() {
    return Boolean(reducedMotion?.matches);
  }

  function stageBox() {
    const rect = stage.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  /** A hidden stage measures zero; scaling to that would shrink the book away. */
  function stageIsLaidOut() {
    const { width, height } = stageBox();
    return width > 1 && height > 1;
  }

  function shouldUseTwoUp() {
    if (!stageIsLaidOut()) return twoUp;
    const { width, height } = stageBox();
    return width >= TWO_UP_MIN_WIDTH && width > height;
  }

  function bookWidth() {
    return layout ? spreadWidth({ twoUp, pageWidth: layout.width }) : 1;
  }

  function pageHeight() {
    return layout?.height ?? 1;
  }

  function currentSpread() {
    return spreads[spreadIndex] || [];
  }

  function canPrevious() {
    return spreadIndex > 0;
  }

  function canNext() {
    return spreadIndex < spreads.length - 1;
  }

  // ---- Book transform: fit, zoom and pan ---------------------------------

  function clampedPan(candidate, atZoom = zoom) {
    if (atZoom <= ZOOM_LIMITS.minimum) return { x: 0, y: 0 };
    const { width, height } = stageBox();
    const slackX = Math.max(0, (bookWidth() * fitScale * atZoom - width) / 2);
    const slackY = Math.max(0, (pageHeight() * fitScale * atZoom - height) / 2);
    return { x: clamp(candidate.x, -slackX, slackX), y: clamp(candidate.y, -slackY, slackY) };
  }

  function applyBookTransform({ animate = false } = {}) {
    book.style.width = `${bookWidth()}px`;
    book.style.height = `${pageHeight()}px`;
    if (!layout || !stageIsLaidOut()) return;

    const { width, height } = stageBox();
    fitScale = Math.min(width / bookWidth(), height / pageHeight());
    book.dataset.motion = animate && !prefersReducedMotion() ? "settle" : "live";
    book.style.transform = `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${fitScale * zoom})`;
    stage.dataset.zoomed = zoom > ZOOMED ? "true" : "false";
    if (zoomLabel) zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  }

  /** Zoom about a point on screen, so what is under the finger stays there. */
  function zoomTo(target, focal = { x: 0, y: 0 }, { animate = true } = {}) {
    const next = clamp(target, ZOOM_LIMITS.minimum, ZOOM_LIMITS.maximum);
    const ratio = next / zoom;
    const candidate = {
      x: focal.x - (focal.x - pan.x) * ratio,
      y: focal.y - (focal.y - pan.y) * ratio,
    };
    zoom = next;
    pan = clampedPan(candidate);
    applyBookTransform({ animate });
  }

  function resetZoom({ animate = false } = {}) {
    zoom = ZOOM_LIMITS.minimum;
    pan = { x: 0, y: 0 };
    applyBookTransform({ animate });
  }

  // ---- The reading strip ---------------------------------------------------

  function computePlacements() {
    placements = [];
    spreads.forEach((spread, position) => {
      spread.forEach((pageIndex, slot) => {
        placements[pageIndex] = { spread: position, slot, length: spread.length };
      });
    });
  }

  /**
   * Every page has a place in one horizontal strip. Turning slides the strip;
   * dragging moves it with the finger, so the next page arrives from the side
   * rather than appearing once the gesture is over.
   */
  function layoutPages({ animate = false } = {}) {
    book.dataset.turn = animate && !prefersReducedMotion() ? "slide" : "none";
    const dragLocal = dragOffset / (fitScale * zoom || 1);

    pageElements.forEach((element, index) => {
      const placement = placements[index];
      if (!placement) return;
      const wasNear = element.dataset.near === "true";
      const spreadDelta = placement.spread - spreadIndex;
      const rendered = pageRenderPlacement({
        spreadDelta,
        slot: placement.slot,
        spreadLength: placement.length,
        twoUp,
        pageWidth: layout.width,
        singlePageWidth: twoUp && element.dataset.pageKind === "cover"
          ? bookWidth()
          : layout.width,
        dragOffset: dragLocal,
      });
      const transitions = shouldTransitionPage({
        animate,
        wasNear,
        isNear: rendered.near,
      });

      if (rendered.transform) element.style.transform = rendered.transform;
      else element.style.removeProperty("transform");
      element.dataset.slot = placement.length === 1 ? "single" : placement.slot === 0 ? "left" : "right";
      element.dataset.near = rendered.near ? "true" : "false";
      element.dataset.turnMotion = transitions ? "true" : "false";
    });
  }

  function flashJump() {
    if (prefersReducedMotion()) return;
    window.clearTimeout(jumpTimer);
    book.classList.remove("is-jumping");
    // Restart the fade when two jumps land in quick succession.
    void book.offsetWidth;
    book.classList.add("is-jumping");
    jumpTimer = window.setTimeout(() => book.classList.remove("is-jumping"), JUMP_FADE);
  }

  function updateChrome() {
    const spread = currentSpread();
    const last = folio(Math.max(0, pages.length - 1));
    const scrubberLabel = spread.length > 1
      ? `${folio(spread[0])}–${folio(spread.at(-1))}`
      : folio(spread[0] ?? 0);
    const label = `${scrubberLabel} / ${last}`;

    if (pageLabel) pageLabel.textContent = label;
    if (status) status.textContent = `第 ${label} 頁`;
    if (scrubber) {
      scrubber.min = "1";
      scrubber.max = String(Math.max(1, spreads.length));
      scrubber.value = String(spreadIndex + 1);
    }
    if (progress) {
      const ratio = spreads.length > 1 ? spreadIndex / (spreads.length - 1) : 1;
      progress.style.setProperty("--progress", String(ratio));
      progress.dataset.label = scrubberLabel;
    }
    if (previousButton) previousButton.disabled = !canPrevious();
    if (nextButton) nextButton.disabled = !canNext();

    for (const thumb of thumbnailRail?.children || []) {
      const index = Number(thumb.dataset.pageIndex);
      thumb.setAttribute("aria-current", spread.includes(index) ? "true" : "false");
    }
    if (thumbnails && !thumbnails.hidden) {
      window.requestAnimationFrame(() => revealCurrentThumbnail({ behavior: "auto" }));
    }
  }

  function goToSpread(nextIndex, { animate = true, reason = "turn", anchor = null } = {}) {
    if (!spreads.length) return;
    const target = clamp(nextIndex, 0, spreads.length - 1);
    const delta = target - spreadIndex;

    if (zoom !== ZOOM_LIMITS.minimum) resetZoom();
    dragOffset = 0;
    spreadIndex = target;

    // Neighbours slide; anything further is a jump, which fades rather than
    // racing the reader through every page in between.
    const slide = animate && Math.abs(delta) === 1;
    if (delta !== 0 && !slide) flashJump();

    layoutPages({ animate: slide || delta === 0 });
    updateChrome();
    positionAnchor = anchor ?? readingAnchorForPage(pages[currentSpread()[0]]);
    onPageChange?.(currentSpread()[0] ?? 0, { reason, anchor: positionAnchor });
  }

  function goToPage(pageIndex, { animate = false, reason = "turn", anchor = null } = {}) {
    const safePage = clamp(pageIndex, 0, Math.max(0, pages.length - 1));
    const target = spreads.findIndex((spread) => spread.includes(safePage));
    if (target >= 0) goToSpread(target, { animate, reason, anchor });
  }

  function goToAnchor(anchor, { reason = "restore" } = {}) {
    const pageIndex = pageHoldingAnchor(pages, anchor);
    if (pageIndex < 0) return false;
    goToPage(pageIndex, { animate: false, reason, anchor });
    return true;
  }

  /**
   * Following a link is a move a reader can take back: the phone's own back
   * button returns to the page the link was followed from, not to the leaf
   * before this one.
   */
  function goToNote(slug) {
    const target = pageIndexForNote(pages, slug);
    if (target >= 0) goToPage(target, { reason: "jump" });
  }

  function move(direction) {
    goToSpread(spreadIndex + direction, { animate: true });
  }

  // ---- Pages ------------------------------------------------------------------

  function revealCurrentThumbnail({ behavior = "smooth" } = {}) {
    if (!thumbnailRail || thumbnails?.hidden) return;
    const current = thumbnailRail.querySelector('[aria-current="true"]');
    if (!current) return;
    const left = current.offsetLeft - (thumbnailRail.clientWidth - current.offsetWidth) / 2;
    thumbnailRail.scrollTo({
      left: Math.max(0, left),
      behavior: prefersReducedMotion() ? "auto" : behavior,
    });
  }

  function buildThumbnails() {
    if (!thumbnailRail) return;
    thumbnailsStale = false;
    thumbnailRail.replaceChildren();
    // Pages come in the screen's own shape, so the previews take it too, at a
    // height the rail can hold.
    const thumbScale = THUMB_HEIGHT / layout.height;
    thumbnailRail.style.setProperty("--thumb-scale", String(thumbScale));
    thumbnailRail.style.setProperty("--thumb-width", `${Math.round(layout.width * thumbScale)}px`);

    pages.forEach((page, index) => {
      const button = createElement("button", "notes-thumb");
      button.type = "button";
      button.dataset.pageIndex = String(index);
      button.setAttribute("aria-label", `前往第 ${index + 1} 頁`);
      button.setAttribute("aria-current", currentSpread().includes(index) ? "true" : "false");

      const preview = createElement("span", "notes-thumb__preview");
      preview.setAttribute("aria-hidden", "true");
      const clone = pageElements[index].cloneNode(true);
      clone.removeAttribute("aria-label");
      clone.style.removeProperty("transform");
      delete clone.dataset.slot;
      clone.dataset.near = "true";
      clone.dataset.turnMotion = "false";
      for (const picture of clone.querySelectorAll("img")) {
        picture.decoding = "async";
        picture.loading = "lazy";
      }
      preview.append(clone);

      button.append(preview, createElement("span", "notes-thumb__folio", folio(index)));
      thumbnailRail.append(button);
    });
  }

  /** The exact stack height, including the margins the measurer counted. */
  function stackHeight(children) {
    return children.reduce((total, child) => {
      const style = window.getComputedStyle(child);
      return total
        + child.offsetHeight
        + Number.parseFloat(style.marginTop || "0")
        + Number.parseFloat(style.marginBottom || "0");
    }, 0);
  }

  function settleTextBlock(element) {
    if (element.dataset.pageKind !== "note") return;

    const body = element.querySelector(".note-page__body");
    // The end mark is ornament, not text: on a page the note already fills, it
    // gives way rather than spill into the margin over the page number.
    const endMark = body.querySelector(".note-page__endmark");
    if (endMark && stackHeight([...body.children]) > body.clientHeight) endMark.remove();
  }

  function renderPages() {
    book.replaceChildren();
    pageElements = pages.map((page, index) => {
      const noteTitle = page.noteSlug ? noteTitles.get(page.noteSlug) : null;
      const pageLayout = twoUp && page.kind === "cover"
        ? { ...layout, width: bookWidth() }
        : layout;
      return renderPage(page, {
        total: pages.length,
        continuedLabel: noteTitle ?? null,
        endsNote: Boolean(page.noteSlug) && pages[index + 1]?.noteSlug !== page.noteSlug,
        layout: pageLayout,
      });
    });
    for (const element of pageElements) book.append(element);
    for (const element of pageElements) settleTextBlock(element);
    // The rail holds a copy of every page. It is built when a reader asks for
    // it, so a book of sixty pages does not carry sixty previews unread.
    thumbnailsStale = true;
    if (thumbnails && !thumbnails.hidden) buildThumbnails();
  }

  function paginate() {
    // Measured outside the view: the stage carries a transform of its own.
    const measurer = createMeasurer(document.body, { layout });
    try {
      pages = packAtoms(atoms, {
        capacity: measurer.capacity,
        lineHeight: layout.font * LINE_HEIGHT_RATIO,
        measure: measurer.measure,
        splitParagraph: measurer.splitParagraph,
      });
    } finally {
      measurer.destroy();
    }

    renderPages();
    paginated = true;
  }

  function applyShape(anchorPage) {
    book.dataset.spread = twoUp ? "two-up" : "single";
    spreads = buildSpreads(pages.length, twoUp);
    computePlacements();
    spreadIndex = Math.max(0, spreads.findIndex((spread) => spread.includes(anchorPage)));
    dragOffset = 0;
    zoom = ZOOM_LIMITS.minimum;
    pan = { x: 0, y: 0 };
    applyBookTransform();
    layoutPages();
    updateChrome();
  }

  function layoutChanged(next) {
    if (!layout) return true;
    return next.width !== layout.width
      || next.font !== layout.font
      || Math.abs(next.height - layout.height) > HEIGHT_TOLERANCE;
  }

  /**
   * A page is the screen it is read on, so turning the phone, resizing the
   * window or changing the text size changes how much a page holds. Re-measure,
   * then put the reader back on the passage they were reading.
   */
  function relayout({ force = false } = {}) {
    if (!atoms.length || !stageIsLaidOut()) {
      applyBookTransform();
      return;
    }

    const { width, height } = stageBox();
    const nextTwoUp = shouldUseTwoUp();
    const font = textSize ?? defaultTextSize(width);
    const next = resolveLayout({ stageWidth: width, stageHeight: height, twoUp: nextTwoUp, textSize: font });

    if (paginated && !force && nextTwoUp === twoUp && !layoutChanged(next)) {
      applyBookTransform();
      return;
    }

    const reflowing = paginated;
    const anchor = reflowing
      ? (positionAnchor ?? readingAnchorForPage(pages[currentSpread()[0]]))
      : null;
    twoUp = nextTwoUp;
    layout = next;
    paginate();
    applyShape(Math.max(0, pageHoldingAnchor(pages, anchor)));
    positionAnchor = anchor ?? readingAnchorForPage(pages[currentSpread()[0]]);
    updateTextSizeControls();
    // The page-turn arrows sit in the page margin, so they only show where it can hold them.
    root.dataset.margins = layout.padX >= TURN_BUTTON_ROOM ? "roomy" : "tight";
    // The same passage now sits on another page number. That is not a turn, so
    // the address follows it without adding a step to the history.
    if (reflowing) {
      onPageChange?.(currentSpread()[0] ?? 0, { reason: "reflow", anchor: positionAnchor });
    }

    if (!overlays.isReady()) {
      overlays.setReady(true);
      overlays.showHint();
      chrome.pin(false);
    }
  }

  function updateTextSizeControls() {
    const current = layout?.font ?? textSize;
    if (textSizeLabel && current) textSizeLabel.textContent = String(current);
    if (textSmaller) textSmaller.disabled = current <= TEXT_SIZES[0];
    if (textLarger) textLarger.disabled = current >= TEXT_SIZES.at(-1);
  }

  /** Larger or smaller type, re-set like a web page and kept on the same passage. */
  function stepTextSize(direction) {
    const current = layout?.font ?? textSize ?? defaultTextSize(stageBox().width);
    const next = nextTextSize(current, direction);
    if (next === current) return;
    textSize = next;
    rememberTextSize(next);
    chrome.keepAlive();
    safeRelayout({ force: true });
  }

  function safeRelayout(options) {
    try {
      relayout(options);
    } catch (error) {
      onError?.(error);
    }
  }

  function scheduleRelayout() {
    window.clearTimeout(relayoutTimer);
    applyBookTransform();
    relayoutTimer = window.setTimeout(() => safeRelayout(), RELAYOUT_DELAY);
  }

  // ---- Loading ---------------------------------------------------------------

  /**
   * `document.fonts.ready` resolves before a face nothing has rendered yet is
   * fetched, and Google serves Chinese in unicode-range subsets. Measuring then
   * would use fallback metrics and every page would overflow, so ask for the
   * exact faces with real text from the book first.
   */
  function loadBookFonts(sample) {
    if (!document.fonts?.load) return Promise.resolve(true);

    const faces = [
      // The book's own face is one subset file per weight: asking once fetches every glyph.
      ['17px "Swei Spring Sugar"', sample],
      ['600 17px "Swei Spring Sugar"', sample],
      ['14px "Bodoni Moda"', "Programme Notes 0123"],
      // Each note's English title is set in the italic, and it can wrap the opening page.
      ['italic 14px "Bodoni Moda"', "Aria in Classic Style"],
    ];

    return Promise.all(faces.map(([font, text]) => document.fonts.load(font, text)))
      .then(() => document.fonts.ready)
      .then(() => true, () => false);
  }

  async function prepare({ programme, chapters }) {
    const loadingTitle = root.querySelector(".notes-loading__title");
    if (loadingTitle && programme?.title) loadingTitle.textContent = programme.title;
    atoms = buildNoteFlow({ programme, chapters });
    // A book's running head names the work, not the page it continues.
    noteTitles = new Map(
      atoms
        .filter((atom) => atom.kind === "note-banner" || atom.kind === "person-banner")
        .map(({ kind, noteSlug, payload }) => [
          noteSlug,
          kind === "person-banner"
            ? [payload.role, payload.name].filter(Boolean).join("／")
            : (payload.composer && payload.work
              ? `${payload.composer} · ${payload.work}`
              : payload.title),
        ]),
    );

    const sample = atoms
      .filter((atom) => atom.kind === "paragraph")
      .map((atom) => atom.payload.text)
      .join("")
      .slice(0, 400);

    // A slow connection should not hold the book hostage: after a while, set it
    // with whatever faces have arrived, and set it again once the rest land.
    const fonts = loadBookFonts(sample || programme?.title || "樂曲解說");
    const timeout = new Promise((resolve) => {
      window.setTimeout(() => resolve("timeout"), FONT_TIMEOUT);
    });
    const outcome = await Promise.race([fonts, timeout]);

    if (outcome === "timeout") {
      fonts.then(() => {
        if (paginated) safeRelayout({ force: true });
      });
    }

    // Pagination waits for a laid-out stage; activate() performs it otherwise.
    if (active) safeRelayout();
  }

  // ---- Gestures ----------------------------------------------------------------

  const gestures = bindNotesGestures(stage, {
    isZoomed: () => zoom > ZOOMED,

    onTap(zone) {
      if (overlays.dismissHint()) return;
      if (zoom > ZOOMED) {
        chrome.toggle();
        return;
      }
      if (zone === "previous" || zone === "next") {
        chrome.hide();
        move(zone === "next" ? 1 : -1);
        return;
      }
      chrome.toggle();
    },

    onDoubleTap(focal) {
      overlays.dismissHint();
      if (zoom > ZOOMED) resetZoom({ animate: true });
      else zoomTo(DOUBLE_TAP_ZOOM, focal, { animate: true });
    },

    onDragStart() {
      overlays.dismissHint();
      chrome.hide();
      book.dataset.dragging = "true";
    },

    onDrag(offset) {
      dragOffset = resistEdge(offset, { canPrevious: canPrevious(), canNext: canNext() });
      layoutPages();
    },

    onDragEnd({ offset, velocity, width }) {
      book.dataset.dragging = "false";
      const direction = resolveSwipe({
        offset,
        velocity,
        width,
        canPrevious: canPrevious(),
        canNext: canNext(),
      });
      dragOffset = 0;
      if (direction) move(direction);
      else layoutPages({ animate: true });
    },

    onPinchStart(focal) {
      overlays.dismissHint();
      pinchStart = { zoom, pan: { ...pan }, focal };
    },

    onPinch({ scale, focal }) {
      if (!pinchStart) return;
      // Free zoom that gives a little past either limit while the fingers are down.
      const next = rubberBandZoom(pinchStart.zoom * scale, ZOOM_LIMITS);
      const ratio = next / pinchStart.zoom;
      pan = {
        x: focal.x - (pinchStart.focal.x - pinchStart.pan.x) * ratio,
        y: focal.y - (pinchStart.focal.y - pinchStart.pan.y) * ratio,
      };
      zoom = next;
      applyBookTransform();
    },

    onPinchEnd() {
      pinchStart = null;
      const target = settleZoom(zoom, ZOOM_LIMITS);
      if (target === ZOOM_LIMITS.minimum) {
        resetZoom({ animate: true });
        return;
      }
      const ratio = target / zoom;
      zoom = target;
      pan = clampedPan({ x: pan.x * ratio, y: pan.y * ratio });
      applyBookTransform({ animate: true });
    },

    onPan(deltaX, deltaY) {
      pan = clampedPan({ x: pan.x + deltaX, y: pan.y + deltaY });
      applyBookTransform();
    },

    onWheelZoom(factor, focal) {
      zoomTo(zoom * factor, focal, { animate: false });
    },
  });

  // ---- Lifecycle -----------------------------------------------------------------

  function activate() {
    active = true;
    root.dataset.active = "true";
    // While the book is still being set, keep the way back in view.
    chrome.pin(!overlays.isReady());
    chrome.show();
    safeRelayout();

    if (!resizeObserver && typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => {
        if (active) scheduleRelayout();
      });
      resizeObserver.observe(stage);
    }
  }

  function deactivate() {
    active = false;
    root.dataset.active = "false";
    chrome.stop();
    gestures.cancelPendingTap();
    window.clearTimeout(relayoutTimer);
    resizeObserver?.disconnect();
    resizeObserver = null;
  }

  // ---- Controls ------------------------------------------------------------------

  function setThumbnails(open) {
    if (!thumbnails) return;
    if (open && thumbnailsStale) buildThumbnails();
    thumbnails.hidden = !open;
    thumbnailsToggle?.setAttribute("aria-expanded", open ? "true" : "false");
    chrome.pin(open);
    if (open) window.requestAnimationFrame(() => revealCurrentThumbnail({ behavior: "auto" }));
  }

  previousButton?.addEventListener("click", () => move(-1));
  nextButton?.addEventListener("click", () => move(1));
  scrubber?.addEventListener("input", () => goToSpread(Number(scrubber.value) - 1, { animate: false }));

  thumbnailsToggle?.addEventListener("click", () => setThumbnails(thumbnails.hidden));
  root.querySelector("#notes-thumbnails-mobile")?.addEventListener("click", () => setThumbnails(true));
  root.querySelector("#notes-thumbnails-close")?.addEventListener("click", () => setThumbnails(false));

  thumbnailRail?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page-index]");
    if (!button) return;
    goToPage(Number(button.dataset.pageIndex), { reason: "jump" });
    setThumbnails(false);
  });

  root.querySelector("#notes-zoom-in")?.addEventListener("click", () => zoomTo(zoom + ZOOM_STEP));
  root.querySelector("#notes-zoom-out")?.addEventListener("click", () => zoomTo(zoom - ZOOM_STEP));
  textSmaller?.addEventListener("click", () => stepTextSize(-1));
  textLarger?.addEventListener("click", () => stepTextSize(1));
  root.querySelector("#notes-contents-jump")?.addEventListener("click", () => goToPage(1, { reason: "jump" }));

  root.querySelector("#notes-fullscreen")?.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else root.requestFullscreen?.();
  });

  root.addEventListener("click", (event) => {
    const noteLink = event.target?.closest?.("button[data-note-slug]");
    if (noteLink) goToNote(noteLink.dataset.noteSlug);
  });

  // Using a control keeps the controls up; a mouse moving over the page calls them back.
  for (const part of root.querySelectorAll(".publication-toolbar, .publication-rail, .publication-thumbnails, .publication-turn")) {
    part.addEventListener("pointerdown", () => chrome.keepAlive());
    part.addEventListener("focusin", () => chrome.show());
  }

  root.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    if (event.timeStamp - lastMouseWake < MOUSE_WAKE_INTERVAL) return;
    lastMouseWake = event.timeStamp;
    chrome.show();
  });

  /**
   * Every page stays in the DOM so find-in-page and screen readers see one
   * continuous document. When the browser scrolls the stage to a hit on
   * another page, follow it and put the stage back where it belongs.
   */
  stage.addEventListener("scroll", () => {
    const selection = window.getSelection?.();
    const node = selection?.anchorNode;
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    const page = element?.closest?.(".note-page") ?? document.activeElement?.closest?.(".note-page");

    stage.scrollTop = 0;
    stage.scrollLeft = 0;

    const index = Number(page?.dataset.pageIndex);
    if (Number.isInteger(index) && !currentSpread().includes(index)) goToPage(index);
  });

  // Reading keys work wherever focus sits, the way they do in a book reader.
  document.addEventListener("keydown", (event) => {
    if (!active) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target?.closest?.("input, textarea, select, [contenteditable]")) return;

    const actions = {
      ArrowRight: () => move(1),
      ArrowLeft: () => move(-1),
      PageDown: () => move(1),
      PageUp: () => move(-1),
      Home: () => goToSpread(0, { animate: false, reason: "jump" }),
      End: () => goToSpread(spreads.length - 1, { animate: false, reason: "jump" }),
      "+": () => stepTextSize(1),
      "=": () => stepTextSize(1),
      "-": () => stepTextSize(-1),
      Escape: () => resetZoom({ animate: true }),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    overlays.dismissHint();
    action();
  });

  root.dataset.chrome = "shown";

  return {
    prepare,
    activate,
    deactivate,
    goToAnchor,
    goToPage,
    goToNote,
    pageCount: () => pages.length,
  };
}
