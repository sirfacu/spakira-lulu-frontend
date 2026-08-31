import { describe, expect, it } from "vitest";
import {
  occupiedCopy,
  occupiedEmoji,
  remainingCopy,
  slotCountLabel,
  sexMark,
  speciesEmoji,
  speciesKind,
  speciesLabel,
  startOfWeekMonday,
  ymd,
  isPastHour,
} from "@/lib/client-agenda";

describe("client agenda copy", () => {
  it("maps species to Canino/Felino", () => {
    expect(speciesKind("perro")).toBe("dog");
    expect(speciesLabel("gato")).toBe("Felino");
    expect(speciesLabel("perro")).toBe("Canino");
    expect(speciesEmoji("gato")).toBe("🐱");
    expect(speciesEmoji("perro")).toBe("🐶");
  });

  it("does not leak names in occupied slots", () => {
    expect(occupiedCopy("dog")).toBe("Dando amor a otro peludito");
    expect(occupiedCopy("cat")).toBe("Cuidando a otro michi");
    expect(occupiedCopy("mixed")).toBe("Dando amor a otro peludito");
    expect(occupiedEmoji("cat")).toBe("🐱");
    expect(occupiedCopy("dog")).not.toMatch(/[A-Z][a-z]+ [A-Z]/);
  });

  it("formats remaining slots", () => {
    expect(remainingCopy(1)).toBe("1 disponible");
    expect(remainingCopy(3)).toBe("3 disponibles");
    expect(slotCountLabel(1)).toBe("1 slot");
    expect(slotCountLabel(3)).toBe("3 slots");
  });

  it("sex mark and monday week", () => {
    expect(sexMark("Macho")).toBe("♂");
    expect(sexMark("Hembra")).toBe("♀");
    const sun = new Date(2026, 7, 30);
    expect(ymd(startOfWeekMonday(sun))).toBe("2026-08-24");
  });

  it("treats past hours of today as past", () => {
    const now = new Date(2026, 7, 30, 10, 30, 0);
    expect(isPastHour("2026-08-30", 9, now)).toBe(true);
    expect(isPastHour("2026-08-30", 11, now)).toBe(false);
    expect(isPastHour("2026-08-31", 8, now)).toBe(false);
  });
});
