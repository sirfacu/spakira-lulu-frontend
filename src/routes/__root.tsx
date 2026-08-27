import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  redirect,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { GlobalKiraLoading } from "@/components/global-kira-loading";
import { KiraLoader } from "@/components/kira-loader";
import { installLocalClientLogging, logError } from "@/lib/local-client-logging";

function NotFoundComponent() {
  // Sesión viva + ruta desconocida → panel (evita “login ok → marketing home”).
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    // Si algún navigate dejó el id de ruta en la URL, corregir al fullPath real.
    if (path.startsWith("/_authenticated")) {
      const fixed = path.replace(/^\/_authenticated/, "") || "/panel";
      throw redirect({ href: `${fixed}${window.location.search}` });
    }
    if (window.localStorage.getItem("spakira_lulu_token")) {
      throw redirect({ href: "/panel" });
    }
  }
  throw redirect({ href: "/home" });
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    logError({
      event: "react_route_error",
      message: error.message,
      stack: error.stack,
      href: typeof window !== "undefined" ? window.location.href : undefined,
    });
  }, [error]);

  return (
    <div className="spa-canvas flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página no cargó
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo salió mal. Intenta de nuevo o vuelve al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                const path = window.location.pathname;
                if (path.startsWith("/_authenticated")) {
                  const fixed = path.replace(/^\/_authenticated/, "") || "/panel/agenda";
                  window.location.assign(`${fixed}${window.location.search}`);
                  return;
                }
              }
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reintentar
          </button>
          <a
            href="/home"
            className="inline-flex items-center justify-center rounded-xl border border-input bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/10"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Spa Kira — Luxury pet grooming" },
      {
        name: "description",
        content:
          "Spa Kira: grooming canino y felino de lujo, con panel administrativo para agenda, mascotas, ventas e inventario.",
      },
      { name: "author", content: "Spa Kira" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Playfair+Display:wght@500;600;700&family=Great+Vibes&display=swap",
      },
      { rel: "icon", href: "/icons/favicon.ico?v=2", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icons/favicon-32.png?v=2" },
      { rel: "icon", type: "image/png", sizes: "48x48", href: "/icons/favicon-48.png?v=2" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon.png?v=2" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  pendingComponent: () => <KiraLoader variant="fullscreen" />,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    installLocalClientLogging();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <GlobalKiraLoading />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
