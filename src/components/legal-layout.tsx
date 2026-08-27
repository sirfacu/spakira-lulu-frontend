import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand";

export const PRIVACY_PDF = "/legal/politica-privacidad.pdf";
export const TERMS_PDF = "/legal/terminos-condiciones.pdf";

export function LegalLayout({
  title,
  pdfHref,
  children,
}: {
  title: string;
  pdfHref: string;
  children: ReactNode;
}) {
  return (
    <div className="spa-canvas min-h-screen bg-background">
      <header className="border-b border-border bg-card/70">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="inline-flex items-center gap-2">
            <BrandMark />
          </Link>
          <a
            href={pdfHref}
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Descargar PDF
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Spa Kira Luxury · Bogotá, Colombia
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vigente desde el 26 de agosto de 2026. Borrador operativo para OAuth y
          el sitio; no sustituye asesoría de un abogado.
        </p>
        <div className="prose prose-sm mt-8 max-w-none text-foreground prose-headings:font-display prose-a:text-primary">
          {children}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          <Link to="/" className="text-primary underline-offset-2 hover:underline">
            Volver al inicio
          </Link>
        </p>
      </main>
    </div>
  );
}
