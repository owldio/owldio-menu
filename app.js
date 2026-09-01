const shell = document.querySelector("#reader-shell");
const headerContext = document.querySelector("#header-context");
const views = new Map(
  [...document.querySelectorAll(".view")].map((view) => [view.id.replace("-view", ""), view]),
);
const toast = document.querySelector("#toast");

const routeMeta = {
  shelf: { context: "PUBLIC LIBRARY", title: "作品索引｜OWLDIO MENU" },
  entrance: { context: "THE TIDE STAYS AWAKE", title: "潮聲未眠｜電子節目冊" },
  contents: { context: "PROGRAMME INDEX", title: "目錄｜潮聲未眠" },
  chapter: { context: "WEB EDITION · 05 / 16", title: "第一場：失眠者的房間｜潮聲未眠" },
  pdf: { context: "ORIGINAL PDF EDITION", title: "原始 PDF｜潮聲未眠" },
};

const pdfPages = [
  {
    src: "./assets/rational-sensual-page-1-v1.png",
    alt: "使用者提供的《理性與感性》原始節目單第一頁",
  },
  {
    src: "./assets/rational-sensual-page-2-v1.png",
    alt: "使用者提供的《理性與感性》原始節目單第二頁",
  },
];

let toastTimer;
let pdfPageIndex = 0;

function normalizedRoute(value) {
  const route = String(value || "").replace(/^#/, "");
  return views.has(route) ? route : "shelf";
}

function animateView(view) {
  view.classList.remove("view-enter");
  window.requestAnimationFrame(() => view.classList.add("view-enter"));
}

function showRoute(route, { updateHash = true } = {}) {
  const nextRoute = normalizedRoute(route);

  views.forEach((view, key) => {
    view.hidden = key !== nextRoute;
  });

  shell.dataset.view = nextRoute;
  headerContext.textContent = routeMeta[nextRoute].context;
  document.title = routeMeta[nextRoute].title;

  if (updateHash && location.hash !== `#${nextRoute}`) {
    history.pushState({ route: nextRoute }, "", `#${nextRoute}`);
  }

  window.scrollTo({ top: 0, behavior: "auto" });
  animateView(views.get(nextRoute));
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3000);
}

function updatePdfPage() {
  const page = pdfPages[pdfPageIndex];
  const image = document.querySelector("#pdf-page-image");
  const label = document.querySelector("#pdf-page-label");
  const progress = document.querySelector("#pdf-progress");
  const previous = document.querySelector("#pdf-prev");
  const next = document.querySelector("#pdf-next");

  image.src = page.src;
  image.alt = page.alt;
  label.textContent = `${String(pdfPageIndex + 1).padStart(2, "0")} / ${String(pdfPages.length).padStart(2, "0")}`;
  progress.style.transform = `translateX(${pdfPageIndex * 100}%)`;
  previous.disabled = pdfPageIndex === 0;
  next.disabled = pdfPageIndex === pdfPages.length - 1;
}

document.querySelectorAll("[data-route]").forEach((control) => {
  control.addEventListener("click", (event) => {
    event.preventDefault();
    showRoute(control.dataset.route);
  });
});

document.querySelectorAll("[data-toast]").forEach((control) => {
  control.addEventListener("click", () => showToast(control.dataset.toast));
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
  showRoute(location.hash, { updateHash: false });
});

window.addEventListener("hashchange", () => {
  showRoute(location.hash, { updateHash: false });
});

updatePdfPage();
showRoute(location.hash || "#shelf", { updateHash: false });
window.__owldioReady = true;
