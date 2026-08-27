/** Splash post-login: sticker Kira + “cargando tu experiencia”, luego navega. */

import { useEffect } from "react";
import { KiraLoader } from "@/components/kira-loader";

type Props = {
  onDone: () => void;
  /** ms totales aproximados */
  durationMs?: number;
};

export function LoginSplash({ onDone, durationMs = 2200 }: Props) {
  useEffect(() => {
    const done = window.setTimeout(() => onDone(), durationMs);
    return () => window.clearTimeout(done);
  }, [onDone, durationMs]);

  return <KiraLoader variant="fullscreen" label="cargando tu experiencia" />;
}
