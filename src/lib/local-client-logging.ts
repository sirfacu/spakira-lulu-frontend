/** Local-only client logging → backend writes logs/{http,error}.log tagged {front} */

function isLocalBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0";
}

function apiBase(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:9001`;
  }
  return "http://127.0.0.1:9001";
}

type Kind = "http" | "error" | "info";

const queue: { kind: Kind; entry: Record<string, unknown> }[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

function enqueue(kind: Kind, entry: Record<string, unknown>) {
  if (!isLocalBrowser()) return;
  queue.push({ kind, entry });
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, 400);
  }
}

async function flush() {
  if (!queue.length || !isLocalBrowser()) return;
  const batch = queue.splice(0, queue.length);
  const byKind = new Map<Kind, Record<string, unknown>[]>();
  for (const item of batch) {
    const list = byKind.get(item.kind) ?? [];
    list.push(item.entry);
    byKind.set(item.kind, list);
  }
  await Promise.all(
    [...byKind.entries()].map(async ([kind, entries]) => {
      try {
        await fetch(`${apiBase()}/debug/client-logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ kind, entries }),
          keepalive: true,
        });
      } catch {
        /* ignore logger failures */
      }
    }),
  );
}

export function logHttp(entry: Record<string, unknown>) {
  enqueue("http", entry);
}

export function logError(entry: Record<string, unknown>) {
  enqueue("error", entry);
}

export function installLocalClientLogging() {
  if (installed || typeof window === "undefined" || !isLocalBrowser()) return;
  installed = true;

  logHttp({
    event: "page_load",
    href: window.location.href,
    userAgent: navigator.userAgent,
  });

  window.addEventListener("error", (ev) => {
    logError({
      event: "window_error",
      message: ev.message,
      filename: ev.filename,
      lineno: ev.lineno,
      colno: ev.colno,
      stack: ev.error instanceof Error ? ev.error.stack : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    logError({
      event: "unhandledrejection",
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  window.addEventListener("beforeunload", () => {
    void flush();
  });
}
