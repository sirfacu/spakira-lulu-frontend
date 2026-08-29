import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  activateAccount,
  getApiBase,
  getToken,
  login,
  roleFromAccessToken,
  seedMeCache,
  setToken,
} from "@/lib/api";
import { BrandMark } from "@/components/brand";
import { LoginSplash } from "@/components/login-splash";
import { KiraLoader } from "@/components/kira-loader";
import {
  DEFAULT_PRIVACY_PATH,
  DEFAULT_TERMS_PATH,
  resolveLegalHref,
  usePublicBusiness,
} from "@/components/legal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { homeForRole, permissionsFor } from "@/lib/roles";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => {
    const out: {
      token?: string;
      google_token?: string;
      google_ticket?: string;
      role?: string;
      google_error?: string;
      auth_error?: string;
      need_profile?: true;
    } = {};
    if (typeof search.token === "string") out.token = search.token;
    if (typeof search.google_token === "string") out.google_token = search.google_token;
    if (typeof search.google_ticket === "string") out.google_ticket = search.google_ticket;
    if (typeof search.role === "string") out.role = search.role;
    if (typeof search.google_error === "string") out.google_error = search.google_error;
    if (typeof search.auth_error === "string") out.auth_error = search.auth_error;
    // Solo serializar need_profile cuando es true (evita ?need_profile=false en la URL).
    if (search.need_profile === "1" || search.need_profile === true) out.need_profile = true;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Ingresar al panel | Spa Kira" },
      {
        name: "description",
        content:
          "Acceso al panel administrativo de Spa Kira: agenda, mascotas, propietarios, inventario y ventas.",
      },
      { property: "og:title", content: "Ingresar al panel | Spa Kira" },
      {
        property: "og:description",
        content: "Acceso del personal al sistema de gestión de Spa Kira.",
      },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && getToken()) {
      // already logged in — panel guard will confirm token
    }
  },
  component: AuthPage,
});

type Mode = "login" | "activate";

function GoogleGIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function destAfterAuth(
  role: string | undefined,
  profileComplete?: boolean,
  needProfile?: boolean,
  needsPet?: boolean,
) {
  if (permissionsFor(role).isCliente && (needProfile || profileComplete === false)) {
    return "/panel/completar";
  }
  if (permissionsFor(role).isCliente && needsPet) {
    return "/panel/mascotas?alta=true";
  }
  return homeForRole(role);
}

/** Si el splash no dispara (HMR roto), forzar salida de /auth. */
function scheduleAuthRedirect(dest: string) {
  window.setTimeout(() => {
    const path = window.location.pathname.replace(/\/$/, "") || "/";
    if (path === "/auth") window.location.assign(dest);
  }, 2800);
}

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const {
    token: tokenFromUrl,
    google_token,
    google_ticket,
    role: roleFromUrl,
    google_error,
    auth_error,
    need_profile,
  } = search;
  const initialMode: Mode = tokenFromUrl ? "activate" : "login";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [token, setActToken] = useState(tokenFromUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(true);
  const [googleHint, setGoogleHint] = useState<string | null>(null);
  const [splashTo, setSplashTo] = useState<string | null>(null);
  const [ticketBusy, setTicketBusy] = useState(false);
  /** Evita re-disparar el canje; no meter ticketBusy en deps (se auto-cancela el fetch). */
  const ticketStarted = useRef(false);
  const { data: bizLegal } = usePublicBusiness();

  const finishSplash = useCallback(() => {
    if (!splashTo) return;
    // Navegación dura: más fiable que navigate() detrás de Apache + Vite dev.
    window.location.assign(splashTo);
  }, [splashTo]);

  const applySession = useCallback(
    (opts: {
      access_token: string;
      email?: string;
      role?: string;
      need_profile?: boolean;
      profile_complete?: boolean;
      needs_pet?: boolean;
    }) => {
      setToken(opts.access_token);
      const role = opts.role || roleFromAccessToken(opts.access_token) || "cliente";
      const needProf =
        opts.need_profile === true ||
        opts.profile_complete === false ||
        need_profile === true;
      seedMeCache({
        access_token: opts.access_token,
        email: opts.email || "",
        role,
        profile_complete: !needProf,
        needs_pet: opts.needs_pet,
      });
      const dest = destAfterAuth(role, opts.profile_complete, needProf, opts.needs_pet);
      setSplashTo(dest);
      scheduleAuthRedirect(dest);
    },
    [need_profile],
  );

  useEffect(() => {
    const err = google_error || auth_error;
    if (!err) return;
    toast.error(err);
    void navigate({ to: "/auth", search: {}, replace: true });
  }, [google_error, auth_error, navigate]);

  // Ticket corto post-Google (preferido; no lleva JWT en la URL).
  useEffect(() => {
    if (!google_ticket || ticketStarted.current) return;
    ticketStarted.current = true;
    let cancelled = false;
    setTicketBusy(true);
    void (async () => {
      try {
        const res = await fetch(
          `${getApiBase()}/auth/google/login/finish?ticket=${encodeURIComponent(google_ticket)}`,
          { credentials: "include" },
        );
        const body = (await res.json().catch(() => ({}))) as {
          detail?: string;
          access_token?: string;
          role?: string;
          email?: string;
          need_profile?: boolean;
          profile_complete?: boolean;
          needs_pet?: boolean;
        };
        if (!res.ok || !body.access_token) {
          throw new Error(body.detail || "No se pudo completar el login con Google");
        }
        if (cancelled) return;
        applySession({
          access_token: body.access_token,
          email: body.email,
          role: body.role,
          need_profile: body.need_profile,
          profile_complete: body.profile_complete,
          needs_pet: body.needs_pet,
        });
        void navigate({ to: "/auth", search: {}, replace: true });
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Login Google falló");
          void navigate({ to: "/auth", search: {}, replace: true });
        }
      } finally {
        setTicketBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [google_ticket, applySession, navigate]);

  // Legacy: JWT en query (por si quedó un redirect viejo).
  useEffect(() => {
    if (!google_token || google_ticket) return;
    applySession({
      access_token: google_token,
      role: roleFromUrl,
      need_profile: need_profile === true,
      profile_complete: need_profile === true ? false : undefined,
    });
    void navigate({ to: "/auth", search: {}, replace: true });
  }, [google_token, google_ticket, roleFromUrl, need_profile, applySession, navigate]);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const kill = window.setTimeout(() => ac.abort(), 2000);
    void (async () => {
      try {
        const res = await fetch(`${getApiBase()}/auth/google/login/status`, { signal: ac.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { configured?: boolean };
        if (!cancelled) {
          setGoogleReady(!!data.configured);
          setGoogleHint(data.configured ? null : "Google no está configurado en el servidor.");
        }
      } catch {
        /* el botón Google queda habilitado; el click falla con toast si no hay API */
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(kill);
      ac.abort();
    };
  }, []);

  const title = mode === "activate" ? "Activar cuenta" : "Ingresar";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const data = await login(email, password);
        toast.success("Ingreso correcto");
        const dest = destAfterAuth(data.role, data.profile_complete, undefined, data.needs_pet);
        setSplashTo(dest);
        scheduleAuthRedirect(dest);
        return;
      }
      const data = await activateAccount(token, password, fullName || undefined);
      toast.success("Cuenta activada");
      const dest = destAfterAuth(data.role, data.profile_complete, undefined, data.needs_pet);
      setSplashTo(dest);
      scheduleAuthRedirect(dest);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No fue posible continuar");
    } finally {
      setLoading(false);
    }
  };

  const googleLoginUrl = `${getApiBase()}/auth/google/login/start`;

  return (
    <div className="spa-canvas flex min-h-screen items-center justify-center bg-background px-4 py-12">
      {ticketBusy ? <KiraLoader variant="fullscreen" label="cargando tu experiencia" /> : null}
      {splashTo && !ticketBusy ? (
        <LoginSplash onDone={finishSplash} label="Ingreso correcto · cargando tu panel" />
      ) : null}
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al sitio
        </Link>

        <div className="card-soft paw-pattern overflow-hidden p-8">
          <div className="relative">
            <BrandMark size="auth" />
            <div className="gold-rule mx-auto my-6 max-w-[12rem]" />
            <h2 className="text-center font-display text-2xl font-bold text-primary">{title}</h2>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Panel · Spa Kira
            </p>

            {mode !== "activate" ? (
              <div className="mt-6 space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full rounded-xl border-border bg-card text-base font-medium text-foreground hover:bg-secondary/50"
                  disabled={!googleReady || loading || ticketBusy}
                  onClick={() => {
                    window.location.href = googleLoginUrl;
                  }}
                >
                  <GoogleGIcon className="mr-2 h-5 w-5" />
                  Continuar con Google
                </Button>
                {!googleReady && googleHint ? (
                  <p className="text-center text-[11px] text-muted-foreground">{googleHint}</p>
                ) : null}
                <p className="pt-1 text-center text-xs text-muted-foreground">
                  Clientes nuevos: Google crea la cuenta. Después te pedimos cédula y tu mascota.
                  Staff e invitados: correo y contraseña.
                </p>
              </div>
            ) : null}

            <form onSubmit={submit} className="mt-4 space-y-4">
              {mode === "activate" ? (
                <div className="space-y-2">
                  <Label htmlFor="token">Token de activación</Label>
                  <Input
                    id="token"
                    required
                    value={token}
                    onChange={(e) => setActToken(e.target.value)}
                    placeholder="Pegá el token del correo / log"
                    className="h-12 rounded-xl"
                  />
                </div>
              ) : null}

              {mode !== "activate" ? (
                <div className="space-y-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@gmail.com"
                    className="h-12 rounded-xl"
                  />
                </div>
              ) : null}

              {mode === "activate" ? (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nombre</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Tu nombre"
                    className="h-12 rounded-xl"
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={mode === "activate" ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 rounded-xl"
                />
              </div>

              <Button type="submit" disabled={loading || ticketBusy} className="h-12 w-full rounded-xl text-base">
                {loading ? "Un momento…" : mode === "activate" ? "Activar e ingresar" : "Ingresar"}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              <a
                href={resolveLegalHref(bizLegal?.privacy_url, DEFAULT_PRIVACY_PATH)}
                className="underline-offset-2 hover:underline"
              >
                Privacidad
              </a>
              {" · "}
              <a
                href={resolveLegalHref(bizLegal?.terms_url, DEFAULT_TERMS_PATH)}
                className="underline-offset-2 hover:underline"
              >
                Términos
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
