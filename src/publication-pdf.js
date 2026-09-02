import {
  choosePageMode,
  movePublicationPage,
  publicationSpread,
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

function nextFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(resolve));
}

export function createPublicationViewer(root, { onError } = {}) {
  const reader = root.querySelector("#pdf-reader");
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

  let source = null;
  let pdfDocument = null;
  let loadingTask = null;
  let currentPage = 1;
  let pageCount = 0;
  let pageMode = "single";
  let pageSize = { width: 1, height: 1 };
  let zoom = 1;
  let renderRevision = 0;
  let thumbnailRevision = 0;
  let resizeTimer;
  let pointerStart = null;
  let active = false;

  function currentSpread() {
    return publicationSpread(currentPage, pageCount, pageMode);
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
    const spread = currentSpread();
    const first = spread[0];
    const last = spread.at(-1);
    pageLabel.textContent = spread.length > 1
      ? `${padPage(first)}–${padPage(last)} / ${padPage(pageCount)}`
      : `${padPage(first)} / ${padPage(pageCount)}`;
    scrubber.max = String(pageCount);
    scrubber.value = String(first);
    progress.style.width = `${(last / pageCount) * 100}%`;
    previous.disabled = first === 1;
    next.disabled = spread.includes(pageCount);
    zoomOut.disabled = zoom <= 0.8;
    zoomIn.disabled = zoom >= 2.2;
    zoomLabel.value = `${Math.round(zoom * 100)}%`;
    reader.dataset.zoomed = zoom > 1.01 ? "true" : "false";
    updateThumbnailSelection();
  }

  async function renderCurrent(direction = 0) {
    if (!pdfDocument || !pageCount) return;

    const revision = ++renderRevision;
    const spread = currentSpread();
    reader.dataset.turn = direction < 0 ? "previous" : direction > 0 ? "next" : "still";
    reader.dataset.mode = pageMode;
    setBusy(true, "正在翻到下一頁…");
    updateChrome();

    const records = await Promise.all(
      spread.map(async (pageNumber) => {
        const page = await pdfDocument.getPage(pageNumber);
        return { page, pageNumber, viewport: page.getViewport({ scale: 1 }) };
      }),
    );

    if (revision !== renderRevision) return;

    const gap = spread.length > 1 ? 3 : 0;
    const baseWidth = records.reduce((sum, record) => sum + record.viewport.width, 0);
    const baseHeight = Math.max(...records.map((record) => record.viewport.height));
    const stageMargin = window.innerWidth < 620 ? 16 : 48;
    const availableWidth = Math.max(260, stage.clientWidth - stageMargin - gap);
    const availableHeight = Math.max(280, stage.clientHeight - 44);
    const fitScale = Math.min(availableWidth / baseWidth, availableHeight / baseHeight);
    const cssScale = Math.max(0.12, fitScale * zoom);
    const pixelRatio = clamp(window.devicePixelRatio || 1, 1, 2);

    const fragment = document.createDocumentFragment();
    const renderJobs = records.map(({ page, pageNumber, viewport }, index) => {
      const frame = document.createElement("figure");
      frame.className = "publication-page";
      frame.dataset.pageNumber = String(pageNumber);
      if (spread.length > 1 && index === 0) frame.classList.add("publication-page--left");
      if (spread.length > 1 && index === 1) frame.classList.add("publication-page--right");

      const canvas = document.createElement("canvas");
      const renderViewport = page.getViewport({ scale: cssScale * pixelRatio });
      canvas.width = Math.ceil(renderViewport.width);
      canvas.height = Math.ceil(renderViewport.height);
      canvas.style.width = `${Math.round(viewport.width * cssScale)}px`;
      canvas.style.height = `${Math.round(viewport.height * cssScale)}px`;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `節目冊第 ${pageNumber} 頁`);
      frame.append(canvas);
      fragment.append(frame);

      return page.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport: renderViewport }).promise
        .then(() => frame.classList.add("is-rendered"));
    });

    pages.replaceChildren(fragment);
    pages.dataset.mode = pageMode;

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
    const page = clamp(Number(pageNumber) || 1, 1, Math.max(1, pageCount));
    return publicationSpread(page, pageCount, pageMode)[0];
  }

  function goTo(pageNumber, direction = 0) {
    if (!pdfDocument) return;
    const nextPage = normalizePage(pageNumber);
    if (nextPage === currentPage && pages.childElementCount) return;
    currentPage = nextPage;
    renderCurrent(direction);
  }

  function move(direction) {
    if (!pdfDocument) return;
    const nextPage = movePublicationPage(currentPage, direction, pageCount, pageMode);
    goTo(nextPage, direction);
  }

  function setZoom(nextZoom) {
    const normalized = Math.round(clamp(nextZoom, 0.8, 2.2) * 10) / 10;
    if (normalized === zoom) return;
    zoom = normalized;
    renderCurrent(0);
  }

  async function buildThumbnails() {
    if (!pdfDocument || thumbnailRail.childElementCount) return;
    const revision = ++thumbnailRevision;

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      if (revision !== thumbnailRevision) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "publication-thumbnail";
      button.dataset.pageNumber = String(pageNumber);
      button.setAttribute("aria-label", `前往第 ${pageNumber} 頁`);

      const canvas = document.createElement("canvas");
      const number = document.createElement("span");
      number.textContent = padPage(pageNumber);
      button.append(canvas, number);
      thumbnailRail.append(button);

      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const thumbScale = Math.min(104 / viewport.width, 78 / viewport.height);
      const thumbViewport = page.getViewport({ scale: thumbScale * 1.4 });
      canvas.width = Math.ceil(thumbViewport.width);
      canvas.height = Math.ceil(thumbViewport.height);
      canvas.style.width = `${Math.round(viewport.width * thumbScale)}px`;
      canvas.style.height = `${Math.round(viewport.height * thumbScale)}px`;
      await page.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport: thumbViewport }).promise;
      if (pageNumber % 4 === 0) await nextFrame();
    }

    updateThumbnailSelection();
  }

  function setThumbnails(open) {
    const isOpen = Boolean(open) && Boolean(pdfDocument);
    thumbnailPanel.hidden = !isOpen;
    thumbnailToggle.setAttribute("aria-expanded", String(isOpen));
    root.dataset.thumbnails = isOpen ? "open" : "closed";
    if (isOpen) buildThumbnails();
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
      const firstPage = await pdfDocument.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1 });
      pageSize = { width: viewport.width, height: viewport.height };
      pageMode = choosePageMode({ viewportWidth: window.innerWidth, pageWidth: pageSize.width, pageHeight: pageSize.height });
      currentPage = 1;
      loadingTask = null;
      await renderCurrent(0);
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
    zoom = 1;
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
    loadPreparedSource();
  }

  function deactivate() {
    active = false;
    setThumbnails(false);
  }

  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  scrubber.addEventListener("change", () => goTo(Number(scrubber.value), Number(scrubber.value) >= currentPage ? 1 : -1));
  zoomOut.addEventListener("click", () => setZoom(zoom - 0.2));
  zoomIn.addEventListener("click", () => setZoom(zoom + 0.2));
  thumbnailToggle.addEventListener("click", () => setThumbnails(thumbnailPanel.hidden));
  thumbnailMobile.addEventListener("click", () => setThumbnails(true));
  thumbnailClose.addEventListener("click", () => setThumbnails(false));
  thumbnailRail.addEventListener("click", (event) => {
    const target = event.target.closest("[data-page-number]");
    if (!target) return;
    const page = Number(target.dataset.pageNumber);
    goTo(page, page >= currentPage ? 1 : -1);
    setThumbnails(false);
  });

  fullscreen.addEventListener("click", async () => {
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

  stage.addEventListener("dblclick", () => setZoom(zoom > 1.01 ? 1 : 1.6));
  stage.addEventListener("pointerdown", (event) => {
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  stage.addEventListener("pointerup", (event) => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY)) {
      move(deltaX < 0 ? 1 : -1);
      return;
    }
    if (window.innerWidth < 700 && Math.abs(deltaX) < 9 && Math.abs(deltaY) < 9 && event.target.closest("canvas")) {
      setZoom(zoom > 1.01 ? 1 : 1.8);
    }
  });
  stage.addEventListener("pointercancel", () => {
    pointerStart = null;
  });

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!active || !pdfDocument) return;
      const nextMode = choosePageMode({ viewportWidth: window.innerWidth, pageWidth: pageSize.width, pageHeight: pageSize.height });
      pageMode = nextMode;
      currentPage = normalizePage(currentPage);
      renderCurrent(0);
    }, 180);
  });

  return { activate, deactivate, prepare };
}
