import { describe, expect, it } from "vitest";
import { publicLocationLabel } from "../location-display";

describe("publicLocationLabel", () => {
  it("joins street with city and region", () => {
    expect(
      publicLocationLabel({
        address: "CR 10 9 65",
        city: "Cota",
        region: "Cundinamarca",
      }),
    ).toBe("CR 10 9 65 · Cota, Cundinamarca");
  });

  it("is empty when there is nothing to show", () => {
    expect(publicLocationLabel({ address: "", city: "", region: "" })).toBe("");
  });
});
