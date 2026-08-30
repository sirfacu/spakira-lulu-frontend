import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "primary" | "accent" | "gold" | "mint" | "sky";
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/12 text-accent",
    gold: "bg-gold/20 text-gold-foreground",
    mint: "bg-mint/20 text-mint-foreground",
    sky: "bg-sky/20 text-sky-foreground",
  };
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 font-display text-2xl font-bold text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", tones[tone])}>
        <Icon className="h-5 w-5" />
      </span>
    </div>
  );
  const shell = "card-soft p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${shell} w-full text-left`}>
        {body}
      </button>
    );
  }
  return <div className={shell}>{body}</div>;
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card-soft p-5 sm:p-6", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="truncate font-display text-lg font-bold text-primary">{title}</h2>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function StatusPill({
  label,
  className,
  hint,
}: {
  label: string;
  className: string;
  hint?: string;
}) {
  return (
    <span
      title={hint}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
        hint ? "cursor-help" : "",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
