import { describe, expect, it } from "vitest";

import {
  canTransitionVisibility,
  hasWebEdition,
  isListedProgramme,
  isPubliclyReadable,
  listedProgrammes,
} from "../src/domain/programme.js";

describe("programme visibility", () => {
  it.each(["published", "unlisted"])("allows %s programmes to be read by URL", (visibility) => {
    expect(isPubliclyReadable({ visibility })).toBe(true);
  });

  it.each(["draft", "archived"])("keeps %s programmes private", (visibility) => {
    expect(isPubliclyReadable({ visibility })).toBe(false);
  });

  it("lists only published programmes on the public shelf", () => {
    const programmes = [
      { id: "one", visibility: "published" },
      { id: "two", visibility: "unlisted" },
      { id: "three", visibility: "draft" },
    ];

    expect(listedProgrammes(programmes)).toEqual([{ id: "one", visibility: "published" }]);
    expect(isListedProgramme(programmes[0])).toBe(true);
  });
});

describe("admin publication transitions", () => {
  it("supports editorial publishing and unpublishing", () => {
    expect(canTransitionVisibility("draft", "published")).toBe(true);
    expect(canTransitionVisibility("published", "unlisted")).toBe(true);
    expect(canTransitionVisibility("unlisted", "published")).toBe(true);
  });

  it("requires an archived programme to return to draft before publishing", () => {
    expect(canTransitionVisibility("archived", "published")).toBe(false);
    expect(canTransitionVisibility("archived", "draft")).toBe(true);
  });
});

describe("programme editions", () => {
  it("offers the web edition only when a visible chapter exists", () => {
    expect(hasWebEdition({ chapters: [] })).toBe(false);
    expect(hasWebEdition({ chapters: [{ is_visible: false }] })).toBe(false);
    expect(hasWebEdition({ chapters: [{ is_visible: true }] })).toBe(true);
  });
});
