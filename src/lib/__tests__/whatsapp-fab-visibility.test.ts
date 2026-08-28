import { describe, expect, it } from "vitest";
import { isPublicVisitorPath, shouldShowWhatsAppFab } from "../whatsapp-fab-visibility";

describe("whatsapp fab visibility", () => {
  it("shows on public marketing and legal pages", () => {
    expect(isPublicVisitorPath("/home")).toBe(true);
    expect(isPublicVisitorPath("/auth")).toBe(true);
    expect(isPublicVisitorPath("/privacidad")).toBe(true);
    expect(shouldShowWhatsAppFab("/home", undefined)).toBe(true);
  });

  it("hides on staff panel routes", () => {
    expect(shouldShowWhatsAppFab("/panel/agenda", "colaborador")).toBe(false);
    expect(shouldShowWhatsAppFab("/panel", "admin")).toBe(false);
  });

  it("shows for cliente on enabled panel modules", () => {
    expect(shouldShowWhatsAppFab("/panel/agenda", "cliente")).toBe(true);
    expect(shouldShowWhatsAppFab("/panel/mascotas", "cliente")).toBe(true);
    expect(shouldShowWhatsAppFab("/panel/precios", "cliente")).toBe(true);
    expect(shouldShowWhatsAppFab("/panel/completar", "cliente")).toBe(true);
    expect(shouldShowWhatsAppFab("/panel/propietarios", "cliente")).toBe(false);
  });

  it("respects custom module access for cliente", () => {
    expect(shouldShowWhatsAppFab("/panel/agenda", "cliente", ["agenda"])).toBe(true);
    expect(shouldShowWhatsAppFab("/panel/mascotas", "cliente", ["agenda"])).toBe(false);
  });
});
