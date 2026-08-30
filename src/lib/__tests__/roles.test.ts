import { describe, expect, it } from "vitest";
import {
  PANEL_MODULES,
  canAccessPath,
  displayRole,
  homeForRole,
  maskEmail,
  maskEndingDigits,
  normalizeRole,
  permissionsFor,
  editableAppointmentStatuses,
  isActiveSale,
} from "../roles";

describe("roles", () => {
  it("normalizes roles", () => {
    expect(normalizeRole("colaborador")).toBe("colaborador");
    expect(normalizeRole("admin")).toBe("admin");
    expect(normalizeRole("cliente")).toBe("cliente");
    expect(normalizeRole(undefined)).toBe("cliente");
  });

  it("homes by role", () => {
    expect(homeForRole("admin")).toBe("/panel");
    expect(homeForRole("colaborador")).toBe("/panel/agenda");
    expect(homeForRole("cliente")).toBe("/panel/precios");
  });

  it("labels colaborador as Staff", () => {
    expect(displayRole("colaborador")).toBe("Staff");
    expect(displayRole("admin")).toBe("Admin");
    expect(displayRole("cliente")).toBe("Usuario");
  });

  it("labels the propietarios module as Usuarios", () => {
    const mod = PANEL_MODULES.find((m) => m.id === "propietarios");
    expect(mod?.label).toBe("Usuarios");
    expect(mod?.path).toBe("/panel/propietarios");
  });

  it("gates razas tab via mascotas (admin)", () => {
    expect(canAccessPath("admin", "/panel/mascotas")).toBe(true);
    expect(canAccessPath("admin", "/panel/razas")).toBe(false);
    expect(canAccessPath("colaborador", "/panel/razas")).toBe(false);
    expect(canAccessPath("cliente", "/panel/mascotas")).toBe(true);
    expect(canAccessPath("cliente", "/panel/agenda")).toBe(true);
    expect(canAccessPath("cliente", "/panel/precios")).toBe(true);
    expect(canAccessPath("cliente", "/panel/propietarios")).toBe(true);
    expect(canAccessPath("cliente", "/panel/completar")).toBe(true);
    expect(canAccessPath("admin", "/panel/permisos")).toBe(true);
    expect(canAccessPath("colaborador", "/panel/permisos")).toBe(false);
    expect(canAccessPath("colaborador", "/panel/ventas")).toBe(false);
    expect(canAccessPath("colaborador", "/panel/ventas", ["agenda", "ventas"])).toBe(true);
    expect(canAccessPath("admin", "/panel/completar")).toBe(false);
  });

  it("permissions for colaborador", () => {
    const p = permissionsFor("colaborador");
    expect(p.maskOwnerPii).toBe(true);
    expect(p.canManagePrices).toBe(false);
    expect(p.canManagePets).toBe(true);
    expect(p.isStaff).toBe(true);
    expect(p.canChangeAppointmentStatus).toBe(true);
    expect(p.canEditFinalizedAppointment).toBe(false);
    expect(p.canSeeWhatsAppLinks).toBe(true);
    expect(p.canViewSalesAnalytics).toBe(false);
    expect(p.canConnectGoogle).toBe(false);
    expect(p.isCliente).toBe(false);
  });

  it("servicios: ver módulo no implica editar precios", () => {
    expect(canAccessPath("cliente", "/panel/precios")).toBe(true);
    expect(permissionsFor("cliente").canManagePrices).toBe(false);
    expect(canAccessPath("colaborador", "/panel/precios")).toBe(true);
    expect(permissionsFor("colaborador").canManagePrices).toBe(false);
    expect(permissionsFor("admin").canManagePrices).toBe(true);
    expect(permissionsFor("admin").canViewSalesAnalytics).toBe(true);
    expect(permissionsFor("admin").canEditFinalizedAppointment).toBe(true);
    expect(permissionsFor("admin").canConnectGoogle).toBe(true);
  });

  it("permissions for cliente", () => {
    const p = permissionsFor("cliente");
    expect(p.isCliente).toBe(true);
    expect(p.isStaff).toBe(false);
    expect(p.canManagePets).toBe(true);
    expect(p.canManageAgenda).toBe(true);
    expect(p.canPickOwners).toBe(false);
    expect(p.canConnectGoogle).toBe(false);
    expect(p.canChangeAppointmentStatus).toBe(false);
    expect(p.canEditFinalizedAppointment).toBe(false);
    expect(p.canSeeWhatsAppLinks).toBe(false);
    expect(p.canManagePrices).toBe(false);
  });

  it("masks values", () => {
    expect(maskEndingDigits("3105551234")).toContain("1234");
    expect(maskEmail("maria@email.com")).toBe("m••••@email.com");
  });

  it("staff cannot edit statuses after finalizada; admin can", () => {
    expect(editableAppointmentStatuses("colaborador", "enproceso")).toEqual([
      "pendiente",
      "enproceso",
      "finalizada",
      "cancelada",
    ]);
    expect(editableAppointmentStatuses("colaborador", "finalizada")).toEqual(["finalizada"]);
    expect(editableAppointmentStatuses("admin", "finalizada")).toContain("pendiente");
    expect(editableAppointmentStatuses("cliente", "pendiente")).toEqual([]);
    expect(isActiveSale("activa")).toBe(true);
    expect(isActiveSale("anulada")).toBe(false);
    expect(isActiveSale(undefined)).toBe(true);
  });
});
