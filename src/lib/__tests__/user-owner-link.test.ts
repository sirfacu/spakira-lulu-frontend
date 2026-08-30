import { describe, expect, it } from "vitest";
import { emailKey, indexByEmail } from "../user-owner-link";

describe("user-owner-link", () => {
  it("normalizes email for matching", () => {
    expect(emailKey("  Ana@SpaKira.local ")).toBe("ana@spakira.local");
    expect(emailKey(null)).toBe("");
  });

  it("indexes by email without dropping rows that lack email", () => {
    const map = indexByEmail([
      { id: "1", email: "a@x.com" },
      { id: "2", email: "A@X.com" },
      { id: "3", email: "  " },
    ]);
    expect(map.get("a@x.com")?.id).toBe("2");
    expect(map.has("")).toBe(false);
    expect(map.size).toBe(1);
  });
});
