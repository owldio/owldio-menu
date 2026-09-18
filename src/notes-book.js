import { buildNoteFlow } from "./domain/notes-flow.js";
import { buildSpreads, packAtoms } from "./domain/notes-pagination.js";
import { PAGE, renderPage } from "./notes-book-render.js";
import { createMeasurer } from "./notes-book-measure.js";
import { bindNotesGestures } from "./notes-book-gestures.js";
import { createElement } from "./lib/dom.js";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;
const TWO_UP_MIN_WIDTH = 900;
const GUTTER = 2;
const TURN_THRESHOLD = 0.18;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function folio(index) {
  return String(index + 1).padStart(2, "0");
}

export function createNotesBook(root, { onRoute, onError, onPageChange } = {}) {
  const stage = root.querySelector("#notes-stage");
  const book = root.querySelector("#notes-book");
  const loading = root.querySelector("#notes-loading");
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

  let atoms = [];
  let pages = [];
  let pageElements = [];
  let spreads = [];
  let spreadIndex = 0;
  let twoUp = false;
  let zoom = MIN_ZOOM;
  let pan = { x: 0, y: 0 };
  let fitScale = 1;
  let runningHead = "樂曲解說";
  let active = false;
  let resizeObserver = null;

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
    return twoUp ? PAGE.width * 2 + GUTTER : PAGE.width;
  }

  function applyTransform() {
    book.style.width = `${bookWidth()}px`;
    book.style.height = `${PAGE.height}px`;
    if (!stageIsLaidOut()) return;

    const { width, height } = stageBox();
    fitScale = Math.min(width / bookWidth(), height / PAGE.height);
    const scale = fitScale * zoom;
    book.style.transform = `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
    stage.dataset.zoomed = zoom > MIN_ZOOM ? "true" : "false";
  }

  function clampPan() {
    if (zoom <= MIN_ZOOM) {
      pan = { x: 0, y: 0 };
      return;
    }
    const { width, height } = stageBox();
    const scaledWidth = bookWidth() * fitScale * zoom;
    const scaledHeight = PAGE.height * fitScale * zoom;
    const slackX = Math.max(0, (scaledWidth - width) / 2);
    const slackY = Math.max(0, (scaledHeight - height) / 2);
    pan = { x: clamp(pan.x, -slackX, slackX), y: clamp(pan.y, -slackY, slackY) };
  }

  function currentSpread() {
    return spreads[spreadIndex] || [];
  }

  function updateSlots({ direction = 0 } = {}) {
    const spread = currentSpread();
    const visible = new Set(spread);

    pageElements.forEach((element, index) => {
      if (!visible.has(index)) {
        element.dataset.slot = "off";
        return;
      }
      if (spread.length === 1) element.dataset.slot = "single";
      else element.dataset.slot = index === spread[0] ? "left" : "right";
    });

    book.dataset.pages = String(spread.length);
    book.dataset.direction = direction > 0 ? "forward" : direction < 0 ? "back" : "none";
    book.dataset.turning = "true";
    window.requestAnimationFrame(() => {
      book.dataset.turning = "false";
    });
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
    if (previousButton) previousButton.disabled = spreadIndex === 0;
    if (nextButton) nextButton.disabled = spreadIndex >= spreads.length - 1;
    if (zoomLabel) zoomLabel.textContent = `${Math.round(zoom * 100)}%`;

    for (const thumb of thumbnailRail?.children || []) {
      const index = Number(thumb.dataset.pageIndex);
      thumb.setAttribute("aria-current", spread.includes(index) ? "true" : "false");
    }
  }

  function goToSpread(nextIndex, { direction = 0 } = {}) {
    const clamped = clamp(nextIndex, 0, Math.max(0, spreads.length - 1));
    const moved = clamped !== spreadIndex;
    spreadIndex = clamped;
    zoom = MIN_ZOOM;
    pan = { x: 0, y: 0 };
    updateSlots({ direction: moved ? direction : 0 });
    applyTransform();
    updateChrome();
    onPageChange?.(currentSpread()[0] ?? 0);
  }

  function goToPage(pageIndex) {
    const target = spreads.findIndex((spread) => spread.includes(pageIndex));
    if (target < 0) return;
    goToSpread(target, { direction: target > spreadIndex ? 1 : -1 });
  }

  function goToNote(slug) {
    const target = pages.findIndex((page) =>
      page.atoms.some((atom) => atom.kind === "note-banner" && atom.noteSlug === slug),
    );
    if (target >= 0) goToPage(target);
  }

  function move(direction) {
    goToSpread(spreadIndex + direction, { direction });
  }

  function setZoom(next, focal = null) {
    const previous = zoom;
    zoom = clamp(next, MIN_ZOOM, MAX_ZOOM);

    if (focal && zoom !== previous) {
      const ratio = zoom / previous;
      pan = { x: (pan.x - focal.x) * ratio + focal.x, y: (pan.y - focal.y) * ratio + focal.y };
    }
    if (zoom === MIN_ZOOM) pan = { x: 0, y: 0 };

    applyTransform();
    clampPan();
    applyTransform();
    updateChrome();
  }

  function panBy(deltaX, deltaY) {
    if (zoom <= MIN_ZOOM) return;
    pan = { x: pan.x + deltaX, y: pan.y + deltaY };
    clampPan();
    applyTransform();
  }

  function previewTurn(offset) {
    if (zoom > MIN_ZOOM) return;
    book.dataset.dragging = "true";
    book.style.transform = `translate(-50%, -50%) translate(${offset}px, 0) scale(${fitScale})`;
  }

  function releaseTurn(offset) {
    book.dataset.dragging = "false";
    const threshold = stageBox().width * TURN_THRESHOLD;
    if (offset <= -threshold) move(1);
    else if (offset >= threshold) move(-1);
    else applyTransform();
  }

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
      clone.dataset.slot = "thumb";
      preview.append(clone);

      button.append(preview, createElement("span", "notes-thumb__folio", folio(index)));
      thumbnailRail.append(button);
    });
  }

  function renderPages() {
    book.replaceChildren();
    pageElements = pages.map((page) => renderPage(page, { total: pages.length, runningHead }));
    for (const element of pageElements) book.append(element);
    buildThumbnails();
  }

  function paginate() {
    // Measured outside the view: it is still hidden when the book is prepared.
    const measurer = createMeasurer(document.body);
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
    twoUp = shouldUseTwoUp();
    book.dataset.spread = twoUp ? "two-up" : "single";
    spreads = buildSpreads(pages.length, twoUp);
    goToSpread(0);
  }

  function relayout() {
    const nextTwoUp = shouldUseTwoUp();
    if (nextTwoUp !== twoUp) {
      const anchor = currentSpread()[0] ?? 0;
      twoUp = nextTwoUp;
      book.dataset.spread = twoUp ? "two-up" : "single";
      spreads = buildSpreads(pages.length, twoUp);
      spreadIndex = Math.max(0, spreads.findIndex((spread) => spread.includes(anchor)));
      updateSlots();
      updateChrome();
    }
    applyTransform();
  }

  /**
   * `document.fonts.ready` resolves before a face nothing has rendered yet is
   * fetched, and Google serves Chinese in unicode-range subsets. Measuring then
   * would use fallback metrics and every page would overflow, so ask for the
   * exact faces with real text from the book first.
   */
  async function loadBookFonts(sample) {
    if (!document.fonts?.load) return;

    const faces = [
      ['16px "Noto Serif TC"', sample],
      ['500 25px "Noto Serif TC"', sample],
      ['10px "Noto Sans TC"', sample],
      ['14px "Bodoni Moda"', "Programme Notes 0123"],
    ];

    try {
      await Promise.all(faces.map(([font, text]) => document.fonts.load(font, text)));
      await document.fonts.ready;
    } catch {
      // Web fonts are a progressive enhancement; lay out with what is available.
    }
  }

  async function prepare({ programme, chapters }) {
    runningHead = `${programme?.title ?? ""} · ${programme?.contents_title || "樂曲解說"}`;
    atoms = buildNoteFlow({ programme, chapters });

    const sample = atoms
      .filter((atom) => atom.kind === "paragraph")
      .map((atom) => atom.payload.text)
      .join("")
      .slice(0, 400);
    await loadBookFonts(sample || runningHead);

    try {
      paginate();
    } catch (error) {
      onError?.(error);
      return;
    }

    if (loading) loading.hidden = true;
  }

  function activate() {
    active = true;
    root.dataset.active = "true";
    relayout();
    if (!resizeObserver && typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => {
        if (active) relayout();
      });
      resizeObserver.observe(stage);
    }
  }

  function deactivate() {
    active = false;
    root.dataset.active = "false";
    resizeObserver?.disconnect();
    resizeObserver = null;
  }

  function setThumbnails(open) {
    if (!thumbnails) return;
    thumbnails.hidden = !open;
    thumbnailsToggle?.setAttribute("aria-expanded", open ? "true" : "false");
  }

  previousButton?.addEventListener("click", () => move(-1));
  nextButton?.addEventListener("click", () => move(1));
  scrubber?.addEventListener("input", () => goToSpread(Number(scrubber.value) - 1));

  thumbnailsToggle?.addEventListener("click", () => setThumbnails(thumbnails.hidden));
  root.querySelector("#notes-thumbnails-mobile")?.addEventListener("click", () => setThumbnails(true));
  root.querySelector("#notes-thumbnails-close")?.addEventListener("click", () => setThumbnails(false));

  thumbnailRail?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page-index]");
    if (!button) return;
    goToPage(Number(button.dataset.pageIndex));
    setThumbnails(false);
  });

  root.querySelector("#notes-zoom-in")?.addEventListener("click", () => setZoom(zoom + ZOOM_STEP));
  root.querySelector("#notes-zoom-out")?.addEventListener("click", () => setZoom(zoom - ZOOM_STEP));
  root.querySelector("#notes-contents-jump")?.addEventListener("click", () => goToPage(1));

  root.querySelector("#notes-fullscreen")?.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else root.requestFullscreen?.();
  });

  book.addEventListener("click", (event) => {
    const noteLink = event.target.closest("button[data-note-slug]");
    if (noteLink) {
      goToNote(noteLink.dataset.noteSlug);
      return;
    }
    const route = event.target.closest("[data-notes-route]");
    if (route) onRoute?.(route.dataset.notesRoute);
  });

  stage.addEventListener("keydown", (event) => {
    const actions = {
      ArrowRight: () => move(1),
      ArrowLeft: () => move(-1),
      PageDown: () => move(1),
      PageUp: () => move(-1),
      Home: () => goToSpread(0),
      End: () => goToSpread(spreads.length - 1),
      "+": () => setZoom(zoom + ZOOM_STEP),
      "=": () => setZoom(zoom + ZOOM_STEP),
      "-": () => setZoom(zoom - ZOOM_STEP),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  });

  bindNotesGestures(stage, {
    move,
    panBy,
    previewTurn,
    releaseTurn,
    setZoom,
    zoom: () => zoom,
    minZoom: MIN_ZOOM,
    stageBox,
  });

  return {
    prepare,
    activate,
    deactivate,
    goToPage,
    goToNote,
    pageCount: () => pages.length,
  };
}
