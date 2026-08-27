import { describe, expect, it } from "vitest";

/** Si un navigate usó el id de ruta, la URL queda con este prefijo inválido. */
function fixAuthenticatedPath(pathname: string): string {
  if (!pathname.startsWith("/_authenticated")) return pathname;
  return pathname.replace(/^\/_authenticated/, "") || "/panel";
}

describe("agenda authenticated URL fix", () => {
  it("strips pathless layout id leaked into the browser path", () => {
    expect(fixAuthenticatedPath("/_authenticated/panel/agenda")).toBe("/panel/agenda");
    expect(fixAuthenticatedPath("/_authenticated/panel/agenda")).not.toContain("_authenticated");
    expect(fixAuthenticatedPath("/panel/agenda")).toBe("/panel/agenda");
    expect(fixAuthenticatedPath("/_authenticated")).toBe("/panel");
  });
});
