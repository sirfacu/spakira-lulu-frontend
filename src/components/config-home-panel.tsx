import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GripVertical } from "lucide-react";
import { sanitizePreviewHtml } from "@/lib/sanitize-html";
import { parseSocialEmbed } from "@/lib/social-embed";
import {
  HOME_SECTION_LABELS,
  normalizeSectionOrder,
  type HomeSectionId,
} from "@/lib/home-sections";
import { cn } from "@/lib/utils";
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
  const [sectionOrder, setSectionOrder] = useState<HomeSectionId[]>(() =>
    normalizeSectionOrder(null),
  );
  const [preview, setPreview] = useState<HomeNewsItem | null>(null);

  useEffect(() => {
    if (!q.data) return;
    setNews(q.data.news ?? []);
    setVideos(q.data.client_videos ?? []);
    setSectionOrder(normalizeSectionOrder(q.data.section_order));
  }, [q.data]);

  const sectionRows = useMemo(
    () => sectionOrder.map((id) => ({ id, label: HOME_SECTION_LABELS[id] })),
    [sectionOrder],
  );

  const saveMut = useMutation({
    mutationFn: () =>
      putHomeContent({
        news: news.map((n, i) => ({ ...n, sort: i })),
        client_videos: videos.map((v, i) => ({ ...v, sort: i })),
        section_order: sectionOrder,
      }),
    onSuccess: async () => {
      toast.success("Inicio actualizado");
      await qc.invalidateQueries({ queryKey: ["home-content"] });
      await qc.invalidateQueries({ queryKey: ["home-content-public"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6">
      <SectionCard title="Orden de secciones">
        <p className="mb-4 text-sm text-muted-foreground">
          Arrastrá el nombre para cambiar cómo se ve el home. El menú de arriba y el pie
          quedan fijos. Al soltar, el orden se guarda y aplica.
        </p>
        <ReorderList
          items={sectionRows}
          className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border/70"
          onReorder={(next) => {
            const ids = next.map((row) => row.id);
            setSectionOrder(ids);
            putHomeContent({ section_order: ids })
              .then(async () => {
                toast.success("Orden del inicio actualizado");
                await qc.invalidateQueries({ queryKey: ["home-content"] });
                await qc.invalidateQueries({ queryKey: ["home-content-public"] });
              })
              .catch((e: Error) => toast.error(e.message));
          }}
          renderItem={(item, { isDragging, dragHandleProps }) => (
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-3",
                isDragging && "opacity-60",
              )}
            >
              <div
                {...dragHandleProps}
                className="grid h-8 w-8 cursor-grab place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary active:cursor-grabbing"
                aria-label={`Reordenar ${item.label}`}
                title="Arrastrar para reordenar"
              >
                <GripVertical className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-foreground">{item.label}</span>
            </div>
          )}
        />
      </SectionCard>

      <SectionCard title="Noticias / ideas (chips del home)">
        <p className="mb-4 text-sm text-muted-foreground">
          Cada ítem puede ser texto HTML o una imagen. En el home desfilan de izquierda a
          derecha. Probá localmente en{" "}
          <code className="text-xs">http://spakira.e-mac.co:9000/home</code>.
        </p>
        <div className="space-y-4">
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
                        setNews((rows) =>
                          rows.map((r) => (r.id === item.id ? { ...r, active: v } : r)),
                        )
                      }
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setPreview(item)}
                  >
                    Preview
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setNews((rows) => rows.filter((r) => r.id !== item.id))}
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
                      setNews((rows) =>
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
                      setNews((rows) =>
                        rows.map((r) =>
                          r.id === item.id
                            ? { ...r, kind: e.target.value as "html" | "image" }
                            : r,
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
                      setNews((rows) =>
                        rows.map((r) =>
                          r.id === item.id ? { ...r, image_url: e.target.value } : r,
                        ),
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
                      setNews((rows) =>
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
              setNews((rows) => [
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
      </SectionCard>

      <SectionCard title="Nuestros clientes dicen (videos)">
        <p className="mb-4 text-sm text-muted-foreground">
          Pegá URLs de YouTube (watch, shorts, youtu.be), Instagram (publicación o reel) o
          TikTok (video). Los perfiles no se pueden embeber: en el home se muestra un
          enlace para abrirlos.
        </p>
        <div className="space-y-4">
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
                        setVideos((rows) =>
                          rows.map((r) => (r.id === item.id ? { ...r, active: v } : r)),
                        )
                      }
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setVideos((rows) => rows.filter((r) => r.id !== item.id))}
                  >
                    Quitar
                  </Button>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    className="h-10 rounded-xl"
                    value={item.title}
                    onChange={(e) =>
                      setVideos((rows) =>
                        rows.map((r) => (r.id === item.id ? { ...r, title: e.target.value } : r)),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL del video</Label>
                  <Input
                    className="h-10 rounded-xl"
                    value={item.embed_url}
                    onChange={(e) =>
                      setVideos((rows) =>
                        rows.map((r) =>
                          r.id === item.id ? { ...r, embed_url: e.target.value } : r,
                        ),
                      )
                    }
                    placeholder="YouTube, Instagram (p/reel) o TikTok (video)…"
                  />
                  {item.embed_url.trim() && !parseSocialEmbed(item.embed_url).iframeSrc ? (
                    <p className="text-xs text-muted-foreground">
                      Este enlace no se puede embeber (perfil o shortlink). En el home se
                      muestra un botón para abrirlo en Instagram o TikTok.
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
              setVideos((rows) => [
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
      </SectionCard>

      <Button
        className="rounded-xl"
        disabled={saveMut.isPending}
        onClick={() => saveMut.mutate()}
      >
        Guardar contenido del inicio
      </Button>

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
              className="prose prose-sm mt-2 max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizePreviewHtml(preview.html) }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
