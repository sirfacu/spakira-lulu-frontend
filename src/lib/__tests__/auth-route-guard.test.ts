import { describe, expect, it } from "vitest";
import { redirect } from "@tanstack/react-router";
import { shouldRethrowAuthGuardError } from "../auth-route-guard";

describe("shouldRethrowAuthGuardError", () => {
  it("rethrows TanStack redirect so incomplete profile does not look like bad session", () => {
    const err = redirect({ to: "/panel/completar" });
    expect(shouldRethrowAuthGuardError(err)).toBe(true);
    expect("to" in (err as object)).toBe(false);
  });

  it("rethrows href-style redirect used for role home", () => {
    expect(shouldRethrowAuthGuardError({ href: "/panel/agenda" })).toBe(true);
  });

  it("does not rethrow a plain fetch failure", () => {
    expect(shouldRethrowAuthGuardError(new Error("401"))).toBe(false);
  });
});
