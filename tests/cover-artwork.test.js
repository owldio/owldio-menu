import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

describe("printed cover artwork", () => {
  it("shows the complete cover instead of cropping its edge content", () => {
    const rule = styles.match(
      /\.note-page\[data-page-kind="cover"\]\s+\.note-printed img\s*\{([^}]*)\}/u,
    );

    expect(rule, "the cover image rule must remain explicit").not.toBeNull();
    expect(rule[1]).toMatch(/object-fit:\s*contain\s*;/u);
    expect(rule[1]).not.toMatch(/object-fit:\s*cover\s*;/u);
  });

  it("sets harp-solo item numbers apart in italic", () => {
    const rule = styles.match(/\.note-work__number\s*\{([^}]*)\}/u);

    expect(rule, "the work number rule must remain explicit").not.toBeNull();
    expect(rule[1]).toMatch(/font-style:\s*italic\s*;/u);
  });
});
