import { describe, expect, it } from "vitest";

/** Mirror of resolveMediaUrl without window (unit). */
function resolveMediaUrl(
  url: string | null | undefined,
  apiBase = "https://spakira.e-mac.co/api",
): string {
  if (!url?.trim()) return "";
  const trimmed = url.trim();
  if (/amazonaws\.com|cloudfront\.net/i.test(trimmed)) return trimmed;
  const match = trimmed.match(/(\/uploads\/.+)$/);
  if (match) return `${apiBase}${match[1]}`;
  if (trimmed.startsWith("/")) return `${apiBase}${trimmed}`;
  return trimmed;
}

describe("resolveMediaUrl", () => {
  it("rewrites local upload paths to the API base", () => {
    expect(resolveMediaUrl("http://127.0.0.1:9001/uploads/pets/a.jpg")).toBe(
      "https://spakira.e-mac.co/api/uploads/pets/a.jpg",
    );
    expect(resolveMediaUrl("/uploads/pets/a.jpg")).toBe(
      "https://spakira.e-mac.co/api/uploads/pets/a.jpg",
    );
  });

  it("keeps S3 / CloudFront URLs", () => {
    const s3 = "https://env-spakirajiro-static-content.s3.us-east-1.amazonaws.com/pets/a.jpg";
    expect(resolveMediaUrl(s3)).toBe(s3);
  });
});
