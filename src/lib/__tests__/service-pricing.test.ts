import { describe, expect, it } from "vitest";
import {
  PENDING_SERVICE_PRICE_LABEL,
  appointmentShowsChargedPrice,
  isPendingCatalogPrice,
  servicePriceHeadline,
  servicePriceHeadlineForClient,
  servicePriceNote,
  servicePriceNoteForClient,
} from "@/lib/service-pricing";

describe("service pricing visibility", () => {
  it("hides catalog amounts when pending", () => {
    const s = { price: null, price_min: null, price_max: null, price_pending: true };
    expect(isPendingCatalogPrice(s)).toBe(true);
    expect(servicePriceHeadline(s)).toBe(PENDING_SERVICE_PRICE_LABEL);
    expect(servicePriceNote(s)).toMatch(/llegar/);
  });

  it("still shows staff catalog ranges", () => {
    expect(servicePriceHeadline({ price: 50000, price_min: 50000, price_max: 80000 })).toMatch(
      /Desde/,
    );
  });

  it("shows breed-based desde headline for clients", () => {
    expect(
      servicePriceHeadlineForClient(
        { price: null, price_min: null, price_max: null, price_pending: true },
        { has_profile: true, breed_name: "Shih tzu", price_min: 35000, price_max: 55000 },
      ),
    ).toBe("Desde $ 35.000");
    expect(
      servicePriceNoteForClient(
        { price_pending: true, price_min: null, price_max: null, price_note: null },
        { breed_name: "Shih tzu", price_min: 35000 },
      ),
    ).toMatch(/Shih tzu/);
  });

  it("shows counter validation when pet breed has no profile", () => {
    expect(
      servicePriceHeadlineForClient(
        { price: null, price_min: null, price_max: null, price_pending: true },
        { has_profile: false, breed_name: "Otra raza" },
        true,
      ),
    ).toBe("Validar en mostrador");
  });

  it("hides charged price for clients until en proceso", () => {
    expect(appointmentShowsChargedPrice({ status: "pendiente" }, true)).toBe(false);
    expect(appointmentShowsChargedPrice({ status: "enproceso", price_pending: false }, true)).toBe(
      true,
    );
    expect(appointmentShowsChargedPrice({ status: "pendiente" }, false)).toBe(true);
  });
});
