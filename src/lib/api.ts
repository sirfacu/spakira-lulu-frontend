/** Cliente HTTP hacia el backend spakira-lulu (reemplaza supabase-js). */

import { logError, logHttp } from "@/lib/local-client-logging";

const TOKEN_KEY = "spakira_lulu_token";

let meCache: {
  at: number;
  user: {
    id: string;
    email: string;
    role: string;
    profile_complete?: boolean;
    needs_pet?: boolean;
    modules?: string[];
    modules_custom?: boolean;
  };
} | null = null;

export function getApiBase(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    const baked = String(import.meta.env.VITE_API_URL).replace(/\/$/, "");
    // No usar localhost horneado cuando el panel ya está en un dominio público.
    if (
      baked &&
      !(
        typeof window !== "undefined" &&
        !/^localhost$|^127\.0\.0\.1$/.test(window.location.hostname) &&
        /localhost|127\.0\.0\.1/.test(baked)
      )
    ) {
      return baked;
    }
  }
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    const localish =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
    // Producción detrás de ALB: mismo host + /api (api.* no resuelve en e-mac).
    if (
      hostname === "spakira.e-mac.co" ||
      ((port === "" || port === "80" || port === "443") && !localish)
    ) {
      return `${protocol}//${hostname.replace(/^www\./, "")}/api`;
    }
    if (localish) {
      return `${protocol}//${hostname}:9001`;
    }
    return `${protocol}//${hostname}:9001`;
  }
  return "http://127.0.0.1:9001";
}

export function usesHttpOnlySession(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname } = window.location;
  const localish =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  return !localish;
}

/**
 * En prod la sesión vive en cookie HttpOnly (`spakira_session`): no hay token en JS.
 * Usar esto (no `getToken()`) para decidir si hay que llamar a `/auth/me`.
 */
export function mayHaveSession(): boolean {
  if (usesHttpOnlySession()) return true;
  return Boolean(getToken());
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  if (usesHttpOnlySession()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  meCache = null;
  if (typeof window === "undefined") return;
  if (usesHttpOnlySession()) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function clearMeCache() {
  meCache = null;
}

function jwtPayload(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const pad = payload.length % 4 === 0 ? "" : "=".repeat(4 - (payload.length % 4));
    return JSON.parse(atob(payload + pad)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function seedMeCache(opts: {
  access_token: string;
  email: string;
  role: string;
  profile_complete?: boolean;
  needs_pet?: boolean;
}) {
  const payload = jwtPayload(opts.access_token);
  const sub = payload && typeof payload.sub === "string" ? payload.sub : "";
  meCache = {
    at: Date.now(),
    user: {
      id: sub,
      email: opts.email,
      role: opts.role,
      profile_complete: opts.profile_complete,
      needs_pet: opts.needs_pet,
    },
  };
}

/** Lee `role` del JWT sin verificar firma (solo para redirección de UI). */
export function roleFromAccessToken(token: string | null | undefined): string | undefined {
  const json = jwtPayload(token);
  return json && typeof json.role === "string" ? json.role : undefined;
}

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail ?? message;
  }
}

const NETWORK_FETCH_ERRORS = new Set([
  "Failed to fetch",
  "Load failed",
  "NetworkError when attempting to fetch resource.",
]);

export function isLocalishHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
  );
}

export function isTunnelHostname(hostname: string): boolean {
  return (
    hostname.endsWith(".trycloudflare.com") ||
    hostname.endsWith(".cfargotunnel.com") ||
    hostname.includes("trycloudflare.com")
  );
}

/** Mensaje de red según el host: el aviso del túnel Cloudflare es solo local. */
export function networkErrorMessage(raw: string, hostname?: string): string {
  if (!NETWORK_FETCH_ERRORS.has(raw)) return raw;
  const host =
    hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
  if (isTunnelHostname(host)) {
    return "No se pudo contactar la API. El cierre no debe ir por el túnel de Cloudflare; usá localhost:9000 en esta PC.";
  }
  if (isLocalishHostname(host)) {
    return "No se pudo contactar la API. ¿Está corriendo en el puerto 9001? Recargá e intentá de nuevo.";
  }
  return "No se pudo contactar la API. Recargá e intentá de nuevo. Si el servicio ya se cerró, revisá la agenda.";
}

type FetchOpts = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

export async function api<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
  const url = `${getApiBase()}${path}`;
  const started = performance.now();

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "include",
    });

    logHttp({
      event: "api_fetch",
      method,
      path,
      status: res.status,
      ms: Math.round(performance.now() - started),
    });

    if (!res.ok) {
      let detail: unknown = res.statusText;
      let message = res.statusText;
      try {
        const j = (await res.json()) as { detail?: unknown };
        if (j.detail !== undefined) {
          detail = j.detail;
          message =
            typeof j.detail === "string"
              ? j.detail
              : j.detail &&
                  typeof j.detail === "object" &&
                  "message" in j.detail &&
                  typeof (j.detail as { message: unknown }).message === "string"
                ? (j.detail as { message: string }).message
                : JSON.stringify(j.detail);
        }
      } catch {
        /* ignore */
      }
      logError({
        event: "api_error",
        method,
        path,
        status: res.status,
        detail: message,
      });
      throw new ApiError(res.status, message, detail);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const raw = err instanceof Error ? err.message : String(err);
    logError({
      event: "api_network_error",
      method,
      path,
      message: raw,
    });
    throw new ApiError(0, networkErrorMessage(raw));
  }
}

export async function login(email: string, password: string) {
  const data = await api<{
    access_token: string;
    email: string;
    role: string;
    profile_complete?: boolean;
    needs_pet?: boolean;
  }>("/auth/login", { method: "POST", body: { email, password }, auth: false });
  setToken(data.access_token);
  seedMeCache(data);
  return data;
}

export async function registerAccount(email: string, full_name: string, password: string) {
  const data = await api<{
    access_token: string;
    email: string;
    role: string;
    profile_complete?: boolean;
    needs_pet?: boolean;
  }>("/auth/register", {
    method: "POST",
    body: { email, full_name, password },
    auth: false,
  });
  setToken(data.access_token);
  seedMeCache(data);
  return data;
}

export async function previewActivation(token: string) {
  return api<{
    email: string;
    full_name: string;
    role: string;
    google_ok: boolean;
  }>(`/auth/activate/preview?token=${encodeURIComponent(token)}`, { auth: false });
}

export async function activateAccount(token: string, password: string, full_name?: string) {
  const data = await api<{
    access_token: string;
    email: string;
    role: string;
    profile_complete?: boolean;
    needs_pet?: boolean;
  }>("/auth/activate", {
    method: "POST",
    body: { token, password, full_name },
    auth: false,
  });
  setToken(data.access_token);
  seedMeCache({ ...data, profile_complete: (data as { profile_complete?: boolean }).profile_complete });
  return data;
}

export async function register(email: string, password: string, full_name?: string) {
  return registerAccount(email, full_name ?? "Humano de compañía", password);
}

export function fetchMe() {
  if (meCache && Date.now() - meCache.at < 8000 && meCache.user.modules) {
    return Promise.resolve(meCache.user);
  }
  return api<{
    id: string;
    email: string;
    role: string;
    profile_complete?: boolean;
    needs_pet?: boolean;
    modules?: string[];
    modules_custom?: boolean;
  }>("/auth/me").then(
    (user) => {
      meCache = { at: Date.now(), user };
      return user;
    },
  );
}

export function logout() {
  meCache = null;
  setToken(null);
  void api("/auth/logout", { method: "POST", auth: false }).catch(() => {});
}

/**
 * Normaliza URLs de fotos locales (/uploads/…) al API base actual.
 * Deja intactas URLs de S3 / CloudFront.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url?.trim()) return "";
  const trimmed = url.trim();
  if (/amazonaws\.com|cloudfront\.net/i.test(trimmed)) return trimmed;
  const match = trimmed.match(/(\/uploads\/.+)$/);
  if (match) return `${getApiBase()}${match[1]}`;
  if (trimmed.startsWith("/")) return `${getApiBase()}${trimmed}`;
  return trimmed;
}

/** Sube imagen (JPG/PNG/WEBP/GIF ≤5MB) y retorna URL pública. */
export async function uploadPhoto(file: File): Promise<{ url: string; key: string }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const body = new FormData();
  body.append("file", file);

  const path = "/storage/upload-photo";
  const url = `${getApiBase()}${path}`;
  const started = performance.now();
  const res = await fetch(url, { method: "POST", headers, body });
  logHttp({
    event: "api_fetch",
    method: "POST",
    path,
    status: res.status,
    ms: Math.round(performance.now() - started),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { detail?: string };
      if (j.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  const data = (await res.json()) as { url: string; key: string };
  return { ...data, url: resolveMediaUrl(data.url) || data.url };
}
