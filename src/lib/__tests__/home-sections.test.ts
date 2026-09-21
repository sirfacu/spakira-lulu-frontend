import { describe, expect, it } from "vitest";
import { normalizeSectionOrder } from "@/lib/home-sections";
import { DEFAULT_HOME_HERO, normalizeHomeHero } from "@/lib/home-hero";

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

describe("normalizeHomeHero", () => {
  it("falls back to the current Spa Kira copy", () => {
    expect(normalizeHomeHero(null)).toEqual(DEFAULT_HOME_HERO);
  });

  it("keeps a custom image and empty accent", () => {
    const out = normalizeHomeHero({
      kicker: "Peludos",
      title: "Hola",
      title_accent: "",
      body: "Texto",
      image_url: "/uploads/branding/x.jpg",
    });
    expect(out.kicker).toBe("Peludos");
    expect(out.title_accent).toBe("");
    expect(out.image_url).toBe("/uploads/branding/x.jpg");
    expect(out.styles.kicker.uppercase).toBe(true);
  });

  it("clips oversized copy so the home layout cannot explode", () => {
    const out = normalizeHomeHero({
      kicker: "k".repeat(80),
      title: "t".repeat(80),
      title_accent: "a".repeat(80),
      body: "b".repeat(500),
      styles: { title: { font: "sans", color: "blush" } },
    });
    expect(out.kicker).toHaveLength(28);
    expect(out.title).toHaveLength(40);
    expect(out.title_accent).toHaveLength(22);
    expect(out.body).toHaveLength(220);
    expect(out.styles.title.font).toBe("sans");
    expect(out.styles.title.color).toBe("blush");
  });
});
