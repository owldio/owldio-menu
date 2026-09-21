export const MIN_PAGE_LOADING_MS = 4_000;

export function remainingPageLoadingMs(
  startedAt,
  now,
  minimum = MIN_PAGE_LOADING_MS,
) {
  const elapsed = Math.max(0, Number(now) - Number(startedAt));
  return Math.max(0, minimum - elapsed);
}

export async function releasePageLoading({
  documentRef = document,
  startedAt,
  now = () => performance.now(),
  wait = (delay) => new Promise((resolve) => window.setTimeout(resolve, delay)),
} = {}) {
  const root = documentRef?.documentElement;
  if (!root?.hasAttribute("data-publication-boot")) return;

  const remaining = remainingPageLoadingMs(startedAt, now());
  if (remaining > 0) await wait(remaining);
  root.removeAttribute("data-publication-boot");
}
