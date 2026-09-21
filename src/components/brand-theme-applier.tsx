import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicBusinessSettings } from "@/lib/spa-queries";
import {
  THEME_PREVIEW_EVENT,
  applyThemeToDocument,
  getThemePreview,
  resolveAppliedThemeId,
} from "@/lib/brand-themes";

/** Aplica preview o theme_id guardado a <html data-theme>. */
export function BrandThemeApplier() {
  const [previewTick, setPreviewTick] = useState(0);
  const q = useQuery({
    queryKey: ["business-settings-public"],
    queryFn: getPublicBusinessSettings,
    staleTime: 30_000,
  });

  useEffect(() => {
    const onPreview = () => setPreviewTick((n) => n + 1);
    window.addEventListener(THEME_PREVIEW_EVENT, onPreview);
    return () => window.removeEventListener(THEME_PREVIEW_EVENT, onPreview);
  }, []);

  useEffect(() => {
    const previewing = Boolean(getThemePreview());
    applyThemeToDocument(resolveAppliedThemeId(q.data?.theme_id), !previewing && Boolean(q.data?.theme_id));
  }, [q.data?.theme_id, previewTick]);

  return null;
}
