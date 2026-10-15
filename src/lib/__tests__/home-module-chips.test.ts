import { describe, expect, it } from "vitest";
import { homeModuleChips, servicesForHomeModule } from "@/lib/home-module-chips";

const services = [
  { name: "Baño", category: "spa" },
  { name: "Cirugías", category: "veterinary" },
];

describe("home module chips", () => {
  it("keeps the home as it is when veterinary is off", () => {
    expect(homeModuleChips(false)).toEqual(["spa"]);
    expect(servicesForHomeModule(services, "spa").map((service) => service.name)).toEqual(["Baño"]);
  });

  it("splits spa and veterinary when the module is on", () => {
    expect(homeModuleChips(true)).toEqual(["spa", "veterinary"]);
    expect(servicesForHomeModule(services, "veterinary").map((service) => service.name)).toEqual(["Cirugías"]);
  });
});
