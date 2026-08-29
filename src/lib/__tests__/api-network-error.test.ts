import { describe, expect, it } from "vitest";
import { networkErrorMessage } from "@/lib/api";

describe("networkErrorMessage", () => {
  it("keeps non-network errors as-is", () => {
    expect(networkErrorMessage("Cita no encontrada", "localhost")).toBe("Cita no encontrada");
  });

  it("mentions the Cloudflare tunnel only on tunnel hosts", () => {
    expect(networkErrorMessage("Failed to fetch", "abc.trycloudflare.com")).toMatch(
      /túnel de Cloudflare/,
    );
  });

  it("asks for local API on localhost", () => {
    expect(networkErrorMessage("Failed to fetch", "localhost")).toMatch(/9001/);
    expect(networkErrorMessage("Failed to fetch", "localhost")).not.toMatch(/túnel/);
  });

  it("does not mention the tunnel on production", () => {
    const msg = networkErrorMessage("Failed to fetch", "spakira.e-mac.co");
    expect(msg).toMatch(/Recargá/);
    expect(msg).not.toMatch(/túnel|Cloudflare/i);
  });
});
