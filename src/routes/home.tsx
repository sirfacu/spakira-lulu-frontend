import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bath, Scissors, Sparkles, Heart, Smile, Clock, Instagram, Facebook } from "lucide-react";
import { BrandMark, PawIcon, LOGO_SRC } from "@/components/brand";
import { ServiceDetailDialog } from "@/components/service-detail-dialog";
import { ChipRail } from "@/components/home-chip-rail";
import { SocialEmbed } from "@/components/social-embed";
import {
  DEFAULT_PRIVACY_PATH,
  DEFAULT_TERMS_PATH,
  resolveLegalHref,
  usePublicBusiness,
} from "@/components/legal-layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getPublicHomeContent,
  servicesQuery,
  type HomeNewsItem,
  type Service,
} from "@/lib/spa-queries";
import { servicePriceHeadline, servicePriceNote } from "@/lib/service-pricing";
import { fetchMe, logout, mayHaveSession } from "@/lib/api";
import { sanitizePreviewHtml } from "@/lib/sanitize-html";
import { homeForRole, permissionsFor } from "@/lib/roles";
import { normalizeSectionOrder } from "@/lib/home-sections";

const INSTAGRAM_URL = "https://www.instagram.com/spakiralu_";
const FACEBOOK_URL = "https://www.facebook.com/spakiralulu";
const TIKTOK_URL = "https://www.tiktok.com/@spa.kira.luxury.pe";

export const Route = createFileRoute("/home")({
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
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(servicesQuery);
    } catch {
      /* landing sin catálogo */
    }
  },
  component: Landing,
});

const PERKS = [
  { icon: Bath, label: "Baño" },
  { icon: Scissors, label: "Corte" },
  { icon: Sparkles, label: "Uñas" },
  { icon: Smile, label: "Limpieza de dientes" },
  { icon: Heart, label: "Mucho amor" },
];

function Landing() {
  const servicesQ = useQuery({
    ...servicesQuery,
    retry: false,
  });
  const services = servicesQ.data ?? [];
  const loggedIn = typeof window !== "undefined" && mayHaveSession();
  const me = useQuery({
    queryKey: ["auth-me"],
    queryFn: fetchMe,
    enabled: loggedIn,
    retry: false,
  });
  const homeContent = useQuery({
    queryKey: ["home-content-public"],
    queryFn: getPublicHomeContent,
    retry: false,
  });
  const publicServices = services.filter((s) => {
    if (!s.is_public) return false;
    if (!s.publish_at) return true;
    return new Date(s.publish_at).getTime() <= Date.now();
  });
  const perms = permissionsFor(me.data?.role);
  const staff = perms.isStaff;
  const panelTo = homeForRole(me.data?.role);
  const { data: bizLegal } = usePublicBusiness();
  const privacyHref = resolveLegalHref(bizLegal?.privacy_url, DEFAULT_PRIVACY_PATH);
  const termsHref = resolveLegalHref(bizLegal?.terms_url, DEFAULT_TERMS_PATH);
  const privacyPdf = bizLegal?.privacy_pdf_url?.trim();
  const termsPdf = bizLegal?.terms_pdf_url?.trim();
  const news = homeContent.data?.news ?? [];
  const videos = homeContent.data?.client_videos ?? [];
  const sectionOrder = normalizeSectionOrder(homeContent.data?.section_order);
  const [preview, setPreview] = useState<HomeNewsItem | null>(null);
  const [detailService, setDetailService] = useState<Service | null>(null);

  const authCta = staff ? (
    <Button asChild size="sm" className="rounded-xl shadow-glow">
      <Link to={panelTo}>Ir al panel</Link>
    </Button>
  ) : me.data ? (
    <Button asChild size="sm" className="rounded-xl shadow-glow">
      <Link to={panelTo}>Mis mascotas</Link>
    </Button>
  ) : (
    <Button asChild size="sm" className="rounded-xl shadow-glow">
      <Link to="/auth">Ingresa aquí</Link>
    </Button>
  );

  return (
    <div className="spa-canvas min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/home" className="min-w-0">
            <BrandMark
              compact
              tagline={false}
              tradeName={bizLegal?.trade_name}
              slogan={bizLegal?.slogan}
            />
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {me.data ? (
              <>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  {me.data.email}
                  {staff ? " · personal" : " · usuario"}
                </p>
                {authCta}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    logout();
                    window.location.assign("/home");
                  }}
                >
                  Salir
                </Button>
              </>
            ) : (
              authCta
            )}
          </div>
        </div>
      </header>

      {sectionOrder.map((id) => (
        <Fragment key={id}>
          {id === "hero" ? (
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-12 pt-10 lg:grid-cols-[1.05fr_1fr]">
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
          {me.data && !staff ? (
            <p className="mt-4 max-w-lg text-sm text-muted-foreground">
              Entraste como <strong>Usuario</strong>. En el panel ves{" "}
              <strong>Mis mascotas</strong> y <strong>Mi agenda</strong>.
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
          ) : null}

          {id === "news" && news.length > 0 ? (
        <section className="border-y border-border/60 bg-card/40 py-10">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mb-6 text-center">
              <span className="font-script text-3xl text-accent">Novedades</span>
              <h2 className="font-display text-2xl font-bold text-primary sm:text-3xl">
                Ideas y noticias
              </h2>
              <div className="gold-rule mx-auto mt-3 max-w-xs" />
            </div>
            <ChipRail stepPx={320}>
              {news.map((item) => (
                <article
                  key={item.id}
                  className="card-soft flex w-[280px] shrink-0 flex-col overflow-hidden sm:w-[320px]"
                >
                  {item.kind === "image" && item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="h-40 w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="font-display text-lg font-bold text-primary">{item.title}</h3>
                    {item.kind === "html" && item.html ? (
                      <div
                        className="prose prose-sm line-clamp-4 max-w-none text-muted-foreground prose-p:my-1"
                        dangerouslySetInnerHTML={{ __html: sanitizePreviewHtml(item.html) }}
                      />
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-auto h-10 w-full rounded-xl"
                      onClick={() => setPreview(item)}
                    >
                      Ver nota
                    </Button>
                  </div>
                </article>
              ))}
            </ChipRail>
          </div>
        </section>
          ) : null}

          {id === "services" ? (
      <section id="precios" className="mx-auto max-w-6xl px-5 py-16">
        <div className="text-center">
          <span className="font-script text-3xl text-accent">Nuestros</span>
          <h2 className="font-display text-3xl font-bold text-primary sm:text-4xl">
            Servicios y precios
          </h2>
          <div className="gold-rule mx-auto mt-4 max-w-xs" />
        </div>

        {publicServices.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Los rituales y precios se publican en esta misma página.
          </p>
        ) : (
          <div className="mt-10">
            <ChipRail stepPx={280}>
              {publicServices.map((s) => (
                <article
                  key={s.id}
                  className="card-soft group flex w-[260px] shrink-0 flex-col overflow-hidden sm:w-[280px]"
                >
                  <div className="relative h-36 overflow-hidden bg-secondary">
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
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="font-display text-lg font-bold text-primary">{s.name}</h3>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {s.description}
                    </p>
                    <p className="mt-3 font-display text-xl font-bold text-accent">
                      {servicePriceHeadline(s)}
                    </p>
                    {servicePriceNote(s) ? (
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {servicePriceNote(s)}
                      </p>
                    ) : null}
                    <div className="mt-3 grid gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-full rounded-xl"
                        onClick={() => setDetailService(s)}
                      >
                        Leer más
                      </Button>
                      {me.data && !staff ? (
                        <Button asChild className="h-10 w-full rounded-xl">
                          <Link
                            to="/panel/agenda"
                            search={{ service: s.id, google: undefined }}
                          >
                            Agendar
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild className="h-10 w-full rounded-xl">
                          <Link to="/auth">Agendar</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </ChipRail>
          </div>
        )}
      </section>
          ) : null}

          {id === "videos" && videos.length > 0 ? (
        <section className="border-t border-border/60 bg-card/35 py-16">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mb-8 text-center">
              <span className="font-script text-3xl text-accent">Testimonios</span>
              <h2 className="font-display text-3xl font-bold text-primary sm:text-4xl">
                Nuestros clientes dicen
              </h2>
              <div className="gold-rule mx-auto mt-4 max-w-xs" />
            </div>
            <ChipRail stepPx={286}>
              {videos.map((v) => (
                <figure
                  key={v.id}
                  className="card-soft w-[260px] shrink-0 overflow-hidden sm:w-[270px]"
                >
                  <figcaption className="px-4 py-3 text-sm font-medium text-primary">
                    {v.title}
                  </figcaption>
                  <SocialEmbed url={v.embed_url} title={v.title} />
                </figure>
              ))}
            </ChipRail>
          </div>
        </section>
          ) : null}
        </Fragment>
      ))}

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary">
              {preview?.title}
            </DialogTitle>
          </DialogHeader>
          {preview?.kind === "image" && preview.image_url ? (
            <img
              src={preview.image_url}
              alt={preview.title}
              className="mt-2 max-h-[50vh] w-full rounded-xl object-contain"
            />
          ) : null}
          {preview?.kind === "html" && preview.html ? (
            <div
              className="prose prose-sm mt-2 max-w-none text-foreground prose-headings:font-display"
              dangerouslySetInnerHTML={{ __html: sanitizePreviewHtml(preview.html) }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ServiceDetailDialog
        service={detailService}
        open={!!detailService}
        onOpenChange={(open) => {
          if (!open) setDetailService(null);
        }}
        showAgendar={
          !!detailService && (perms.isCliente || perms.isColaborador)
        }
      />

      <footer className="border-t border-border bg-card/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-10 text-center">
          <BrandMark tradeName={bizLegal?.trade_name} slogan={bizLegal?.slogan} />
          <p className="text-sm text-muted-foreground">
            Luxury pet grooming · Canina y felina
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-accent"
            >
              <Instagram className="h-4 w-4" aria-hidden="true" />
              Instagram
            </a>
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-accent"
            >
              <Facebook className="h-4 w-4" aria-hidden="true" />
              Facebook
            </a>
            <a
              href={TIKTOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-accent"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M14.5 3c.4 2.5 1.9 4.4 4.3 4.8v3.1c-1.5 0-2.9-.5-4.1-1.3v6.6c0 3.4-2.8 6.2-6.3 6.2S2.1 19.6 2.1 16.1c0-3.4 2.8-6.2 6.3-6.2.4 0 .8 0 1.2.1v3.3c-.4-.1-.8-.2-1.2-.2-1.6 0-2.9 1.3-2.9 3s1.3 3 2.9 3 2.9-1.3 2.9-3V3h3.2Z" />
              </svg>
              TikTok
            </a>
          </div>
          <p className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <a href={privacyHref} className="hover:text-primary hover:underline">
              Privacidad
            </a>
            <a href={termsHref} className="hover:text-primary hover:underline">
              Términos
            </a>
            {privacyPdf ? (
              <a href={privacyPdf} className="hover:text-primary hover:underline">
                Privacidad (PDF)
              </a>
            ) : null}
            {termsPdf ? (
              <a href={termsPdf} className="hover:text-primary hover:underline">
                Términos (PDF)
              </a>
            ) : null}
          </p>
        </div>
      </footer>
    </div>
  );
}
