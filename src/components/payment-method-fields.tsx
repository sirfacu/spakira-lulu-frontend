import { useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadPhoto, resolveMediaUrl } from "@/lib/api";
import type { PaymentMethod } from "@/lib/spa-queries";

type Props = {
  methods: PaymentMethod[];
  methodCode: string;
  onMethodChange: (code: string) => void;
  evidenceUrl: string;
  onEvidenceUrl: (url: string) => void;
  disabled?: boolean;
};

export function PaymentMethodFields({
  methods,
  methodCode,
  onMethodChange,
  evidenceUrl,
  onEvidenceUrl,
  disabled,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const selected = methods.find((m) => m.code === methodCode);
  const needsEvidence = Boolean(selected?.require_evidence);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadPhoto(file);
      onEvidenceUrl(up.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la evidencia");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Medio de pago</Label>
        <Select value={methodCode || undefined} onValueChange={onMethodChange} disabled={disabled}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Elegí cómo pagó" />
          </SelectTrigger>
          <SelectContent>
            {methods.map((m) => (
              <SelectItem key={m.code} value={m.code}>
                {m.label}
                {m.require_evidence ? " · con evidencia" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsEvidence ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-3">
          <p className="text-xs text-muted-foreground">
            {selected?.label} requiere foto del comprobante (captura o archivo).
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              disabled={disabled || uploading}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              Adjuntar archivo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              disabled={disabled || uploading}
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" />
              {uploading ? "Subiendo…" : "Abrir cámara"}
            </Button>
          </div>
          {evidenceUrl ? (
            <div className="relative mt-3 inline-block">
              <img
                src={resolveMediaUrl(evidenceUrl)}
                alt="Evidencia de pago"
                className="h-24 w-24 rounded-xl object-cover ring-1 ring-border"
              />
              <button
                type="button"
                className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-background text-destructive shadow-soft ring-1 ring-border"
                onClick={() => onEvidenceUrl("")}
                aria-label="Quitar evidencia"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
