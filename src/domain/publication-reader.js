function clampPage(pageNumber, pageCount) {
  const total = Math.max(1, Number(pageCount) || 1);
  return Math.min(total, Math.max(1, Number(pageNumber) || 1));
}

export function triFoldReadingOrder(pageCount) {
  const total = Math.max(1, Number(pageCount) || 1);
  const sequence = total === 1
    ? [[1, 2], [1, 0], [1, 1]]
    : [[1, 2], [2, 0], [2, 1], [2, 2], [1, 0], [1, 1]];

  return sequence
    .filter(([pageNumber]) => pageNumber <= total)
    .map(([pageNumber, panelIndex]) => ({ pageNumber, panelIndex }));
}

export function choosePageMode({ viewportWidth, pageWidth, pageHeight, foldMode }) {
  const viewport = Number(viewportWidth) || 0;
  const width = Number(pageWidth) || 1;
  const height = Number(pageHeight) || 1;
  const isLandscape = width / height >= 1.08;

  if (foldMode === "tri-fold" && viewport < 900) return "panel";
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
