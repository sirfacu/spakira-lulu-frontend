/** Parsea URLs de YouTube / Instagram / TikTok para embeber o mostrar enlace. */

export type SocialKind = "youtube" | "instagram" | "tiktok" | "link";

export type ParsedSocialEmbed = {
  kind: SocialKind;
  /** src del iframe oficial; null si la plataforma no deja embeber (perfil, shortlink). */
  iframeSrc: string | null;
  permalink: string;
  label: string;
  /** true = formato vertical (reel / TikTok). */
  tall: boolean;
};

const IG_POST = /instagram\.com\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i;
const TT_VIDEO = /tiktok\.com\/@[^/]+\/video\/(\d+)/i;
const TT_EMBED = /tiktok\.com\/embed(?:\/v2)?\/(\d+)/i;

function cleanUrl(url: string): string {
  return (url || "").trim();
}

export function parseSocialEmbed(url: string): ParsedSocialEmbed {
  const raw = cleanUrl(url);
  const permalink = raw || "#";
  const lower = raw.toLowerCase();

  if (!raw) {
    return { kind: "link", iframeSrc: null, permalink, label: "Abrir enlace", tall: false };
  }

  if (lower.includes("youtube.com/watch") && raw.includes("v=")) {
    const vid = raw.split("v=")[1]?.split("&")[0] ?? "";
    return {
      kind: "youtube",
      iframeSrc: `https://www.youtube.com/embed/${vid}`,
      permalink: raw,
      label: "Ver en YouTube",
      tall: true,
    };
  }
  if (lower.includes("youtu.be/")) {
    const vid = raw.replace(/\/+$/, "").split("/").pop()?.split("?", 1)[0] ?? "";
    return {
      kind: "youtube",
      iframeSrc: `https://www.youtube.com/embed/${vid}`,
      permalink: raw,
      label: "Ver en YouTube",
      tall: true,
    };
  }
  if (lower.includes("youtube.com/shorts/")) {
    const vid = raw.split("/shorts/")[1]?.split("?")[0]?.split("/")[0] ?? "";
    return {
      kind: "youtube",
      iframeSrc: `https://www.youtube.com/embed/${vid}`,
      permalink: raw,
      label: "Ver en YouTube",
      tall: true,
    };
  }
  if (lower.includes("youtube.com/embed/") || lower.includes("youtube-nocookie.com/embed/")) {
    return {
      kind: "youtube",
      iframeSrc: raw.split("?", 1)[0],
      permalink: raw,
      label: "Ver en YouTube",
      tall: true,
    };
  }

  const ig = raw.match(IG_POST);
  if (ig) {
    const kind = ig[1].toLowerCase() === "reels" ? "reel" : ig[1].toLowerCase();
    const code = ig[2];
    return {
      kind: "instagram",
      iframeSrc: `https://www.instagram.com/${kind}/${code}/embed/`,
      permalink: `https://www.instagram.com/${kind}/${code}/`,
      label: "Ver en Instagram",
      tall: true,
    };
  }
  if (lower.includes("instagram.com/")) {
    return {
      kind: "instagram",
      iframeSrc: null,
      permalink,
      label: "Ver en Instagram",
      tall: false,
    };
  }

  const ttVid = raw.match(TT_VIDEO) || raw.match(TT_EMBED);
  if (ttVid) {
    const id = ttVid[1];
    return {
      kind: "tiktok",
      iframeSrc: `https://www.tiktok.com/embed/v2/${id}`,
      permalink: raw.includes("/video/") ? raw.split("?")[0] : `https://www.tiktok.com/embed/v2/${id}`,
      label: "Ver en TikTok",
      tall: true,
    };
  }
  if (lower.includes("tiktok.com")) {
    return {
      kind: "tiktok",
      iframeSrc: null,
      permalink,
      label: "Ver en TikTok",
      tall: false,
    };
  }

  return { kind: "link", iframeSrc: null, permalink, label: "Abrir enlace", tall: false };
}
