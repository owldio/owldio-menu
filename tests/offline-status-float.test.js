import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_STATUS_POSITION,
  clampStatusPosition,
  readStoredPosition,
  statusDock,
  writeStoredPosition,
} from "../src/offline-status-float.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

const viewport = { width: 375, height: 812 };
const pill = { width: 136, height: 24 };

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    values,
  };
}

describe("floating offline status pill", () => {
  it("starts in the top-left corner", () => {
    expect(DEFAULT_STATUS_POSITION).toEqual({ x: 8, y: 8 });
  });

  it("keeps a dragged pill fully on screen", () => {
    expect(clampStatusPosition({ x: 100, y: 300 }, pill, viewport)).toEqual({ x: 100, y: 300 });
    expect(clampStatusPosition({ x: 999, y: 999 }, pill, viewport)).toEqual({ x: 231, y: 780 });
    expect(clampStatusPosition({ x: -40, y: -40 }, pill, viewport)).toEqual({ x: 8, y: 8 });
  });

  it("pins the pill to the margin when the screen is narrower than the pill", () => {
    expect(clampStatusPosition({ x: 50, y: 50 }, { width: 400, height: 24 }, viewport)).toEqual({
      x: 8,
      y: 50,
    });
  });

  it("docks only when the pill overlaps the toolbar or the progress rail", () => {
    const chrome = { top: 48, bottom: 50 };

    expect(statusDock({ y: 8 }, pill, viewport, chrome)).toBe("top");
    expect(statusDock({ y: 60 }, pill, viewport, chrome)).toBe("free");
    expect(statusDock({ y: 400 }, pill, viewport, chrome)).toBe("free");
    expect(statusDock({ y: 780 }, pill, viewport, chrome)).toBe("bottom");
  });

  it("restores only a valid saved position", () => {
    expect(readStoredPosition(memoryStorage())).toBeNull();
    expect(readStoredPosition(memoryStorage({ "owldio-offline-status-position": "{oops" }))).toBeNull();
    expect(
      readStoredPosition(memoryStorage({ "owldio-offline-status-position": '{"x":"a","y":4}' })),
    ).toBeNull();
    expect(
      readStoredPosition(memoryStorage({ "owldio-offline-status-position": '{"x":120,"y":64}' })),
    ).toEqual({ x: 120, y: 64 });
  });

  it("survives storage that throws", () => {
    const blocked = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };

    expect(readStoredPosition(blocked)).toBeNull();
    expect(() => writeStoredPosition(blocked, { x: 1, y: 2 })).not.toThrow();
    expect(readStoredPosition(undefined)).toBeNull();
  });

  it("saves the rounded position", () => {
    const storage = memoryStorage();
    writeStoredPosition(storage, { x: 12.6, y: 40.2 });
    expect(storage.values.get("owldio-offline-status-position")).toBe('{"x":13,"y":40}');
  });

  it("offers a labelled retry button that only appears after a failed download", () => {
    expect(html).toMatch(
      /<button[^>]*class="offline-status__retry"[^>]*id="offline-status-retry"[^>]*aria-label="重新下載離線內容"/su,
    );
    expect(styles).toMatch(/\.offline-status__retry\s*\{[^}]*display:\s*none;/su);
    expect(styles).toMatch(
      /\.offline-status\[data-offline-state="error"\]\s*\.offline-status__retry\s*\{[^}]*display:\s*grid;/su,
    );
  });

  it("lets a finger drag the pill without scrolling or selecting the page", () => {
    const pillRule = styles.match(/\.offline-status\s*\{([^}]*)\}/su)?.[1] || "";

    expect(pillRule).toMatch(/touch-action:\s*none;/u);
    expect(pillRule).toMatch(/cursor:\s*grab;/u);
    expect(pillRule).not.toMatch(/pointer-events:\s*none;/u);
    expect(pillRule).toMatch(/transform:\s*translate3d\(var\(--offline-x\),\s*var\(--offline-y\),\s*0\);/u);
  });
});
