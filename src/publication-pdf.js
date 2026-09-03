import {
  classifyPublicationGesture,
  classifyPublicationTapZone,
  choosePageMode,
  fitTriFoldScale,
  isPublicationDoubleTap,
  movePublicationPage,
  normalizePublicationZoom,
  publicationSpread,
  resolvePublicationDoubleTapZoom,
  resolvePublicationFocusAnchor,
  resolvePublicationFocusScroll,
  resolvePublicationPinchZoom,
  resolvePublicationPinchTranslation,
  resolveTriFoldCoverPanel,
  resolveTriFoldInsideOrder,
  resolveTriFoldOpeningLeaf,
  resolveTriFoldPanelCrop,
  triFoldDesktopSteps,
  triFoldReadingOrder,
} from "./domain/publication-reader.js";

let pdfEnginePromise;

async function loadPdfEngine() {
  if (!pdfEnginePromise) {
    pdfEnginePromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjs, workerModule]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
      return pdfjs;
    });
  }
  return pdfEnginePromise;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function padPage(value) {
  return String(value).padStart(2, "0");
}

function optionalPanelIndex(value) {
  if (value === null || value === "") return null;
  const panelIndex = Number(value);
  return Number.isInteger(panelIndex) && panelIndex >= 0 && panelIndex <= 2
    ? panelIndex
    : null;
}

function nextFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(resolve));
}

export function createPublicationViewer(root, { onError } = {}) {
  const toolbar = root.querySelector(".publication-toolbar");
  const reader = root.querySelector("#pdf-reader");
  const hint = root.querySelector(".publication-reader__hint");
  const stage = root.querySelector("#pdf-stage");
  const pages = root.querySelector("#pdf-pages");
  const loading = root.querySelector("#pdf-loading");
  const empty = root.querySelector("#pdf-empty");
  const previous = root.querySelector("#pdf-prev");
  const next = root.querySelector("#pdf-next");
  const pageLabel = root.querySelector("#pdf-page-label");
  const scrubber = root.querySelector("#pdf-scrubber");
  const progress = root.querySelector("#pdf-progress");
  const caption = root.querySelector("#pdf-caption");
  const download = root.querySelector("#pdf-download");
  const zoomOut = root.querySelector("#pdf-zoom-out");
  const zoomIn = root.querySelector("#pdf-zoom-in");
  const zoomLabel = root.querySelector("#pdf-zoom-label");
  const fullscreen = root.querySelector("#pdf-fullscreen");
  const thumbnailPanel = root.querySelector("#pdf-thumbnails");
  const thumbnailRail = root.querySelector("#pdf-thumbnail-rail");
  const thumbnailToggle = root.querySelector("#pdf-thumbnails-toggle");
  const thumbnailMobile = root.querySelector("#pdf-thumbnails-mobile");
  const thumbnailClose = root.querySelector("#pdf-thumbnails-close");
  const pager = root.querySelector("#pdf-pager");

  let source = null;
  let pdfDocument = null;
  let loadingTask = null;
  let currentPage = 1;
  let pageCount = 0;
  let pageMode = "single";
  let panelOrder = [];
  let foldSteps = [];
  let pageSize = { width: 1, height: 1 };
  let zoom = 1;
  let renderRevision = 0;
  let thumbnailRevision = 0;
  let resizeTimer;
  let chromeTimer;
  let hintTimer;
  let tapTimer;
  let lastTap = null;
  let pointerStart = null;
  const activePointers = new Map();
  let pinchState = null;
  let active = false;

  function readingPositionCount() {
    if (pageMode === "panel") return panelOrder.length;
    if (pageMode === "fold") return foldSteps.length;
    return pageCount;
  }

  function currentSpread() {
    const total = readingPositionCount();
    if (pageMode === "panel" || pageMode === "fold") {
      return [clamp(currentPage, 1, Math.max(1, total))];
    }
    return publicationSpread(currentPage, pageCount, pageMode);
  }

  function isMobileReader() {
    return window.innerWidth < 900;
  }

  function clearChromeTimer() {
    window.clearTimeout(chromeTimer);
    chromeTimer = null;
  }

  function setChromeVisible(visible, { autoHide = true } = {}) {
    const shouldShow = !isMobileReader() || Boolean(visible) || !active;
    root.dataset.chrome = shouldShow ? "visible" : "hidden";
    toolbar.inert = !shouldShow;
    pager.inert = !shouldShow;
    previous.inert = !shouldShow;
    next.inert = !shouldShow;
    clearChromeTimer();

    if (shouldShow && autoHide && active && isMobileReader() && thumbnailPanel.hidden) {
      chromeTimer = window.setTimeout(() => setChromeVisible(false, { autoHide: false }), 3000);
    }
  }

  function revealChrome() {
    setChromeVisible(true);
  }

  function showGestureHint() {
    window.clearTimeout(hintTimer);
    reader.dataset.hint = "visible";
    hintTimer = window.setTimeout(() => {
      reader.dataset.hint = "hidden";
    }, 3200);
  }

  function showPreview(previewSource) {
    if (!previewSource?.previewUrl) return;
    const frame = document.createElement("figure");
    frame.className = "publication-page publication-page--preview";
    const image = document.createElement("img");
    image.src = previewSource.previewUrl;
    image.alt = previewSource.previewAlt || "節目冊第一頁預覽";
    image.decoding = "async";

    if (previewSource.foldMode === "tri-fold") {
      const panelIndex = resolveTriFoldCoverPanel(previewSource.previewPanelIndex);
      const crop = resolveTriFoldPanelCrop({
        pageNumber: 1,
        panelIndex,
        pageWidth: 1,
        panelBoundaries: previewSource.panelBoundaries,
      });
      frame.classList.add("publication-page--preview-panel");
      frame.style.setProperty("--preview-panel-index", String(panelIndex));
      frame.style.setProperty("--preview-panel-offset", `${-(crop.leftRatio / crop.widthRatio) * 100}%`);
      frame.style.setProperty("--preview-image-width", `${100 / crop.widthRatio}%`);
      frame.style.setProperty("--preview-panel-ratio", String(previewSource.previewPanelAspectRatio || 0.4704));
      pages.dataset.mode = isMobileReader() ? "panel" : "fold";
      pages.dataset.coverPanel = String(panelIndex);
      reader.dataset.foldStage = "closed";
    } else {
      pages.dataset.mode = "single";
    }

    frame.append(image);
    pages.replaceChildren(frame);
  }

  function setBusy(isBusy, message = "正在展開節目冊…") {
    root.setAttribute("aria-busy", String(isBusy));
    loading.textContent = message;
    loading.hidden = !isBusy;
  }

  function updateThumbnailSelection() {
    const visiblePages = new Set(currentSpread());
    thumbnailRail.querySelectorAll("[data-page-number]").forEach((button) => {
      const isCurrent = visiblePages.has(Number(button.dataset.pageNumber));
      button.classList.toggle("is-current", isCurrent);
      button.toggleAttribute("aria-current", isCurrent);
    });

    const currentThumb = thumbnailRail.querySelector("[aria-current='true']");
    currentThumb?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  function updateChrome() {
    if (!pageCount) return;
    const total = readingPositionCount();
    const spread = currentSpread();
    const first = spread[0];
    const last = spread.at(-1);
    pageLabel.textContent = spread.length > 1
      ? `${padPage(first)}–${padPage(last)} / ${padPage(total)}`
      : `${padPage(first)} / ${padPage(total)}`;
    const foldStep = pageMode === "fold" ? foldSteps[first - 1] : null;
    caption.textContent = pageMode === "panel"
      ? `${source?.panelLabels?.[first - 1] || `第 ${first} 欄`} · 三折頁行動閱讀`
      : foldStep
        ? `${foldStep.label} · 三折頁實體閱讀`
        : source?.caption || "原始印刷節目冊";
    hint.textContent = pageMode === "panel"
      ? "左右滑動或點兩側翻頁 · 雙指或點兩下縮放"
      : pageMode === "fold"
        ? "拖曳或使用方向鍵 · 依折線展開"
        : "左右滑動或點兩側翻頁 · 雙指或點兩下縮放";
    scrubber.max = String(total);
    scrubber.value = String(first);
    progress.style.width = `${(last / total) * 100}%`;
    previous.disabled = first === 1;
    next.disabled = spread.includes(total);
    zoomOut.disabled = zoom <= 0.8;
    zoomIn.disabled = zoom >= 2.2;
    zoomLabel.value = `${Math.round(zoom * 100)}%`;
    reader.dataset.zoomed = zoom > 1 ? "true" : "false";
    reader.dataset.fold = source?.foldMode || "none";
    reader.dataset.foldStage = foldStep?.id || "none";
    updateThumbnailSelection();
  }

  function createRenderedCanvas({
    page,
    pageNumber,
    panelIndex = null,
    cssScale,
    pixelRatio,
    displayWidth,
    displayHeight,
    label,
  }) {
    const canvas = document.createElement("canvas");
    const viewport = page.getViewport({ scale: 1 });
    const renderViewport = page.getViewport({ scale: cssScale * pixelRatio });
    const crop = panelIndex === null
      ? { leftRatio: 0, widthRatio: 1 }
      : resolveTriFoldPanelCrop({
          pageNumber,
          panelIndex,
          pageWidth: viewport.width,
          panelBoundaries: source?.panelBoundaries,
        });

    canvas.width = Math.ceil(renderViewport.width * crop.widthRatio);
    canvas.height = Math.ceil(renderViewport.height);
    canvas.style.width = `${Math.round(displayWidth)}px`;
    canvas.style.height = `${Math.round(displayHeight)}px`;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", label);

    const renderOptions = {
      canvasContext: canvas.getContext("2d", { alpha: false }),
      viewport: renderViewport,
    };
    if (panelIndex !== null) {
      renderOptions.transform = [1, 0, 0, 1, -renderViewport.width * crop.leftRatio, 0];
    }

    return { canvas, renderPromise: page.render(renderOptions).promise };
  }

  async function renderTriFoldCurrent(revision) {
    const step = foldSteps[currentPage - 1] || foldSteps[0];
    const coverPanel = resolveTriFoldCoverPanel(source?.previewPanelIndex);
    const insidePanelOrder = resolveTriFoldInsideOrder(source?.foldLayout?.insidePanelOrder);
    const closingPanelIndex = optionalPanelIndex(source?.foldLayout?.closingPanelIndex)
      ?? (coverPanel === 0 ? 2 : 0);
    const backCoverPanelIndex = optionalPanelIndex(source?.foldLayout?.backCoverPanelIndex);
    const openingLeafLayout = resolveTriFoldOpeningLeaf({
      coverPanelIndex: coverPanel,
      insidePanelOrder,
      closingPanelIndex,
      backCoverPanelIndex,
    });
    const renderKey = `${stage.clientWidth}x${stage.clientHeight}@${zoom}`;
    const existingBook = pages.querySelector(".tri-fold-book");
    if (existingBook && pages.dataset.renderKey === renderKey) {
      existingBook.setAttribute("aria-label", `三折頁：${step.label}`);
      pages.dataset.foldStage = step.id;
      setBusy(false);
      return;
    }

    setBusy(true, "正在依折線展開節目冊…");
    const outsidePageNumber = 1;
    const insidePageNumber = Math.min(2, pageCount);
    const [outsidePage, insidePage] = await Promise.all([
      pdfDocument.getPage(outsidePageNumber),
      pdfDocument.getPage(insidePageNumber),
    ]);
    if (revision !== renderRevision) return;

    const insideViewport = insidePage.getViewport({ scale: 1 });
    const fitScale = fitTriFoldScale({
      stageWidth: stage.clientWidth,
      stageHeight: stage.clientHeight,
      pageWidth: insideViewport.width,
      pageHeight: insideViewport.height,
      horizontalPadding: 72,
      verticalPadding: 42,
    });
    const cssScale = Math.max(0.12, fitScale * zoom);
    const pixelRatio = clamp(window.devicePixelRatio || 1, 1, 2);
    const panelWidth = (insideViewport.width / 3) * cssScale;
    const displayHeight = insideViewport.height * cssScale;

    const book = document.createElement("div");
    book.className = "tri-fold-book";
    book.setAttribute("role", "img");
    book.setAttribute("aria-label", `三折頁：${step.label}`);
    book.style.setProperty("--fold-panel-width", `${panelWidth}px`);
    book.style.setProperty("--fold-sheet-height", `${displayHeight}px`);

    const assembly = document.createElement("div");
    assembly.className = "tri-fold-book__assembly";
    const renderJobs = [];

    for (let panelIndex = 0; panelIndex < 3; panelIndex += 1) {
      const panel = document.createElement("section");
      panel.className = `tri-fold-panel tri-fold-panel--${panelIndex}`;
      panel.setAttribute("aria-hidden", "true");

      const front = document.createElement("div");
      front.className = "tri-fold-panel__face tri-fold-panel__face--front";
      const frontRender = createRenderedCanvas({
        page: insidePage,
        pageNumber: insidePageNumber,
        panelIndex: insidePanelOrder[panelIndex],
        cssScale,
        pixelRatio,
        displayWidth: panelWidth,
        displayHeight,
        label: `節目冊內頁第 ${panelIndex + 1} 欄`,
      });
      front.append(frontRender.canvas);
      renderJobs.push(frontRender.renderPromise);

      const back = document.createElement("div");
      back.className = "tri-fold-panel__face tri-fold-panel__face--back";
      const backRender = createRenderedCanvas({
        page: outsidePage,
        pageNumber: outsidePageNumber,
        panelIndex,
        cssScale,
        pixelRatio,
        displayWidth: panelWidth,
        displayHeight,
        label: `節目冊外側第 ${panelIndex + 1} 欄`,
      });
      back.append(backRender.canvas);
      renderJobs.push(backRender.renderPromise);

      panel.append(front, back);
      assembly.append(panel);
    }

    if (openingLeafLayout) {
      const openingLeaf = document.createElement("div");
      openingLeaf.className = "tri-fold-book__opening-leaf";
      openingLeaf.setAttribute("aria-hidden", "true");
      openingLeaf.dataset.hinge = openingLeafLayout.hinge;
      openingLeaf.style.setProperty("--fold-opening-position", String(openingLeafLayout.positionPanelIndex));
      openingLeaf.style.setProperty("--fold-opening-rotation", `${openingLeafLayout.openRotation}deg`);
      openingLeaf.style.setProperty("--fold-opening-hinge", openingLeafLayout.hinge);

      const openingFront = document.createElement("div");
      openingFront.className = "tri-fold-opening-face tri-fold-opening-face--front";
      const openingFrontRender = createRenderedCanvas({
        page: outsidePage,
        pageNumber: outsidePageNumber,
        panelIndex: openingLeafLayout.outsidePanelIndex,
        cssScale,
        pixelRatio,
        displayWidth: panelWidth,
        displayHeight,
        label: "向右展開的表演者頁",
      });
      openingFront.append(openingFrontRender.canvas);
      renderJobs.push(openingFrontRender.renderPromise);

      const openingBack = document.createElement("div");
      openingBack.className = "tri-fold-opening-face tri-fold-opening-face--back";
      const openingBackRender = createRenderedCanvas({
        page: insidePage,
        pageNumber: insidePageNumber,
        panelIndex: openingLeafLayout.insidePanelIndex,
        cssScale,
        pixelRatio,
        displayWidth: panelWidth,
        displayHeight,
        label: "展開後的大提琴與鋼琴頁",
      });
      openingBack.append(openingBackRender.canvas);
      renderJobs.push(openingBackRender.renderPromise);

      openingLeaf.append(openingFront, openingBack);
      assembly.append(openingLeaf);
    }

    if (backCoverPanelIndex !== null) {
      const closingLeaf = document.createElement("div");
      closingLeaf.className = "tri-fold-book__closing-leaf";
      closingLeaf.setAttribute("aria-hidden", "true");

      const closingFront = document.createElement("div");
      closingFront.className = "tri-fold-closing-face tri-fold-closing-face--front";
      const closingFrontRender = createRenderedCanvas({
        page: outsidePage,
        pageNumber: outsidePageNumber,
        panelIndex: closingPanelIndex,
        cssScale,
        pixelRatio,
        displayWidth: panelWidth,
        displayHeight,
        label: "折回後的右頁",
      });
      closingFront.append(closingFrontRender.canvas);
      renderJobs.push(closingFrontRender.renderPromise);

      const closingBack = document.createElement("div");
      closingBack.className = "tri-fold-closing-face tri-fold-closing-face--back";
      const closingBackRender = createRenderedCanvas({
        page: outsidePage,
        pageNumber: outsidePageNumber,
        panelIndex: backCoverPanelIndex,
        cssScale,
        pixelRatio,
        displayWidth: panelWidth,
        displayHeight,
        label: "節目冊封底",
      });
      closingBack.append(closingBackRender.canvas);
      renderJobs.push(closingBackRender.renderPromise);

      closingLeaf.append(closingFront, closingBack);
      assembly.append(closingLeaf);
    }

    book.append(assembly);
    if (foldSteps.some(({ id }) => id === "outside-open")) {
      const reverse = document.createElement("div");
      reverse.className = "tri-fold-book__reverse";
      reverse.setAttribute("aria-hidden", "true");
      const reverseRender = createRenderedCanvas({
        page: outsidePage,
        pageNumber: outsidePageNumber,
        cssScale,
        pixelRatio,
        displayWidth: panelWidth * 3,
        displayHeight,
        label: "節目冊完整外側",
      });
      reverse.append(reverseRender.canvas);
      renderJobs.push(reverseRender.renderPromise);
      book.append(reverse);
    }
    pages.replaceChildren(book);
    pages.dataset.mode = "fold";
    pages.dataset.foldStage = step.id;
    pages.dataset.coverPanel = String(coverPanel);
    pages.dataset.openingLeaf = openingLeafLayout ? "true" : "false";
    pages.dataset.renderKey = renderKey;

    try {
      await Promise.all(renderJobs);
      if (revision !== renderRevision) return;
      book.classList.add("is-rendered");
      setBusy(false);
    } catch (error) {
      if (revision !== renderRevision) return;
      setBusy(false);
      empty.hidden = false;
      empty.textContent = "三折頁暫時無法顯示，請稍後再試或下載原始 PDF。";
      onError?.(error);
    }
  }

  async function renderCurrent(direction = 0) {
    if (!pdfDocument || !pageCount) return;

    const revision = ++renderRevision;
    const spread = currentSpread();
    reader.dataset.turn = direction < 0 ? "previous" : direction > 0 ? "next" : "still";
    reader.dataset.mode = pageMode;
    updateChrome();

    if (pageMode === "fold") {
      await renderTriFoldCurrent(revision);
      window.setTimeout(() => {
        if (reader.dataset.turn !== "still") reader.dataset.turn = "still";
      }, 820);
      return;
    }

    setBusy(true, "正在翻到下一頁…");

    const records = await Promise.all(
      spread.map(async (position) => {
        const panel = pageMode === "panel" ? panelOrder[position - 1] : null;
        const pageNumber = panel?.pageNumber || position;
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const crop = panel
          ? resolveTriFoldPanelCrop({
              pageNumber,
              panelIndex: panel.panelIndex,
              pageWidth: viewport.width,
              panelBoundaries: source?.panelBoundaries,
            })
          : null;
        return {
          page,
          pageNumber,
          panelIndex: panel?.panelIndex ?? null,
          position,
          viewport,
          crop,
          displayWidth: crop?.width || viewport.width,
        };
      }),
    );

    if (revision !== renderRevision) return;

    const gap = spread.length > 1 ? 3 : 0;
    const baseWidth = records.reduce((sum, record) => sum + record.displayWidth, 0);
    const baseHeight = Math.max(...records.map((record) => record.viewport.height));
    const stageMargin = window.innerWidth < 620 ? 16 : 48;
    const availableWidth = Math.max(pageMode === "panel" ? 220 : 260, stage.clientWidth - stageMargin - gap);
    const availableHeight = Math.max(280, stage.clientHeight - 44);
    const fitScale = pageMode === "panel"
      ? availableWidth / baseWidth
      : Math.min(availableWidth / baseWidth, availableHeight / baseHeight);
    const cssScale = Math.max(0.12, fitScale * zoom);
    const pixelRatio = clamp(window.devicePixelRatio || 1, 1, 2);

    const fragment = document.createDocumentFragment();
    const renderJobs = records.map(({ page, pageNumber, panelIndex, position, viewport, crop, displayWidth }, index) => {
      const frame = document.createElement("figure");
      frame.className = "publication-page";
      frame.dataset.pageNumber = String(position);
      frame.dataset.sourcePage = String(pageNumber);
      if (panelIndex !== null) {
        frame.dataset.panelIndex = String(panelIndex);
        frame.classList.add("publication-page--panel");
      }
      if (spread.length > 1 && index === 0) frame.classList.add("publication-page--left");
      if (spread.length > 1 && index === 1) frame.classList.add("publication-page--right");

      const canvas = document.createElement("canvas");
      const renderViewport = page.getViewport({ scale: cssScale * pixelRatio });
      const panelPixelWidth = renderViewport.width * (crop?.widthRatio || 1);
      canvas.width = Math.ceil(panelIndex === null ? renderViewport.width : panelPixelWidth);
      canvas.height = Math.ceil(renderViewport.height);
      canvas.style.width = `${Math.round(displayWidth * cssScale)}px`;
      canvas.style.height = `${Math.round(viewport.height * cssScale)}px`;
      canvas.setAttribute("role", "img");
      canvas.setAttribute(
        "aria-label",
        pageMode === "panel"
          ? source?.panelLabels?.[position - 1] || `節目冊第 ${position} 欄`
          : `節目冊第 ${pageNumber} 頁`,
      );
      frame.append(canvas);
      fragment.append(frame);

      const renderOptions = {
        canvasContext: canvas.getContext("2d", { alpha: false }),
        viewport: renderViewport,
      };
      if (panelIndex !== null) {
        renderOptions.transform = [1, 0, 0, 1, -renderViewport.width * crop.leftRatio, 0];
      }

      return page.render(renderOptions).promise
        .then(() => frame.classList.add("is-rendered"));
    });

    pages.replaceChildren(fragment);
    pages.dataset.mode = pageMode;
    if (direction !== 0) {
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
    }

    try {
      await Promise.all(renderJobs);
      if (revision !== renderRevision) return;
      setBusy(false);
      window.setTimeout(() => {
        if (reader.dataset.turn !== "still") reader.dataset.turn = "still";
      }, 360);
    } catch (error) {
      if (revision !== renderRevision) return;
      setBusy(false);
      empty.hidden = false;
      empty.textContent = "這一頁暫時無法顯示，請稍後再試或下載原始 PDF。";
      onError?.(error);
    }
  }

  function normalizePage(pageNumber) {
    const total = readingPositionCount();
    const page = clamp(Number(pageNumber) || 1, 1, Math.max(1, total));
    return pageMode === "panel" || pageMode === "fold"
      ? page
      : publicationSpread(page, pageCount, pageMode)[0];
  }

  function goTo(pageNumber, direction = 0) {
    if (!pdfDocument) return;
    const nextPage = normalizePage(pageNumber);
    if (nextPage === currentPage && pages.childElementCount) return;
    if (nextPage !== currentPage && isMobileReader()) {
      setChromeVisible(false, { autoHide: false });
    }
    currentPage = nextPage;
    renderCurrent(direction);
  }

  function move(direction) {
    if (!pdfDocument) return;
    const nextPage = movePublicationPage(currentPage, direction, readingPositionCount(), pageMode);
    if (nextPage !== currentPage && zoom > 1) zoom = 1;
    goTo(nextPage, direction);
  }

  async function setZoom(nextZoom, focalPoint = null, { focusAnchor = null } = {}) {
    const normalized = normalizePublicationZoom(nextZoom);
    const stageRect = stage.getBoundingClientRect();
    const activeCanvas = pages.querySelector(".publication-page canvas");
    const canvasRect = activeCanvas?.getBoundingClientRect();
    const point = focalPoint || {
      x: stageRect.left + stageRect.width / 2,
      y: stageRect.top + stageRect.height / 2,
    };
    const anchor = focusAnchor || (canvasRect
      ? resolvePublicationFocusAnchor({ point, rect: canvasRect })
      : { x: 0.5, y: 0.5 });

    if (normalized === zoom) {
      if (zoom > 1 && activeCanvas && focusAnchor) {
        const target = resolvePublicationFocusScroll({
          stageRect,
          canvasRect,
          scrollLeft: stage.scrollLeft,
          scrollTop: stage.scrollTop,
          focusAnchor: anchor,
          focalPoint: point,
        });
        stage.scrollTo({ ...target, behavior: "auto" });
      }
      return;
    }

    zoom = normalized;
    await renderCurrent(0);
    await nextFrame();

    if (zoom <= 1) {
      stage.scrollTo({ left: 0, top: 0, behavior: "auto" });
      return;
    }

    const nextCanvas = pages.querySelector(".publication-page canvas");
    if (!nextCanvas) return;
    const nextRect = nextCanvas.getBoundingClientRect();
    const target = resolvePublicationFocusScroll({
      stageRect,
      canvasRect: nextRect,
      scrollLeft: stage.scrollLeft,
      scrollTop: stage.scrollTop,
      focusAnchor: anchor,
      focalPoint: point,
    });
    stage.scrollTo({ ...target, behavior: "auto" });
  }

  async function buildThumbnails() {
    if (!pdfDocument || thumbnailRail.childElementCount) return;
    const revision = ++thumbnailRevision;
    const total = readingPositionCount();

    for (let position = 1; position <= total; position += 1) {
      if (revision !== thumbnailRevision) return;
      const panel = pageMode === "panel" ? panelOrder[position - 1] : null;
      const foldStep = pageMode === "fold" ? foldSteps[position - 1] : null;
      const foldCoverPanel = resolveTriFoldCoverPanel(source?.previewPanelIndex);
      const foldClosingPanel = optionalPanelIndex(source?.foldLayout?.closingPanelIndex)
        ?? (foldCoverPanel === 0 ? 2 : 0);
      const foldBackCoverPanel = optionalPanelIndex(source?.foldLayout?.backCoverPanelIndex);
      const foldPageNumber = foldStep
        ? (["closed", "first-open", "refold", "back-cover", "outside-open"].includes(foldStep.id)
            ? 1
            : Math.min(2, pageCount))
        : null;
      const pageNumber = panel?.pageNumber || foldPageNumber || position;
      const panelIndex = panel?.panelIndex
        ?? (foldStep?.id === "closed"
          ? resolveTriFoldCoverPanel(source?.previewPanelIndex)
          : ["first-open", "refold"].includes(foldStep?.id)
            ? foldClosingPanel
            : foldStep?.id === "back-cover" && foldBackCoverPanel !== null
              ? foldBackCoverPanel
              : null);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "publication-thumbnail";
      button.dataset.pageNumber = String(position);
      button.setAttribute(
        "aria-label",
        pageMode === "panel"
          ? `前往${source?.panelLabels?.[position - 1] || `第 ${position} 欄`}`
          : foldStep
            ? `前往${foldStep.label}`
          : `前往第 ${pageNumber} 頁`,
      );

      const canvas = document.createElement("canvas");
      const number = document.createElement("span");
      number.textContent = padPage(position);
      button.append(canvas, number);
      thumbnailRail.append(button);

      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const crop = panelIndex === null
        ? null
        : resolveTriFoldPanelCrop({
            pageNumber,
            panelIndex,
            pageWidth: viewport.width,
            panelBoundaries: source?.panelBoundaries,
          });
      const displayWidth = crop?.width || viewport.width;
      const thumbScale = Math.min(104 / displayWidth, 78 / viewport.height);
      const thumbViewport = page.getViewport({ scale: thumbScale * 1.4 });
      const panelPixelWidth = thumbViewport.width * (crop?.widthRatio || 1);
      canvas.width = Math.ceil(crop ? panelPixelWidth : thumbViewport.width);
      canvas.height = Math.ceil(thumbViewport.height);
      canvas.style.width = `${Math.round(displayWidth * thumbScale)}px`;
      canvas.style.height = `${Math.round(viewport.height * thumbScale)}px`;
      const renderOptions = {
        canvasContext: canvas.getContext("2d", { alpha: false }),
        viewport: thumbViewport,
      };
      if (crop) {
        renderOptions.transform = [1, 0, 0, 1, -thumbViewport.width * crop.leftRatio, 0];
      }
      await page.render(renderOptions).promise;
      if (position % 4 === 0) await nextFrame();
    }

    updateThumbnailSelection();
  }

  function setThumbnails(open) {
    const isOpen = Boolean(open) && Boolean(pdfDocument);
    thumbnailPanel.hidden = !isOpen;
    thumbnailToggle.setAttribute("aria-expanded", String(isOpen));
    root.dataset.thumbnails = isOpen ? "open" : "closed";
    if (isOpen) {
      setChromeVisible(true, { autoHide: false });
      buildThumbnails();
    } else if (active) {
      setChromeVisible(true);
    }
  }

  async function loadPreparedSource() {
    if (!source?.url || pdfDocument || loadingTask) return;
    empty.hidden = true;
    setBusy(true);

    try {
      const pdfjs = await loadPdfEngine();
      loadingTask = pdfjs.getDocument({ url: source.url });
      pdfDocument = await loadingTask.promise;
      pageCount = pdfDocument.numPages;
      panelOrder = source.foldMode === "tri-fold"
        ? triFoldReadingOrder(pageCount, source.readingOrder)
        : [];
      foldSteps = source.foldMode === "tri-fold"
        ? triFoldDesktopSteps(pageCount, {
            backCoverPanelIndex: source?.foldLayout?.backCoverPanelIndex,
          })
        : [];
      const firstPage = await pdfDocument.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1 });
      pageSize = { width: viewport.width, height: viewport.height };
      pageMode = choosePageMode({
        viewportWidth: window.innerWidth,
        pageWidth: pageSize.width,
        pageHeight: pageSize.height,
        foldMode: source.foldMode,
      });
      currentPage = 1;
      loadingTask = null;
      await renderCurrent(0);
      if (active) {
        setChromeVisible(true);
        showGestureHint();
      }
    } catch (error) {
      loadingTask = null;
      pdfDocument = null;
      setBusy(false);
      empty.hidden = false;
      empty.textContent = "節目冊暫時無法展開。你仍可使用右上角下載原始 PDF。";
      onError?.(error);
    }
  }

  async function prepare(nextSource) {
    renderRevision += 1;
    thumbnailRevision += 1;
    setThumbnails(false);
    thumbnailRail.replaceChildren();
    pages.replaceChildren();
    empty.hidden = true;
    setBusy(false);

    if (loadingTask) {
      await loadingTask.destroy().catch(() => {});
      loadingTask = null;
    }
    if (pdfDocument) {
      await pdfDocument.destroy().catch(() => {});
      pdfDocument = null;
    }

    source = nextSource || null;
    currentPage = 1;
    pageCount = 0;
    pageMode = "single";
    panelOrder = [];
    foldSteps = [];
    zoom = 1;
    showPreview(source);
    caption.textContent = source?.caption || "原始印刷節目冊";
    download.hidden = !source?.url;

    if (source?.url) {
      download.href = source.downloadUrl || source.url;
      if (source.forceDownload) {
        download.setAttribute("download", source.filename || "programme.pdf");
        download.removeAttribute("target");
        download.removeAttribute("rel");
      } else {
        download.removeAttribute("download");
        download.target = "_blank";
        download.rel = "noreferrer";
      }
      pageLabel.textContent = "READY";
      scrubber.max = "1";
      scrubber.value = "1";
      progress.style.width = "0%";
      return;
    }

    pageLabel.textContent = "NO PDF";
    empty.hidden = false;
    empty.textContent = "這份節目冊尚未上傳 PDF。";
    previous.disabled = true;
    next.disabled = true;
  }

  function activate() {
    active = true;
    setChromeVisible(true);
    showGestureHint();
    loadPreparedSource();
  }

  function deactivate() {
    active = false;
    clearChromeTimer();
    window.clearTimeout(hintTimer);
    window.clearTimeout(tapTimer);
    lastTap = null;
    pointerStart = null;
    activePointers.clear();
    pinchState = null;
    reader.dataset.pinching = "false";
    pages.style.removeProperty("transform");
    pages.style.removeProperty("transform-origin");
    pages.style.removeProperty("will-change");
    setChromeVisible(true, { autoHide: false });
    setThumbnails(false);
  }

  previous.addEventListener("click", () => {
    move(-1);
  });
  next.addEventListener("click", () => {
    move(1);
  });
  scrubber.addEventListener("change", () => {
    goTo(Number(scrubber.value), Number(scrubber.value) >= currentPage ? 1 : -1);
  });
  zoomOut.addEventListener("click", () => {
    revealChrome();
    setZoom(zoom - 0.2);
  });
  zoomIn.addEventListener("click", () => {
    revealChrome();
    setZoom(zoom + 0.2);
  });
  thumbnailToggle.addEventListener("click", () => setThumbnails(thumbnailPanel.hidden));
  thumbnailMobile.addEventListener("click", () => setThumbnails(true));
  thumbnailClose.addEventListener("click", () => setThumbnails(false));
  thumbnailRail.addEventListener("click", (event) => {
    const target = event.target.closest("[data-page-number]");
    if (!target) return;
    const page = Number(target.dataset.pageNumber);
    goTo(page, page >= currentPage ? 1 : -1);
    setThumbnails(false);
    if (isMobileReader()) setChromeVisible(false, { autoHide: false });
  });

  root.addEventListener("focusin", (event) => {
    if (event.target.closest(".publication-toolbar, .publication-rail, .publication-turn, .publication-thumbnails")) {
      revealChrome();
    }
  });

  fullscreen.addEventListener("click", async () => {
    revealChrome();
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await root.requestFullscreen();
    }
  });

  document.addEventListener("fullscreenchange", () => {
    const isFullscreen = document.fullscreenElement === root;
    fullscreen.setAttribute("aria-label", isFullscreen ? "離開全螢幕" : "進入全螢幕");
    fullscreen.querySelector("span").textContent = isFullscreen ? "離開全螢幕" : "全螢幕";
    if (active && pdfDocument) window.setTimeout(() => renderCurrent(0), 80);
  });

  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    }
    if (event.key === "ArrowRight" || event.key === " ") {
      event.preventDefault();
      move(1);
    }
    if (event.key === "+" || event.key === "=") setZoom(zoom + 0.2);
    if (event.key === "-") setZoom(zoom - 0.2);
    if (event.key === "Escape" && !thumbnailPanel.hidden) setThumbnails(false);
  });

  function handlePublicationTap(event) {
    const tap = { x: event.clientX, y: event.clientY, at: performance.now() };
    if (isPublicationDoubleTap(lastTap, tap)) {
      window.clearTimeout(tapTimer);
      tapTimer = null;
      lastTap = null;
      setZoom(resolvePublicationDoubleTapZoom(zoom), tap);
      return;
    }

    lastTap = tap;
    window.clearTimeout(tapTimer);
    tapTimer = window.setTimeout(() => {
      lastTap = null;
      const stageRect = stage.getBoundingClientRect();
      const action = classifyPublicationTapZone({
        clientX: tap.x,
        stageLeft: stageRect.left,
        stageWidth: stageRect.width,
        zoom,
      });
      if (action === "previous") move(-1);
      if (action === "next") move(1);
      if (action === "toggle-chrome") {
        setChromeVisible(root.dataset.chrome === "hidden");
      }
    }, 330);
  }

  function clearPendingTap({ keepLastTap = false } = {}) {
    window.clearTimeout(tapTimer);
    tapTimer = null;
    if (!keepLastTap) lastTap = null;
  }

  function capturePointer(pointerId) {
    try {
      stage.setPointerCapture?.(pointerId);
    } catch {
      // Pointer capture is an enhancement; touch-action still preserves the gesture.
    }
  }

  function releasePointer(pointerId) {
    try {
      if (stage.hasPointerCapture?.(pointerId)) stage.releasePointerCapture(pointerId);
    } catch {
      // The browser may have released capture after a cancelled system gesture.
    }
  }

  function trackedTouchPointers() {
    return [...activePointers.entries()]
      .filter(([, point]) => point.pointerType !== "mouse")
      .slice(0, 2);
  }

  function pointerDistance(first, second) {
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  function pointerMidpoint(first, second) {
    return {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
  }

  function beginPinch() {
    const pointers = trackedTouchPointers();
    if (pointers.length < 2) return false;

    const [[firstId, first], [secondId, second]] = pointers;
    const startDistance = pointerDistance(first, second);
    if (startDistance <= 0) return false;

    const focalPoint = pointerMidpoint(first, second);
    const pagesRect = pages.getBoundingClientRect();
    const activeCanvas = pages.querySelector(".publication-page canvas");
    pinchState = {
      ids: [firstId, secondId],
      startDistance,
      startZoom: zoom,
      zoom,
      startFocalPoint: focalPoint,
      focalPoint,
      focusAnchor: activeCanvas
        ? resolvePublicationFocusAnchor({ point: focalPoint, rect: activeCanvas.getBoundingClientRect() })
        : { x: 0.5, y: 0.5 },
      origin: {
        x: focalPoint.x - pagesRect.left,
        y: focalPoint.y - pagesRect.top,
      },
    };
    pointerStart = null;
    clearPendingTap();
    setChromeVisible(false, { autoHide: false });
    reader.dataset.pinching = "true";
    pages.style.willChange = "transform";
    pages.style.transformOrigin = `${pinchState.origin.x}px ${pinchState.origin.y}px`;
    return true;
  }

  function updatePinchPreview() {
    if (!pinchState) return;
    const [firstId, secondId] = pinchState.ids;
    const first = activePointers.get(firstId);
    const second = activePointers.get(secondId);
    if (!first || !second) return;

    pinchState.zoom = resolvePublicationPinchZoom({
      startZoom: pinchState.startZoom,
      startDistance: pinchState.startDistance,
      currentDistance: pointerDistance(first, second),
    });
    pinchState.focalPoint = pointerMidpoint(first, second);
    const translation = resolvePublicationPinchTranslation({
      startPoint: pinchState.startFocalPoint,
      currentPoint: pinchState.focalPoint,
    });
    pages.style.transform = `translate3d(${translation.x}px, ${translation.y}px, 0) scale(${pinchState.zoom / pinchState.startZoom})`;
  }

  function finishPinch({ commit = true } = {}) {
    if (!pinchState) return;
    const completedPinch = pinchState;
    pinchState = null;
    pointerStart = null;
    reader.dataset.pinching = "false";
    pages.style.removeProperty("transform");
    pages.style.removeProperty("transform-origin");
    pages.style.removeProperty("will-change");
    if (commit) {
      void setZoom(completedPinch.zoom, completedPinch.focalPoint, {
        focusAnchor: completedPinch.focusAnchor,
      });
    }
  }

  stage.addEventListener("dblclick", (event) => {
    if (isMobileReader()) return;
    event.preventDefault();
    setZoom(resolvePublicationDoubleTapZoom(zoom), { x: event.clientX, y: event.clientY });
  });
  stage.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    clearPendingTap({ keepLastTap: true });
    activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
    });
    capturePointer(event.pointerId);

    if (pinchState) {
      event.preventDefault();
      return;
    }

    if (beginPinch()) {
      event.preventDefault();
      return;
    }

    pointerStart = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      scrollLeft: stage.scrollLeft,
      scrollTop: stage.scrollTop,
    };
  });
  stage.addEventListener("pointermove", (event) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
    });

    if (pinchState) {
      event.preventDefault();
      updatePinchPreview();
      return;
    }

    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    const canPanVertically = stage.scrollHeight > stage.clientHeight + 1;
    const shouldPan = zoom > 1
      || (canPanVertically && Math.abs(deltaY) > Math.abs(deltaX));
    if (!shouldPan) return;

    event.preventDefault();
    if (zoom > 1) stage.scrollLeft = pointerStart.scrollLeft - deltaX;
    stage.scrollTop = pointerStart.scrollTop - deltaY;
  });
  stage.addEventListener("pointerup", (event) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
    });
    const endedPinchPointer = pinchState?.ids.includes(event.pointerId) || false;
    if (endedPinchPointer) updatePinchPreview();
    activePointers.delete(event.pointerId);
    releasePointer(event.pointerId);
    if (endedPinchPointer) {
      finishPinch();
      return;
    }
    if (pinchState) return;

    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    pointerStart = null;
    const gesture = classifyPublicationGesture({ deltaX, deltaY, zoom });
    if (gesture === "next") move(1);
    if (gesture === "previous") move(-1);
    if (gesture === "tap" && isMobileReader()) handlePublicationTap(event);
    if (gesture !== "tap") clearPendingTap();
  });
  stage.addEventListener("pointercancel", (event) => {
    const cancelledPinchPointer = pinchState?.ids.includes(event.pointerId) || false;
    activePointers.delete(event.pointerId);
    releasePointer(event.pointerId);
    if (cancelledPinchPointer) finishPinch();
    if (pointerStart?.id === event.pointerId) pointerStart = null;
    clearPendingTap();
  });

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!active || !pdfDocument) return;
      const previousMode = pageMode;
      const visiblePanel = previousMode === "panel" ? panelOrder[currentPage - 1] : null;
      const activeFoldStep = previousMode === "fold" ? foldSteps[currentPage - 1] : null;
      const coverPanel = resolveTriFoldCoverPanel(source?.previewPanelIndex);
      const insideOrder = resolveTriFoldInsideOrder(source?.foldLayout?.insidePanelOrder);
      const closingPanel = optionalPanelIndex(source?.foldLayout?.closingPanelIndex)
        ?? (coverPanel === 0 ? 2 : 0);
      const backCoverPanel = optionalPanelIndex(source?.foldLayout?.backCoverPanelIndex);
      const preferredFoldPanel = activeFoldStep?.id === "closed"
        ? { pageNumber: 1, panelIndex: coverPanel }
        : ["first-open", "refold"].includes(activeFoldStep?.id)
          ? { pageNumber: 1, panelIndex: closingPanel }
          : activeFoldStep?.id === "inside-open"
            ? { pageNumber: Math.min(2, pageCount), panelIndex: insideOrder[0] }
            : activeFoldStep?.id === "back-cover" && backCoverPanel !== null
              ? { pageNumber: 1, panelIndex: backCoverPanel }
              : activeFoldStep
                ? { pageNumber: 1, panelIndex: null }
                : null;
      const visibleSourcePage = visiblePanel?.pageNumber ?? preferredFoldPanel?.pageNumber ?? currentPage;
      const nextMode = choosePageMode({
        viewportWidth: window.innerWidth,
        pageWidth: pageSize.width,
        pageHeight: pageSize.height,
        foldMode: source?.foldMode,
      });
      if (nextMode === previousMode) {
        setChromeVisible(true);
        renderCurrent(0);
        return;
      }

      pageMode = nextMode;
      if (nextMode === "panel") {
        const preferredPanel = preferredFoldPanel || { pageNumber: visibleSourcePage, panelIndex: null };
        const panelIndex = panelOrder.findIndex((panel) => (
          panel.pageNumber === preferredPanel.pageNumber
          && (preferredPanel.panelIndex === null || panel.panelIndex === preferredPanel.panelIndex)
        ));
        currentPage = Math.max(1, panelIndex + 1);
      } else if (nextMode === "fold") {
        const preferredStepId = visiblePanel?.pageNumber === 1 && visiblePanel.panelIndex === coverPanel
          ? "closed"
          : visiblePanel?.pageNumber === 1 && visiblePanel.panelIndex === backCoverPanel
            ? "back-cover"
            : visiblePanel?.pageNumber === 1 && visiblePanel.panelIndex === closingPanel
              ? "first-open"
              : visiblePanel?.pageNumber === Math.min(2, pageCount)
                ? "inside-open"
                : "outside-open";
        const stepIndex = foldSteps.findIndex(({ id }) => id === preferredStepId);
        currentPage = stepIndex >= 0 ? stepIndex + 1 : 1;
      } else {
        currentPage = clamp(visibleSourcePage, 1, pageCount);
      }
      thumbnailRevision += 1;
      thumbnailRail.replaceChildren();
      setThumbnails(false);
      zoom = 1;
      setChromeVisible(true);
      showGestureHint();
      renderCurrent(0);
    }, 180);
  });

  return { activate, deactivate, prepare };
}
