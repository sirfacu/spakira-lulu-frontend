import { describe, expect, it } from "vitest";
import { splitTradeName } from "@/components/brand";

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
