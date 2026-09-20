import { describe, expect, it } from "vitest";
import {
  appointmentOwnerChatMessage,
  buildWhatsAppLink,
  ownerChatLinks,
} from "../whatsapp-link";

describe("whatsapp-link", () => {
  it("builds wa.me with Colombia prefix", () => {
    const href = buildWhatsAppLink("3001112222", "Hola");
    expect(href).toBe("https://wa.me/573001112222?text=Hola");
  });

  it("skips masked PII and falls back to phone", () => {
    const { items, missing } = ownerChatLinks(
      [
        { id: "a", full_name: "Ana", whatsapp: null, phone: "3105551234" },
        { id: "b", full_name: "Luis", whatsapp: "••••1234", pii_masked: true },
      ],
      (name) => `Hola ${name}`,
    );
    expect(items).toHaveLength(1);
    expect(items[0].link).toContain("wa.me/573105551234");
    expect(missing.map((m) => m.full_name)).toEqual(["Luis"]);
  });

  it("names the pet in the agenda chat message", () => {
    const msg = appointmentOwnerChatMessage({
      ownerName: "Ana",
      petName: "Luca",
      serviceName: "Baño",
      whenLabel: "lun. 14:00",
    });
    expect(msg).toContain("Luca");
    expect(msg).toContain("Baño");
  });
});
