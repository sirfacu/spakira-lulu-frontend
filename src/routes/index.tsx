import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Bath, Scissors, Sparkles, Heart, Clock, Instagram } from "lucide-react";
import { BrandMark, PawIcon, LOGO_SRC } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { servicesQuery } from "@/lib/spa-queries";
import { cop } from "@/lib/format";
import { fetchMe, getToken, logout } from "@/lib/api";
import { homeForRole, permissionsFor } from "@/lib/roles";

const INSTAGRAM_URL = "https://www.instagram.com/spakiralu_";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Spa Kira | Grooming canino y felino de lujo" },
      {
        name: "description",
        content:
          "Baño, corte, deslanado y spa completo para perros y gatos en Bogotá. Consulta precios y agenda con Spa Kira.",
      },
      { property: "og:title", content: "Spa Kira | Grooming canino y felino de lujo" },
      {
        property: "og:description",
        content: "Baño, corte, deslanado y spa completo para perros y gatos. Precios y agenda.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(servicesQuery),
  errorComponent: ({ error }) => (
    <div role="alert" className="p-10 text-center text-muted-foreground">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Sin servicios publicados.</div>,
  component: Landing,
});

const PERKS = [
  { icon: Bath, label: "Baño" },
  { icon: Scissors, label: "Corte" },
  { icon: Sparkles, label: "Uñas" },
  { icon: Heart, label: "Mucho amor" },
];

function Landing() {
  const { data: services } = useSuspenseQuery(servicesQuery);
  const loggedIn = typeof window !== "undefined" && !!getToken();
  const me = useQuery({
    queryKey: ["auth-me"],
    queryFn: fetchMe,
    enabled: loggedIn,
    retry: false,
  });
  const publicServices = services.filter((s) => {
    if (!s.is_public) return false;
    if (!s.publish_at) return true;
    return new Date(s.publish_at).getTime() <= Date.now();
  });
  const staff = permissionsFor(me.data?.role).isStaff;
  const panelTo = homeForRole(me.data?.role);

  return (
    <div className="spa-canvas min-h-screen bg-background">
      {me.data ? (
        <div className="border-b border-border bg-card/80 px-5 py-3 text-sm">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground">
              Sesión: <span className="font-medium text-foreground">{me.data.email}</span>
              {staff ? " · personal" : " · usuario (Mis mascotas y Mi agenda)"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" className="rounded-xl">
                <Link to={panelTo}>Ir al panel</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  logout();
                  window.location.assign("/auth");
                }}
              >
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-blush px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-blush-foreground">
            <PawIcon className="h-3.5 w-3.5" /> Canina y felina
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.08] text-primary sm:text-6xl">
            El spa donde tu mascota{" "}
            <span className="font-script text-accent">se siente amada</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            Grooming de lujo con productos hipoalergénicos, estilistas certificados y un trato
            paciente. Cada visita termina con moño, perfume y una foto de antes y después.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {staff ? (
              <Button asChild size="lg" className="h-13 rounded-xl px-7 text-base shadow-glow">
                <Link to={panelTo}>Ir al panel</Link>
              </Button>
            ) : me.data ? (
              <Button asChild size="lg" className="h-13 rounded-xl px-7 text-base shadow-glow">
                <Link to={panelTo}>Mis mascotas</Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="h-13 rounded-xl px-7 text-base shadow-glow">
                <Link to="/auth">Ingresa aquí</Link>
              </Button>
            )}
          </div>
          {me.data && !staff ? (
            <p className="mt-4 max-w-lg text-sm text-muted-foreground">
              Entraste como <strong>Usuario</strong>. En el panel ves{" "}
              <strong>Mis mascotas</strong> y <strong>Mi agenda</strong> para registrar a tu
              peludo y pedir turno.
            </p>
          ) : null}

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            {PERKS.map((p) => (
              <div key={p.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-primary">
                  <p.icon className="h-4 w-4" />
                </span>
                {p.label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-[28px] border border-border bg-card shadow-lift">
            <img
              src={LOGO_SRC}
              alt="Logo de Spa Kira, grooming canino y felino de lujo"
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      <section id="precios" className="mx-auto max-w-6xl px-5 pb-24">
        <div className="text-center">
          <span className="font-script text-3xl text-accent">Nuestros</span>
          <h2 className="font-display text-3xl font-bold text-primary sm:text-4xl">
            Servicios y precios
          </h2>
          <div className="gold-rule mx-auto mt-4 max-w-xs" />
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {publicServices.map((s) => (
            <article
              key={s.id}
              className="card-soft group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift"
            >
              <div className="relative h-40 overflow-hidden bg-secondary">
                {s.image_url ? (
                  <img
                    src={s.image_url}
                    alt={`Servicio ${s.name} en Spa Kira`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : null}
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-medium text-primary backdrop-blur">
                  <Clock className="h-3 w-3" /> {s.duration_min} min
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-lg font-bold text-primary">{s.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {s.description}
                </p>
                <p className="mt-4 font-display text-2xl font-bold text-accent">{cop(s.price)}</p>
                <Button asChild className="mt-4 h-11 w-full rounded-xl">
                  <Link to="/auth">Agendar</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-card/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-10 text-center">
          <BrandMark />
          <p className="text-sm text-muted-foreground">
            Luxury pet grooming · Canina y felina · Bogotá
          </p>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-accent"
          >
            <Instagram className="h-4 w-4" aria-hidden="true" />
            Síguenos en Instagram @spakiralu_
          </a>
        </div>
      </footer>
    </div>
  );
}
