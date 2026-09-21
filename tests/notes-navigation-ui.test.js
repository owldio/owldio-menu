import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/notes-book.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

describe("notes-book page navigation", () => {
  it("keeps each regenerated thumbnail drawable, including printed artwork", () => {
    expect(source).toMatch(/clone\.dataset\.near\s*=\s*"true"/u);
    expect(source).not.toMatch(/querySelectorAll\("img"\)[^;]*\.remove\(\)/u);
    expect(source).toMatch(/thumbnailsStale\s*=\s*true;[\s\S]*if \(thumbnails && !thumbnails\.hidden\) buildThumbnails\(\)/u);
  });

  it("centres the active regenerated thumbnail when the panel opens", () => {
    expect(source).toMatch(/revealCurrentThumbnail\(\{ behavior: "auto" \}\)/u);
    expect(source).toMatch(/if \(thumbnails && !thumbnails\.hidden\)[\s\S]*revealCurrentThumbnail/u);
  });

  it("draws a visible draggable handle at the live progress position", () => {
    const progressRules = [...styles.matchAll(/\.publication-rail__scrubber i\s*\{([^}]*)\}/gu)];
    const handleRule = styles.match(/\.view--notes-book \.publication-rail__scrubber i::after\s*\{([^}]*)\}/u);

    expect(progressRules.some((rule) => /width:\s*calc\(var\(--progress, 0\) \* 100%\)/u.test(rule[1]))).toBe(true);
    expect(handleRule).not.toBeNull();
    expect(handleRule[1]).toMatch(/border-radius:\s*50%/u);
    expect(handleRule[1]).toMatch(/background:\s*var\(--moon-gold\)/u);
  });

  it("shows the destination folio while the scrubber is focused or dragged", () => {
    expect(source).toMatch(/progress\.dataset\.label\s*=\s*scrubberLabel/u);
    expect(styles).toMatch(/content:\s*attr\(data-label\)/u);
    expect(styles).toMatch(/\.publication-rail__scrubber:focus-within i::before/u);
  });
});
