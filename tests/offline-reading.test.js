import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { offlinePercent } from "../src/offline-reading.js";
import { shouldIncludeInOfflinePack } from "../scripts/offline-pack-manifest.mjs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const worker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

describe("Moonlight Promise offline preparation", () => {
  it("shows OWLDIO branding with a real accessible progress indicator", () => {
    expect(html).toMatch(/owldio-offline-lockup\.webp/u);
    expect(html).toMatch(/role="progressbar"/u);
    expect(html).toMatch(/id="offline-progress-value"/u);
    expect(html).toMatch(/id="offline-progress-percent"/u);
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
    expect(shouldIncludeInOfflinePack("owldio-offline-lockup.webp")).toBe(true);
    expect(shouldIncludeInOfflinePack("assets/moonlight-promise-cover-v2-hash.jpg")).toBe(true);
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
    expect(worker).toMatch(/caches\.match\("\/index\.html"\)/u);
  });
});
