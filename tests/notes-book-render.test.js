import { describe, expect, it } from "vitest";

import { pageStartsSection } from "../src/notes-book-render.js";

describe("pageStartsSection", () => {
  it.each(["note-banner", "person-banner"])(
    "treats %s pages as titled opening pages",
    (kind) => {
      expect(pageStartsSection({ atoms: [{ kind }] })).toBe(true);
    },
  );

  it("keeps a running head on an untitled continuation page", () => {
    expect(pageStartsSection({ atoms: [{ kind: "paragraph" }] })).toBe(false);
  });
});
