import { buildProgrammePath, parseReaderHash } from "./domain/routing.js";
import { advanceCarouselIndex, relativeCarouselOffset } from "./domain/carousel.js";
import { samplePdf, sampleProgramme, sampleProgrammes } from "./data/sample-programme.js";

const routeMeta = {
  shelf: { context: "PROGRAMME CIRCULATION", title: "公開節目冊｜OWLDIO MENU" },
  entrance: { context: "PROGRAMME ENTRANCE", title: "電子節目冊｜OWLDIO MENU" },
  contents: { context: "PROGRAMME INDEX", title: "目錄｜OWLDIO MENU" },
  chapter: { context: "WEB EDITION", title: "網頁版｜OWLDIO MENU" },
  pdf: { context: "ORIGINAL PDF EDITION", title: "原始 PDF｜OWLDIO MENU" },
  "not-found": { context: "NOT FOUND", title: "找不到節目冊｜OWLDIO MENU" },
};

const readerViews = new Set(["entrance", "contents", "chapter", "pdf"]);

function text(id, value) {
  const node = document.querySelector(`#${id}`);
  if (node && value !== null && value !== undefined && value !== "") {
    node.textContent = value;
  }
}

function formatDate(value, options) {
  if (!value) return "待公告";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "待公告";
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", ...options }).format(date);
}

function dateLabel(programme) {
  const start = formatDate(programme.starts_at, { year: "numeric", month: "2-digit", day: "2-digit" });
  if (!programme.ends_at) return start;
  const end = formatDate(programme.ends_at, { month: "2-digit", day: "2-digit" });
  return `${start}—${end}`;
}

function timeLabel(programme) {
  return programme.starts_at
    ? formatDate(programme.starts_at, { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
    : "待公告";
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
  const button = document.createElement("button");
  button.type = "button";
  button.className = "programme-volume";
  button.dataset.carouselIndex = String(index);
  button.dataset.programmePath = buildProgrammePath(programme.client_slug, programme.slug);
  button.setAttribute("aria-roledescription", "slide");
  button.setAttribute("aria-label", `${index + 1} / ${total}，${programme.title}。按一下選取；已選取時按一下開啟。`);

  const cover = document.createElement("span");
  const coverVariant = programme.cover_theme || (index % 2 === 0 ? "sage" : "oxide");
  cover.className = `volume-cover volume-cover--${coverVariant}`;
  cover.setAttribute("aria-hidden", "true");

  const spine = document.createElement("span");
  spine.className = "cover-spine";
  spine.textContent = String(index + 1).padStart(2, "0");

  const series = document.createElement("span");
  series.className = "cover-series";
  series.textContent = `OWLDIO MENU / EDITION ${String(index + 1).padStart(2, "0")}`;

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

  cover.append(spine, series, genre, coverTitle, coverEnglish, coverDate);
  button.append(cover);
  return button;
}

function renderShelf(programmes) {
  const shelf = document.querySelector("#programme-shelf");
  const track = document.querySelector("#carousel-track");
  shelf.replaceChildren();
  track.replaceChildren();
  text("shelf-count", `${programmes.length} ${programmes.length === 1 ? "TITLE" : "TITLES"}`);

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

function renderContents(programme) {
  const index = document.querySelector("#editorial-index");
  const chapters = (programme.chapters || []).filter((chapter) => chapter.is_visible !== false);
  index.replaceChildren();
  text("contents-count", `${chapters.length} / ${chapters.length}`);

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
    const folio = createElement("span", "index-row__folio", String(chapter.page_start || chapterIndex + 1).padStart(2, "0"));
    row.append(number, copy, folio);
    index.append(row);
  });

  const pdf = createElement("button", "index-row index-row--pdf");
  pdf.type = "button";
  pdf.dataset.readerRoute = "pdf";
  const pdfCopy = createElement("span", "index-row__copy");
  pdfCopy.append(
    createElement("strong", "", "原始印刷節目冊"),
    createElement("small", "", "ORIGINAL PRINT EDITION"),
  );
  pdf.append(
    createElement("span", "index-row__no", "PDF"),
    pdfCopy,
    createElement("span", "index-row__folio", "↗"),
  );
  index.append(pdf);
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

  text("programme-cover-spine", `OWLDIO MENU / ${programme.production_type || "PERFORMING ARTS"}`);
  text("programme-cover-edition", "DIGITAL PROGRAMME");
  text("programme-cover-title", programme.title);
  text("programme-cover-title-en", titleEnglish);
  text("programme-cover-date", dateLabel(programme));
  text("programme-type", [programme.production_type, titleEnglish].filter(Boolean).join(" · "));
  text("entrance-title", programme.title);
  text("programme-title-en", titleEnglish);
  text("programme-summary", programme.summary || "演出內容即將公開。 ");
  text("programme-date", dateLabel(programme));
  text("programme-time", timeLabel(programme));
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
  text("pdf-title", `原始 PDF｜${programme.title}`);

  renderContents(programme);

  const firstChapter = programme.chapters?.[0];

  routeMeta.entrance = { context: titleEnglish, title: `${programme.title}｜電子節目冊` };
  routeMeta.contents.title = `目錄｜${programme.title}`;
  routeMeta.chapter.title = `${firstChapter?.title || "網頁版"}｜${programme.title}`;
  routeMeta.pdf.title = `原始 PDF｜${programme.title}`;
}

function configureSamplePdf() {
  return {
    pages: samplePdf.pageImages,
    downloadUrl: samplePdf.downloadUrl,
    caption: "原始印刷節目冊 · 422 × 299 mm · 橫式跨頁",
  };
}

export async function mountReader({ root, repository, initialRoute }) {
  root.hidden = false;
  const shell = document.querySelector("#reader-shell");
  const headerContext = document.querySelector("#header-context");
  const headerIndex = document.querySelector(".site-header__index");
  const toast = document.querySelector("#toast");
  const views = new Map(
    [...document.querySelectorAll(".view")].map((view) => [view.id.replace("-view", ""), view]),
  );

  let toastTimer;
  let pdfPageIndex = 0;
  let pdfPages = [];
  let shelfProgrammes = [];
  let shelfActiveIndex = 0;
  let shelfPointerStart = null;
  let shelfDidSwipe = false;
  let currentProgramme = null;
  let currentChapterIndex = 0;

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

  function updateShelfCarousel(nextIndex, { announce = true } = {}) {
    const total = shelfProgrammes.length;
    if (!total) return;

    shelfActiveIndex = advanceCarouselIndex(0, nextIndex, total);
    const selected = activeShelfProgramme();
    const cards = [...document.querySelectorAll("#programme-shelf [data-carousel-index]")];

    cards.forEach((card) => {
      const index = Number(card.dataset.carouselIndex);
      const offset = relativeCarouselOffset(index, shelfActiveIndex, total);
      const isVisible = Math.abs(offset) <= 2;
      card.dataset.offset = String(offset);
      card.classList.toggle("is-active", offset === 0);
      card.classList.toggle("is-outside", !isVisible);
      card.tabIndex = isVisible ? 0 : -1;
      card.setAttribute("aria-hidden", isVisible ? "false" : "true");
      if (offset === 0) {
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
    text("selected-programme-date", dateLabel(selected));
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
    updateShelfCarousel(advanceCarouselIndex(shelfActiveIndex, direction, shelfProgrammes.length));
  }

  function openActiveShelfProgramme() {
    const selected = activeShelfProgramme();
    if (selected) window.location.assign(buildProgrammePath(selected.client_slug, selected.slug));
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
      ? "原始 PDF"
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

    const activeChapter = nextRoute === "chapter" ? renderChapter(chapterSlug) : null;

    views.forEach((view, key) => {
      view.hidden = key !== nextRoute;
    });

    shell.dataset.view = nextRoute;
    headerContext.textContent = routeMeta[nextRoute]?.context || routeMeta.shelf.context;
    headerIndex.hidden = nextRoute === "shelf";
    document.title = routeMeta[nextRoute]?.title || routeMeta.shelf.title;

    const hashRoute = activeChapter ? `chapter/${encodeURIComponent(activeChapter.slug)}` : nextRoute;
    if (updateHash && initialRoute.kind === "programme" && location.hash !== `#${hashRoute}`) {
      history.pushState({ route: nextRoute, chapterSlug: activeChapter?.slug }, "", `${location.pathname}#${hashRoute}`);
    }

    window.scrollTo({ top: 0, behavior: "auto" });
    animateView(views.get(nextRoute));
  }

  function updatePdfPage() {
    if (!pdfPages.length) return;
    const page = pdfPages[pdfPageIndex];
    const image = document.querySelector("#pdf-page-image");
    const label = document.querySelector("#pdf-page-label");
    const progress = document.querySelector("#pdf-progress");
    const previous = document.querySelector("#pdf-prev");
    const next = document.querySelector("#pdf-next");

    image.src = page.src;
    image.alt = page.alt;
    label.textContent = `${String(pdfPageIndex + 1).padStart(2, "0")} / ${String(pdfPages.length).padStart(2, "0")}`;
    progress.style.width = `${100 / pdfPages.length}%`;
    progress.style.transform = `translateX(${pdfPageIndex * 100}%)`;
    previous.disabled = pdfPageIndex === 0;
    next.disabled = pdfPageIndex === pdfPages.length - 1;
  }

  async function configurePdf(programme) {
    const image = document.querySelector("#pdf-page-image");
    const object = document.querySelector("#pdf-document");
    const empty = document.querySelector("#pdf-empty");
    const pager = document.querySelector("#pdf-pager");
    const download = document.querySelector("#pdf-download");

    image.hidden = true;
    object.hidden = true;
    empty.hidden = true;
    pager.hidden = true;
    download.hidden = true;

    if (programme.pdf_path && repository) {
      const signedUrl = await repository.createPdfUrl(programme.pdf_path);
      if (signedUrl) {
        object.data = signedUrl;
        object.hidden = false;
        download.href = signedUrl;
        download.removeAttribute("download");
        download.target = "_blank";
        download.rel = "noreferrer";
        download.hidden = false;
        text("pdf-page-label", "PDF");
        text("pdf-caption", `${programme.pdf_filename || "原始節目冊"} · 安全連結 15 分鐘內有效`);
        return;
      }
    }

    if (programme.client_slug === sampleProgramme.client_slug && programme.slug === sampleProgramme.slug) {
      const sample = configureSamplePdf();
      pdfPages = sample.pages;
      pdfPageIndex = 0;
      image.hidden = false;
      pager.hidden = false;
      download.href = sample.downloadUrl;
      download.setAttribute("download", "");
      download.removeAttribute("target");
      download.hidden = false;
      text("pdf-caption", sample.caption);
      updatePdfPage();
      return;
    }

    empty.hidden = false;
    text("pdf-page-label", "NO PDF");
    text("pdf-caption", "後台上傳後，原始印刷版會顯示在這裡。 ");
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
          window.location.assign(`${buildProgrammePath(first.client_slug, first.slug)}#${target}`);
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
      return;
    }
    const card = event.target.closest("[data-programme-path]");
    if (!card) return;
    const selectedIndex = Number(card.dataset.carouselIndex);
    if (selectedIndex === shelfActiveIndex) {
      openActiveShelfProgramme();
    } else {
      updateShelfCarousel(selectedIndex);
    }
  });

  document.querySelector("#carousel-prev").addEventListener("click", () => moveShelfCarousel(-1));
  document.querySelector("#carousel-next").addEventListener("click", () => moveShelfCarousel(1));
  document.querySelector("#carousel-open").addEventListener("click", openActiveShelfProgramme);

  document.querySelector("#carousel-track").addEventListener("click", (event) => {
    const marker = event.target.closest("[data-carousel-index]");
    if (marker) updateShelfCarousel(Number(marker.dataset.carouselIndex));
  });

  const carousel = document.querySelector("#programme-carousel");
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
  carousel.addEventListener("pointerdown", (event) => {
    shelfPointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    shelfDidSwipe = false;
  });
  carousel.addEventListener("pointerup", (event) => {
    if (!shelfPointerStart || shelfPointerStart.id !== event.pointerId) return;
    const deltaX = event.clientX - shelfPointerStart.x;
    const deltaY = event.clientY - shelfPointerStart.y;
    shelfPointerStart = null;
    if (Math.abs(deltaX) > 42 && Math.abs(deltaX) > Math.abs(deltaY)) {
      shelfDidSwipe = true;
      moveShelfCarousel(deltaX < 0 ? 1 : -1);
    }
  });
  carousel.addEventListener("pointercancel", () => {
    shelfPointerStart = null;
  });

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

  document.querySelector("#pdf-prev").addEventListener("click", () => {
    pdfPageIndex = Math.max(0, pdfPageIndex - 1);
    updatePdfPage();
  });

  document.querySelector("#pdf-next").addEventListener("click", () => {
    pdfPageIndex = Math.min(pdfPages.length - 1, pdfPageIndex + 1);
    updatePdfPage();
  });

  window.addEventListener("popstate", () => {
    if (initialRoute.kind === "programme") {
      const readerRoute = parseReaderHash(location.hash);
      showRoute(readerRoute.view, { chapterSlug: readerRoute.chapterSlug, updateHash: false });
    }
  });

  window.addEventListener("hashchange", () => {
    if (initialRoute.kind === "programme") {
      const readerRoute = parseReaderHash(location.hash);
      showRoute(readerRoute.view, { chapterSlug: readerRoute.chapterSlug, updateHash: false });
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
  } else if (initialRoute.kind === "programme") {
    try {
      currentProgramme = repository
        ? await repository.getPublicByPath(initialRoute.clientSlug, initialRoute.programmeSlug)
        : null;
    } catch (error) {
      console.error("Unable to load programme", error);
    }

    if (!currentProgramme) {
      currentProgramme = sampleProgrammes.find(
        (programme) => programme.client_slug === initialRoute.clientSlug && programme.slug === initialRoute.programmeSlug,
      );
    }

    if (!currentProgramme) {
      initialRoute.kind = "not-found";
      showRoute("not-found", { updateHash: false });
    } else {
      hydrateProgramme(currentProgramme);
      await configurePdf(currentProgramme);
      showRoute(initialRoute.view, { chapterSlug: initialRoute.chapterSlug, updateHash: false });
    }
  } else {
    showRoute("not-found", { updateHash: false });
  }

  window.__owldioReady = true;
}
