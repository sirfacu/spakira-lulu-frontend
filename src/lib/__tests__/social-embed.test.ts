import { describe, expect, it } from "vitest";
import { parseSocialEmbed } from "@/lib/social-embed";

describe("parseSocialEmbed", () => {
  it("converts YouTube watch, short and youtu.be", () => {
    expect(parseSocialEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10").iframeSrc).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(parseSocialEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10").tall).toBe(true);
    expect(parseSocialEmbed("https://youtu.be/dQw4w9WgXcQ").iframeSrc).toContain("/embed/dQw4w9WgXcQ");
    expect(parseSocialEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ").iframeSrc).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
  });

  it("embeds Instagram posts and reels, not profiles", () => {
    const post = parseSocialEmbed("https://www.instagram.com/p/AbC123xyz/");
    expect(post.kind).toBe("instagram");
    expect(post.iframeSrc).toBe("https://www.instagram.com/p/AbC123xyz/embed/");

    const reel = parseSocialEmbed("https://www.instagram.com/reel/ReelCode99/?igsh=x");
    expect(reel.iframeSrc).toBe("https://www.instagram.com/reel/ReelCode99/embed/");
    expect(reel.tall).toBe(true);

    const withHl = parseSocialEmbed("https://www.instagram.com/p/B6rIzRmp9VI/?hl=es");
    expect(withHl.iframeSrc).toBe("https://www.instagram.com/p/B6rIzRmp9VI/embed/");

    const profile = parseSocialEmbed("https://www.instagram.com/spakiralu_/");
    expect(profile.kind).toBe("instagram");
    expect(profile.iframeSrc).toBeNull();
    expect(profile.label).toBe("Ver en Instagram");
  });

  it("embeds TikTok videos, not profiles", () => {
    const video = parseSocialEmbed("https://www.tiktok.com/@spa.kira.luxury.pe/video/7123456789012345678");
    expect(video.kind).toBe("tiktok");
    expect(video.iframeSrc).toBe("https://www.tiktok.com/embed/v2/7123456789012345678");
    expect(video.tall).toBe(true);

    const profile = parseSocialEmbed("https://www.tiktok.com/@spa.kira.luxury.pe");
    expect(profile.iframeSrc).toBeNull();
    expect(profile.label).toBe("Ver en TikTok");
  });
});
