import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionCard } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { LoyaltyCard } from "@/components/loyalty-card";
import {
  fetchMyOwner,
  updateMyOwner,
  getMyMailPrefs,
  putMyMailPrefs,
  type MailPrefItem,
} from "@/lib/spa-queries";

export function UserSelfProfile() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["owners-me"], queryFn: fetchMyOwner });
  const prefs = useQuery({ queryKey: ["mail-prefs"], queryFn: getMyMailPrefs });
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [documentType, setDocumentType] = useState("CC");
  const [documentId, setDocumentId] = useState("");
  const [items, setItems] = useState<MailPrefItem[]>([]);

  useEffect(() => {
    if (!me.data) return;
    setFullName(me.data.full_name || "");
    setPhone(me.data.phone || "");
    setWhatsapp(me.data.whatsapp || "");
    setAddress(me.data.address || "");
    setDocumentType((me.data.document_type || "CC").toUpperCase());
    setDocumentId(me.data.document_id || "");
  }, [me.data]);

  useEffect(() => {
    if (prefs.data?.items) setItems(prefs.data.items);
  }, [prefs.data]);

  const saveProfile = useMutation({
    mutationFn: () =>
      updateMyOwner({
        full_name: fullName.trim(),
        phone,
        whatsapp,
        address,
        document_type: documentType,
        document_id: documentId,
      }),
    onSuccess: async () => {
      toast.success("Datos actualizados");
      await qc.invalidateQueries({ queryKey: ["owners-me"] });
      await qc.invalidateQueries({ queryKey: ["auth-me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePrefs = useMutation({
    mutationFn: () => putMyMailPrefs(items.map((i) => ({ key: i.key, enabled: i.enabled }))),
    onSuccess: async (res) => {
      toast.success("Notificaciones guardadas");
      setItems(res.items);
      await qc.invalidateQueries({ queryKey: ["mail-prefs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6">
      <SectionCard title="Mis datos">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nombre</Label>
            <Input className="h-11 rounded-xl" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tipo de documento</Label>
            <select
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
            >
              {["CC", "CE", "NIT", "PAS", "TI"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Documento</Label>
            <Input className="h-11 rounded-xl" value={documentId} onChange={(e) => setDocumentId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input className="h-11 rounded-xl" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input className="h-11 rounded-xl" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Dirección</Label>
            <Input className="h-11 rounded-xl" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        <Button className="mt-4 rounded-xl" disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()}>
          Guardar datos
        </Button>
      </SectionCard>

      {me.data?.id ? <LoyaltyCard customerId={me.data.id} self /> : null}

      <SectionCard title="Notificaciones por correo">
        <p className="mb-4 text-sm text-muted-foreground">
          Elegí qué correos querés recibir. Si el spa apaga una plantilla, no se envía aunque esté activa acá.
        </p>
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">{item.name}</p>
                {!item.template_enabled ? (
                  <p className="text-xs text-muted-foreground">El spa tiene este correo desactivado.</p>
                ) : null}
              </div>
              <Switch
                checked={item.enabled}
                onCheckedChange={(v) =>
                  setItems((prev) => prev.map((p) => (p.key === item.key ? { ...p, enabled: v } : p)))
                }
              />
            </li>
          ))}
        </ul>
        <Button className="mt-4 rounded-xl" disabled={savePrefs.isPending} onClick={() => savePrefs.mutate()}>
          Guardar notificaciones
        </Button>
      </SectionCard>
    </div>
  );
}
