import { buildProgrammePath } from "./domain/routing.js";
import { samplePdf, sampleProgramme } from "./data/sample-programme.js";

const routeMeta = {
  shelf: { context: "PUBLIC LIBRARY", title: "作品索引｜OWLDIO MENU" },
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

function volumeCard(programme, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `programme-volume${index === 0 ? " programme-volume--featured" : ""}`;
  button.dataset.programmePath = buildProgrammePath(programme.client_slug, programme.slug);

  const cover = document.createElement("span");
  const coverVariant = index === 0 ? "tide" : index % 2 === 1 ? "night" : "archive";
  cover.className = `volume-cover volume-cover--${coverVariant}`;
  cover.setAttribute("aria-hidden", "true");

  const series = document.createElement("span");
  series.className = "cover-series";
  series.textContent = `OWLDIO MENU / ${String(index + 1).padStart(3, "0")}`;

  const coverTitle = document.createElement("span");
  coverTitle.className = `cover-title${index === 0 ? " cover-title--vertical" : ""}`;
  coverTitle.textContent = programme.title;

  const coverEnglish = document.createElement("span");
  coverEnglish.className = "cover-title-en";
  coverEnglish.textContent = programme.title_en || "DIGITAL PROGRAMME";

  const coverDate = document.createElement("span");
  coverDate.className = "cover-date";
  coverDate.textContent = formatDate(programme.starts_at, { year: "numeric", month: "2-digit", day: "2-digit" });

  cover.append(series, coverTitle, coverEnglish, coverDate);

  const meta = document.createElement("span");
  meta.className = "volume-meta";

  const status = document.createElement("span");
  status.className = "volume-meta__status";
  const dot = document.createElement("i");
  status.append(dot, document.createTextNode(" 公開中"));

  const title = document.createElement("strong");
  title.textContent = programme.title;

  const detail = document.createElement("small");
  detail.textContent = [programme.production_type, programme.venue].filter(Boolean).join(" · ") || "演出資訊";

  const open = document.createElement("span");
  open.className = "volume-meta__open";
  open.textContent = "開啟節目冊 ";
  const arrow = document.createElement("b");
  arrow.textContent = "↗";
  open.append(arrow);

  meta.append(status, title, detail, open);
  button.append(cover, meta);
  return button;
}

function renderShelf(programmes) {
  const shelf = document.querySelector("#programme-shelf");
  shelf.replaceChildren();
  text("shelf-count", `${programmes.length} ${programmes.length === 1 ? "TITLE" : "TITLES"}`);

  if (!programmes.length) {
    const empty = document.createElement("div");
    empty.className = "shelf-empty";
    empty.innerHTML = "<strong>目前沒有公開作品</strong><span>新節目冊發布後會出現在這裡。</span>";
    shelf.append(empty);
    return;
  }

  programmes.forEach((programme, index) => shelf.append(volumeCard(programme, index)));
}

function hydrateProgramme(programme) {
  const state = performanceState(programme);
  const titleEnglish = programme.title_en || "DIGITAL PROGRAMME";

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

  const firstChapter = programme.chapters?.[0];
  if (firstChapter) {
    text("chapter-title", firstChapter.title.replace(/^第一場[　\s]*/, ""));
    const firstIndex = document.querySelector(".editorial-index .index-row");
    if (firstIndex) {
      firstIndex.querySelector("strong").textContent = firstChapter.title;
      firstIndex.querySelector("small").textContent = firstChapter.title_en || "CHAPTER 01";
      firstIndex.querySelector(".index-row__folio").textContent = String(firstChapter.page_start || 1).padStart(2, "0");
    }
  }

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
  const toast = document.querySelector("#toast");
  const views = new Map(
    [...document.querySelectorAll(".view")].map((view) => [view.id.replace("-view", ""), view]),
  );

  let toastTimer;
  let pdfPageIndex = 0;
  let pdfPages = [];
  let shelfProgrammes = [];
  let currentProgramme = null;

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

  function showRoute(route, { updateHash = true } = {}) {
    let nextRoute = route;
    if (initialRoute.kind === "shelf") nextRoute = "shelf";
    if (initialRoute.kind === "programme" && !readerViews.has(nextRoute)) nextRoute = "entrance";
    if (initialRoute.kind === "not-found") nextRoute = "not-found";

    views.forEach((view, key) => {
      view.hidden = key !== nextRoute;
    });

    shell.dataset.view = nextRoute;
    headerContext.textContent = routeMeta[nextRoute]?.context || routeMeta.shelf.context;
    document.title = routeMeta[nextRoute]?.title || routeMeta.shelf.title;

    if (updateHash && initialRoute.kind === "programme" && location.hash !== `#${nextRoute}`) {
      history.pushState({ route: nextRoute }, "", `${location.pathname}#${nextRoute}`);
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
    const card = event.target.closest("[data-programme-path]");
    if (card) window.location.assign(card.dataset.programmePath);
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
    if (initialRoute.kind === "programme") showRoute(location.hash.replace(/^#/, "") || "entrance", { updateHash: false });
  });

  window.addEventListener("hashchange", () => {
    if (initialRoute.kind === "programme") showRoute(location.hash.replace(/^#/, "") || "entrance", { updateHash: false });
  });

  if (initialRoute.kind === "shelf") {
    try {
      shelfProgrammes = repository ? await repository.listPublished() : [sampleProgramme];
    } catch (error) {
      console.error("Unable to load published programmes", error);
      shelfProgrammes = [sampleProgramme];
      showToast("作品索引暫時使用離線版本。");
    }
    renderShelf(shelfProgrammes);
    showRoute("shelf", { updateHash: false });
  } else if (initialRoute.kind === "programme") {
    try {
      currentProgramme = repository
        ? await repository.getPublicByPath(initialRoute.clientSlug, initialRoute.programmeSlug)
        : null;
    } catch (error) {
      console.error("Unable to load programme", error);
    }

    if (
      !currentProgramme &&
      initialRoute.clientSlug === sampleProgramme.client_slug &&
      initialRoute.programmeSlug === sampleProgramme.slug
    ) {
      currentProgramme = sampleProgramme;
    }

    if (!currentProgramme) {
      initialRoute.kind = "not-found";
      showRoute("not-found", { updateHash: false });
    } else {
      hydrateProgramme(currentProgramme);
      await configurePdf(currentProgramme);
      showRoute(initialRoute.view, { updateHash: false });
    }
  } else {
    showRoute("not-found", { updateHash: false });
  }

  window.__owldioReady = true;
}
