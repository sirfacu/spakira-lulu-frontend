import { describe, expect, it } from "vitest";
import { canonicalizeStaffRole, staffRoleLabel, staffRolesLine } from "../staff-roles";

describe("staff roles", () => {
  it("canonicalizes aliases", () => {
    expect(canonicalizeStaffRole("Lavador")).toBe("bañista");
    expect(canonicalizeStaffRole("Bañista")).toBe("bañista");
    expect(canonicalizeStaffRole("Estilista")).toBe("groomer");
    expect(canonicalizeStaffRole("Secador")).toBe("secador");
  });

  it("labels display cargo", () => {
    expect(staffRoleLabel("secador")).toBe("Secador");
    expect(staffRoleLabel("groomer")).toBe("Groomer");
  });

  it("builds card line with extra profiles", () => {
    expect(staffRolesLine(["bañista", "secador"], "secador")).toBe("Secador · Bañista");
  });
});
