import { Bold, CaseUpper, Italic } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  IDENTITY_COLOR_TOKENS,
  IDENTITY_FONTS,
  identityInputClassName,
  identityLineColorStyle,
  isIdentityColorToken,
  type IdentityLineStyle,
} from "@/lib/identity-styles";
import { cn } from "@/lib/utils";

type Props = {
  value: IdentityLineStyle;
  onChange: (next: IdentityLineStyle) => void;
  disabled?: boolean;
};

type FieldProps = {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  style: IdentityLineStyle;
  onStyleChange: (next: IdentityLineStyle) => void;
  maxLength: number;
  placeholder?: string;
  disabled?: boolean;
  multiline?: boolean;
};

/** Barra de estilo solo visible mientras el campo (o la barra) tiene foco. */
export function IdentityStyledField({
  label,
  hint,
  value,
  onChange,
  style,
  onStyleChange,
  maxLength,
  placeholder,
  disabled,
  multiline = false,
}: FieldProps) {
  const fieldId = `identity-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const fieldClass = cn(
    "rounded-xl",
    multiline ? "min-h-28" : "h-11",
    identityInputClassName(style),
  );
  const fieldStyle = identityLineColorStyle(style);

  return (
    <div className="group space-y-2">
      <Label htmlFor={fieldId}>{label}</Label>
      {multiline ? (
        <Textarea
          id={fieldId}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
          style={fieldStyle}
          placeholder={placeholder}
          disabled={disabled}
        />
      ) : (
        <Input
          id={fieldId}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
          style={fieldStyle}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}
      <div
        className="hidden group-focus-within:block"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest("input[type=color]")) return;
          e.preventDefault();
        }}
      >
        <IdentityStyleBar value={style} onChange={onStyleChange} disabled={disabled} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {hint} {value.length}/{maxLength}
      </p>
    </div>
  );
}

export function IdentityStyleBar({ value, onChange, disabled }: Props) {
  const customColor = isIdentityColorToken(value.color) ? "#888888" : value.color;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {IDENTITY_FONTS.map((font) => {
          const selected = value.font === font.id;
          return (
            <button
              key={font.id}
              type="button"
              disabled={disabled}
              title={font.sample}
              onClick={() => onChange({ ...value, font: font.id })}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-sm transition",
                font.className,
                selected
                  ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                  : "border-border text-muted-foreground hover:border-primary/40",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              {font.label}
            </button>
          );
        })}
        <span className="mx-1 h-5 w-px bg-border" />
        <Toggle
          size="sm"
          variant="outline"
          pressed={value.bold}
          disabled={disabled}
          aria-label="Negrita"
          title="Negrita"
          onPressedChange={(pressed) => onChange({ ...value, bold: pressed })}
        >
          <Bold />
        </Toggle>
        <Toggle
          size="sm"
          variant="outline"
          pressed={value.italic}
          disabled={disabled}
          aria-label="Cursiva"
          title="Cursiva"
          onPressedChange={(pressed) => onChange({ ...value, italic: pressed })}
        >
          <Italic />
        </Toggle>
        <Toggle
          size="sm"
          variant="outline"
          pressed={value.uppercase}
          disabled={disabled}
          aria-label="Mayúsculas"
          title="Mayúsculas en el menú"
          onPressedChange={(pressed) => onChange({ ...value, uppercase: pressed })}
        >
          <CaseUpper />
        </Toggle>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {IDENTITY_COLOR_TOKENS.map((token) => {
          const selected = value.color === token.id;
          return (
            <button
              key={token.id}
              type="button"
              disabled={disabled}
              title={token.label}
              aria-label={token.label}
              onClick={() => onChange({ ...value, color: token.id })}
              className={cn(
                "h-6 w-6 rounded-full border border-black/10",
                selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                disabled && "cursor-not-allowed opacity-50",
              )}
              style={{ background: token.swatch }}
            />
          );
        })}
        <label
          className={cn(
            "relative h-6 w-6 overflow-hidden rounded-full border border-dashed border-border",
            !isIdentityColorToken(value.color) && "ring-2 ring-primary ring-offset-2 ring-offset-background",
            disabled && "cursor-not-allowed opacity-50",
          )}
          title="Color personalizado"
        >
          <span className="absolute inset-0" style={{ background: customColor }} />
          <input
            type="color"
            disabled={disabled}
            value={customColor}
            aria-label="Color personalizado"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => onChange({ ...value, color: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
