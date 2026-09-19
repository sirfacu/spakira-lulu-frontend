import { describe, expect, it } from "vitest";
import {
  formatContentQty,
  formatPackagesLabel,
  niceQty,
  presentationToStored,
  storedDeltaToMatch,
  storedToPresentation,
} from "../inventory-qty";

describe("inventory qty conversion", () => {
  it("converts presentation to stored for every unit kind", () => {
    expect(presentationToStored("ml", 450, 1)).toBe(450);
    expect(presentationToStored("ml", 450, 2)).toBe(900);
    expect(presentationToStored("g", 100, 3)).toBe(300);
    expect(presentationToStored("l", 1.5, 2)).toBe(3);
    expect(presentationToStored("pack", 12, 2)).toBe(24);
    expect(presentationToStored("unidad", 1, 7)).toBe(7);
    expect(presentationToStored("unidad", 12, 7)).toBe(7);
  });

  it("does not add a whole bottle when leftover ml is 1", () => {
    expect(
      storedDeltaToMatch({
        unitKind: "ml",
        packSize: 450,
        currentStored: 1,
        wantedPresentation: 1,
      }),
    ).toBe(449);
    expect(
      storedDeltaToMatch({
        unitKind: "ml",
        packSize: 450,
        currentStored: 451,
        wantedPresentation: 1,
      }),
    ).toBe(-1);
    expect(
      storedDeltaToMatch({
        unitKind: "ml",
        packSize: 450,
        currentStored: 450,
        wantedPresentation: 1,
      }),
    ).toBe(0);
    expect(
      storedDeltaToMatch({
        unitKind: "g",
        packSize: 42,
        currentStored: 41,
        wantedPresentation: 1,
      }),
    ).toBe(1);
    expect(
      storedDeltaToMatch({
        unitKind: "pack",
        packSize: 10,
        currentStored: 10,
        wantedPresentation: 2,
      }),
    ).toBe(10);
  });

  it("keeps open-bottle remainder instead of snapping to a full pack", () => {
    expect(storedToPresentation("ml", 450, 447)).toBeCloseTo(0.9933, 3);
    expect(
      storedDeltaToMatch({
        unitKind: "ml",
        packSize: 450,
        currentStored: 447,
        wantedPresentation: 1,
      }),
    ).toBe(3);
  });

  it("does not label 451 ml as a clean 1 envase", () => {
    expect(formatContentQty(451, "ml")).toBe("451 ml");
    expect(formatPackagesLabel(451 / 450, "ml")).toBe("1.002 envases");
    expect(niceQty(1.002222, 3)).toBe(1.002);
    expect(niceQty(1, 3)).toBe(1);
  });
});
