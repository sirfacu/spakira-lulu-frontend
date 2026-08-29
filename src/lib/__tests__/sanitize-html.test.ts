import { describe, expect, it } from "vitest";
import { sanitizePreviewHtml } from "../sanitize-html";

describe("sanitizePreviewHtml", () => {
  it("strips script and event handlers", () => {
    const dirty = `<p>Hola</p><script>alert(1)</script><img src=x onerror="alert(2)">`;
    const clean = sanitizePreviewHtml(dirty);
    expect(clean).not.toMatch(/script/i);
    expect(clean).not.toMatch(/onerror/i);
    expect(clean).toMatch(/Hola/);
  });
});
