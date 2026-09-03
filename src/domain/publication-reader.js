function clampPage(pageNumber, pageCount) {
  const total = Math.max(1, Number(pageCount) || 1);
  return Math.min(total, Math.max(1, Number(pageNumber) || 1));
}

export function triFoldReadingOrder(pageCount, configuredOrder) {
  const total = Math.max(1, Number(pageCount) || 1);
  const defaultSequence = total === 1
    ? [[1, 2], [1, 0], [1, 1]]
    : [[1, 2], [2, 0], [2, 1], [2, 2], [1, 0], [1, 1]];

  const configuredSequence = Array.isArray(configuredOrder)
    ? configuredOrder
        .map(({ pageNumber, panelIndex } = {}) => [Number(pageNumber), Number(panelIndex)])
        .filter(([pageNumber, panelIndex]) => (
          Number.isInteger(pageNumber)
          && pageNumber >= 1
          && pageNumber <= total
          && Number.isInteger(panelIndex)
          && panelIndex >= 0
          && panelIndex <= 2
        ))
    : [];
  const sequence = configuredSequence.length ? configuredSequence : defaultSequence;

  return sequence
    .map(([pageNumber, panelIndex]) => ({ pageNumber, panelIndex }));
}

export function triFoldDesktopSteps(pageCount, { backCoverPanelIndex = null } = {}) {
  const steps = [
    { id: "closed", label: "封面" },
    { id: "first-open", label: "打開第一折" },
    { id: "inside-open", label: "完整展開" },
  ];

  if ((Number(pageCount) || 0) > 1) {
    const hasBackCover = backCoverPanelIndex !== null
      && backCoverPanelIndex !== ""
      && Number.isInteger(Number(backCoverPanelIndex))
      && Number(backCoverPanelIndex) >= 0
      && Number(backCoverPanelIndex) <= 2;
    if (hasBackCover) {
      steps.push(
        { id: "refold", label: "折回右頁" },
        { id: "back-cover", label: "封底" },
      );
    } else {
      steps.push({ id: "outside-open", label: "翻至背面" });
    }
  }

  return steps;
}

export function resolveTriFoldInsideOrder(configuredOrder) {
  const order = Array.isArray(configuredOrder) ? configuredOrder.map(Number) : [];
  const isPermutation = order.length === 3
    && order.every((panelIndex) => Number.isInteger(panelIndex) && panelIndex >= 0 && panelIndex <= 2)
    && new Set(order).size === 3;
  return isPermutation ? order : [0, 1, 2];
}

export function resolveTriFoldCoverPanel(panelIndex) {
  return Number(panelIndex) === 2 ? 2 : 0;
}

export function resolveTriFoldOpeningLeaf({
  coverPanelIndex,
  insidePanelOrder,
  closingPanelIndex,
  backCoverPanelIndex,
} = {}) {
  const hasBackCover = backCoverPanelIndex !== null
    && backCoverPanelIndex !== ""
    && Number.isInteger(Number(backCoverPanelIndex))
    && Number(backCoverPanelIndex) >= 0
    && Number(backCoverPanelIndex) <= 2;
  if (resolveTriFoldCoverPanel(coverPanelIndex) !== 0 || !hasBackCover) return null;

  const insideOrder = resolveTriFoldInsideOrder(insidePanelOrder);
  const outsidePanel = Number(closingPanelIndex);

  return {
    positionPanelIndex: 1,
    hinge: "right",
    openRotation: 180,
    outsidePanelIndex: Number.isInteger(outsidePanel) && outsidePanel >= 0 && outsidePanel <= 2
      ? outsidePanel
      : 2,
    insidePanelIndex: insideOrder[2],
  };
}

export function resolveTriFoldActiveLeaf({ foldStage, direction } = {}) {
  if (foldStage === "back-cover") return "closing";
  if (foldStage === "refold" && direction === "previous") return "closing";
  return "opening";
}

export function resolveTriFoldPanelCrop({ pageNumber, panelIndex, pageWidth, panelBoundaries }) {
  const fallback = [0, 1 / 3, 2 / 3, 1];
  const configured = panelBoundaries?.[String(Number(pageNumber) || 1)];
  const validBoundaries = Array.isArray(configured)
    && configured.length === 4
    && configured.every((value) => Number.isFinite(Number(value)))
    && configured.every((value, index) => index === 0 || Number(value) > Number(configured[index - 1]))
    && Number(configured[0]) >= 0
    && Number(configured[3]) <= 1;
  const boundaries = validBoundaries ? configured.map(Number) : fallback;
  const index = Math.min(2, Math.max(0, Number(panelIndex) || 0));
  const width = Math.max(1, Number(pageWidth) || 1);
  const leftRatio = boundaries[index];
  const rightRatio = boundaries[index + 1];

  return {
    left: width * leftRatio,
    width: width * (rightRatio - leftRatio),
    leftRatio,
    widthRatio: rightRatio - leftRatio,
  };
}

export function classifyPublicationGesture({ deltaX, deltaY, zoom }) {
  const horizontal = Number(deltaX) || 0;
  const vertical = Number(deltaY) || 0;
  const movement = Math.hypot(horizontal, vertical);

  if ((Number(zoom) || 1) > 1) return movement <= 9 ? "tap" : "pan";
  if (movement <= 9) return "tap";
  if (Math.abs(horizontal) >= 48 && Math.abs(horizontal) > Math.abs(vertical) * 1.15) {
    return horizontal < 0 ? "next" : "previous";
  }
  return "none";
}

export function isPublicationDoubleTap(previousTap, currentTap) {
  if (!previousTap || !currentTap) return false;
  const elapsed = Number(currentTap.at) - Number(previousTap.at);
  const distance = Math.hypot(
    Number(currentTap.x) - Number(previousTap.x),
    Number(currentTap.y) - Number(previousTap.y),
  );
  return elapsed >= 0 && elapsed <= 320 && distance <= 32;
}

export function classifyPublicationTapZone({
  clientX,
  stageLeft = 0,
  stageWidth,
  zoom = 1,
  edgeRatio = 0.3,
}) {
  if ((Number(zoom) || 1) > 1) return "toggle-chrome";

  const width = Number(stageWidth);
  if (!Number.isFinite(width) || width <= 0) return "toggle-chrome";

  const ratio = Math.min(0.45, Math.max(0.2, Number(edgeRatio) || 0.3));
  const position = (Number(clientX) - (Number(stageLeft) || 0)) / width;
  if (position <= ratio) return "previous";
  if (position >= 1 - ratio) return "next";
  return "toggle-chrome";
}

export function resolvePublicationPinchZoom({
  startZoom,
  startDistance,
  currentDistance,
  minZoom = 1,
  maxZoom = 2.2,
}) {
  const minimum = Number(minZoom) || 1;
  const maximum = Math.max(minimum, Number(maxZoom) || 2.2);
  const initialZoom = Math.min(maximum, Math.max(minimum, Number(startZoom) || 1));
  const initialDistance = Number(startDistance);
  const nextDistance = Number(currentDistance);

  if (!Number.isFinite(initialDistance) || initialDistance <= 0) return initialZoom;
  if (!Number.isFinite(nextDistance) || nextDistance <= 0) return initialZoom;
  return Math.min(maximum, Math.max(minimum, initialZoom * (nextDistance / initialDistance)));
}

export function normalizePublicationZoom(nextZoom, { minZoom = 0.8, maxZoom = 2.2 } = {}) {
  const minimum = Number(minZoom) || 0.8;
  const maximum = Math.max(minimum, Number(maxZoom) || 2.2);
  const requested = Number.isFinite(Number(nextZoom)) ? Number(nextZoom) : 1;
  return Math.round(Math.min(maximum, Math.max(minimum, requested)) * 100) / 100;
}

export function resolvePublicationDoubleTapZoom(currentZoom, expandedZoom = 2.2) {
  return Number(currentZoom) > 1 ? 1 : Number(expandedZoom) || 2.2;
}

export function resolvePublicationFocusAnchor({ point, rect }) {
  const left = Number(rect?.left) || 0;
  const top = Number(rect?.top) || 0;
  const width = Math.max(1, Number(rect?.width) || 1);
  const height = Math.max(1, Number(rect?.height) || 1);
  const x = Number.isFinite(Number(point?.x)) ? Number(point.x) : left + width / 2;
  const y = Number.isFinite(Number(point?.y)) ? Number(point.y) : top + height / 2;

  return {
    x: Math.min(1, Math.max(0, (x - left) / width)),
    y: Math.min(1, Math.max(0, (y - top) / height)),
  };
}

export function resolvePublicationPinchTranslation({ startPoint, currentPoint }) {
  return {
    x: (Number(currentPoint?.x) || 0) - (Number(startPoint?.x) || 0),
    y: (Number(currentPoint?.y) || 0) - (Number(startPoint?.y) || 0),
  };
}

export function resolvePublicationFocusScroll({
  stageRect,
  canvasRect,
  scrollLeft,
  scrollTop,
  focusAnchor,
  focalPoint,
}) {
  const stageLeft = Number(stageRect?.left) || 0;
  const stageTop = Number(stageRect?.top) || 0;
  const canvasLeft = Number(canvasRect?.left) || 0;
  const canvasTop = Number(canvasRect?.top) || 0;
  const canvasWidth = Math.max(1, Number(canvasRect?.width) || 1);
  const canvasHeight = Math.max(1, Number(canvasRect?.height) || 1);
  const anchorX = Math.min(1, Math.max(0, Number(focusAnchor?.x) || 0));
  const anchorY = Math.min(1, Math.max(0, Number(focusAnchor?.y) || 0));
  const pointX = Number.isFinite(Number(focalPoint?.x)) ? Number(focalPoint.x) : stageLeft;
  const pointY = Number.isFinite(Number(focalPoint?.y)) ? Number(focalPoint.y) : stageTop;
  const contentLeft = canvasLeft + (Number(scrollLeft) || 0) - stageLeft;
  const contentTop = canvasTop + (Number(scrollTop) || 0) - stageTop;

  return {
    left: contentLeft + anchorX * canvasWidth - (pointX - stageLeft),
    top: contentTop + anchorY * canvasHeight - (pointY - stageTop),
  };
}

export function fitTriFoldScale({
  stageWidth,
  stageHeight,
  pageWidth,
  pageHeight,
  horizontalPadding = 0,
  verticalPadding = 0,
}) {
  const availableWidth = Math.max(1, Number(stageWidth) - Number(horizontalPadding));
  const availableHeight = Math.max(1, Number(stageHeight) - Number(verticalPadding));
  const width = Math.max(1, Number(pageWidth) || 1);
  const height = Math.max(1, Number(pageHeight) || 1);
  return Math.max(0.12, Math.min(availableWidth / width, availableHeight / height));
}

export function choosePageMode({ viewportWidth, pageWidth, pageHeight, foldMode }) {
  const viewport = Number(viewportWidth) || 0;
  const width = Number(pageWidth) || 1;
  const height = Number(pageHeight) || 1;
  const isLandscape = width / height >= 1.08;

  if (foldMode === "tri-fold") return viewport < 900 ? "panel" : "fold";
  return viewport >= 800 && !isLandscape ? "spread" : "single";
}

export function publicationSpread(pageNumber, pageCount, mode = "single") {
  const total = Math.max(1, Number(pageCount) || 1);
  const page = clampPage(pageNumber, total);

  if (mode !== "spread" || page === 1) return [page];

  const spreadStart = page % 2 === 0 ? page : page - 1;
  return [spreadStart, spreadStart + 1].filter((candidate) => candidate <= total);
}

export function movePublicationPage(pageNumber, direction, pageCount, mode = "single") {
  const total = Math.max(1, Number(pageCount) || 1);
  const page = clampPage(pageNumber, total);
  const step = Math.sign(Number(direction) || 0);

  if (!step) return page;
  if (mode !== "spread") return clampPage(page + step, total);

  const spread = publicationSpread(page, total, mode);
  const spreadStart = spread[0];

  if (step < 0) return spreadStart <= 2 ? 1 : spreadStart - 2;
  if (spread.includes(total)) return spreadStart;
  return spreadStart === 1 ? Math.min(2, total) : Math.min(spreadStart + 2, total);
}
