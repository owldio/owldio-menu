import { buildNoteFlow } from "./domain/notes-flow.js";
import { buildSpreads, packAtoms } from "./domain/notes-pagination.js";
import {
  PAGE_HEIGHT_BOUNDS,
  pageOffset,
  resolvePageHeight,
  spreadWidth,
} from "./domain/notes-geometry.js";
import {
  resistEdge,
  resolveSwipe,
  rubberBandZoom,
  settleZoom,
} from "./domain/reader-gestures.js";
import { PAGE, renderPage } from "./notes-book-render.js";
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
const MAX_GAP_EXTRA = 14;
const ENDING_GAP_EXTRA = 26;
const CENTRE_THRESHOLD = 0.06;
const FONT_TIMEOUT = 3500;
const JUMP_FADE = 240;
const MOUSE_WAKE_INTERVAL = 250;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function folio(index) {
  return String(index + 1).padStart(2, "0");
}

export function createNotesBook(root, { onRoute, onError, onPageChange } = {}) {
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

  const chrome = createChromeController(root);
  const overlays = createOverlays(root);
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

  let atoms = [];
  let pages = [];
  let pageElements = [];
  let placements = [];
  let spreads = [];
  let spreadIndex = 0;
  let twoUp = false;
  let zoom = ZOOM_LIMITS.minimum;
  let pan = { x: 0, y: 0 };
  let fitScale = 1;
  let dragOffset = 0;
  let pinchStart = null;
  let runningHead = "樂曲解說";
  let noteTitles = new Map();
  let pageHeight = PAGE_HEIGHT_BOUNDS.minimum;
  let active = false;
  let paginated = false;
  let resizeObserver = null;
  let relayoutTimer = 0;
  let jumpTimer = 0;
  let lastMouseWake = 0;

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
    return spreadWidth(twoUp);
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
    const slackY = Math.max(0, (pageHeight * fitScale * atZoom - height) / 2);
    return { x: clamp(candidate.x, -slackX, slackX), y: clamp(candidate.y, -slackY, slackY) };
  }

  function applyBookTransform({ animate = false } = {}) {
    book.style.width = `${bookWidth()}px`;
    book.style.height = `${pageHeight}px`;
    if (!stageIsLaidOut()) return;

    const { width, height } = stageBox();
    fitScale = Math.min(width / bookWidth(), height / pageHeight);
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
      const spreadDelta = placement.spread - spreadIndex;
      const x = pageOffset({
        spreadDelta,
        slot: placement.slot,
        spreadLength: placement.length,
        twoUp,
      }) + dragLocal;

      element.style.transform = `translate3d(${x}px, 0, 0)`;
      element.dataset.slot = placement.length === 1 ? "single" : placement.slot === 0 ? "left" : "right";
      element.dataset.near = Math.abs(spreadDelta) <= 1 ? "true" : "false";
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
    const label = spread.length > 1
      ? `${folio(spread[0])}–${folio(spread.at(-1))} / ${last}`
      : `${folio(spread[0] ?? 0)} / ${last}`;

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
    }
    if (previousButton) previousButton.disabled = !canPrevious();
    if (nextButton) nextButton.disabled = !canNext();

    for (const thumb of thumbnailRail?.children || []) {
      const index = Number(thumb.dataset.pageIndex);
      thumb.setAttribute("aria-current", spread.includes(index) ? "true" : "false");
    }
  }

  function goToSpread(nextIndex, { animate = true } = {}) {
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
    onPageChange?.(currentSpread()[0] ?? 0);
  }

  function goToPage(pageIndex, { animate = false } = {}) {
    const target = spreads.findIndex((spread) => spread.includes(pageIndex));
    if (target >= 0) goToSpread(target, { animate });
  }

  function goToNote(slug) {
    const target = pages.findIndex((page) =>
      page.atoms.some((atom) => atom.kind === "note-banner" && atom.noteSlug === slug),
    );
    if (target >= 0) goToPage(target);
  }

  function move(direction) {
    goToSpread(spreadIndex + direction, { animate: true });
  }

  // ---- Pages ------------------------------------------------------------------

  function buildThumbnails() {
    if (!thumbnailRail) return;
    thumbnailRail.replaceChildren();

    pages.forEach((page, index) => {
      const button = createElement("button", "notes-thumb");
      button.type = "button";
      button.dataset.pageIndex = String(index);
      button.setAttribute("aria-label", `前往第 ${index + 1} 頁`);

      const preview = createElement("span", "notes-thumb__preview");
      preview.setAttribute("aria-hidden", "true");
      const clone = pageElements[index].cloneNode(true);
      clone.removeAttribute("aria-label");
      clone.style.removeProperty("transform");
      delete clone.dataset.slot;
      delete clone.dataset.near;
      preview.append(clone);

      button.append(preview, createElement("span", "notes-thumb__folio", folio(index)));
      thumbnailRail.append(button);
    });
  }

  /**
   * Books sit flush at the foot of the page. Pagination cannot land exactly on
   * the last line, so the leftover is shared between the paragraph gaps — up to
   * a cap, which keeps a page from being stretched open.
   *
   * The last page of a note usually ends short. It gets a little more air
   * between paragraphs, and whatever is still left over is split above and
   * below the text, so the page reads as composed rather than abandoned.
   */
  function settleTextBlock(element) {
    if (element.dataset.pageKind !== "note") return;

    const body = element.querySelector(".note-page__body");
    const children = [...body.children];
    if (!children.length) return;

    const content = children.reduce((total, child) => {
      const style = window.getComputedStyle(child);
      return total
        + child.offsetHeight
        + Number.parseFloat(style.marginTop || "0")
        + Number.parseFloat(style.marginBottom || "0");
    }, 0);

    const slack = body.clientHeight - content;
    if (slack <= 0) return;

    // Only gaps between blocks can open; space after the final block is unseen.
    const growable = children.filter(
      (child, index) => index < children.length - 1 && child.matches(".note-paragraph, .note-work"),
    ).length;
    const endsNote = element.dataset.endsNote === "true";
    const cap = endsNote ? ENDING_GAP_EXTRA : MAX_GAP_EXTRA;
    const extra = growable ? Math.min(slack / growable, cap) : 0;
    if (extra > 0) element.style.setProperty("--note-gap-extra", `${extra.toFixed(2)}px`);

    const remaining = slack - extra * growable;
    if (endsNote && remaining > body.clientHeight * CENTRE_THRESHOLD) {
      element.dataset.closing = "true";
    }
  }

  function renderPages() {
    book.replaceChildren();
    pageElements = pages.map((page, index) => {
      const noteTitle = page.noteSlug ? noteTitles.get(page.noteSlug) : null;
      return renderPage(page, {
        total: pages.length,
        runningHead: noteTitle || runningHead,
        continuedLabel: noteTitle ? `${noteTitle}（續）` : null,
        endsNote: Boolean(page.noteSlug) && pages[index + 1]?.noteSlug !== page.noteSlug,
        height: pageHeight,
      });
    });
    for (const element of pageElements) book.append(element);
    for (const element of pageElements) settleTextBlock(element);
    buildThumbnails();
  }

  /** The atom a reader is looking at, so a reflow can put them back on it. */
  function anchorAtomId() {
    const first = currentSpread()[0];
    return pages[first]?.atoms[0]?.id ?? null;
  }

  function pageHolding(atomId) {
    if (!atomId) return 0;
    const page = pages.findIndex((candidate) => candidate.atoms.some((atom) => atom.id === atomId));
    return Math.max(0, page);
  }

  function paginate() {
    // Measured outside the view: the stage carries a transform of its own.
    const measurer = createMeasurer(document.body, { height: pageHeight });
    try {
      pages = packAtoms(atoms, {
        capacity: measurer.capacity,
        lineHeight: PAGE.lineHeight,
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

  /**
   * The page is as tall as the screen allows, so a resize changes how much text
   * a leaf holds. Re-measure, then put the reader back on the atom they were on.
   */
  function relayout({ force = false } = {}) {
    if (!atoms.length || !stageIsLaidOut()) {
      applyBookTransform();
      return;
    }

    const nextTwoUp = shouldUseTwoUp();
    const { width, height } = stageBox();
    const nextHeight = resolvePageHeight({ stageWidth: width, stageHeight: height, twoUp: nextTwoUp });
    const heightChanged = Math.abs(nextHeight - pageHeight) > HEIGHT_TOLERANCE;

    if (paginated && !force && !heightChanged && nextTwoUp === twoUp) {
      applyBookTransform();
      return;
    }

    const anchor = paginated ? anchorAtomId() : null;
    twoUp = nextTwoUp;
    if (force || heightChanged || !paginated) {
      pageHeight = nextHeight;
      paginate();
    }
    applyShape(pageHolding(anchor));

    if (!overlays.isReady()) {
      overlays.setReady(true);
      overlays.showHint();
      chrome.pin(false);
    }
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
      ['16px "Noto Serif TC"', sample],
      ['500 25px "Noto Serif TC"', sample],
      ['10px "Noto Sans TC"', sample],
      ['14px "Bodoni Moda"', "Programme Notes 0123"],
    ];

    return Promise.all(faces.map(([font, text]) => document.fonts.load(font, text)))
      .then(() => document.fonts.ready)
      .then(() => true, () => false);
  }

  async function prepare({ programme, chapters }) {
    runningHead = `${programme?.title ?? ""} · ${programme?.contents_title || "樂曲解說"}`;
    const loadingTitle = root.querySelector(".notes-loading__title");
    if (loadingTitle && programme?.title) loadingTitle.textContent = programme.title;
    atoms = buildNoteFlow({ programme, chapters });
    noteTitles = new Map(
      atoms
        .filter((atom) => atom.kind === "note-banner")
        .map((atom) => [atom.noteSlug, `${atom.payload.number}　${atom.payload.title}`]),
    );

    const sample = atoms
      .filter((atom) => atom.kind === "paragraph")
      .map((atom) => atom.payload.text)
      .join("")
      .slice(0, 400);

    // A slow connection should not hold the book hostage: after a while, set it
    // with whatever faces have arrived, and set it again once the rest land.
    const fonts = loadBookFonts(sample || runningHead);
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
    thumbnails.hidden = !open;
    thumbnailsToggle?.setAttribute("aria-expanded", open ? "true" : "false");
    chrome.pin(open);
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
    goToPage(Number(button.dataset.pageIndex));
    setThumbnails(false);
  });

  root.querySelector("#notes-zoom-in")?.addEventListener("click", () => zoomTo(zoom + ZOOM_STEP));
  root.querySelector("#notes-zoom-out")?.addEventListener("click", () => zoomTo(zoom - ZOOM_STEP));
  root.querySelector("#notes-contents-jump")?.addEventListener("click", () => goToPage(1));

  root.querySelector("#notes-fullscreen")?.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else root.requestFullscreen?.();
  });

  root.addEventListener("click", (event) => {
    const noteLink = event.target?.closest?.("button[data-note-slug]");
    if (noteLink) {
      goToNote(noteLink.dataset.noteSlug);
      return;
    }
    const route = event.target?.closest?.("[data-notes-route]");
    if (route) onRoute?.(route.dataset.notesRoute);
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
      Home: () => goToSpread(0, { animate: false }),
      End: () => goToSpread(spreads.length - 1, { animate: false }),
      "+": () => zoomTo(zoom + ZOOM_STEP),
      "=": () => zoomTo(zoom + ZOOM_STEP),
      "-": () => zoomTo(zoom - ZOOM_STEP),
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
    goToPage,
    goToNote,
    pageCount: () => pages.length,
  };
}
