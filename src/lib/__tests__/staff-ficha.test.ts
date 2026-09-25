import { describe, expect, it } from "vitest";
import {
  currentPayTerm,
  exceptionRanges,
  hoursForLocation,
  pastPayTerms,
  payFieldsChanged,
  summarizeBaseHours,
  uniquePayTerms,
  upcomingPayTerms,
} from "../staff-ficha";

describe("staff ficha hours", () => {
  it("summarizes only the base week, not dated exceptions", () => {
    const rows = summarizeBaseHours([
      { weekday: 0, start_time: "09:00", end_time: "18:00" },
      { weekday: 2, start_time: "10:00", end_time: "16:00", valid_from: "2026-09-21", valid_to: "2026-09-27" },
    ]);
    expect(rows).toEqual([{ weekday: 0, label: "Lun", start: "09:00", end: "18:00" }]);
  });

  it("does not mix another sede's copy of the same week", () => {
    const rows = hoursForLocation(
      [
        { weekday: 2, start_time: "10:00", end_time: "18:00", location_id: "principal" },
        { weekday: 2, start_time: "10:00", end_time: "18:00", location_id: "cota" },
      ],
      "principal",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].location_id).toBe("principal");
  });

  it("collapses identical franjas when location_id is missing", () => {
    const rows = hoursForLocation(
      [
        { weekday: 2, start_time: "10:00", end_time: "18:00" },
        { weekday: 2, start_time: "10:00", end_time: "18:00" },
      ],
      "principal",
    );
    expect(rows).toHaveLength(1);
  });
});

describe("staff ficha pay terms", () => {
  const dupA = {
    id: "1",
    effective_from: "2026-09-21",
    effective_to: null,
    payment_mode: "fijo",
    shift_rate: 50000,
    commission_pct: 0,
    fixed_pay_basis: "por_turno",
  };
  const dupB = { ...dupA, id: "2" };
  const previous = {
    id: "0",
    effective_from: "2026-09-07",
    effective_to: "2026-09-20",
    payment_mode: "fijo",
    shift_rate: 40000,
    commission_pct: 0,
    fixed_pay_basis: "por_turno",
  };
  const next = {
    id: "3",
    effective_from: "2026-09-28",
    effective_to: null,
    payment_mode: "porcentaje",
    shift_rate: 0,
    commission_pct: 18,
    fixed_pay_basis: "por_turno",
  };

  it("collapses duplicate rows of the same conditions", () => {
    expect(uniquePayTerms([dupA, dupB, previous])).toHaveLength(2);
  });

  it("picks the term covering today, not a scheduled future change", () => {
    const today = "2026-09-21";
    const terms = [previous, dupA, dupB, next];
    expect(currentPayTerm(terms, today)?.id).toBe("1");
    expect(upcomingPayTerms(terms, today).map((t) => t.id)).toEqual(["3"]);
    expect(pastPayTerms(terms, today).map((t) => t.id)).toEqual(["0"]);
  });

  it("does not treat a name-only edit as a pay change", () => {
    expect(
      payFieldsChanged(
        { shift_rate: 50000, payment_mode: "fijo", commission_pct: 0, fixed_pay_basis: "por_turno" },
        { shift_rate: 50000, payment_mode: "fijo", commission_pct: 0, fixed_pay_basis: "por_turno" },
      ),
    ).toBe(false);
    expect(
      payFieldsChanged(
        { shift_rate: 50000, payment_mode: "fijo", commission_pct: 0 },
        { shift_rate: 60000, payment_mode: "fijo", commission_pct: 0, fixed_pay_basis: "por_turno" },
      ),
    ).toBe(true);
  });
});
