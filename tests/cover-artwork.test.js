import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const artworkSource = readFileSync(
  new URL("../src/data/moonlight-promise-people.js", import.meta.url),
  "utf8",
);
const programmeSource = readFileSync(
  new URL("../src/data/sample-programme.js", import.meta.url),
  "utf8",
);

describe("printed cover artwork", () => {
  it("uses the colour-corrected cover artwork on regular and compact phones", () => {
    expect(artworkSource).toMatch(/moonlight-promise-cover-v4\.jpg/u);
    expect(artworkSource).toMatch(/moonlight-promise-cover-compact-v3\.jpg/u);
    expect(programmeSource).toMatch(/moonlight-promise-cover-v4\.jpg/u);
    expect(programmeSource).not.toMatch(/moonlight-promise-cover-v2\.jpg/u);
  });

  it("fills the mobile cover while anchoring its credits to the bottom edge", () => {
    const rule = styles.match(
      /\.note-page\[data-page-kind="cover"\]\s+\.note-printed img\s*\{([^}]*)\}/u,
    );

    expect(rule, "the cover image rule must remain explicit").not.toBeNull();
    expect(rule[1]).toMatch(/object-fit:\s*cover\s*;/u);
    expect(rule[1]).toMatch(/object-position:\s*center bottom\s*;/u);
  });

  it("sets harp-solo item numbers apart in italic", () => {
    const rule = styles.match(/\.note-work__number\s*\{([^}]*)\}/u);

    expect(rule, "the work number rule must remain explicit").not.toBeNull();
    expect(rule[1]).toMatch(/font-style:\s*italic\s*;/u);
  });

  it("keeps opening phrases the same colour as the paragraph", () => {
    const rule = styles.match(/\.note-paragraph__lead\s*\{([^}]*)\}/u);

    expect(rule, "the opening phrase rule must remain explicit").not.toBeNull();
    expect(rule[1]).toMatch(/color:\s*inherit\s*;/u);
  });

  it("indents each harp-solo item description like a normal paragraph", () => {
    const rule = styles.match(/\.note-work__detail\s*\{([^}]*)\}/u);

    expect(rule, "the work description rule must remain explicit").not.toBeNull();
    expect(rule[1]).toMatch(/text-indent:\s*2em\s*;/u);
  });

  it("extends the bank artwork with blue through the folio instead of ending in white", () => {
    const rule = styles.match(
      /\.note-page\[data-page-kind="back-cover"\]\s+\.note-printed\s*\{([^}]*)\}/u,
    );

    expect(rule, "the sponsor page extension must remain explicit").not.toBeNull();
    expect(rule[1]).toMatch(/background:\s*#1f6aa5\s*;/u);
    expect(rule[1]).not.toMatch(/#f8f8f6/u);
  });

  it("extends the harp-centre advertisement with its own ivory field", () => {
    const rule = styles.match(
      /\.note-page\[data-page-kind="sponsor-page"\]\s+\.note-printed\s*\{([^}]*)\}/u,
    );

    expect(rule, "the harp sponsor page extension must remain explicit").not.toBeNull();
    expect(rule[1]).toMatch(/background:\s*#f4efe3\s*;/u);
  });
});
