import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("Moonlight Promise font subset", () => {
  it("includes the performer biographies in the subset source corpus", () => {
    const buildScript = readFileSync(new URL("../scripts/build-notes-font.mjs", import.meta.url), "utf8");

    expect(buildScript).toContain('"src/data/moonlight-promise-people.js"');
  });
});
