/** Auditoría de acciones del panel (antes en Configuración → Usuarios). */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionCard, Empty } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { auditQuery, type AuditEntry } from "@/lib/spa-queries";
import { shortDate, time } from "@/lib/format";

const AUDIT_PAGE_SIZE = 10;

export function ConfigAuditPanel() {
  const [auditPage, setAuditPage] = useState(0);
  const [auditDetail, setAuditDetail] = useState<AuditEntry | null>(null);
  const audit = useQuery(auditQuery(AUDIT_PAGE_SIZE, auditPage * AUDIT_PAGE_SIZE));

  return (
    <>
      <SectionCard title="Auditoría de acciones">
        <p className="mb-4 text-sm text-muted-foreground">
          Registro en base de datos de altas, cambios y bajas del panel (servicios, citas,
          usuarios, permisos, configuración, etc.). Se muestran de a {AUDIT_PAGE_SIZE} acciones.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Cuándo</th>
                <th className="px-4 py-3 font-semibold">Quién</th>
                <th className="px-4 py-3 font-semibold">Acción</th>
                <th className="px-4 py-3 font-semibold">Entidad</th>
                <th className="px-4 py-3 font-semibold">Detalle</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {(audit.data?.items ?? []).map((a) => (
                <tr key={a.id} className="border-b border-border/60 last:border-0 align-top">
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                    {a.created_at ? `${shortDate(a.created_at)} ${time(a.created_at)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5">{a.actor_email ?? "—"}</td>
                  <td className="px-4 py-2.5 capitalize">{a.action_label ?? a.action}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {a.entity_label ?? a.entity_type}
                    {a.entity_id ? (
                      <span className="ml-1 font-mono text-[11px]">
                        {String(a.entity_id).slice(0, 8)}…
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{a.summary ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => setAuditDetail(a)}
                    >
                      Ver
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!audit.isLoading && !(audit.data?.items?.length) ? (
            <div className="p-4">
              <Empty message="Aún no hay eventos de auditoría." />
            </div>
          ) : null}
        </div>
        {(() => {
          const total = audit.data?.total ?? 0;
          const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
          if (total <= AUDIT_PAGE_SIZE) return null;
          return (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-muted-foreground">
                {total} eventos · página {auditPage + 1} de {pages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={auditPage <= 0 || audit.isFetching}
                  onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={auditPage + 1 >= pages || audit.isFetching}
                  onClick={() => setAuditPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          );
        })()}
      </SectionCard>

      <Dialog open={!!auditDetail} onOpenChange={(open) => !open && setAuditDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-primary">
              Detalle de auditoría
            </DialogTitle>
          </DialogHeader>
          {auditDetail ? (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">{auditDetail.summary}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Quién:</span> {auditDetail.actor_email ?? "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Cuándo:</span>{" "}
                  {auditDetail.created_at
                    ? `${shortDate(auditDetail.created_at)} ${time(auditDetail.created_at)}`
                    : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Acción:</span>{" "}
                  {auditDetail.action_label ?? auditDetail.action}
                </p>
                <p>
                  <span className="text-muted-foreground">Entidad:</span>{" "}
                  {auditDetail.entity_label ?? auditDetail.entity_type}
                </p>
              </div>
              {auditDetail.before_data ? (
                <div>
                  <p className="mb-1 font-medium text-primary">Antes</p>
                  <pre className="max-h-48 overflow-auto rounded-xl bg-secondary/60 p-3 text-xs">
                    {JSON.stringify(auditDetail.before_data, null, 2)}
                  </pre>
                </div>
              ) : null}
              {auditDetail.after_data ? (
                <div>
                  <p className="mb-1 font-medium text-primary">Después</p>
                  <pre className="max-h-48 overflow-auto rounded-xl bg-secondary/60 p-3 text-xs">
                    {JSON.stringify(auditDetail.after_data, null, 2)}
                  </pre>
                </div>
              ) : null}
              {auditDetail.meta ? (
                <div>
                  <p className="mb-1 font-medium text-primary">Meta</p>
                  <pre className="max-h-32 overflow-auto rounded-xl bg-secondary/60 p-3 text-xs">
                    {JSON.stringify(auditDetail.meta, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
