import { describe, expect, it } from "vitest";
import {
  agendaCreateKind,
  agendaSearchPreserveModulo,
} from "../agenda-create-kind";

describe("agendaCreateKind", () => {
  it("opens veterinary create only on the Veterinaria chip", () => {
    expect(agendaCreateKind("veterinary")).toBe("veterinary");
    expect(agendaCreateKind("todos")).toBe("spa");
    expect(agendaCreateKind(undefined)).toBe("spa");
  });
});

describe("agendaSearchPreserveModulo", () => {
  it("keeps modulo when clearing service deep-link", () => {
    expect(
      agendaSearchPreserveModulo({
        google: undefined,
        service: undefined,
        pet: undefined,
        modulo: "veterinary",
      }),
    ).toEqual({
      google: undefined,
      service: undefined,
      pet: undefined,
      modulo: "veterinary",
    });
  });
});
