const COMPLETION_HOLD_MS = 2400;
const FAILURE_HOLD_MS = 5200;
const PREPARATION_TIMEOUT_MS = 120000;

export function offlinePercent(completed, total) {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const value = Math.round((Number(completed) / total) * 100);
  return Math.min(100, Math.max(0, value));
}

function wait(ms) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function statusElements(documentRef) {
  return {
    root: documentRef.querySelector("#offline-status"),
    title: documentRef.querySelector("#offline-status-title"),
    track: documentRef.querySelector("#offline-status-track"),
    detail: documentRef.querySelector("#offline-status-detail"),
    percent: documentRef.querySelector("#offline-status-percent"),
  };
}

function paintProgress(elements, { completed = 0, total = 0, title, detail, state = "loading" }) {
  const percent = offlinePercent(completed, total);
  if (elements.root) {
    elements.root.hidden = false;
    elements.root.setAttribute("aria-hidden", "false");
  }
  elements.root?.style.setProperty("--offline-progress", String(percent / 100));
  if (elements.root) elements.root.dataset.offlineState = state;
  if (elements.title && title) elements.title.textContent = title;
  if (elements.detail && detail) elements.detail.textContent = detail;
  if (elements.percent) elements.percent.textContent = `${percent}%`;
  elements.track?.setAttribute("aria-valuenow", String(percent));
  elements.track?.setAttribute("aria-valuetext", detail || `${percent}%`);
}

function closeStatus(elements) {
  if (!elements.root) return;
  elements.root.setAttribute("aria-hidden", "true");
  elements.root.hidden = true;
}

function activeWorker(registration) {
  return registration.active || registration.waiting || registration.installing;
}

function requestOfflinePack(serviceWorker, worker, manifest, elements) {
  return new Promise((resolve, reject) => {
    const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    let timeoutId;

    const cleanup = () => {
      globalThis.clearTimeout(timeoutId);
      serviceWorker.removeEventListener("message", onMessage);
    };

    const onMessage = (event) => {
      const message = event.data;
      if (!message || message.requestId !== requestId) return;

      if (message.type === "OFFLINE_PROGRESS") {
        paintProgress(elements, {
          completed: message.completed,
          total: message.total,
          detail: `正在下載 ${message.completed} / ${message.total} 個檔案`,
        });
        return;
      }

      cleanup();
      if (message.type === "OFFLINE_READY") resolve(message);
      else reject(new Error(message.message || "離線內容下載失敗"));
    };

    serviceWorker.addEventListener("message", onMessage);
    timeoutId = globalThis.setTimeout(() => {
      cleanup();
      reject(new Error("離線內容下載逾時"));
    }, PREPARATION_TIMEOUT_MS);

    worker.postMessage({ type: "CACHE_OFFLINE_PACK", requestId, manifest });
  });
}

/**
 * Downloads the Moonlight Promise reading pack on the first online visit. The
 * worker reports each cached file, so the branded progress bar is truthful.
 */
export async function prepareOfflineReading({
  documentRef = globalThis.document,
  navigatorRef = globalThis.navigator,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!documentRef) return { status: "unavailable" };

  const elements = statusElements(documentRef);

  if (!import.meta.env.PROD || !navigatorRef?.serviceWorker || !globalThis.isSecureContext) {
    closeStatus(elements);
    return { status: "unavailable" };
  }

  try {
    paintProgress(elements, {
      title: "正在準備離線閱讀",
      detail: "正在確認頁面與圖片",
    });

    const [registration, manifestResponse] = await Promise.all([
      navigatorRef.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }),
      fetchImpl("/offline-manifest.json", { cache: "no-store" }),
    ]);

    if (!manifestResponse.ok) throw new Error("無法取得離線內容清單");
    const manifest = await manifestResponse.json();
    const readyRegistration = await navigatorRef.serviceWorker.ready;
    const worker = activeWorker(readyRegistration) || activeWorker(registration);
    if (!worker) throw new Error("離線服務尚未啟動");

    const result = await requestOfflinePack(
      navigatorRef.serviceWorker,
      worker,
      manifest,
      elements,
    );

    paintProgress(elements, {
      completed: result.total,
      total: result.total,
      title: "已可離線閱讀",
      detail: `共 ${result.total} 個檔案已儲存在這台裝置`,
      state: "ready",
    });

    navigatorRef.storage?.persist?.().catch(() => false);
    await wait(COMPLETION_HOLD_MS);
    closeStatus(elements);
    return { status: "ready", ...result };
  } catch (error) {
    paintProgress(elements, {
      title: "離線下載尚未完成",
      detail: navigatorRef?.onLine === false
        ? "目前沒有網路；已下載的內容仍可使用"
        : "可以先閱讀，連線恢復後重新整理即可續傳",
      state: "error",
    });
    await wait(FAILURE_HOLD_MS);
    closeStatus(elements);
    return { status: "error", error };
  }
}
