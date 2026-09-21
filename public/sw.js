const CACHE_PREFIX = "owldio-moonlight-";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function reply(client, message) {
  client?.postMessage(message);
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
    const url = typeof asset === "string" ? asset : asset.url;
    if (!url) continue;
    const request = new Request(new URL(url, self.location.origin), {
      cache: "reload",
      credentials: "same-origin",
    });
    const cached = await cache.match(request, { ignoreSearch: true });

    if (!cached) {
      const response = await fetch(request);
      if (!response.ok) throw new Error(`下載失敗：${url}`);
      await cache.put(request, response);
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

async function refreshShell(request) {
  try {
    const response = await fetch(request);
    if (!response.ok) return;
    const names = (await caches.keys()).filter((name) => name.startsWith(CACHE_PREFIX));
    await Promise.all(names.map(async (name) => {
      const cache = await caches.open(name);
      await cache.put("/index.html", response.clone());
    }));
  } catch {
    // A cached shell is expected to work when the venue network disappears.
  }
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
      const shell = await caches.match("/index.html");
      if (shell) {
        event.waitUntil(refreshShell(request));
        return shell;
      }
      const response = await fetch(request);
      if (response.ok) await cache.put("/index.html", response.clone());
      return response;
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    return cached || fetch(request);
  })());
});
