import { cn } from "@/lib/utils";

/** Logo completo (landing / materiales). */
export const LOGO_SRC = "/images/spa-kira-logo-1mb.png";
/** Marca compacta para sidebar / favicon (cara de Kira). */
export const MARK_SRC = "/images/kira-face.png";

export function PawIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-5 w-5", className)} aria-hidden="true">
      <g fill="currentColor">
        <ellipse cx="17" cy="24" rx="7" ry="9" />
        <ellipse cx="31" cy="17" rx="7" ry="9.5" />
        <ellipse cx="45" cy="21" rx="6.5" ry="9" />
        <ellipse cx="55" cy="34" rx="6" ry="7.5" />
        <path d="M32 32c8 0 16 7 16 15 0 6-5 10-11 8l-5-1.6-5 1.6c-6 2-11-2-11-8 0-8 8-15 16-15z" />
      </g>
    </svg>
  );
}

/** Primera palabra en script, resto en display (ej. Spa + KIRA). */
export function splitTradeName(tradeName?: string | null): { script: string; display: string } {
  const name = (tradeName || "Spa Kira").trim() || "Spa Kira";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { script: "", display: parts[0]! };
  return { script: parts[0]!, display: parts.slice(1).join(" ") };
}

export function BrandMark({
  className,
  tagline = true,
  compact = false,
  size = "default",
  tradeName,
  slogan,
}: {
  className?: string;
  tagline?: boolean;
  /** Sidebar: cara grande + nombre. */
  compact?: boolean;
  /** `auth` = logo grande y centrado (login). */
  size?: "default" | "auth";
  tradeName?: string | null;
  slogan?: string | null;
}) {
  const { script, display } = splitTradeName(tradeName);
  const tag = (slogan || "Luxury pet grooming").trim();
  const alt = tradeName?.trim() || "Spa Kira";

  if (compact) {
    return (
      <div className={cn("flex min-w-0 items-center gap-3", className)}>
        <img
          src={MARK_SRC}
          alt={alt}
          className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-soft ring-2 ring-primary/15"
        />
        <span className="min-w-0 leading-none">
          {script ? <span className="block font-script text-lg text-accent">{script}</span> : null}
          <span className="block font-display text-xl font-bold tracking-wide text-primary uppercase">
            {display}
          </span>
          {tagline ? (
            <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {tag}
            </span>
          ) : null}
        </span>
      </div>
    );
  }

  if (size === "auth") {
    return (
      <div className={cn("flex w-full flex-col items-center justify-center", className)}>
        <img
          src={LOGO_SRC}
          alt={`${alt} — ${tag}`}
          className="h-auto w-full max-w-[280px] object-contain sm:max-w-[320px]"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center", className)}>
      <img
        src={LOGO_SRC}
        alt={`${alt} — ${tag}`}
        className="h-14 w-auto max-w-[240px] object-contain object-left lg:h-16 lg:max-w-[280px]"
      />
    </div>
  );
}
