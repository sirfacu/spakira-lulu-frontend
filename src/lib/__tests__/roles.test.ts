import { describe, expect, it } from "vitest";
import {
  PANEL_MODULES,
  canAccessPath,
  canCancelAppointment,
  displayRole,
  homeForRole,
  isVisibleOnAgenda,
  AGENDA_FILTER_STATUSES,
  maskEmail,
  maskEndingDigits,
  normalizeRole,
  panelNavLabel,
  permissionsFor,
  editableAppointmentStatuses,
  isActiveSale,
  sortPanelNavPaths,
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

  it("cliente sidebar: Mi perfil under Servicios", () => {
    expect(panelNavLabel("/panel/propietarios", "cliente")).toBe("Mi perfil");
    expect(panelNavLabel("/panel/propietarios", "admin")).toBe("Usuarios");
    expect(panelNavLabel("/panel/precios", "cliente")).toBe("Servicios");
    expect(panelNavLabel("/panel/agenda", "cliente")).toBe("Mi agenda");
    expect(panelNavLabel("/panel/mascotas", "cliente")).toBe("Mis mascotas");
    expect(
      sortPanelNavPaths(
        ["/panel/propietarios", "/panel/agenda", "/panel/mascotas", "/panel/precios"],
        "cliente",
      ),
    ).toEqual(["/panel/agenda", "/panel/mascotas", "/panel/precios", "/panel/propietarios"]);
    const servicios = sortPanelNavPaths(
      ["/panel/propietarios", "/panel/precios"],
      "cliente",
    );
    expect(servicios.indexOf("/panel/precios")).toBeLessThan(
      servicios.indexOf("/panel/propietarios"),
    );
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
    expect(canAccessPath("colaborador", "/panel/personal")).toBe(false);
    expect(canAccessPath("colaborador", "/panel/reportes")).toBe(false);
    expect(canAccessPath("colaborador", "/panel/configuracion")).toBe(false);
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
    expect(permissionsFor("admin").canEditFinalizedAppointment).toBe(false);
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

  it("nobody reopens a finalized appointment; staff only moves forward", () => {
    expect(editableAppointmentStatuses("colaborador", "pendiente")).toEqual([
      "pendiente",
      "enproceso",
      "cancelada",
    ]);
    expect(editableAppointmentStatuses("colaborador", "enproceso")).toEqual([
      "enproceso",
      "finalizada",
    ]);
    expect(editableAppointmentStatuses("admin", "enproceso")).toEqual([
      "enproceso",
      "finalizada",
      "cancelada",
    ]);
    expect(editableAppointmentStatuses("colaborador", "finalizada")).toEqual(["finalizada"]);
    expect(editableAppointmentStatuses("admin", "finalizada")).toEqual(["finalizada"]);
    expect(editableAppointmentStatuses("admin", "enproceso")).not.toContain("pendiente");
    expect(editableAppointmentStatuses("cliente", "pendiente")).toEqual([]);
    expect(canCancelAppointment("cliente", "pendiente")).toBe(true);
    expect(canCancelAppointment("cliente", "enproceso")).toBe(false);
    expect(canCancelAppointment("colaborador", "enproceso")).toBe(false);
    expect(canCancelAppointment("admin", "enproceso")).toBe(true);
    expect(canCancelAppointment("admin", "finalizada")).toBe(false);
    expect(isActiveSale("activa")).toBe(true);
    expect(isActiveSale("anulada")).toBe(false);
    expect(isActiveSale(undefined)).toBe(true);
  });

  it("hides cancelled appointments from the agenda grid", () => {
    expect(isVisibleOnAgenda("pendiente")).toBe(true);
    expect(isVisibleOnAgenda("enproceso")).toBe(true);
    expect(isVisibleOnAgenda("finalizada")).toBe(true);
    expect(isVisibleOnAgenda("cancelada")).toBe(false);
    expect(AGENDA_FILTER_STATUSES).toEqual(["pendiente", "enproceso", "finalizada"]);
    expect(AGENDA_FILTER_STATUSES).not.toContain("cancelada");
  });

  it("cliente never reaches ventas, inventario, reportes, staff or permisos", () => {
    for (const path of [
      "/panel/ventas",
      "/panel/inventario",
      "/panel/reportes",
      "/panel/personal",
      "/panel/permisos",
      "/panel/configuracion",
      "/panel/promociones",
    ]) {
      expect(canAccessPath("cliente", path)).toBe(false);
    }
    expect(permissionsFor("cliente").canSeeWhatsAppLinks).toBe(false);
    expect(permissionsFor("cliente").canViewSalesAnalytics).toBe(false);
    expect(permissionsFor("colaborador").canViewSalesAnalytics).toBe(false);
    expect(permissionsFor("colaborador").maskOwnerPii).toBe(true);
  });
});
