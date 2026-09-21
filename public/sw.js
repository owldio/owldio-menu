const CACHE_PREFIX = "owldio-moonlight-";
const APP_SHELL_URL = "/";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function reply(client, message) {
  client?.postMessage(message);
}

async function withoutRedirectMetadata(response) {
  if (!response?.redirected) return response;

  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("transfer-encoding");

  return new Response(await response.clone().arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function removeOlderPacks(currentCacheName) {
  const names = await caches.keys();
  await Promise.all(names
    .filter((name) => name.startsWith(CACHE_PREFIX) && name !== currentCacheName)
    .map((name) => caches.delete(name)));
}

async function cacheOfflinePack(client, requestId, manifest) {
  const cacheName = `${CACHE_PREFIX}${manifest.version}`;
  const cache = await caches.open(cacheName);
  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  let completed = 0;

  for (const asset of assets) {
    const manifestUrl = typeof asset === "string" ? asset : asset.url;
    if (!manifestUrl) continue;
    const url = manifestUrl === "/index.html" ? APP_SHELL_URL : manifestUrl;
    const request = new Request(new URL(url, self.location.origin), {
      cache: "reload",
      credentials: "same-origin",
    });
    const cached = await cache.match(request, { ignoreSearch: true });

    if (!cached) {
      const response = await fetch(request);
      if (!response.ok) throw new Error(`下載失敗：${url}`);
      const cacheable = url === APP_SHELL_URL
        ? await withoutRedirectMetadata(response)
        : response;
      await cache.put(request, cacheable);
    }

    completed += 1;
    reply(client, {
      type: "OFFLINE_PROGRESS",
      requestId,
      completed,
      total: assets.length,
      url,
    });
  }

  await cache.put("/offline-manifest.json", new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  }));
  await removeOlderPacks(cacheName);
  reply(client, {
    type: "OFFLINE_READY",
    requestId,
    total: assets.length,
    version: manifest.version,
  });
}

self.addEventListener("message", (event) => {
  const message = event.data;
  if (message?.type !== "CACHE_OFFLINE_PACK") return;

  event.waitUntil(cacheOfflinePack(event.source, message.requestId, message.manifest)
    .catch((error) => reply(event.source, {
      type: "OFFLINE_ERROR",
      requestId: message.requestId,
      message: error instanceof Error ? error.message : "離線內容下載失敗",
    })));
});

async function cachedNavigationShell(shellCache) {
  const shell = await shellCache.match(APP_SHELL_URL)
    || await caches.match(APP_SHELL_URL)
    || await caches.match("/index.html");
  return shell ? withoutRedirectMetadata(shell) : null;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/offline-manifest.json") {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(`${CACHE_PREFIX}shell`);
      try {
        const response = await fetch(request, { cache: "reload" });
        if (response.ok) {
          const safeResponse = await withoutRedirectMetadata(response);
          await cache.put(APP_SHELL_URL, safeResponse.clone());
          return safeResponse;
        }
        return await cachedNavigationShell(cache) || response;
      } catch (error) {
        const shell = await cachedNavigationShell(cache);
        if (shell) return shell;
        throw error;
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    return cached || fetch(request);
  })());
});
