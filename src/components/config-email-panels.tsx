import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Empty } from "@/components/ui-kit";
import { KiraLoader } from "@/components/kira-loader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { sanitizePreviewHtml } from "@/lib/sanitize-html";
import {
  listEmailTemplates,
  saveEmailTemplate,
  previewEmailTemplate,
  patchEmailTemplateEnabled,
  createEmailTemplate,
  deleteEmailTemplate,
  getMailSettings,
  putMailSettings,
  sendMailTest,
  type EmailTemplate,
} from "@/lib/spa-queries";
import { allowsFromAlias, consumerMailHint, extractEmailAddress } from "@/lib/mail-account";

const DELIVERY_REASON_LABEL: Record<string, string> = {
  deshabilitado_en_panel: "envío desactivado",
  mail_log_only: "bloqueado por el servidor",
  smtp_incompleto: "faltan datos del correo",
};

export function MailConfigPanel() {
  const qc = useQueryClient();
  const mail = useQuery({ queryKey: ["mail-settings"], queryFn: getMailSettings });
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [userSmtp, setUserSmtp] = useState("");
  const [from, setFrom] = useState("");
  const [tls, setTls] = useState(true);
  const [password, setPassword] = useState("");
  const [sendingEnabled, setSendingEnabled] = useState(true);
  const [testTo, setTestTo] = useState("");

  const fromAliasAllowed = useMemo(() => allowsFromAlias(userSmtp), [userSmtp]);
  const providerHint = useMemo(() => consumerMailHint(userSmtp), [userSmtp]);

  useEffect(() => {
    if (!mail.data) return;
    setHost(mail.data.smtp_host || "");
    setPort(String(mail.data.smtp_port || 587));
    setUserSmtp(mail.data.smtp_user || "");
    setFrom(mail.data.smtp_from || "");
    setTls(!!mail.data.smtp_tls);
    setSendingEnabled(mail.data.sending_enabled !== false);
    setPassword("");
  }, [mail.data]);

  useEffect(() => {
    if (fromAliasAllowed) return;
    const account = extractEmailAddress(userSmtp);
    if (account) setFrom(account);
  }, [fromAliasAllowed, userSmtp]);

  const saveMut = useMutation({
    mutationFn: () => {
      const account = extractEmailAddress(userSmtp);
      const smtpFrom = fromAliasAllowed ? from.trim() : account || from.trim();
      return putMailSettings({
        smtp_host: host.trim(),
        smtp_port: Number(port) || 587,
        smtp_user: userSmtp.trim(),
        smtp_from: smtpFrom,
        smtp_tls: tls,
        sending_enabled: sendingEnabled,
        ...(password.trim() ? { smtp_password: password.trim() } : {}),
      });
    },
    onSuccess: async (res) => {
      toast.success("Configuración de correo guardada");
      if (res.backup) toast.message("Se guardó una copia de seguridad");
      setPassword("");
      await qc.invalidateQueries({ queryKey: ["mail-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSendMut = useMutation({
    mutationFn: (enabled: boolean) => putMailSettings({ sending_enabled: enabled }),
    onSuccess: async (res) => {
      setSendingEnabled(res.sending_enabled !== false);
      toast.success(
        res.sending_enabled !== false
          ? "Los correos del spa ya se pueden enviar"
          : "El envío de correos quedó pausado",
      );
      await qc.invalidateQueries({ queryKey: ["mail-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: () =>
      sendMailTest({
        ...(testTo.trim() ? { to: testTo.trim() } : {}),
        template_key: "appointment_created",
      }),
    onSuccess: (res) => {
      toast.success(`Listo: enviamos la prueba a ${res.to}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (mail.isLoading) {
    return <KiraLoader variant="inline" />;
  }

  const deliveryActive = !!mail.data?.delivery_active;
  const blockedLabels = (mail.data?.delivery_blocked_reasons || []).map(
    (r) => DELIVERY_REASON_LABEL[r] || r,
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <Label className="text-base">Envío de correos</Label>
            <p className="text-sm text-muted-foreground">
              Activá o pausá los mensajes automáticos del spa (citas, facturas y cancelaciones).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={sendingEnabled}
              disabled={toggleSendMut.isPending}
              onCheckedChange={(v) => {
                setSendingEnabled(v);
                toggleSendMut.mutate(v);
              }}
            />
            <span className="text-sm font-medium">
              {sendingEnabled ? "Activo" : "Pausado"}
            </span>
          </div>
        </div>
        <p
          className={`text-sm ${deliveryActive ? "text-emerald-700 dark:text-emerald-400" : "text-amber-800 dark:text-amber-300"}`}
        >
          {deliveryActive
            ? "Ahora mismo los correos se están enviando."
            : `Ahora mismo no se envían${blockedLabels.length ? ` (${blockedLabels.join(", ")})` : ""}.`}
        </p>
      </div>

      <div className="rounded-xl border border-border/70 p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-base">Probar envío</Label>
          <p className="text-sm text-muted-foreground">
            Te mandamos un mensaje de ejemplo (confirmación de cita) para verificar que todo llega
            bien. Si no escribís un destino, lo enviamos a tu correo de administrador.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-2 flex-1 min-w-0">
            <Label>Correo de destino (opcional)</Label>
            <Input
              className="h-11 rounded-xl"
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="tu@correo.com"
            />
          </div>
          <Button
            type="button"
            className="rounded-xl h-11 shrink-0"
            disabled={testMut.isPending || !sendingEnabled || !deliveryActive}
            onClick={() => testMut.mutate()}
          >
            {testMut.isPending ? "Enviando…" : "Enviar prueba"}
          </Button>
        </div>
        {!sendingEnabled || !deliveryActive ? (
          <p className="text-xs text-muted-foreground">
            Activá el envío y completá los datos de la cuenta para poder probar.
          </p>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        Datos de la cuenta que usa el spa para enviar correos.
        {mail.data?.password_set
          ? " La contraseña ya está guardada; dejá el campo vacío si no querés cambiarla."
          : " Completá también la contraseña de la cuenta."}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Servidor de correo</Label>
          <Input
            className="h-11 rounded-xl"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="ej. smtp.tudominio.com"
          />
        </div>
        <div className="space-y-2">
          <Label>Puerto</Label>
          <Input className="h-11 rounded-xl" value={port} onChange={(e) => setPort(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Conexión segura</Label>
          <div className="flex h-11 items-center gap-2">
            <Switch checked={tls} onCheckedChange={setTls} />
            <span className="text-sm text-muted-foreground">{tls ? "Activada" : "Desactivada"}</span>
          </div>
        </div>
        <div className={`space-y-2 ${fromAliasAllowed ? "" : "sm:col-span-2"}`}>
          <Label>Cuenta de correo</Label>
          <Input
            className="h-11 rounded-xl"
            value={userSmtp}
            onChange={(e) => setUserSmtp(e.target.value)}
            placeholder="cuenta@tudominio.com"
          />
        </div>
        {fromAliasAllowed ? (
          <div className="space-y-2">
            <Label>Remitente visible (alias)</Label>
            <Input
              className="h-11 rounded-xl"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder={'Spa Kira <hola@tudominio.com>'}
            />
            <p className="text-xs text-muted-foreground">
              Con un correo de tu dominio podés mostrar un nombre o dirección distinta a la cuenta
              de envío.
            </p>
          </div>
        ) : (
          <div className="space-y-2 sm:col-span-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-sm text-muted-foreground">
              {providerHint ||
                "Con cuentas como Gmail, Hotmail u Outlook el remitente tiene que ser la misma cuenta. El alias solo se puede usar con un correo de tu dominio (por ejemplo @e-mac.co)."}
            </p>
          </div>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label>
            Contraseña
            {mail.data?.password_set ? " (ya guardada — opcional cambiar)" : ""}
          </Label>
          <Input
            type="password"
            className="h-11 rounded-xl"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              mail.data?.password_set ? "Dejar vacío para no cambiar" : "Contraseña de la cuenta"
            }
            autoComplete="new-password"
          />
        </div>
      </div>
      <Button
        className="rounded-xl"
        disabled={saveMut.isPending}
        onClick={() => saveMut.mutate()}
      >
        Guardar configuración
      </Button>
    </div>
  );
}

export function EmailTemplatesPanel({
  module,
  allowCreate = true,
  intro,
}: {
  module?: string;
  allowCreate?: boolean;
  intro?: string;
} = {}) {
  const qc = useQueryClient();
  const templates = useQuery({
    queryKey: ["email-templates", module || "core"],
    queryFn: () => listEmailTemplates(module),
  });
  const items = templates.data?.items ?? [];
  const variables = templates.data?.variables ?? [];
  const [selectedKey, setSelectedKey] = useState<string>("appointment_created");
  const selected = useMemo(
    () => items.find((t) => t.key === selectedKey) ?? items[0] ?? null,
    [items, selectedKey],
  );
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [title, setTitle] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<EmailTemplate | null>(null);
  const [preview, setPreview] = useState<{
    subject: string;
    body_html: string;
    body_text: string;
  } | null>(null);

  useEffect(() => {
    if (!selected) return;
    setSubject(selected.subject);
    setBodyHtml(selected.body_html);
    setBodyText(selected.body_text);
    setTitle(selected.name);
    setEnabled(selected.enabled !== false);
    setPreview(null);
  }, [selected?.key, selected?.updated_at, selected?.enabled, selected?.name]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveEmailTemplate(selected!.key, {
        name: title.trim() || selected!.name,
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
        enabled,
      }),
    onSuccess: async () => {
      toast.success("Plantilla guardada");
      await qc.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (next: boolean) => patchEmailTemplateEnabled(selected!.key, next),
    onSuccess: async (res) => {
      setEnabled(res.enabled !== false);
      toast.success(
        res.enabled !== false ? "Este correo se enviará" : "Este correo no se enviará",
      );
      await qc.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: () => createEmailTemplate("Nueva plantilla"),
    onSuccess: async (created) => {
      toast.success("Plantilla creada");
      await qc.invalidateQueries({ queryKey: ["email-templates"] });
      setSelectedKey(created.key);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (key: string) => deleteEmailTemplate(key),
    onSuccess: async (_, key) => {
      toast.success("Plantilla eliminada");
      setPendingDelete(null);
      if (selectedKey === key) setSelectedKey("appointment_created");
      await qc.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const askDelete = (t: EmailTemplate | null) => {
    if (!t || t.system !== false) {
      toast.message("Las de sistema no se borran. Apagalas con el interruptor si no querés enviarlas.");
      return;
    }
    setPendingDelete(t);
  };

  const previewMut = useMutation({
    mutationFn: () =>
      previewEmailTemplate(selected!.key, {
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
      }),
    onSuccess: (res) => setPreview(res),
    onError: (e: Error) => toast.error(e.message),
  });

  const insertVar = (v: string) => {
    const token = `{{${v}}}`;
    setBodyHtml((h) => `${h}${h.endsWith("\n") || !h ? "" : "\n"}${token}`);
  };

  if (templates.isLoading) {
    return <KiraLoader variant="inline" />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Plantillas
        </p>
        {intro ? <p className="text-xs text-muted-foreground">{intro}</p> : null}
        <ul className="space-y-1">
          {items.map((t: EmailTemplate) => (
            <li key={t.key}>
              <button
                type="button"
                onClick={() => setSelectedKey(t.key)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                  selected?.key === t.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/60 text-foreground hover:bg-secondary"
                }`}
              >
                <span className="block">{t.name}</span>
                {t.enabled === false ? (
                  <span
                    className={`mt-0.5 block text-[11px] ${
                      selected?.key === t.key ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}
                  >
                    No se envía
                  </span>
                ) : null}
              </button>
            </li>
          ))}
          {allowCreate ? (
          <li>
            <button
              type="button"
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
              aria-label="Agregar plantilla"
              className="flex w-full items-center justify-center rounded-xl bg-secondary/60 px-3 py-2 text-foreground hover:bg-secondary disabled:opacity-50"
            >
              <Plus className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </li>
          ) : null}
        </ul>
        <p className="pt-3 text-[11px] text-muted-foreground">
          El interruptor de cada plantilla decide si el mensaje sale. Variables con doble llave,
          p. ej. {"{{mascota}}"}.
        </p>
      </div>

      {selected ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Enviar este correo</p>
              <p className="text-xs text-muted-foreground">
                {selected.system === false
                  ? "Plantilla extra: se guarda acá. Las citas y facturas siguen usando las cuatro de sistema."
                  : enabled
                    ? "Si está apagado, no se manda ese aviso (cita, factura, etc.)."
                    : "Apagado: no se envía, el texto se conserva."}
              </p>
            </div>
            <Switch
              checked={enabled}
              disabled={toggleMut.isPending}
              onCheckedChange={(next) => toggleMut.mutate(next)}
              aria-label="Enviar este correo"
            />
          </div>
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              className="h-11 rounded-xl"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre en la lista"
            />
          </div>
          <div className="space-y-2">
            <Label>Asunto</Label>
            <Input
              className="h-11 rounded-xl"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Cuerpo HTML</Label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {variables.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVar(v)}
                  className="rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:border-accent hover:text-foreground"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
            <Textarea
              className="min-h-[220px] rounded-xl font-mono text-xs"
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Cuerpo texto (fallback)</Label>
            <Textarea
              className="min-h-[120px] rounded-xl font-mono text-xs"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-xl"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              Guardar plantilla
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={previewMut.isPending}
              onClick={() => previewMut.mutate()}
            >
              Vista previa
            </Button>
            {allowCreate ? (
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={deleteMut.isPending}
              onClick={() => askDelete(selected)}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Eliminar
            </Button>
            ) : null}
          </div>
          <ConfirmDialog
            open={pendingDelete != null}
            title="¿Eliminar esta plantilla?"
            description={
              pendingDelete
                ? `Se va a borrar «${pendingDelete.name}». Las de cita y factura no se pueden eliminar.`
                : undefined
            }
            pending={deleteMut.isPending}
            onConfirm={() => {
              if (pendingDelete) deleteMut.mutate(pendingDelete.key);
            }}
            onOpenChange={(open) => {
              if (!open) setPendingDelete(null);
            }}
          />
          {preview ? (
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preview
              </p>
              <p className="mt-2 font-medium">{preview.subject}</p>
              <div
                className="prose prose-sm mt-3 max-w-none rounded-xl bg-secondary/40 p-3 text-sm"
                dangerouslySetInnerHTML={{ __html: sanitizePreviewHtml(preview.body_html) }}
              />
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-card p-3 text-[11px] text-muted-foreground">
                {preview.body_text}
              </pre>
            </div>
          ) : null}
        </div>
      ) : (
        <Empty message="No hay plantillas." />
      )}
    </div>
  );
}
