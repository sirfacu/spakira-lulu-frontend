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
import {
  listEmailTemplates,
  saveEmailTemplate,
  previewEmailTemplate,
  getMailSettings,
  putMailSettings,
  type EmailTemplate,
} from "@/lib/spa-queries";

export function MailConfigPanel() {
  const qc = useQueryClient();
  const mail = useQuery({ queryKey: ["mail-settings"], queryFn: getMailSettings });
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [userSmtp, setUserSmtp] = useState("");
  const [from, setFrom] = useState("");
  const [tls, setTls] = useState(true);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!mail.data) return;
    setHost(mail.data.smtp_host || "");
    setPort(String(mail.data.smtp_port || 587));
    setUserSmtp(mail.data.smtp_user || "");
    setFrom(mail.data.smtp_from || "");
    setTls(!!mail.data.smtp_tls);
    setPassword("");
  }, [mail.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      putMailSettings({
        smtp_host: host.trim(),
        smtp_port: Number(port) || 587,
        smtp_user: userSmtp.trim(),
        smtp_from: from.trim(),
        smtp_tls: tls,
        ...(password.trim() ? { smtp_password: password.trim() } : {}),
      }),
    onSuccess: async (res) => {
      toast.success("Correo guardado");
      if (res.backup) toast.message(`Backup: ${res.backup}`);
      setPassword("");
      await qc.invalidateQueries({ queryKey: ["mail-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (mail.isLoading) {
    return <KiraLoader variant="inline" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Valores efectivos (fuente: <code>{mail.data?.source}</code>
        {mail.data?.smtp_configured ? " · SMTP listo" : " · SMTP incompleto"}). La contraseña nunca
        se muestra; dejá el campo vacío para no cambiarla.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>SMTP host</Label>
          <Input className="h-11 rounded-xl" value={host} onChange={(e) => setHost(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Puerto</Label>
          <Input className="h-11 rounded-xl" value={port} onChange={(e) => setPort(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>TLS</Label>
          <div className="flex h-11 items-center gap-2">
            <Switch checked={tls} onCheckedChange={setTls} />
            <span className="text-sm text-muted-foreground">{tls ? "Activado" : "Desactivado"}</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Usuario (cuenta real)</Label>
          <Input
            className="h-11 rounded-xl"
            value={userSmtp}
            onChange={(e) => setUserSmtp(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>From (alias visible)</Label>
          <Input className="h-11 rounded-xl" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>
            Password {mail.data?.password_set ? "(•••• configurada — opcional cambiar)" : ""}
          </Label>
          <Input
            type="password"
            className="h-11 rounded-xl"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mail.data?.password_set ? "Dejar vacío para no cambiar" : "App Password"}
            autoComplete="new-password"
          />
        </div>
      </div>
      <Button
        className="rounded-xl"
        disabled={saveMut.isPending}
        onClick={() => saveMut.mutate()}
      >
        Guardar correo
      </Button>
    </div>
  );
}

export function EmailTemplatesPanel() {
  const qc = useQueryClient();
  const templates = useQuery({
    queryKey: ["email-templates"],
    queryFn: listEmailTemplates,
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
    setPreview(null);
  }, [selected?.key, selected?.updated_at]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveEmailTemplate(selected!.key, {
        name: selected!.name,
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
      }),
    onSuccess: async () => {
      toast.success("Plantilla guardada");
      await qc.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
                {t.name}
              </button>
            </li>
          ))}
        </ul>
        <p className="pt-3 text-[11px] text-muted-foreground">
          Variables con doble llave, p. ej. {"{{mascota}}"}. Se reemplazan al enviar.
        </p>
      </div>

      {selected ? (
        <div className="space-y-4">
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
          </div>
          {preview ? (
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preview
              </p>
              <p className="mt-2 font-medium">{preview.subject}</p>
              <div
                className="prose prose-sm mt-3 max-w-none rounded-xl bg-secondary/40 p-3 text-sm"
                dangerouslySetInnerHTML={{ __html: preview.body_html }}
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
