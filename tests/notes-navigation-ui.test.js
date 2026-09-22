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

    expect(source).toMatch(/progress\.style\.width\s*=\s*`\$\{ratio \* 100\}%`/u);
    expect(progressRules.some((rule) => /width:\s*0/u.test(rule[1]))).toBe(true);
    expect(handleRule).not.toBeNull();
    expect(handleRule[1]).toMatch(/border-radius:\s*50%/u);
    expect(handleRule[1]).toMatch(/background:\s*var\(--moon-gold\)/u);
  });

  it("shows the destination folio while the scrubber is focused or dragged", () => {
    expect(source).toMatch(/progress\.dataset\.label\s*=\s*scrubberLabel/u);
    expect(styles).toMatch(/content:\s*attr\(data-label\)/u);
    expect(styles).toMatch(/\.publication-rail__scrubber:focus-within i::before/u);
  });

  it("uses the full track as a large direct-manipulation target", () => {
    const hitAreaRule = styles.match(/\.publication-rail__scrubber\s*\{([^}]*)\}/u);

    expect(hitAreaRule).not.toBeNull();
    expect(hitAreaRule[1]).toMatch(/height:\s*44px/u);
    expect(hitAreaRule[1]).toMatch(/touch-action:\s*none/u);
    expect(source).toMatch(/scrubberValueAtClientX/u);
    expect(source).toMatch(/addEventListener\("pointerdown"/u);
    expect(source).toMatch(/addEventListener\("pointermove"/u);
    expect(source).toMatch(/setPointerCapture/u);
    expect(styles).toMatch(/\[data-scrubbing="true"\][^{]*i\s*\{[^}]*transition:\s*none/su);
  });
});

describe("note page running head", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  it("sets the running head with modest tracking so names read as words", () => {
    const rule = styles.match(/\.note-page__running\s*\{([^}]*)\}/su)?.[1] || "";
    const tracking = Number(rule.match(/letter-spacing:\s*([\d.]+)em;/u)?.[1]);

    expect(tracking).toBeGreaterThan(0);
    expect(tracking).toBeLessThanOrEqual(0.12);
  });
});

describe("programme without running numbers", () => {
  const render = readFileSync(new URL("../src/notes-book-render.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  it("prints no number beside a programme entry, a note's opening, or a harp-solo song", () => {
    expect(render).not.toMatch(/note-contents__number/u);
    expect(render).not.toMatch(/note-banner__number/u);
    expect(render).not.toMatch(/note-work__number/u);
  });

  it("sets the harp-solo songs upright in the programme list", () => {
    const rule = styles.match(/\.note-contents__sub--work\s*\{([^}]*)\}/su)?.[1] || "";
    expect(rule).not.toMatch(/font-style:\s*italic/u);
  });
});

describe("no stranded last character", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const render = readFileSync(new URL("../src/notes-book-render.js", import.meta.url), "utf8");

  it("keeps the guarded tail of a paragraph on one line", () => {
    expect(styles).toMatch(/\.note-nowrap\s*\{[^}]*white-space:\s*nowrap;/su);
    expect(render).toMatch(/orphanGuardStart/u);
  });

  it("justifies Chinese paragraphs so a line that gave up a character still meets the margin", () => {
    expect(styles).toMatch(
      /\.note-paragraph\[data-justify="true"\],\s*\.note-work__detail\[data-justify="true"\]\s*\{[^}]*text-align:\s*justify;/su,
    );
  });

  it("leaves a paragraph that runs onto the next page full to its last line", () => {
    expect(render).toMatch(/runsOn/u);
  });
});

describe("titles never end on a lone character", () => {
  const render = readFileSync(new URL("../src/notes-book-render.js", import.meta.url), "utf8");

  it("guards programme titles, song lines and note headings like the paragraphs", () => {
    expect(render).toMatch(/const link = createElement\("strong", "note-contents__title-link"\);\s*appendCopy\(link, payload\.title\);/u);
    expect(render).toMatch(/const titleText = createElement\("span"\);\s*appendCopy\(titleText, payload\.title\);/u);
    expect(render).toMatch(/const title = createElement\("h2", "note-banner__title"\);\s*appendCopy\(title, payload\.work \|\| payload\.title\);/u);
  });
});
