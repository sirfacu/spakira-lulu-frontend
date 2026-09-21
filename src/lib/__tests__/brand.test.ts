import { describe, expect, it } from "vitest";
import { splitTradeName } from "@/components/brand";
import { DEFAULT_THEME_ID, normalizeThemeId } from "@/lib/brand-themes";
import { DEFAULT_IDENTITY_STYLES, normalizeIdentityStyles } from "@/lib/identity-styles";

describe("splitTradeName", () => {
  it("splits first word as script and rest as display", () => {
    expect(splitTradeName("Spa Kira")).toEqual({ script: "Spa", display: "Kira" });
    expect(splitTradeName("Spa Kira Luxury")).toEqual({
      script: "Spa",
      display: "Kira Luxury",
    });
  });

  it("uses single display block when there is no space", () => {
    expect(splitTradeName("Kira")).toEqual({ script: "", display: "Kira" });
  });

  it("falls back to Spa Kira", () => {
    expect(splitTradeName(null)).toEqual({ script: "Spa", display: "Kira" });
    expect(splitTradeName("")).toEqual({ script: "Spa", display: "Kira" });
  });
});

describe("normalizeThemeId", () => {
  it("keeps registered themes and falls back to KIRA default", () => {
    expect(normalizeThemeId("pink-pastel")).toBe("pink-pastel");
    expect(normalizeThemeId("navy")).toBe("navy");
    expect(normalizeThemeId("rose")).toBe("rose");
    expect(normalizeThemeId("nope")).toBe(DEFAULT_THEME_ID);
    expect(normalizeThemeId(null)).toBe(DEFAULT_THEME_ID);
  });
});

describe("normalizeIdentityStyles", () => {
  it("keeps KIRA defaults and accepts a custom hex on one line", () => {
    expect(normalizeIdentityStyles(null)).toEqual(DEFAULT_IDENTITY_STYLES);
    const out = normalizeIdentityStyles({
      short_name: { font: "sans", color: "#112233", bold: true, italic: true },
      brand_name: { font: "nope", color: "neon" },
    });
    expect(out.short_name).toMatchObject({
      font: "sans",
      color: "#112233",
      bold: true,
      italic: true,
    });
    expect(out.brand_name.font).toBe("display");
    expect(out.brand_name.color).toBe("primary");
  });
});
