import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrandMark, LOGO_SRC, PawIcon } from "@/components/brand";
import {
  getPublicBusinessSettings,
  type PublicBusinessSettings,
} from "@/lib/spa-queries";

export const DEFAULT_PRIVACY_PATH = "/privacidad";
export const DEFAULT_TERMS_PATH = "/terminos";
export const PRIVACY_PDF = "/legal/politica-privacidad.pdf";
export const TERMS_PDF = "/legal/terminos-condiciones.pdf";

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function formatLegalDate(iso?: string | null): string {
  if (!iso) return "26 de agosto de 2026";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso;
  const day = Number(m[3]);
  const month = Number(m[2]) - 1;
  const year = m[1];
  return `${day} de ${MONTHS_ES[month] ?? m[2]} de ${year}`;
}

/** Href absoluto o relativo para footer / Google; rutas internas → path. */
export function resolveLegalHref(url: string | null | undefined, fallbackPath: string): string {
  const raw = (url || "").trim();
  if (!raw) return fallbackPath;
  try {
    if (raw.startsWith("/")) return raw;
    const u = new URL(raw);
    if (typeof window !== "undefined" && u.origin === window.location.origin) {
      return u.pathname || fallbackPath;
    }
    return raw;
  } catch {
    return fallbackPath;
  }
}

export function usePublicBusiness() {
  return useQuery({
    queryKey: ["business-settings-public"],
    queryFn: getPublicBusinessSettings,
    staleTime: 60_000,
  });
}

function SidePaws({ side }: { side: "left" | "right" }) {
  const rotate = side === "left" ? "-rotate-12" : "rotate-12";
  return (
    <div
      className={`pointer-events-none absolute top-24 hidden w-14 select-none text-primary/25 lg:block ${
        side === "left" ? "left-3 xl:left-8" : "right-3 xl:right-8"
      }`}
      aria-hidden
    >
      <div className="flex flex-col gap-10">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <PawIcon
            key={i}
            className={`h-9 w-9 opacity-70 ${rotate} ${i % 2 === 0 ? "translate-x-1" : "-translate-x-1"}`}
          />
        ))}
      </div>
    </div>
  );
}

export function LegalLayout({
  title,
  pdfHref,
  children,
  biz,
}: {
  title: string;
  pdfHref?: string | null;
  children: ReactNode;
  biz?: PublicBusinessSettings | null | undefined;
}) {
  const trade = biz?.trade_name?.trim() || "Spa Kira";
  const place = biz?.address?.trim() || "Bogotá, Colombia";
  const logo = biz?.logo_url?.trim() || LOGO_SRC;
  const since = formatLegalDate(biz?.legal_effective_from);
  const showPdf = !!(pdfHref && pdfHref.trim());

  return (
    <div className="spa-canvas relative min-h-screen overflow-hidden bg-background">
      <SidePaws side="left" />
      <SidePaws side="right" />

      <header className="relative z-10 border-b border-border/60 bg-card/55 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="inline-flex items-center gap-2">
            <BrandMark tradeName={trade} slogan={biz?.slogan} />
          </Link>
          {showPdf ? (
            <a
              href={pdfHref!}
              className="text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              Descargar PDF
            </a>
          ) : null}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-5 py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={logo}
            alt={trade}
            className="h-auto w-full max-w-[220px] object-contain drop-shadow-sm sm:max-w-[260px]"
          />
          <div className="gold-rule mt-5 w-40" />
        </div>

        <article className="card-soft paw-pattern relative overflow-hidden px-6 py-8 sm:px-10 sm:py-10">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {trade} · {place}
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Vigente desde el {since}. Documento operativo del sitio y de OAuth; no
            sustituye asesoría de un abogado.
          </p>
          <div className="prose prose-sm mt-8 max-w-none text-foreground prose-headings:font-display prose-a:text-primary">
            {children}
          </div>
        </article>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          <Link to="/" className="text-primary underline-offset-2 hover:underline">
            Volver al inicio
          </Link>
        </p>
      </main>
    </div>
  );
}
