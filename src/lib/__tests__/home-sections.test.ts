import { describe, expect, it } from "vitest";
import { normalizeSectionOrder } from "@/lib/home-sections";

describe("normalizeSectionOrder", () => {
  it("fills missing sections after the ones the admin dragged", () => {
    expect(normalizeSectionOrder(["videos", "hero"])).toEqual([
      "videos",
      "hero",
      "news",
      "services",
    ]);
  });

  it("drops unknowns and duplicates", () => {
    expect(normalizeSectionOrder(["videos", "videos", "nope", "news"])).toEqual([
      "videos",
      "news",
      "hero",
      "services",
    ]);
  });

  it("defaults to the original home order", () => {
    expect(normalizeSectionOrder(null)).toEqual(["hero", "news", "services", "videos"]);
  });
});
