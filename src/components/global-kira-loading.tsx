/** Overlay solo en navegación lenta (no en polling de notificaciones). */

import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { KiraLoader } from "@/components/kira-loader";

const SHOW_AFTER_MS = 450;

export function GlobalKiraLoading() {
  const routerBusy = useRouterState({
    select: (s) => s.status === "pending",
  });
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!routerBusy) {
      setShow(false);
      return;
    }
    const t = window.setTimeout(() => setShow(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [routerBusy]);

  if (!show) return null;
  return <KiraLoader variant="overlay" label="cargando tu experiencia" />;
}
