import { describe, expect, it } from "vitest";

import { ProgrammeRepository } from "../src/services/programme-repository.js";

function publicProgrammeClient() {
  const calls = [];
  const query = {
    select(value) {
      calls.push(["select", value]);
      return this;
    },
    eq(column, value) {
      calls.push(["eq", column, value]);
      return this;
    },
    in(column, value) {
      calls.push(["in", column, value]);
      return this;
    },
    async maybeSingle() {
      calls.push(["maybeSingle"]);
      return {
        data: { slug: "sense-and-sensibility", programme_chapters: [] },
        error: null,
      };
    },
  };

  return {
    calls,
    client: {
      from(table) {
        calls.push(["from", table]);
        return query;
      },
    },
  };
}

describe("ProgrammeRepository public lookup", () => {
  it("loads a public programme by its globally unique slug", async () => {
    const { client, calls } = publicProgrammeClient();
    const repository = new ProgrammeRepository(client);

    const programme = await repository.getPublicBySlug("sense-and-sensibility");

    expect(programme.slug).toBe("sense-and-sensibility");
    expect(calls).toContainEqual(["eq", "slug", "sense-and-sensibility"]);
    expect(calls).not.toContainEqual(["eq", "client_slug", expect.anything()]);
    expect(calls).toContainEqual(["in", "visibility", ["published", "unlisted"]]);
  });
});
