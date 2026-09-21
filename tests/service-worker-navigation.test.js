import { readFileSync } from "node:fs";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

const workerSource = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

function redirectedShell() {
  const bytes = new TextEncoder().encode("<!doctype html><title>Cached shell</title>");
  return {
    ok: true,
    redirected: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
    clone() {
      return this;
    },
    async arrayBuffer() {
      return bytes.slice().buffer;
    },
  };
}

async function runCachedNavigation(shell, { offline = false } = {}) {
  const listeners = new Map();
  const cache = {
    async match() {
      return undefined;
    },
    async put() {},
  };
  const caches = {
    async keys() {
      return ["owldio-moonlight-test"];
    },
    async open() {
      return cache;
    },
    async match(key) {
      return key === "/index.html" ? shell : undefined;
    },
    async delete() {
      return true;
    },
  };
  const self = {
    location: { origin: "https://menu.owldio.art" },
    clients: { async claim() {} },
    skipWaiting() {},
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  };

  vm.runInNewContext(workerSource, {
    self,
    caches,
    fetch: async () => {
      if (offline) throw new TypeError("Network unavailable");
      return new Response("<!doctype html><title>Fresh shell</title>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
    Request,
    Response,
    Headers,
    URL,
  });

  let navigationResponse;
  listeners.get("fetch")({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://menu.owldio.art/moonlight-promise",
    },
    respondWith(response) {
      navigationResponse = response;
    },
    waitUntil() {},
  });

  return navigationResponse;
}

describe("service worker navigation responses", () => {
  it("prefers the current network shell over a stale cached shell", async () => {
    const response = await runCachedNavigation(redirectedShell());

    expect(response.redirected).toBe(false);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Fresh shell");
  });

  it("does not return a redirected cached shell to Safari when offline", async () => {
    const response = await runCachedNavigation(redirectedShell(), { offline: true });

    expect(response.redirected).toBe(false);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Cached shell");
  });
});
