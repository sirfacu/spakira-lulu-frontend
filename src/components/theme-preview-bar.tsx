import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  THEME_PREVIEW_EVENT,
  clearThemePreview,
  getThemePreview,
  normalizeThemeId,
  persistSavedTheme,
  themeLabel,
  type BrandThemeId,
} from "@/lib/brand-themes";
import { getPublicBusinessSettings, patchBusinessSettings } from "@/lib/spa-queries";

/** Barra fija: el tema de preview se ve al navegar; solo persiste con Guardar tema. */
export function ThemePreviewBar() {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<BrandThemeId | null>(() => getThemePreview());
  const publicQ = useQuery({
    queryKey: ["business-settings-public"],
    queryFn: getPublicBusinessSettings,
    staleTime: 30_000,
  });
  const saved = normalizeThemeId(publicQ.data?.theme_id);

  useEffect(() => {
    const sync = () => setPreview(getThemePreview());
    window.addEventListener(THEME_PREVIEW_EVENT, sync);
    return () => window.removeEventListener(THEME_PREVIEW_EVENT, sync);
  }, []);

  const saveMut = useMutation({
    mutationFn: (themeId: BrandThemeId) => patchBusinessSettings({ theme_id: themeId }),
    onSuccess: async (_data, themeId) => {
      persistSavedTheme(themeId);
      clearThemePreview(themeId);
      toast.success(`Tema guardado: ${themeLabel(themeId)}`);
      await qc.invalidateQueries({ queryKey: ["business-settings"] });
      await qc.invalidateQueries({ queryKey: ["business-settings-public"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!preview || preview === saved) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-xl flex-wrap items-center justify-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-lg">
        <p className="text-foreground">
          Vista previa: <span className="font-medium">{themeLabel(preview)}</span>. Recorré el panel
          para verlo. No está guardado.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            className="rounded-xl"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate(preview)}
          >
            {saveMut.isPending ? "Guardando…" : "Guardar tema"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={saveMut.isPending}
            onClick={() => clearThemePreview(saved)}
          >
            Descartar
          </Button>
        </div>
      </div>
    </div>
  );
}
