import { ExternalLink, Instagram } from "lucide-react";
import { parseSocialEmbed, type SocialKind } from "@/lib/social-embed";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.5 3h2.1c.2 1.7 1.2 3.2 2.7 4.1 1 .6 2.1.9 3.2 1v2.4c-1.6 0-3.1-.5-4.4-1.3v7.5c0 3.9-3.2 7.1-7.1 7.1S4 20.6 4 16.7 7.1 9.6 11 9.6c.4 0 .8 0 1.2.1v2.5c-.4-.1-.8-.2-1.2-.2-2.5 0-4.5 2-4.5 4.6s2 4.6 4.5 4.6 4.5-2 4.5-4.6V3z"
      />
    </svg>
  );
}

function withPlayerParams(src: string, kind: SocialKind): string {
  if (kind !== "youtube") return src;
  try {
    const u = new URL(src);
    u.searchParams.set("rel", "0");
    u.searchParams.set("modestbranding", "1");
    u.searchParams.set("playsinline", "1");
    return u.toString();
  } catch {
    return src;
  }
}

/** Marco vertical único (9:16) para YouTube, Instagram y TikTok. */
export function SocialEmbed({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const parsed = parseSocialEmbed(url);

  if (parsed.iframeSrc) {
    return (
      <div className="relative h-[480px] w-full overflow-hidden bg-neutral-950">
        <iframe
          title={title}
          src={withPlayerParams(parsed.iframeSrc, parsed.kind)}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  const Icon =
    parsed.kind === "instagram" ? Instagram : parsed.kind === "tiktok" ? TikTokIcon : ExternalLink;

  return (
    <a
      href={parsed.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-[480px] w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/12 via-secondary to-accent/15 px-6 text-center transition-colors hover:from-primary/20 hover:to-accent/25"
    >
      <Icon className="h-10 w-10 text-primary" />
      <span className="text-sm font-semibold text-primary">{parsed.label}</span>
      <span className="max-w-[220px] truncate text-xs text-muted-foreground">{parsed.permalink}</span>
    </a>
  );
}
