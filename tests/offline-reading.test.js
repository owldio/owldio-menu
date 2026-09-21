import { readFileSync } from "node:fs";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { MIN_PAGE_LOADING_MS, remainingPageLoadingMs } from "../src/page-loading.js";
import { offlinePercent } from "../src/offline-reading.js";
import {
  offlineAssetUrl,
  shouldIncludeInOfflinePack,
} from "../scripts/offline-pack-manifest.mjs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const worker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const bootScript = html.match(/<script>([\s\S]*?)<\/script>/u)?.[1] || "";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

function runPublicationBoot(sessionStorage) {
  const documentElement = { dataset: {} };
  vm.runInNewContext(bootScript, {
    document: {
      documentElement,
      querySelector() {
        return { setAttribute() {} };
      },
    },
    location: { pathname: "/moonlight-promise" },
    sessionStorage,
  });
  return documentElement.dataset;
}

describe("Moonlight Promise offline preparation", () => {
  it("uses the OWLDIO animation only while the page itself is loading", () => {
    expect(html).toMatch(/owldio-offline-lockup\.webp/u);
    expect(html).toMatch(/頁面載入中/u);
    expect(html).toMatch(/if \(shouldShowPublicationBoot\) \{/u);
    expect(html).not.toMatch(/hashRoute/u);
    expect(html).not.toMatch(/dataset\.offlineBoot/u);
    expect(styles).not.toMatch(/html\[data-offline-boot="true"\]/u);
  });

  it("shows the branded loader only on the first programme load in a tab", () => {
    const storage = memoryStorage();

    expect(runPublicationBoot(storage).publicationBoot).toBe("true");
    expect(runPublicationBoot(storage).publicationBoot).toBeUndefined();
  });

  it("renders the reader before starting the non-blocking offline download", () => {
    const readerReady = main.indexOf("await mountReader");
    const loadingReleased = main.indexOf("await releasePageLoading");
    const offlineStart = main.indexOf("void prepareOfflineReading()");

    expect(readerReady).toBeGreaterThan(-1);
    expect(loadingReleased).toBeGreaterThan(readerReady);
    expect(offlineStart).toBeGreaterThan(loadingReleased);
  });

  it("keeps the branded page-loading advertisement visible for four seconds", () => {
    expect(MIN_PAGE_LOADING_MS).toBe(4_000);
    expect(remainingPageLoadingMs(1_000, 1_000)).toBe(4_000);
    expect(remainingPageLoadingMs(1_000, 2_500)).toBe(2_500);
    expect(remainingPageLoadingMs(1_000, 5_500)).toBe(0);
  });

  it("provides a compact accessible offline progress status", () => {
    expect(html).toMatch(/id="offline-status"[^>]*hidden/u);
    expect(html).toMatch(/id="offline-status-track"[^>]*role="progressbar"/u);
    expect(html).toMatch(/id="offline-status-value"/u);
    expect(html).toMatch(/id="offline-status-percent"/u);
    expect(styles).toMatch(/\.offline-status\s*\{[^}]*position:\s*fixed;/su);
  });

  it("reports bounded download progress", () => {
    expect(offlinePercent(0, 20)).toBe(0);
    expect(offlinePercent(5, 20)).toBe(25);
    expect(offlinePercent(20, 20)).toBe(100);
    expect(offlinePercent(30, 20)).toBe(100);
    expect(offlinePercent(1, 0)).toBe(0);
  });

  it("keeps the Moonlight reader offline without packaging the unrelated demo PDF", () => {
    expect(shouldIncludeInOfflinePack("index.html")).toBe(true);
    expect(offlineAssetUrl("index.html")).toBe("/");
    expect(offlineAssetUrl("assets/index-hash.js")).toBe("/assets/index-hash.js");
    expect(shouldIncludeInOfflinePack("owldio-offline-lockup.webp")).toBe(true);
    expect(shouldIncludeInOfflinePack("assets/moonlight-promise-cover-v4-hash.jpg")).toBe(true);
    expect(shouldIncludeInOfflinePack("assets/index-hash.js")).toBe(true);
    expect(shouldIncludeInOfflinePack("assets/rational-sensual-programme-sample-v1-hash.pdf")).toBe(false);
    expect(shouldIncludeInOfflinePack("_headers")).toBe(false);
  });

  it("has a worker protocol for progress, completion, failure, and offline navigation", () => {
    expect(worker).toMatch(/CACHE_OFFLINE_PACK/u);
    expect(worker).toMatch(/OFFLINE_PROGRESS/u);
    expect(worker).toMatch(/OFFLINE_READY/u);
    expect(worker).toMatch(/OFFLINE_ERROR/u);
    expect(worker).toMatch(/request\.mode === "navigate"/u);
    expect(worker).toMatch(/withoutRedirectMetadata/u);
    expect(worker).toMatch(/caches\.match\(APP_SHELL_URL\)/u);
  });
});
