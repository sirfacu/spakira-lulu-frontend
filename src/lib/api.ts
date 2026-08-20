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
    modules?: string[];
    modules_custom?: boolean;
  };
} | null = null;

export function getApiBase(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    const localish =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
    // Panel vía Apache (:80/:443) → API en subdominio api.* (mismo Host-header mapping)
    if (
      hostname === "spakira.e-mac.co" ||
      ((port === "" || port === "80" || port === "443") && !localish)
    ) {
      return `${protocol}//api.${hostname.replace(/^www\./, "")}`;
    }
    if (localish) {
      return `${protocol}//${hostname}:9001`;
    }
    // Dev directo en :9000 sin proxy
    return `${protocol}//${hostname}:9001`;
  }
  return "http://127.0.0.1:9001";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  meCache = null;
  if (typeof window === "undefined") return;
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
    throw new ApiError(
      0,
      raw === "Failed to fetch" || raw === "Load failed" || raw === "NetworkError when attempting to fetch resource."
        ? "No se pudo contactar la API. Si estás en esta PC, recargá; el cierre no debe ir por el túnel de Cloudflare."
        : raw,
    );
  }
}

export async function login(email: string, password: string) {
  const data = await api<{
    access_token: string;
    email: string;
    role: string;
    profile_complete?: boolean;
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
  }>("/auth/register", {
    method: "POST",
    body: { email, full_name, password },
    auth: false,
  });
  setToken(data.access_token);
  seedMeCache(data);
  return data;
}

export async function activateAccount(token: string, password: string, full_name?: string) {
  const data = await api<{
    access_token: string;
    email: string;
    role: string;
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
  return (await res.json()) as { url: string; key: string };
}
