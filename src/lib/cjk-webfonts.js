const CJK_WEBFONTS = "https://fonts.googleapis.com/css2"
  + "?family=Noto+Sans+TC:wght@400;500;600"
  + "&family=Noto+Serif+TC:wght@400;500;600;700"
  + "&display=swap";

/**
 * The Chinese web fonts weigh about two megabytes with their stylesheet, and
 * the programme notes do not need them: that book is set in its own subset
 * face. Every other surface asks for them here, once, when it is shown.
 */
export function loadCjkWebFonts() {
  if (typeof document === "undefined") return;
  if (document.querySelector('link[data-cjk-webfonts="true"]')) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CJK_WEBFONTS;
  link.dataset.cjkWebfonts = "true";
  document.head.append(link);
}
