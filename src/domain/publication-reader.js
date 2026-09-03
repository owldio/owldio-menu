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

export function triFoldDesktopSteps(pageCount) {
  const steps = [
    { id: "closed", label: "封面" },
    { id: "first-open", label: "打開第一折" },
    { id: "inside-open", label: "完整展開" },
  ];

  if ((Number(pageCount) || 0) > 1) {
    steps.push({ id: "outside-open", label: "翻至背面" });
  }

  return steps;
}

export function resolveTriFoldCoverPanel(panelIndex) {
  return Number(panelIndex) === 2 ? 2 : 0;
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

  if ((Number(zoom) || 1) > 1.01) return movement <= 9 ? "tap" : "pan";
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
