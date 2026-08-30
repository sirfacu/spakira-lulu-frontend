import { useState } from "react";
import { Link, useRouterState, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  CalendarDays,
  ShoppingBag,
  Boxes,
  Dog,
  Users,
  UserCog,
  Tags,
  BarChart3,
  Percent,
  Settings,
  Menu,
  X,
  LogOut,
  Search,
  Bell,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark, PawIcon } from "@/components/brand";
import { logout as apiLogout } from "@/lib/api";
import { canAccessPath, normalizeRole } from "@/lib/roles";
import { markNotificationsRead, notificationsQuery, getBusinessSettings } from "@/lib/spa-queries";
import { shortDate, time } from "@/lib/format";

const NAV = [
  { to: "/panel", label: "Dashboard", icon: LayoutDashboard },
  { to: "/panel/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/panel/ventas", label: "Ventas", icon: ShoppingBag },
  { to: "/panel/inventario", label: "Inventario", icon: Boxes },
  { to: "/panel/mascotas", label: "Mascotas", icon: Dog },
  { to: "/panel/propietarios", label: "Usuarios", icon: Users },
  { to: "/panel/personal", label: "Staff", icon: UserCog },
  { to: "/panel/precios", label: "Servicios", icon: Tags },
  { to: "/panel/reportes", label: "Reportes", icon: BarChart3 },
  { to: "/panel/promociones", label: "Promociones", icon: Percent },
  { to: "/panel/configuracion", label: "Configuración", icon: Settings },
  { to: "/panel/permisos", label: "Roles y permisos", icon: Shield },
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useRouteContext({ from: "/_authenticated" });
  const role = normalizeRole(user?.role);
  const profileLocked = role === "cliente" && user?.profile_complete === false;
  const needsPet = role === "cliente" && user?.profile_complete !== false && !!user?.needs_pet;
  const nav = (
    profileLocked
      ? []
      : needsPet
        ? NAV.filter((item) => item.to === "/panel/mascotas")
        : NAV.filter((item) => canAccessPath(role, item.to, user?.modules))
  ).map((item) => {
    if (item.to === "/panel/agenda" && (role === "colaborador" || role === "cliente")) {
      return { ...item, label: "Mi agenda" };
    }
    if (item.to === "/panel/mascotas" && role === "cliente") {
      return { ...item, label: "Mis mascotas" };
    }
    return item;
  });
  const qc = useQueryClient();
  const notifs = useQuery(notificationsQuery);
  const business = useQuery({
    queryKey: ["business-settings"],
    queryFn: getBusinessSettings,
  });
  const unread = notifs.data?.unread_count ?? 0;

  const readMut = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const signOut = async () => {
    apiLogout();
    navigate({ to: "/home" });
  };

  return (
    <div className="spa-canvas min-h-screen bg-background">
      {open ? (
        <button
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-primary/25 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[268px] flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <Link
            to="/home"
            onClick={() => setOpen(false)}
            className="min-w-0 rounded-xl outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Ir al inicio"
          >
            <BrandMark
              compact
              tagline={false}
              tradeName={business.data?.trade_name ?? null}
              slogan={business.data?.slogan ?? null}
            />
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent lg:hidden"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="gold-rule mx-5" />

        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-6">
          {nav.map((item) => {
            const active =
              item.to === "/panel" ? pathname === "/panel" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-sidebar-foreground hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="paw-pattern m-3 overflow-hidden rounded-2xl bg-blush/60 p-4">
          <div className="relative">
            <PawIcon className="h-5 w-5 text-accent" />
            <p className="mt-2 text-sm font-semibold text-blush-foreground">Consentimos con amor</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Canina y felina
              {role === "colaborador" ? " · Staff" : ""}
            </p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="mx-3 mb-4 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Cerrar sesión
        </button>
      </aside>

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-xl">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 sm:px-6">
            <button
              onClick={() => setOpen(true)}
              className="rounded-xl border border-border bg-card p-2.5 text-primary shadow-soft lg:hidden"
              aria-label="Abrir menú"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl font-bold text-primary sm:text-2xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
              ) : null}
            </div>
            <div className="relative flex shrink-0 items-center gap-2">
              {actions}
              <button
                type="button"
                className="relative hidden h-10 w-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground shadow-soft sm:grid"
                aria-label="Notificaciones"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  if (!notifOpen && unread > 0) readMut.mutate();
                }}
              >
                <Bell className="h-4 w-4" />
                {unread > 0 ? (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </button>
              {notifOpen ? (
                <div className="absolute right-12 top-12 z-50 w-80 rounded-2xl border border-border bg-card p-3 shadow-lift">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Notificaciones
                  </p>
                  <ul className="max-h-72 space-y-2 overflow-y-auto">
                    {(notifs.data?.items ?? []).slice(0, 12).map((n) => (
                      <li key={n.id} className="rounded-xl bg-secondary/50 p-2.5 text-xs">
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => {
                            setNotifOpen(false);
                            if (
                              n.kind === "reschedule_request" ||
                              n.kind === "reschedule_result"
                            ) {
                              navigate({ to: "/panel/agenda" });
                            }
                          }}
                        >
                        <p className="font-medium text-foreground">{n.title}</p>
                        <p className="mt-0.5 text-muted-foreground">{n.body}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {n.created_at ? `${shortDate(n.created_at)} ${time(n.created_at)}` : ""}
                        </p>
                        </button>
                      </li>
                    ))}
                    {!notifs.data?.items?.length ? (
                      <li className="p-2 text-xs text-muted-foreground">Sin avisos.</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
              <span className="hidden h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground shadow-soft sm:grid">
                <Search className="h-4 w-4" />
              </span>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto max-w-[1400px] animate-in fade-in duration-500">{children}</div>
        </main>
      </div>
    </div>
  );
}
