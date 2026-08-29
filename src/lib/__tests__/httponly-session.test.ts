import { describe, expect, it, vi, afterEach } from "vitest";

describe("mayHaveSession / usesHttpOnlySession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("usesHttpOnlySession is false on localhost and mayHaveSession follows token", async () => {
    const store: Record<string, string> = { spakira_lulu_token: "tok" };
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
    vi.stubGlobal("window", {
      location: { hostname: "localhost", protocol: "http:", port: "9000" },
      localStorage: globalThis.localStorage,
    });
    const { usesHttpOnlySession, mayHaveSession, getToken } = await import("../api");
    expect(usesHttpOnlySession()).toBe(false);
    expect(getToken()).toBe("tok");
    expect(mayHaveSession()).toBe(true);
  });

  it("usesHttpOnlySession is true on production host and getToken is null", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "should-not-use",
      setItem: () => {},
      removeItem: () => {},
    });
    vi.stubGlobal("window", {
      location: { hostname: "spakira.e-mac.co", protocol: "https:", port: "" },
      localStorage: globalThis.localStorage,
    });
    const { usesHttpOnlySession, mayHaveSession, getToken } = await import("../api");
    expect(usesHttpOnlySession()).toBe(true);
    expect(getToken()).toBe(null);
    expect(mayHaveSession()).toBe(true);
  });
});
