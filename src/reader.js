import {
  buildProgrammePath,
  buildProgrammeReaderPath,
  buildProgrammeViewUrl,
  isProgrammeReaderHash,
  parseReaderHash,
  resolveProgrammeLayoutView,
  resolveProgrammeReaderView,
} from "./domain/routing.js";
import {
  advanceCarouselIndex,
  frontmostOrbitIndex,
  isIntentionalCarouselDrag,
  normalizeMarqueeOffset,
  resolveMarqueeOffset,
  resolveOrbitPose,
  resolveOrbitTransition,
} from "./domain/carousel.js";
import {
  formatDate,
  programmeDateLabel,
  programmeTimeLabel,
} from "./domain/datetime.js";
import { hasWebEdition, withEditorialFallback } from "./domain/programme.js";
import {
  cycleReadingSize,
  normalizeReadingSize,
  resetReadingPosition,
} from "./domain/reading.js";
import { sampleProgrammes } from "./data/sample-programme.js";
import { createPublicationViewer } from "./publication-pdf.js";

const routeMeta = {
  shelf: { context: "公開節目冊", title: "公開節目冊｜OWLDIO MENU" },
  entrance: { context: "PROGRAMME ENTRANCE", title: "電子節目冊｜OWLDIO MENU" },
  contents: { context: "PROGRAMME INDEX", title: "目錄｜OWLDIO MENU" },
  chapter: { context: "WEB EDITION", title: "網頁版｜OWLDIO MENU" },
  pdf: { context: "IMMERSIVE PUBLICATION", title: "翻閱節目冊｜OWLDIO MENU" },
  "not-found": { context: "NOT FOUND", title: "找不到節目冊｜OWLDIO MENU" },
};

const readerViews = new Set(["entrance", "contents", "chapter", "pdf"]);

function text(id, value) {
  const node = document.querySelector(`#${id}`);
  if (node && value !== null && value !== undefined && value !== "") {
    node.textContent = value;
  }
}

function performanceState(programme) {
  if (!programme.starts_at) {
    return { label: "PROGRAMME LIVE", copy: "節目資訊已公開" };
  }

  const delta = new Date(programme.starts_at).valueOf() - Date.now();
  if (delta <= 90 * 60 * 1000 && delta >= -30 * 60 * 1000) {
    return { label: "HOUSE OPEN", copy: "觀眾席已開放" };
  }
  if (delta > 0) {
    return { label: "UPCOMING", copy: "演出即將到來" };
  }
  return { label: "ARCHIVE", copy: "演出已結束・節目冊持續開放" };
}

function volumeCard(programme, index, total) {
  const link = document.createElement("a");
  const readerPath = buildProgrammeReaderPath(programme.slug);
  link.href = readerPath;
  link.className = "programme-volume";
  link.dataset.carouselIndex = String(index);
  link.dataset.programmePath = readerPath;
  link.dataset.lane = String(index % 5);
  link.setAttribute("aria-roledescription", "slide");
  link.setAttribute("aria-label", `${index + 1} / ${total}，${programme.title}。按一下開啟節目冊。`);

  const cover = document.createElement("span");
  const coverVariant = programme.cover_theme || (index % 2 === 0 ? "sage" : "oxide");
  cover.className = `volume-cover volume-cover--${coverVariant}`;
  cover.setAttribute("aria-hidden", "true");
  const coverShape = programme.cover_format || (index === total - 1 ? "square" : "portrait");
  const coverRatio = Number(programme.cover_aspect_ratio)
    || ({ spread: 1.411, square: 1, portrait: 0.72 }[coverShape] ?? 0.72);
  link.dataset.shape = coverShape;
  cover.style.setProperty("--cover-ratio", String(coverRatio));

  const spine = document.createElement("span");
  spine.className = "cover-spine";
  spine.textContent = String(index + 1).padStart(2, "0");

  const series = document.createElement("span");
  series.className = "cover-series";
  series.textContent = programme.client_name || "OWLDIO MENU";

  const genre = document.createElement("span");
  genre.className = "cover-genre";
  genre.textContent = programme.production_type || "PERFORMING ARTS";

  const coverTitle = document.createElement("span");
  coverTitle.className = "cover-title";
  coverTitle.textContent = programme.title;

  const coverEnglish = document.createElement("span");
  coverEnglish.className = "cover-title-en";
  coverEnglish.textContent = programme.title_en || "DIGITAL PROGRAMME";

  const coverDate = document.createElement("span");
  coverDate.className = "cover-date";
  coverDate.textContent = formatDate(programme.starts_at, { year: "numeric", month: "2-digit", day: "2-digit" });

  const hoverCue = document.createElement("span");
  hoverCue.className = "programme-volume__cue";
  hoverCue.setAttribute("aria-hidden", "true");
  const hoverCueLabel = document.createElement("small");
  hoverCueLabel.textContent = "閱讀這本節目冊";
  const hoverCueTitle = document.createElement("strong");
  hoverCueTitle.textContent = programme.title;
  const hoverCueArrow = document.createElement("i");
  hoverCueArrow.textContent = "↗";
  hoverCue.append(hoverCueLabel, hoverCueTitle, hoverCueArrow);

  const focusMarker = document.createElement("span");
  focusMarker.className = "programme-volume__marker";
  focusMarker.setAttribute("aria-hidden", "true");
  focusMarker.textContent = "↗";

  if (programme.cover_image_url) {
    const image = document.createElement("img");
    image.className = "volume-cover__image";
    image.src = programme.cover_image_url;
    image.alt = "";
    image.loading = index === 0 ? "eager" : "lazy";
    image.decoding = "async";
    cover.classList.add("volume-cover--image");
    cover.append(image, focusMarker);
  } else {
    cover.append(spine, series, genre, coverTitle, coverEnglish, coverDate, focusMarker);
  }
  link.append(cover, hoverCue);
  return link;
}

function renderShelf(programmes) {
  const shelf = document.querySelector("#programme-shelf");
  const track = document.querySelector("#carousel-track");
  shelf.replaceChildren();
  track.replaceChildren();
  text("shelf-count", `${programmes.length} 本節目冊`);

  if (!programmes.length) {
    const empty = document.createElement("div");
    empty.className = "shelf-empty";
    empty.innerHTML = "<strong>目前沒有公開作品</strong><span>新節目冊發布後會出現在這裡。</span>";
    shelf.append(empty);
    return;
  }

  programmes.forEach((programme, index) => {
    shelf.append(volumeCard(programme, index, programmes.length));
    const marker = document.createElement("button");
    marker.type = "button";
    marker.dataset.carouselIndex = String(index);
    marker.setAttribute("aria-label", `選擇 ${programme.title}`);
    track.append(marker);
  });
}

function createElement(tagName, className, value) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (value !== undefined && value !== null) node.textContent = value;
  return node;
}

function programmeNoteList(block) {
  const list = createElement("section", "programme-note__works");
  (block.items || []).forEach(([number, title, detail]) => {
    const item = createElement("section", "programme-note__work");
    const detailLines = String(detail || "").split("\n");
    const englishTitle = detailLines.shift();
    const heading = createElement("header", "programme-note__work-heading");
    heading.append(
      createElement("span", "programme-note__work-number", number),
      createElement("h3", "", title),
    );
    item.append(heading);
    if (englishTitle) item.append(createElement("p", "programme-note__work-english", englishTitle));
    detailLines.filter(Boolean).forEach((paragraph) => {
      item.append(createElement("p", "programme-note__paragraph", paragraph));
    });
    list.append(item);
  });
  return list;
}

function renderProgrammeNotes(programme, index, chapters) {
  index.classList.add("programme-notes");
  index.removeAttribute("role");
  index.setAttribute("aria-label", `${programme.title} 樂曲解說`);

  chapters.forEach((chapter, chapterIndex) => {
    const article = createElement("article", "programme-note");
    article.id = `note-${chapter.slug}`;

    const heading = createElement("header", "programme-note__heading");
    const headingCopy = createElement("div", "programme-note__heading-copy");
    headingCopy.append(
      createElement("p", "programme-note__label", chapter.eyebrow || "樂曲解說"),
      createElement("h2", "", chapter.title),
    );
    if (chapter.title_en) {
      headingCopy.append(createElement("p", "programme-note__english", chapter.title_en));
    }
    if (chapter.author) {
      headingCopy.append(createElement("p", "programme-note__author", chapter.author));
    }
    heading.append(
      createElement("span", "programme-note__number", String(chapterIndex + 1).padStart(2, "0")),
      headingCopy,
    );

    const body = createElement("div", "programme-note__body");
    (chapter.blocks || []).forEach((block) => {
      if (block.type === "prose") {
        (block.paragraphs || []).filter(Boolean).forEach((paragraph) => {
          body.append(createElement("p", "programme-note__paragraph", paragraph));
        });
      }
      if (block.type === "programme-list") body.append(programmeNoteList(block));
    });

    const folio = createElement("footer", "programme-note__folio");
    folio.append(
      createElement("span", "", "月光下的約定 / 樂曲解說"),
      createElement("span", "", String(chapterIndex + 1).padStart(2, "0")),
    );
    article.append(heading, body, folio);
    index.append(article);
  });
}

function renderContents(programme) {
  const index = document.querySelector("#editorial-index");
  const chapters = (programme.chapters || []).filter((chapter) => chapter.is_visible !== false);
  index.replaceChildren();
  index.classList.remove("programme-notes");
  index.setAttribute("role", "navigation");
  index.setAttribute("aria-label", `${programme.title} 節目冊章節`);

  if (programme.reader_layout === "programme-notes") {
    text("contents-count", "PROGRAM NOTE");
    renderProgrammeNotes(programme, index, chapters);
    return;
  }

  text("contents-count", programme.contents_title ? `${chapters.length} 篇` : `${chapters.length} / ${chapters.length}`);

  chapters.forEach((chapter, chapterIndex) => {
    const row = createElement("button", "index-row");
    row.type = "button";
    row.dataset.chapterSlug = chapter.slug;

    const number = createElement("span", "index-row__no", String(chapterIndex + 1).padStart(2, "0"));
    const copy = createElement("span", "index-row__copy");
    copy.append(
      createElement("strong", "", chapter.title),
      createElement("small", "", chapter.title_en || chapter.eyebrow || `CHAPTER ${chapterIndex + 1}`),
    );
    const folioLabel = chapter.reading_minutes
      ? `${chapter.reading_minutes}′`
      : String(chapter.page_start || chapterIndex + 1).padStart(2, "0");
    const folio = createElement("span", "index-row__folio", folioLabel);
    if (chapter.reading_minutes) {
      row.setAttribute("aria-label", `${chapter.title}，閱讀約 ${chapter.reading_minutes} 分鐘`);
    }
    row.append(number, copy, folio);
    index.append(row);
  });

  if (programme.show_pdf_in_contents !== false) {
    const pdf = createElement("button", "index-row index-row--pdf");
    pdf.type = "button";
    pdf.dataset.readerRoute = "pdf";
    const pdfCopy = createElement("span", "index-row__copy");
    pdfCopy.append(
      createElement("strong", "", "翻閱印刷節目冊"),
      createElement("small", "", "IMMERSIVE PRINT EDITION"),
    );
    pdf.append(
      createElement("span", "index-row__no", "PDF"),
      pdfCopy,
      createElement("span", "index-row__folio", "↗"),
    );
    index.append(pdf);
  }
}

function proseBlock(paragraphs, lede = false) {
  const wrapper = createElement("div", "chapter-prose");
  paragraphs.filter(Boolean).forEach((paragraph) => {
    wrapper.append(createElement("p", lede ? "chapter-lede" : "", paragraph));
  });
  return wrapper;
}

function scoreBlock(block) {
  const aside = createElement("aside", "score-note");
  aside.setAttribute("aria-label", block.label || "曲目資訊");
  const copy = createElement("div");
  copy.append(
    createElement("p", "", block.label || "MUSIC NOTE"),
    createElement("h2", "", block.title || "曲目"),
  );
  const details = createElement("dl");
  (block.details || []).forEach(([label, value]) => {
    const row = createElement("div");
    row.append(createElement("dt", "", label), createElement("dd", "", value));
    details.append(row);
  });
  copy.append(details);
  aside.append(createElement("span", "score-note__number", block.number || "I."), copy);
  return aside;
}

function quoteBlock(block) {
  const quote = createElement("blockquote", "chapter-quote", `「${block.text || ""}」`);
  if (block.cite) quote.append(createElement("cite", "", `— ${block.cite}`));
  return quote;
}

function programmeListBlock(block) {
  const section = createElement("section", "programme-list");
  section.setAttribute("aria-label", "曲目與場次");
  (block.items || []).forEach(([number, title, detail, duration]) => {
    const item = createElement("article", "programme-item");
    const copy = createElement("div");
    copy.append(createElement("h2", "", title), createElement("p", "", detail));
    item.append(createElement("span", "programme-item__number", number), copy, createElement("time", "", duration));
    section.append(item);
  });
  return section;
}

function peopleListBlock(block) {
  const section = createElement("section", "people-index");
  section.setAttribute("aria-label", "演員與樂手名單");
  (block.items || []).forEach(([role, name, description], index) => {
    const item = createElement("article", "person-row");
    const nameGroup = createElement("div");
    nameGroup.append(createElement("span", "", role), createElement("h2", "", name));
    item.append(
      createElement("span", "person-row__number", String(index + 1).padStart(2, "0")),
      nameGroup,
      createElement("p", "", description),
    );
    section.append(item);
  });
  return section;
}

function creditsBlock(block) {
  const section = createElement("section", "credit-groups");
  section.setAttribute("aria-label", "製作團隊名單");
  (block.groups || []).forEach((group, groupIndex) => {
    const groupNode = createElement("section", "credit-group");
    const heading = createElement("header");
    heading.append(
      createElement("span", "", String(groupIndex + 1).padStart(2, "0")),
      createElement("h2", "", group.title),
    );
    const list = createElement("dl");
    (group.items || []).forEach(([role, name]) => {
      const row = createElement("div");
      row.append(createElement("dt", "", role), createElement("dd", "", name));
      list.append(row);
    });
    groupNode.append(heading, list);
    section.append(groupNode);
  });
  return section;
}

function infoGridBlock(block) {
  const list = createElement("dl", "visitor-grid");
  (block.items || []).forEach(([label, value], index) => {
    const item = createElement("div");
    item.append(
      createElement("span", "visitor-grid__number", String(index + 1).padStart(2, "0")),
      createElement("dt", "", label),
      createElement("dd", "", value),
    );
    list.append(item);
  });
  return list;
}

function noticeBlock(block) {
  const aside = createElement("aside", "visitor-notice");
  aside.append(createElement("p", "", block.title || "NOTICE"), createElement("div", "", block.text || ""));
  return aside;
}

function renderChapterBlocks(chapter) {
  const content = document.querySelector("#chapter-content");
  content.replaceChildren();
  const blocks = Array.isArray(chapter.blocks) && chapter.blocks.length
    ? chapter.blocks
    : [{ type: "prose", paragraphs: [chapter.body || "本章內容即將更新。"] }];

  blocks.forEach((block) => {
    if (block.type === "lede") content.append(proseBlock([block.text], true));
    if (block.type === "prose") content.append(proseBlock(block.paragraphs || []));
    if (block.type === "score") content.append(scoreBlock(block));
    if (block.type === "listening-guide") {
      const guide = scoreBlock(block);
      guide.classList.add("listening-guide");
      content.append(guide);
    }
    if (block.type === "quote") content.append(quoteBlock(block));
    if (block.type === "programme-list") content.append(programmeListBlock(block));
    if (block.type === "people-list") content.append(peopleListBlock(block));
    if (block.type === "credits") content.append(creditsBlock(block));
    if (block.type === "info-grid") content.append(infoGridBlock(block));
    if (block.type === "notice") content.append(noticeBlock(block));
    if (block.type === "dateline") content.append(createElement("p", "chapter-dateline", block.text));
    if (block.type === "signature") {
      const signature = createElement("footer", "chapter-signature");
      signature.append(createElement("strong", "", block.name), createElement("span", "", block.role));
      content.append(signature);
    }
  });
}

function hydrateProgramme(programme) {
  const state = performanceState(programme);
  const titleEnglish = programme.title_en || "DIGITAL PROGRAMME";
  const entranceCover = document.querySelector(".entrance-cover");

  entranceCover.dataset.theme = programme.cover_theme || "sage";
  document.querySelector("#entrance-view").dataset.theme = programme.cover_theme || "sage";
  const readerShell = document.querySelector("#reader-shell");
  readerShell.dataset.programmeTheme = programme.cover_theme || "sage";
  readerShell.dataset.readerLayout = programme.reader_layout || "standard";

  text("programme-cover-spine", `OWLDIO MENU / ${programme.production_type || "PERFORMING ARTS"}`);
  text("programme-cover-edition", "DIGITAL PROGRAMME");
  text("programme-cover-title", programme.title);
  text("programme-cover-title-en", titleEnglish);
  text("programme-cover-date", programmeDateLabel(programme));
  text("programme-type", [programme.production_type, titleEnglish].filter(Boolean).join(" · "));
  text("entrance-title", programme.title);
  text("programme-title-en", titleEnglish);
  text("programme-summary", programme.summary || "演出內容即將公開。 ");
  text("programme-date", programmeDateLabel(programme));
  text("programme-time", programmeTimeLabel(programme));
  text("programme-venue", programme.venue || "待公告");
  text(
    "programme-duration",
    programme.duration_minutes ? `全長約 ${programme.duration_minutes} 分鐘` : "演出長度待公告",
  );
  const statusLabel = document.querySelector("#programme-status-label");
  if (statusLabel) {
    const dot = document.createElement("i");
    statusLabel.replaceChildren(dot, document.createTextNode(` ${state.label}`));
  }
  text("programme-status-copy", state.copy);
  text("pdf-title", programme.title);
  text("contents-programme-title", programme.title);
  text("entrance-folio-title", `OWLDIO MENU / ${programme.title_en || programme.title}`);
  text("contents-folio-title", programme.title_en || programme.title);
  text("contents-kicker", programme.contents_kicker || "CONTENTS / PROGRAMME INDEX");
  text("contents-title", programme.contents_title || "目錄");
  document.querySelector("#contents-description").textContent = programme.contents_description
    ?? "依照現場閱讀順序編排。點選章節，即刻進入網頁版內容。";

  const webEditionAvailable = hasWebEdition(programme);
  document.querySelectorAll('[data-route="contents"]').forEach((control) => {
    control.hidden = !webEditionAvailable;
  });

  renderContents(programme);

  const firstChapter = programme.chapters?.[0];

  routeMeta.entrance = { context: titleEnglish, title: `${programme.title}｜電子節目冊` };
  routeMeta.contents = {
    context: programme.contents_title ? "LISTENING NOTES" : "PROGRAMME INDEX",
    title: `${programme.contents_title || "目錄"}｜${programme.title}`,
  };
  routeMeta.chapter.title = `${firstChapter?.title || "網頁版"}｜${programme.title}`;
  routeMeta.pdf.title = `翻閱節目冊｜${programme.title}`;
}

export async function mountReader({ root, repository, initialRoute }) {
  root.hidden = false;
  const shell = document.querySelector("#reader-shell");
  const headerContext = document.querySelector("#header-context");
  const headerIndex = document.querySelector(".site-header__index");
  const toast = document.querySelector("#toast");
  const carousel = document.querySelector("#programme-carousel");
  const carouselMotionLabel = document.querySelector("#carousel-motion-label");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const views = new Map(
    [...document.querySelectorAll(".view")].map((view) => [view.id.replace("-view", ""), view]),
  );
  const publicationViewer = createPublicationViewer(document.querySelector("#pdf-view"), {
    onError(error) {
      console.error("Unable to render publication PDF", error);
      showToast("節目冊暫時無法展開，可先下載原始 PDF。");
    },
  });

  let toastTimer;
  let shelfProgrammes = [];
  let shelfActiveIndex = 0;
  let shelfPointerStart = null;
  let shelfDidSwipe = false;
  let shelfInteraction = "idle";
  let shelfMarqueeOffset = 0;
  let shelfMarqueeStride = 1;
  let shelfMarqueeCycleWidth = 1;
  let shelfLastFrame = 0;
  let shelfAnimationFrame = 0;
  let shelfDragStartX = 0;
  let shelfDragStartOffset = 0;
  let shelfPointerX = 0;
  let shelfPointerCard = null;
  let shelfOrbitTransition = null;
  let shelfQueuedOrbitSteps = 0;
  let currentProgramme = null;
  let currentChapterIndex = 0;
  let readingSize = "standard";

  try {
    readingSize = normalizeReadingSize(window.localStorage.getItem("owldio-menu-reading-size"));
  } catch {
    readingSize = "standard";
  }

  function applyReadingSize(size) {
    readingSize = normalizeReadingSize(size);
    shell.dataset.readingSize = readingSize;
    const labels = {
      standard: "標準",
      large: "大字",
      "extra-large": "特大",
    };
    const label = labels[readingSize];
    text("reading-size-label", label);
    const control = document.querySelector("#reading-size-toggle");
    control?.setAttribute("aria-label", `調整文章字級，目前為${label}`);
    try {
      window.localStorage.setItem("owldio-menu-reading-size", readingSize);
    } catch {
      // Private browsing can disable persistent preferences; the in-memory setting still works.
    }
  }

  applyReadingSize(readingSize);

  function animateView(view) {
    view.classList.remove("view-enter");
    window.requestAnimationFrame(() => view.classList.add("view-enter"));
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 3600);
  }

  function activeShelfProgramme() {
    return shelfProgrammes[shelfActiveIndex] || null;
  }

  function shelfCards() {
    return [...document.querySelectorAll("#programme-shelf [data-carousel-index]")];
  }

  function renderShelfMarquee() {
    const cards = shelfCards();
    const stageWidth = Math.max(1, carousel.clientWidth);
    const orbitProgress = shelfMarqueeCycleWidth
      ? shelfMarqueeOffset / shelfMarqueeCycleWidth
      : 0;
    const compactViewport = stageWidth < 620;
    const radiusX = Math.min(460, Math.max(compactViewport ? 138 : 260, stageWidth * 0.3));
    const radiusY = compactViewport ? 38 : 56;
    const radiusZ = compactViewport ? 104 : 150;

    cards.forEach((card, index) => {
      const pose = resolveOrbitPose({
        itemIndex: index,
        itemCount: cards.length,
        orbitProgress,
        radiusX,
        radiusY,
        radiusZ,
      });
      card.style.setProperty("--orbit-x", `${pose.x}px`);
      card.style.setProperty("--orbit-y", `${pose.y}px`);
      card.style.setProperty("--orbit-z", `${pose.z}px`);
      card.style.setProperty("--orbit-rotate", `${pose.rotationY}deg`);
      card.style.setProperty("--orbit-scale", pose.scale);
      card.style.setProperty("--orbit-opacity", pose.opacity);
      card.style.setProperty("--orbit-brightness", pose.brightness);
      card.style.zIndex = String(pose.zIndex);
      card.dataset.side = pose.x < -10 ? "left" : pose.x > 10 ? "right" : "center";
      card.dataset.depth = pose.depth > 0.48 ? "front" : pose.depth < -0.48 ? "back" : "side";
    });

    if (!shelfPointerCard && (shelfInteraction === "idle" || shelfInteraction === "dragging")) {
      const frontIndex = frontmostOrbitIndex({ itemCount: cards.length, orbitProgress });
      if (frontIndex !== shelfActiveIndex) updateShelfCarousel(frontIndex, { announce: false });
    }
  }

  function measureShelfMarquee() {
    const cards = shelfCards();
    if (!cards.length) return;
    const stageWidth = Math.max(320, carousel.clientWidth);
    shelfMarqueeCycleWidth = Math.min(1_680, Math.max(760, stageWidth * 0.9));
    shelfMarqueeStride = shelfMarqueeCycleWidth / cards.length;
    shelfMarqueeOffset = normalizeMarqueeOffset(shelfMarqueeOffset, shelfMarqueeCycleWidth);
    renderShelfMarquee();
  }

  function setShelfInteraction(nextInteraction) {
    shelfInteraction = nextInteraction;
    carousel.dataset.interaction = nextInteraction;
    carouselMotionLabel.textContent = {
      idle: reduceMotion.matches ? "輪播已暫停" : "自動輪播",
      hovered: "停留選冊",
      dragging: "拖曳輪播",
      transitioning: "切換節目冊",
    }[nextInteraction] || "自動輪播";
  }

  function setShelfPointerCard(card) {
    if (shelfPointerCard === card) return;
    shelfPointerCard?.classList.remove("is-pointer-focus");
    shelfPointerCard = card;
    shelfPointerCard?.classList.add("is-pointer-focus");

    if (card) {
      updateShelfCarousel(Number(card.dataset.carouselIndex), { announce: false });
    }
  }

  function pointerIsInsideCarousel(event) {
    const bounds = carousel.getBoundingClientRect();
    return event.clientX >= bounds.left
      && event.clientX <= bounds.right
      && event.clientY >= bounds.top
      && event.clientY <= bounds.bottom;
  }

  function interactionAfterOrbitTurn() {
    return carousel.matches(":hover") || carousel.contains(document.activeElement)
      ? "hovered"
      : "idle";
  }

  function beginShelfOrbitTurn(direction, startedAt = performance.now()) {
    const step = direction < 0 ? -1 : 1;
    if (reduceMotion.matches) {
      shelfMarqueeOffset = normalizeMarqueeOffset(
        shelfMarqueeOffset - step * shelfMarqueeStride,
        shelfMarqueeCycleWidth,
      );
      updateShelfCarousel(advanceCarouselIndex(shelfActiveIndex, step, shelfProgrammes.length));
      setShelfInteraction(interactionAfterOrbitTurn());
      renderShelfMarquee();
      return;
    }

    setShelfPointerCard(null);
    shelfOrbitTransition = {
      fromOffset: shelfMarqueeOffset,
      toOffset: shelfMarqueeOffset - step * shelfMarqueeStride,
      startedAt,
      durationMs: 900,
      targetIndex: advanceCarouselIndex(shelfActiveIndex, step, shelfProgrammes.length),
    };
    carousel.classList.add("is-turning");
    setShelfInteraction("transitioning");
  }

  function finishShelfOrbitTurn(timestamp) {
    const completedTurn = shelfOrbitTransition;
    if (!completedTurn) return;

    shelfMarqueeOffset = normalizeMarqueeOffset(
      completedTurn.toOffset,
      shelfMarqueeCycleWidth,
    );
    shelfOrbitTransition = null;
    updateShelfCarousel(completedTurn.targetIndex);

    if (shelfQueuedOrbitSteps !== 0) {
      const nextDirection = Math.sign(shelfQueuedOrbitSteps);
      shelfQueuedOrbitSteps -= nextDirection;
      beginShelfOrbitTurn(nextDirection, timestamp);
      return;
    }

    carousel.classList.remove("is-turning");
    setShelfInteraction(interactionAfterOrbitTurn());
    renderShelfMarquee();
  }

  function animateShelfMarquee(timestamp) {
    const elapsedMs = shelfLastFrame ? Math.min(64, timestamp - shelfLastFrame) : 0;
    shelfLastFrame = timestamp;

    if (shelfProgrammes.length && initialRoute.kind === "shelf") {
      if (shelfOrbitTransition) {
        const transition = resolveOrbitTransition({
          fromOffset: shelfOrbitTransition.fromOffset,
          toOffset: shelfOrbitTransition.toOffset,
          elapsedMs: timestamp - shelfOrbitTransition.startedAt,
          durationMs: reduceMotion.matches ? 0 : shelfOrbitTransition.durationMs,
        });
        shelfMarqueeOffset = normalizeMarqueeOffset(
          transition.offset,
          shelfMarqueeCycleWidth,
        );
        renderShelfMarquee();
        if (transition.complete) finishShelfOrbitTurn(timestamp);
      } else {
        const interaction = reduceMotion.matches && shelfInteraction === "idle" ? "hovered" : shelfInteraction;
        shelfMarqueeOffset = resolveMarqueeOffset({
          offset: shelfMarqueeOffset,
          elapsedMs,
          pixelsPerSecond: 20,
          cycleWidth: shelfMarqueeCycleWidth,
          interaction,
          dragStartOffset: shelfDragStartOffset,
          dragStartX: shelfDragStartX,
          pointerX: shelfPointerX,
        });
        renderShelfMarquee();
      }
    }

    shelfAnimationFrame = window.requestAnimationFrame(animateShelfMarquee);
  }

  function startShelfMarquee() {
    window.cancelAnimationFrame(shelfAnimationFrame);
    shelfLastFrame = 0;
    setShelfInteraction("idle");
    measureShelfMarquee();
    shelfAnimationFrame = window.requestAnimationFrame(animateShelfMarquee);
  }

  function updateShelfCarousel(nextIndex, { announce = true } = {}) {
    const total = shelfProgrammes.length;
    if (!total) return;

    shelfActiveIndex = advanceCarouselIndex(0, nextIndex, total);
    const selected = activeShelfProgramme();
    const cards = [...document.querySelectorAll("#programme-shelf [data-carousel-index]")];

    cards.forEach((card) => {
      const index = Number(card.dataset.carouselIndex);
      const isSelected = index === shelfActiveIndex;
      card.classList.toggle("is-active", isSelected);
      card.classList.remove("is-outside");
      card.removeAttribute("data-offset");
      card.tabIndex = 0;
      card.setAttribute("aria-hidden", "false");
      if (isSelected) {
        card.setAttribute("aria-current", "true");
      } else {
        card.removeAttribute("aria-current");
      }
    });

    text("selected-programme-number", String(shelfActiveIndex + 1).padStart(2, "0"));
    text("selected-programme-total", `/ ${String(total).padStart(2, "0")}`);
    text("selected-programme-type", selected.production_type || "PERFORMING ARTS");
    text("selected-programme-title", selected.title);
    text("selected-programme-title-en", selected.title_en || "DIGITAL PROGRAMME");
    text("selected-programme-summary", selected.summary || "演出內容即將公開。 ");
    text("selected-programme-date", programmeDateLabel(selected));
    text("selected-programme-venue", selected.venue || "待公告");

    document.querySelectorAll("#carousel-track [data-carousel-index]").forEach((marker) => {
      const isCurrent = Number(marker.dataset.carouselIndex) === shelfActiveIndex;
      marker.classList.toggle("is-current", isCurrent);
      marker.toggleAttribute("aria-current", isCurrent);
    });

    document.querySelector("#carousel-selection").dataset.theme = selected.cover_theme || "sage";
    if (announce) {
      document.querySelector("#carousel-selection").setAttribute(
        "aria-label",
        `目前選擇 ${shelfActiveIndex + 1} / ${total}：${selected.title}`,
      );
    }
  }

  function moveShelfCarousel(direction) {
    if (!shelfProgrammes.length) return;
    const step = direction < 0 ? -1 : 1;
    if (shelfOrbitTransition) {
      shelfQueuedOrbitSteps = Math.max(-4, Math.min(4, shelfQueuedOrbitSteps + step));
      return;
    }
    beginShelfOrbitTurn(step);
  }

  function openActiveShelfProgramme() {
    const selected = activeShelfProgramme();
    if (selected) {
      window.location.assign(buildProgrammeReaderPath(selected.slug));
    }
  }

  function visibleChapters() {
    return (currentProgramme?.chapters || []).filter((chapter) => chapter.is_visible !== false);
  }

  function chapterLabel(chapter, fallback) {
    if (!chapter) return fallback;
    return chapter.title.replace(/^第[一二三四五六七八九十]+[場章][　\s]*/, "").slice(0, 8);
  }

  function renderChapter(chapterSlug) {
    const chapters = visibleChapters();
    if (!chapters.length) return null;

    const requestedIndex = chapterSlug ? chapters.findIndex((chapter) => chapter.slug === chapterSlug) : -1;
    currentChapterIndex = requestedIndex >= 0 ? requestedIndex : Math.min(currentChapterIndex, chapters.length - 1);
    const chapter = chapters[currentChapterIndex];
    const chapterView = document.querySelector("#chapter-view");
    const progress = document.querySelector("#chapter-progress");
    const previous = document.querySelector("#chapter-prev");
    const next = document.querySelector("#chapter-next");

    chapterView.dataset.chapterKind = chapter.kind || "essay";
    text("chapter-number", String(currentChapterIndex + 1).padStart(2, "0"));
    text("chapter-kicker", `${chapter.eyebrow || "CHAPTER"} · ${String(chapter.page_start || currentChapterIndex + 1).padStart(2, "0")}`);
    text("chapter-title", chapter.title);
    text("chapter-title-en", chapter.title_en || chapter.eyebrow || "WEB EDITION");
    text("chapter-folio", `${currentChapterIndex + 1} / ${chapters.length}`);
    renderChapterBlocks(chapter);

    progress.replaceChildren();
    progress.setAttribute("aria-label", `目前章節進度 ${currentChapterIndex + 1}/${chapters.length}`);
    chapters.forEach((item, index) => {
      const marker = createElement("button", "");
      marker.type = "button";
      marker.dataset.chapterSlug = item.slug;
      marker.setAttribute("aria-label", `前往第 ${index + 1} 章：${item.title}`);
      if (index < currentChapterIndex) marker.classList.add("is-complete");
      if (index === currentChapterIndex) {
        marker.classList.add("is-current");
        marker.setAttribute("aria-current", "page");
      }
      progress.append(marker);
    });

    previous.querySelector("strong").textContent = currentChapterIndex === 0
      ? "目錄"
      : chapterLabel(chapters[currentChapterIndex - 1], "上一章");
    next.querySelector("strong").textContent = currentChapterIndex === chapters.length - 1
      ? "翻閱節目冊"
      : chapterLabel(chapters[currentChapterIndex + 1], "下一章");

    routeMeta.chapter = {
      context: chapter.eyebrow || "WEB EDITION",
      title: `${chapter.title}｜${currentProgramme.title}`,
    };
    return chapter;
  }

  function showRoute(route, { updateHash = true, chapterSlug } = {}) {
    let nextRoute = route;
    if (initialRoute.kind === "shelf") nextRoute = "shelf";
    if (initialRoute.kind === "programme" && !readerViews.has(nextRoute)) nextRoute = "entrance";
    if (initialRoute.kind === "not-found") nextRoute = "not-found";
    if (readerViews.has(nextRoute)) {
      nextRoute = resolveProgrammeLayoutView({
        readerLayout: currentProgramme?.reader_layout,
        view: nextRoute,
      });
    }

    const activeChapter = nextRoute === "chapter" ? renderChapter(chapterSlug) : null;

    views.forEach((view, key) => {
      view.hidden = key !== nextRoute;
    });
    document.documentElement.removeAttribute("data-publication-boot");

    shell.dataset.view = nextRoute;
    headerContext.textContent = routeMeta[nextRoute]?.context || routeMeta.shelf.context;
    headerIndex.hidden = nextRoute === "shelf"
      || !hasWebEdition(currentProgramme)
      || currentProgramme?.reader_layout === "programme-notes";
    document.title = routeMeta[nextRoute]?.title || routeMeta.shelf.title;

    if (nextRoute === "pdf") {
      window.requestAnimationFrame(() => publicationViewer.activate());
    } else {
      publicationViewer.deactivate();
    }

    const nextUrl = buildProgrammeViewUrl(location.pathname, {
      view: nextRoute,
      chapterSlug: activeChapter?.slug,
      defaultView: currentProgramme?.default_reader_view,
    });
    const routeUrlChanged = `${location.pathname}${location.hash}` !== nextUrl;
    if (
      initialRoute.kind === "programme"
      && currentProgramme?.reader_layout === "programme-notes"
      && routeUrlChanged
    ) {
      history.replaceState({ route: nextRoute }, "", nextUrl);
    } else if (updateHash && initialRoute.kind === "programme" && routeUrlChanged) {
      history.pushState({ route: nextRoute, chapterSlug: activeChapter?.slug }, "", nextUrl);
    }

    const resetScroll = () => resetReadingPosition({
      scrollingElement: document.scrollingElement,
      body: document.body,
      activeElement: document.activeElement,
      scrollTo: (left, top) => window.scrollTo({ left, top, behavior: "instant" }),
    });
    resetScroll();
    window.requestAnimationFrame(resetScroll);
    animateView(views.get(nextRoute));
  }

  async function configurePdf(programme) {
    const presentation = {
      title: programme.title,
      previewUrl: programme.cover_image_url,
      previewAlt: `《${programme.title}》節目冊封面預覽`,
      previewAspectRatio: programme.cover_aspect_ratio,
    };

    if (programme.pdf_path && repository) {
      const signedUrl = await repository.createPdfUrl(programme.pdf_path);
      if (signedUrl) {
        await publicationViewer.prepare({
          ...presentation,
          url: signedUrl,
          downloadUrl: signedUrl,
          filename: programme.pdf_filename || "programme.pdf",
          caption: `${programme.pdf_filename || "原始節目冊"} · 安全連結 15 分鐘內有效`,
          forceDownload: false,
        });
        return;
      }
    }

    if (programme.pdf_source?.url) {
      await publicationViewer.prepare({
        ...presentation,
        ...programme.pdf_source,
        title: programme.title,
      });
      return;
    }

    await publicationViewer.prepare({
      ...presentation,
      url: null,
      caption: "後台上傳後，原始印刷版會顯示在這裡。",
    });
  }

  document.querySelectorAll("[data-route]").forEach((control) => {
    control.addEventListener("click", (event) => {
      event.preventDefault();
      const target = control.dataset.route;

      if (target === "shelf") {
        window.location.assign("/");
        return;
      }

      if (!currentProgramme) {
        const first = shelfProgrammes[0];
        if (first) {
          window.location.assign(`${buildProgrammePath(first.slug)}#${target}`);
        } else {
          showToast("目前沒有可開啟的節目冊。");
        }
        return;
      }

      showRoute(target);
    });
  });

  document.querySelectorAll("[data-toast]").forEach((control) => {
    control.addEventListener("click", () => showToast(control.dataset.toast));
  });

  document.querySelector("#programme-shelf").addEventListener("click", (event) => {
    if (shelfDidSwipe) {
      shelfDidSwipe = false;
      event.preventDefault();
      return;
    }
    const card = event.target.closest("[data-programme-path]");
    if (!card) return;
    updateShelfCarousel(Number(card.dataset.carouselIndex), { announce: false });
  });

  document.querySelector("#carousel-prev").addEventListener("click", () => moveShelfCarousel(-1));
  document.querySelector("#carousel-next").addEventListener("click", () => moveShelfCarousel(1));
  document.querySelector("#carousel-open").addEventListener("click", openActiveShelfProgramme);

  document.querySelector("#carousel-track").addEventListener("click", (event) => {
    const marker = event.target.closest("[data-carousel-index]");
    if (marker) updateShelfCarousel(Number(marker.dataset.carouselIndex));
  });

  carousel.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveShelfCarousel(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveShelfCarousel(1);
    }
    if (event.key === "Enter" && event.target === carousel) {
      event.preventDefault();
      openActiveShelfProgramme();
    }
  });

  carousel.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse" && !shelfOrbitTransition) setShelfInteraction("hovered");
  });

  carousel.addEventListener("pointermove", (event) => {
    const bounds = carousel.getBoundingClientRect();
    carousel.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
    carousel.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
    carousel.dataset.pointer = "visible";

    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const card = hit?.closest?.(".programme-volume") || null;
    setShelfPointerCard(card);

    shelfPointerX = event.clientX;
    if (shelfInteraction === "dragging") {
      if (
        shelfPointerStart
        && shelfPointerStart.id === event.pointerId
        && !carousel.hasPointerCapture(event.pointerId)
        && isIntentionalCarouselDrag({
          deltaX: event.clientX - shelfPointerStart.x,
          deltaY: event.clientY - shelfPointerStart.y,
        })
      ) {
        carousel.setPointerCapture(event.pointerId);
      }
      shelfMarqueeOffset = resolveMarqueeOffset({
        offset: shelfMarqueeOffset,
        elapsedMs: 0,
        pixelsPerSecond: 0,
        cycleWidth: shelfMarqueeCycleWidth,
        interaction: "dragging",
        dragStartOffset: shelfDragStartOffset,
        dragStartX: shelfDragStartX,
        pointerX: shelfPointerX,
      });
      renderShelfMarquee();
    } else if (event.pointerType === "mouse" && !shelfOrbitTransition) {
      setShelfInteraction("hovered");
    }
  });

  carousel.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest(".carousel-arrow")) return;
    shelfOrbitTransition = null;
    shelfQueuedOrbitSteps = 0;
    carousel.classList.remove("is-turning");
    shelfPointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    shelfDragStartX = event.clientX;
    shelfPointerX = event.clientX;
    shelfDragStartOffset = shelfMarqueeOffset;
    shelfDidSwipe = false;
    setShelfInteraction("dragging");
  });

  carousel.addEventListener("pointerup", (event) => {
    if (!shelfPointerStart || shelfPointerStart.id !== event.pointerId) return;
    const deltaX = event.clientX - shelfPointerStart.x;
    const deltaY = event.clientY - shelfPointerStart.y;
    shelfPointerX = event.clientX;
    shelfMarqueeOffset = resolveMarqueeOffset({
      offset: shelfMarqueeOffset,
      elapsedMs: 0,
      pixelsPerSecond: 0,
      cycleWidth: shelfMarqueeCycleWidth,
      interaction: "dragging",
      dragStartOffset: shelfDragStartOffset,
      dragStartX: shelfDragStartX,
      pointerX: shelfPointerX,
    });
    if (carousel.hasPointerCapture(event.pointerId)) carousel.releasePointerCapture(event.pointerId);
    shelfPointerStart = null;
    if (isIntentionalCarouselDrag({ deltaX, deltaY })) {
      shelfDidSwipe = true;
    }
    const pointerStillInside = event.pointerType === "mouse" && pointerIsInsideCarousel(event);
    if (!pointerStillInside) {
      carousel.dataset.pointer = "hidden";
      setShelfPointerCard(null);
    }
    setShelfInteraction(pointerStillInside ? "hovered" : "idle");
    renderShelfMarquee();
  });

  carousel.addEventListener("pointercancel", (event) => {
    if (carousel.hasPointerCapture(event.pointerId)) carousel.releasePointerCapture(event.pointerId);
    shelfPointerStart = null;
    carousel.dataset.pointer = "hidden";
    setShelfPointerCard(null);
    setShelfInteraction("idle");
  });

  carousel.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse" || shelfInteraction === "dragging") return;
    carousel.dataset.pointer = "hidden";
    setShelfPointerCard(null);
    if (!shelfOrbitTransition) setShelfInteraction("idle");
    shelfLastFrame = performance.now();
  });

  carousel.addEventListener("focusin", (event) => {
    const card = event.target.closest(".programme-volume");
    if (!card) return;
    setShelfPointerCard(card);
    if (!shelfOrbitTransition) setShelfInteraction("hovered");
  });

  carousel.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (carousel.contains(document.activeElement)) return;
      setShelfPointerCard(null);
      if (!shelfOrbitTransition) setShelfInteraction("idle");
    }, 0);
  });

  window.addEventListener("resize", measureShelfMarquee);
  reduceMotion.addEventListener("change", () => setShelfInteraction(shelfInteraction));

  document.querySelector("#editorial-index").addEventListener("click", (event) => {
    const chapter = event.target.closest("[data-chapter-slug]");
    const route = event.target.closest("[data-reader-route]");
    if (chapter) showRoute("chapter", { chapterSlug: chapter.dataset.chapterSlug });
    if (route) showRoute(route.dataset.readerRoute);
  });

  document.querySelector("#chapter-progress").addEventListener("click", (event) => {
    const marker = event.target.closest("[data-chapter-slug]");
    if (marker) showRoute("chapter", { chapterSlug: marker.dataset.chapterSlug });
  });

  document.querySelector("#reading-size-toggle").addEventListener("click", () => {
    applyReadingSize(cycleReadingSize(readingSize));
  });

  document.querySelector("#chapter-prev").addEventListener("click", () => {
    const chapters = visibleChapters();
    if (currentChapterIndex === 0) {
      showRoute("contents");
    } else {
      showRoute("chapter", { chapterSlug: chapters[currentChapterIndex - 1].slug });
    }
  });

  document.querySelector("#chapter-next").addEventListener("click", () => {
    const chapters = visibleChapters();
    if (currentChapterIndex >= chapters.length - 1) {
      showRoute("pdf");
    } else {
      showRoute("chapter", { chapterSlug: chapters[currentChapterIndex + 1].slug });
    }
  });

  window.addEventListener("popstate", () => {
    if (initialRoute.kind === "programme" && isProgrammeReaderHash(location.hash)) {
      const readerRoute = parseReaderHash(location.hash);
      const resolvedView = resolveProgrammeReaderView({
        requestedView: readerRoute.view,
        hash: location.hash,
        defaultView: currentProgramme?.default_reader_view,
      });
      showRoute(resolvedView, { chapterSlug: readerRoute.chapterSlug, updateHash: false });
    }
  });

  window.addEventListener("hashchange", () => {
    if (initialRoute.kind === "programme" && isProgrammeReaderHash(location.hash)) {
      const readerRoute = parseReaderHash(location.hash);
      const resolvedView = resolveProgrammeReaderView({
        requestedView: readerRoute.view,
        hash: location.hash,
        defaultView: currentProgramme?.default_reader_view,
      });
      showRoute(resolvedView, { chapterSlug: readerRoute.chapterSlug, updateHash: false });
    }
  });

  if (initialRoute.kind === "shelf") {
    try {
      shelfProgrammes = repository ? await repository.listPublished() : sampleProgrammes;
    } catch (error) {
      console.error("Unable to load published programmes", error);
      shelfProgrammes = sampleProgrammes;
      showToast("作品索引暫時使用離線版本。");
    }
    renderShelf(shelfProgrammes);
    updateShelfCarousel(0, { announce: false });
    showRoute("shelf", { updateHash: false });
    startShelfMarquee();
  } else if (initialRoute.kind === "programme") {
    const localProgramme = sampleProgrammes.find(
      (programme) => {
        const slugMatches = programme.slug === initialRoute.programmeSlug
          || programme.legacy_slugs?.includes(initialRoute.programmeSlug);
        if (!initialRoute.legacyPath) return slugMatches;
        return slugMatches && (programme.client_slug === initialRoute.clientSlug
          || programme.legacy_client_slugs?.includes(initialRoute.clientSlug));
      },
    );

    if (
      initialRoute.view === "pdf"
      && location.hash
      && localProgramme?.reader_layout !== "programme-notes"
    ) {
      publicationViewer.preload();
      showRoute("pdf", { updateHash: false });
    }

    try {
      currentProgramme = repository
        ? await (initialRoute.legacyPath
          ? repository.getPublicByPath(initialRoute.clientSlug, initialRoute.programmeSlug)
          : repository.getPublicBySlug(initialRoute.programmeSlug))
        : null;
    } catch (error) {
      console.error("Unable to load programme", error);
    }

    currentProgramme = withEditorialFallback(currentProgramme, localProgramme);

    if (!currentProgramme) {
      initialRoute.kind = "not-found";
      showRoute("not-found", { updateHash: false });
    } else {
      const resolvedInitialView = resolveProgrammeReaderView({
        requestedView: initialRoute.view,
        hash: location.hash,
        defaultView: currentProgramme.default_reader_view,
      });
      const displayedInitialView = resolveProgrammeLayoutView({
        readerLayout: currentProgramme.reader_layout,
        view: resolvedInitialView,
      });
      const canonicalPath = buildProgrammePath(currentProgramme.slug);
      const canonicalUrl = buildProgrammeViewUrl(canonicalPath, {
        view: displayedInitialView,
        chapterSlug: initialRoute.chapterSlug,
        defaultView: currentProgramme.default_reader_view,
      });
      if (
        initialRoute.legacyPath
        || currentProgramme.slug !== initialRoute.programmeSlug
        || `${location.pathname}${location.hash}` !== canonicalUrl
      ) {
        history.replaceState(
          { route: displayedInitialView, chapterSlug: initialRoute.chapterSlug },
          "",
          canonicalUrl,
        );
      }
      hydrateProgramme(currentProgramme);
      if (currentProgramme.reader_layout !== "programme-notes") {
        await configurePdf(currentProgramme);
      }
      showRoute(displayedInitialView, { chapterSlug: initialRoute.chapterSlug, updateHash: false });
    }
  } else {
    showRoute("not-found", { updateHash: false });
  }

  window.__owldioReady = true;
}
