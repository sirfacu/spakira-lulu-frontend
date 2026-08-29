import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { clearMeCache } from "@/lib/api";
import { requirePathAccess } from "@/lib/route-access";
import { homeForRole, permissionsFor } from "@/lib/roles";
import { fetchMyOwner, updateMyOwner } from "@/lib/spa-queries";

export const Route = createFileRoute("/_authenticated/panel/completar")({
  beforeLoad: requirePathAccess("/panel/completar"),
  head: () => ({
    meta: [{ title: "Completar tus datos | Spa Kira" }],
  }),
  component: CompletarPerfil,
});

const DOC_TYPES = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "NIT", label: "NIT" },
  { value: "PAS", label: "Pasaporte" },
  { value: "TI", label: "Tarjeta de identidad" },
] as const;

function CompletarPerfil() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState("CC");
  const [documentId, setDocumentId] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permissionsFor(user?.role).isCliente) {
      void navigate({ to: homeForRole(user?.role), replace: true });
      return;
    }
    void fetchMyOwner()
      .then((o) => {
        setFullName(o.full_name ?? "");
        setPhone(o.phone ?? "");
        setAddress(o.address ?? "");
        setWhatsapp(o.whatsapp ?? "");
        setDocumentType((o.document_type || "CC").toUpperCase());
        setDocumentId(o.document_id ?? "");
      })
      .catch(() => {
        /* ficha nueva vacía */
      });
  }, [user?.role, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    const doc = documentId.replace(/[^a-zA-Z0-9]/g, "");
    if (digits.length < 8) {
      toast.error("El teléfono es obligatorio (mínimo 8 dígitos)");
      return;
    }
    if (address.trim().length < 8) {
      toast.error("La dirección es obligatoria");
      return;
    }
    if (doc.length < 5) {
      toast.error("La cédula / documento es obligatorio");
      return;
    }
    setLoading(true);
    try {
      await updateMyOwner({
        full_name: fullName.trim() || undefined,
        phone: phone.trim(),
        address: address.trim(),
        whatsapp: whatsapp.trim() || undefined,
        document_type: documentType,
        document_id: documentId.trim(),
      });
      clearMeCache();
      toast.success("Datos guardados. Ahora registrá a tu peludito.");
      await navigate({ to: "/panel/mascotas", search: { alta: true }, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell
      title="Tus datos"
      subtitle="Paso 1: tus datos (cédula incluida). Después creás la mascota."
    >
      <form onSubmit={submit} className="card-soft mx-auto max-w-lg space-y-4 p-6">
        <p className="text-sm text-muted-foreground">
          1 de 2 · Completá tu información. El siguiente paso es crear tu mascota.
        </p>
        <div className="space-y-2">
          <Label htmlFor="fullName">Nombre</Label>
          <Input
            id="fullName"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-12 rounded-xl"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="documentType">Tipo de documento</Label>
            <select
              id="documentType"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="flex h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="documentId">Cédula / documento</Label>
            <Input
              id="documentId"
              required
              minLength={5}
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              placeholder="Número"
              className="h-12 rounded-xl"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            required
            minLength={8}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="3001234567"
            className="h-12 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsapp">WhatsApp (opcional)</Label>
          <Input
            id="whatsapp"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="Si es distinto al teléfono"
            className="h-12 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Dirección</Label>
          <Textarea
            id="address"
            required
            minLength={8}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Calle, barrio, ciudad"
            className="min-h-[5rem] rounded-xl"
          />
        </div>
        <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl">
          {loading ? "Guardando…" : "Guardar y crear mascota"}
        </Button>
      </form>
    </AppShell>
  );
}
