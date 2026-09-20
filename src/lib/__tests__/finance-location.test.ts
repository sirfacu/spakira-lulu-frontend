import { describe, expect, it } from "vitest";
import { financeLocationParam } from "@/lib/spa-queries";

describe("financeLocationParam", () => {
  it("omits empty, todas and whitespace so the API stays global", () => {
    expect(financeLocationParam(undefined)).toBeUndefined();
    expect(financeLocationParam(null)).toBeUndefined();
    expect(financeLocationParam("")).toBeUndefined();
    expect(financeLocationParam("  ")).toBeUndefined();
    expect(financeLocationParam("todas")).toBeUndefined();
  });

  it("keeps a sede id for the querystring", () => {
    expect(financeLocationParam("11111111-1111-1111-1111-111111111111")).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
  });
});
