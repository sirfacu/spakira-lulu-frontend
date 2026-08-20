import { describe, expect, it } from "vitest";
import { roleFromAccessToken } from "@/lib/api";

function fakeJwt(payload: object): string {
  const json = JSON.stringify(payload);
  const b64 = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `hdr.${b64}.sig`;
}

describe("roleFromAccessToken", () => {
  it("reads role from JWT payload", () => {
    expect(roleFromAccessToken(fakeJwt({ role: "admin", email: "a@b.c" }))).toBe("admin");
    expect(roleFromAccessToken(fakeJwt({ role: "colaborador" }))).toBe("colaborador");
    expect(roleFromAccessToken(fakeJwt({ role: "cliente" }))).toBe("cliente");
  });

  it("returns undefined when missing or invalid", () => {
    expect(roleFromAccessToken(null)).toBeUndefined();
    expect(roleFromAccessToken("not-a-jwt")).toBeUndefined();
    expect(roleFromAccessToken(fakeJwt({ email: "x" }))).toBeUndefined();
  });
});
