/** Crédito discreto de la empresa que construye Spa Kira. */
export const EMAC_URL = "https://e-mac.co";

export function EmacCredit({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] tracking-wide text-muted-foreground ${className}`.trim()}>
      Desarrollado por{" "}
      <a
        href={EMAC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground/80 underline-offset-2 hover:text-primary hover:underline"
      >
        e-mac
      </a>
    </p>
  );
}
