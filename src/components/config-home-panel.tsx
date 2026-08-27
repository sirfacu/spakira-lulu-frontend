import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionCard } from "@/components/ui-kit";
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
  const [preview, setPreview] = useState<HomeNewsItem | null>(null);

  useEffect(() => {
    if (!q.data) return;
    setNews(q.data.news ?? []);
    setVideos(q.data.client_videos ?? []);
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      putHomeContent({
        news: news.map((n, i) => ({ ...n, sort: i })),
        client_videos: videos.map((v, i) => ({ ...v, sort: i })),
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
          Pegá URLs de YouTube (watch, youtu.be o embed). Se muestran embebidos y desfilan
          en el home.
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
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
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
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
