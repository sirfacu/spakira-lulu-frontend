import { describe, expect, it } from "vitest";
import {
  canonicalizeStaffRole,
  isAdminStaffJob,
  staffRoleLabel,
  staffRolesLine,
} from "../staff-roles";

describe("staff roles", () => {
  it("canonicalizes aliases", () => {
    expect(canonicalizeStaffRole("Lavador")).toBe("auxiliar");
    expect(canonicalizeStaffRole("Bañista")).toBe("auxiliar");
    expect(canonicalizeStaffRole("Estilista")).toBe("groomer");
    expect(canonicalizeStaffRole("Secador")).toBe("auxiliar");
    expect(canonicalizeStaffRole("Colorista")).toBe("groomer");
    expect(canonicalizeStaffRole("Chofer")).toBe("conductor");
    expect(canonicalizeStaffRole("Recepcion")).toBe("recepcionista");
  });

  it("labels display cargo", () => {
    expect(staffRoleLabel("auxiliar")).toBe("Auxiliar");
    expect(staffRoleLabel("groomer")).toBe("Groomer");
    expect(staffRoleLabel("secador")).toBe("Auxiliar");
    expect(staffRoleLabel("recepcionista")).toBe("Recepcionista");
    expect(staffRoleLabel("conductor")).toBe("Conductor");
    expect(staffRoleLabel("oficios_varios")).toBe("Oficios varios");
  });

  it("builds card line with extra profiles", () => {
    expect(staffRolesLine(["auxiliar"], "auxiliar")).toBe("Auxiliar");
  });

  it("marks administrative jobs", () => {
    expect(isAdminStaffJob("conductor")).toBe(true);
    expect(isAdminStaffJob("recepcionista")).toBe(true);
    expect(isAdminStaffJob("oficios_varios")).toBe(true);
    expect(isAdminStaffJob("groomer")).toBe(false);
    expect(isAdminStaffJob("auxiliar")).toBe(false);
  });
});
