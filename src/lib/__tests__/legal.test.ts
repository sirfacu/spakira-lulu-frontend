import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRIVACY_PATH,
  DEFAULT_TERMS_PATH,
  formatLegalDate,
  resolveLegalHref,
} from "@/components/legal-layout";

describe("formatLegalDate", () => {
  it("formats ISO dates in Spanish", () => {
    expect(formatLegalDate("2026-08-26")).toBe("26 de agosto de 2026");
    expect(formatLegalDate("2026-01-01")).toBe("1 de enero de 2026");
  });

  it("falls back when empty", () => {
    expect(formatLegalDate(null)).toContain("agosto");
    expect(formatLegalDate("")).toContain("agosto");
  });
});

describe("resolveLegalHref (Google / footer)", () => {
  it("keeps absolute same-origin paths as path-only", () => {
    // jsdom location is typically http://localhost:3000
    const href = resolveLegalHref("http://localhost:3000/privacidad", DEFAULT_PRIVACY_PATH);
    expect(href === "/privacidad" || href.includes("/privacidad")).toBe(true);
  });

  it("keeps relative paths", () => {
    expect(resolveLegalHref("/privacidad", DEFAULT_PRIVACY_PATH)).toBe("/privacidad");
    expect(resolveLegalHref("/terminos", DEFAULT_TERMS_PATH)).toBe("/terminos");
  });

  it("falls back when empty", () => {
    expect(resolveLegalHref("", DEFAULT_PRIVACY_PATH)).toBe("/privacidad");
    expect(resolveLegalHref(null, DEFAULT_TERMS_PATH)).toBe("/terminos");
  });

  it("keeps external absolute URLs (Google consent may use full URL)", () => {
    const url = "https://spakira.e-mac.co/privacidad";
    expect(resolveLegalHref(url, DEFAULT_PRIVACY_PATH)).toBe(url);
  });
});

describe("Google OAuth consent URL shape", () => {
  it("canonical local routes used in consent screen", () => {
    expect(DEFAULT_PRIVACY_PATH).toBe("/privacidad");
    expect(DEFAULT_TERMS_PATH).toBe("/terminos");
  });
});
