import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, GripVertical } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { sanitizePreviewHtml } from "@/lib/sanitize-html";
import { parseSocialEmbed } from "@/lib/social-embed";
import { uploadBrandingPhoto, resolveMediaUrl } from "@/lib/api";
import {
  HOME_SECTION_LABELS,
  normalizeSectionOrder,
  type HomeSectionId,
} from "@/lib/home-sections";
import {
  DEFAULT_HOME_HERO,
  HERO_ACCENT_MAX,
  HERO_BODY_MAX,
  HERO_KICKER_MAX,
  HERO_TITLE_MAX,
  normalizeHomeHero,
  type HomeHero,
} from "@/lib/home-hero";
import { cn } from "@/lib/utils";
import { IdentityStyledField } from "@/components/identity-style-bar";
import { SectionCard } from "@/components/ui-kit";
import { ReorderList } from "@/components/reorder-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getHomeContent,
  putHomeContent,
  type HomeNewsItem,
  type HomeVideoItem,
} from "@/lib/spa-queries";

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ConfigHomePanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["home-content"], queryFn: getHomeContent });
  const [news, setNews] = useState<HomeNewsItem[]>([]);
  const [videos, setVideos] = useState<HomeVideoItem[]>([]);
  const [hero, setHero] = useState<HomeHero>(DEFAULT_HOME_HERO);
  const [heroBusy, setHeroBusy] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<HomeSectionId[]>(() =>
    normalizeSectionOrder(null),
  );
  const [openSection, setOpenSection] = useState<HomeSectionId | null>(null);
  /** Solo el id: el ítem se resuelve desde `news` en vivo (evita preview stale). */
  const [previewId, setPreviewId] = useState<string | null>(null);
  const preview = useMemo(
    () => (previewId ? news.find((n) => n.id === previewId) ?? null : null),
    [news, previewId],
  );
  const hydrated = useRef(false);

  useEffect(() => {
    if (!q.data) return;
    // No pisar ediciones locales en cada refetch (p.ej. al reordenar secciones).
    if (hydrated.current) return;
    setNews(q.data.news ?? []);
    setVideos(q.data.client_videos ?? []);
    setHero(normalizeHomeHero(q.data.hero));
    setSectionOrder(normalizeSectionOrder(q.data.section_order));
    hydrated.current = true;
  }, [q.data]);

  const sectionRows = useMemo(
    () => sectionOrder.map((id) => ({ id, label: HOME_SECTION_LABELS[id] })),
    [sectionOrder],
  );

  const applyHomePayload = (data: {
    news?: HomeNewsItem[];
    client_videos?: HomeVideoItem[];
    section_order?: string[] | null;
    hero?: HomeHero | null;
  }) => {
    if (data.news) setNews(data.news);
    if (data.client_videos) setVideos(data.client_videos);
    if (data.section_order) setSectionOrder(normalizeSectionOrder(data.section_order));
    if (data.hero) setHero(normalizeHomeHero(data.hero));
  };

  const saveMut = useMutation({
    mutationFn: () =>
      putHomeContent({
        news: news.map((n, i) => ({ ...n, sort: i })),
        client_videos: videos.map((v, i) => ({ ...v, sort: i })),
        section_order: sectionOrder,
        hero,
      }),
    onSuccess: async (data) => {
      toast.success("Inicio actualizado");
      applyHomePayload(data);
      await qc.invalidateQueries({ queryKey: ["home-content"] });
      await qc.invalidateQueries({ queryKey: ["home-content-public"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6">
      <SectionCard title="Secciones del inicio">
        <p className="mb-4 text-sm text-muted-foreground">
          Arrastrá el ícono para cambiar el orden (se guarda al soltar). Clic en el nombre para
          editar esa sección. El menú de arriba y el pie quedan fijos.
        </p>
        <ReorderList
          items={sectionRows}
          className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border/70"
          onReorder={(next) => {
            const ids = next.map((row) => row.id);
            setSectionOrder(ids);
            putHomeContent({ section_order: ids })
              .then(async (data) => {
                toast.success("Orden del inicio actualizado");
                applyHomePayload(data);
                await qc.invalidateQueries({ queryKey: ["home-content-public"] });
              })
              .catch((e: Error) => toast.error(e.message));
          }}
          renderItem={(item, { isDragging, dragHandleProps }) => {
            const open = openSection === item.id;
            return (
              <div className={cn(isDragging && "opacity-60")}>
                <div className="flex items-center gap-1 px-2 py-2">
                  <div
                    {...dragHandleProps}
                    className="grid h-9 w-9 shrink-0 cursor-grab place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary active:cursor-grabbing"
                    aria-label={`Reordenar ${item.label}`}
                    title="Arrastrar para reordenar"
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenSection(open ? null : item.id)}
                    className="flex min-w-0 flex-1 items-center justify-between rounded-xl px-2 py-2 text-left hover:bg-secondary/60"
                  >
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  </button>
                </div>
                {open ? (
                  <div className="border-t border-border/70 px-4 pb-4 pt-3">
                    {item.id === "hero" ? (
                      <HomeHeroEditor
                        hero={hero}
                        busy={heroBusy}
                        onChange={setHero}
                        onBusy={setHeroBusy}
                      />
                    ) : null}
                    {item.id === "news" ? (
                      <HomeNewsEditor
                        news={news}
                        onChange={setNews}
                        onPreview={setPreviewId}
                      />
                    ) : null}
                    {item.id === "videos" ? (
                      <HomeVideosEditor videos={videos} onChange={setVideos} />
                    ) : null}
                    {item.id === "services" ? (
                      <p className="text-sm text-muted-foreground">
                        Los rituales salen del catálogo público. Se editan en{" "}
                        <Link to="/panel/precios" className="font-medium text-primary underline-offset-2 hover:underline">
                          Servicios
                        </Link>
                        , no acá.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          }}
        />
      </SectionCard>

      <Button
        className="rounded-xl"
        disabled={saveMut.isPending}
        onClick={() => saveMut.mutate()}
      >
        Guardar contenido del inicio
      </Button>

      <Dialog open={!!previewId} onOpenChange={(open) => !open && setPreviewId(null)}>
        <DialogContent
          key={previewId ?? "closed"}
          className="max-h-[85vh] max-w-lg overflow-y-auto rounded-2xl"
        >
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary">
              {preview?.title || "Nota"}
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
              className="prose prose-sm mt-2 max-w-none whitespace-pre-wrap text-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizePreviewHtml(preview.html) }}
            />
          ) : preview?.kind === "html" ? (
            <p className="mt-2 text-sm text-muted-foreground">Sin contenido HTML aún.</p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HomeHeroEditor({
  hero,
  busy,
  onChange,
  onBusy,
}: {
  hero: HomeHero;
  busy: boolean;
  onChange: (next: HomeHero | ((prev: HomeHero) => HomeHero)) => void;
  onBusy: (v: boolean) => void;
}) {
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Textos e imagen del bloque de entrada. Los íconos de Baño/Corte/Uñas quedan fijos.
      </p>
      <IdentityStyledField
        label="Etiqueta"
        hint="Barra sobre el título. "
        value={hero.kicker}
        maxLength={HERO_KICKER_MAX}
        onChange={(value) => onChange((h) => ({ ...h, kicker: value }))}
        style={hero.styles.kicker}
        onStyleChange={(style) =>
          onChange((h) => ({ ...h, styles: { ...h.styles, kicker: style } }))
        }
        disabled={busy}
      />
      <IdentityStyledField
        label="Título"
        hint="Primera parte. "
        value={hero.title}
        maxLength={HERO_TITLE_MAX}
        onChange={(value) => onChange((h) => ({ ...h, title: value }))}
        style={hero.styles.title}
        onStyleChange={(style) =>
          onChange((h) => ({ ...h, styles: { ...h.styles, title: style } }))
        }
        disabled={busy}
      />
      <IdentityStyledField
        label="Acento del título"
        hint="Segunda parte. Podés dejarlo vacío. "
        value={hero.title_accent}
        maxLength={HERO_ACCENT_MAX}
        onChange={(value) => onChange((h) => ({ ...h, title_accent: value }))}
        style={hero.styles.title_accent}
        onStyleChange={(style) =>
          onChange((h) => ({ ...h, styles: { ...h.styles, title_accent: style } }))
        }
        disabled={busy}
      />
      <IdentityStyledField
        label="Párrafo"
        hint="Texto bajo el título. "
        value={hero.body}
        maxLength={HERO_BODY_MAX}
        multiline
        onChange={(value) => onChange((h) => ({ ...h, body: value }))}
        style={hero.styles.body}
        onStyleChange={(style) =>
          onChange((h) => ({ ...h, styles: { ...h.styles, body: style } }))
        }
        disabled={busy}
      />
      <div className="space-y-2">
        <Label>Imagen</Label>
        <div className="flex flex-wrap items-center gap-3">
          <img
            src={resolveMediaUrl(hero.image_url) || "/images/spa-kira-logo-1mb.png"}
            alt="Portada"
            className="h-20 w-28 rounded-xl object-cover ring-1 ring-border"
          />
          <label className="inline-flex cursor-pointer items-center rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary">
            {busy ? "Subiendo…" : "Cambiar imagen"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                onBusy(true);
                try {
                  const up = await uploadBrandingPhoto(file);
                  onChange((h) => ({ ...h, image_url: up.url }));
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen");
                } finally {
                  onBusy(false);
                }
              }}
            />
          </label>
          {hero.image_url ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onChange((h) => ({ ...h, image_url: null }))}
            >
              Usar logo KIRA
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HomeNewsEditor({
  news,
  onChange,
  onPreview,
}: {
  news: HomeNewsItem[];
  onChange: (next: HomeNewsItem[] | ((prev: HomeNewsItem[]) => HomeNewsItem[])) => void;
  onPreview: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cada ítem puede ser texto HTML o una imagen. En el home desfilan de izquierda a derecha.
      </p>
      {news.map((item, idx) => (
        <div key={item.id} className="rounded-2xl border border-border bg-secondary/30 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Nota #{idx + 1}</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Activa
                <Switch
                  checked={item.active !== false}
                  onCheckedChange={(v) =>
                    onChange((rows) => rows.map((r) => (r.id === item.id ? { ...r, active: v } : r)))
                  }
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => onPreview(item.id)}
              >
                Preview
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => onChange((rows) => rows.filter((r) => r.id !== item.id))}
              >
                Quitar
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                className="h-10 rounded-xl"
                value={item.title}
                onChange={(e) =>
                  onChange((rows) =>
                    rows.map((r) => (r.id === item.id ? { ...r, title: e.target.value } : r)),
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={item.kind}
                onChange={(e) =>
                  onChange((rows) =>
                    rows.map((r) =>
                      r.id === item.id ? { ...r, kind: e.target.value as "html" | "image" } : r,
                    ),
                  )
                }
              >
                <option value="html">Texto HTML</option>
                <option value="image">Imagen</option>
              </select>
            </div>
          </div>
          {item.kind === "image" ? (
            <div className="mt-3 space-y-2">
              <Label>URL de imagen</Label>
              <Input
                className="h-10 rounded-xl"
                value={item.image_url ?? ""}
                onChange={(e) =>
                  onChange((rows) =>
                    rows.map((r) => (r.id === item.id ? { ...r, image_url: e.target.value } : r)),
                  )
                }
                placeholder="/images/... o https://..."
              />
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <Label>HTML corto</Label>
              <Textarea
                className="min-h-24 rounded-xl"
                value={item.html ?? ""}
                onChange={(e) =>
                  onChange((rows) =>
                    rows.map((r) => (r.id === item.id ? { ...r, html: e.target.value } : r)),
                  )
                }
                placeholder="<p>Inauguración este sábado…</p>"
              />
            </div>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="rounded-xl"
        onClick={() =>
          onChange((rows) => [
            ...rows,
            {
              id: newId(),
              kind: "html",
              title: "Nueva nota",
              html: "<p>Escribí acá la novedad.</p>",
              active: true,
              sort: rows.length,
            },
          ])
        }
      >
        Agregar noticia
      </Button>
    </div>
  );
}

function HomeVideosEditor({
  videos,
  onChange,
}: {
  videos: HomeVideoItem[];
  onChange: (next: HomeVideoItem[] | ((prev: HomeVideoItem[]) => HomeVideoItem[])) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pegá URLs de YouTube, Instagram (publicación o reel) o TikTok. Los perfiles no se pueden
        embeber: en el home se muestra un enlace.
      </p>
      {videos.map((item, idx) => (
        <div key={item.id} className="rounded-2xl border border-border bg-secondary/30 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Video #{idx + 1}</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Activo
                <Switch
                  checked={item.active !== false}
                  onCheckedChange={(v) =>
                    onChange((rows) => rows.map((r) => (r.id === item.id ? { ...r, active: v } : r)))
                  }
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => onChange((rows) => rows.filter((r) => r.id !== item.id))}
              >
                Quitar
              </Button>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Título (máx. 250)</Label>
              <Input
                className="h-10 rounded-xl"
                value={item.title}
                maxLength={250}
                onChange={(e) =>
                  onChange((rows) =>
                    rows.map((r) =>
                      r.id === item.id ? { ...r, title: e.target.value.slice(0, 250) } : r,
                    ),
                  )
                }
              />
              <p className="text-xs text-muted-foreground">{item.title.length}/250</p>
            </div>
            <div className="space-y-2">
              <Label>URL del video</Label>
              <Input
                className="h-10 rounded-xl"
                value={item.embed_url}
                onChange={(e) =>
                  onChange((rows) =>
                    rows.map((r) => (r.id === item.id ? { ...r, embed_url: e.target.value } : r)),
                  )
                }
                placeholder="YouTube, Instagram (p/reel) o TikTok (video)…"
              />
              {item.embed_url.trim() && !parseSocialEmbed(item.embed_url).iframeSrc ? (
                <p className="text-xs text-muted-foreground">
                  Este enlace no se puede embeber (perfil o shortlink). En el home se muestra un
                  botón para abrirlo.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="rounded-xl"
        onClick={() =>
          onChange((rows) => [
            ...rows,
            {
              id: newId(),
              title: "Cliente feliz",
              embed_url: "",
              active: true,
              sort: rows.length,
            },
          ])
        }
      >
        Agregar video
      </Button>
    </div>
  );
}
