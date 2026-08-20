/** Helpers de formularios / listados para mascotas y humanos de compañía. */

import type { Owner, Pet } from "./spa-queries";
import { ageLabelFromLifeDate, calendarDate, lifeDateKindLabel } from "./format";

export type OwnerFormFields = {
  full_name: string;
  document_type: string;
  document_id: string;
  legal_name: string;
  dv: string;
  tax_regime: string;
  fiscal_responsibilities: string;
  city: string;
  department: string;
  invoice_email: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  photo_url: string;
};

export type PetFormFields = {
  name: string;
  species: string;
  breed_id: string;
  sex: string;
  life_date: string;
  life_date_kind: "birth" | "home";
  weight_kg: string;
  photo_url: string;
  allergies: string;
  vaccines: string;
  medical_notes: string;
  notes: string;
  owner_id_1: string;
  owner_id_2: string;
};

export function ownerToFormFields(o: Owner): OwnerFormFields {
  return {
    full_name: o.full_name ?? "",
    document_type: o.document_type ?? "CC",
    document_id: o.document_id ?? "",
    legal_name: o.legal_name ?? "",
    dv: o.dv ?? "",
    tax_regime: o.tax_regime ?? "",
    fiscal_responsibilities: o.fiscal_responsibilities ?? "",
    city: o.city ?? "",
    department: o.department ?? "",
    invoice_email: o.invoice_email ?? "",
    phone: o.phone ?? "",
    whatsapp: o.whatsapp ?? "",
    email: o.email ?? "",
    address: o.address ?? "",
    photo_url: o.photo_url ?? "",
  };
}

export function petToFormFields(p: Pet): PetFormFields {
  const owners = (p.owners_list?.length ? p.owners_list : p.owners ? [p.owners] : []).filter(
    (o): o is NonNullable<typeof o> => !!o?.id,
  );
  return {
    name: p.name ?? "",
    species: p.species ?? "perro",
    breed_id: p.breed_id ?? "",
    sex: p.sex ?? "",
    life_date: p.life_date ? String(p.life_date).slice(0, 10) : "",
    life_date_kind: p.life_date_kind === "home" ? "home" : "birth",
    weight_kg: p.weight_kg != null ? String(p.weight_kg) : "",
    photo_url: p.photo_url ?? "",
    allergies: p.allergies ?? "",
    vaccines: p.vaccines ?? "",
    medical_notes: p.medical_notes ?? "",
    notes: p.notes ?? "",
    owner_id_1: owners[0]?.id ?? p.owner_id ?? "",
    owner_id_2: owners[1]?.id ?? "",
  };
}

/** Sustituye un ítem en la lista tras un PATCH exitoso (refresco de UI). */
export function replaceById<T extends { id: string }>(list: T[], updated: T): T[] {
  return list.map((item) => (item.id === updated.id ? updated : item));
}

export function petCardAgeText(p: Pick<Pet, "life_date" | "age_years">): string {
  if (p.life_date) {
    return `${ageLabelFromLifeDate(p.life_date)} · ${calendarDate(p.life_date)}`;
  }
  if (p.age_years != null) return `${p.age_years} años`;
  return "Fecha ?";
}

export function petDetailLifeText(p: Pick<Pet, "life_date" | "life_date_kind" | "age_years">): string {
  if (p.life_date) {
    return `${lifeDateKindLabel(p.life_date_kind)} ${calendarDate(p.life_date)} (${ageLabelFromLifeDate(p.life_date)})`;
  }
  if (p.age_years != null) return `${p.age_years} años`;
  return "Edad ?";
}

export function ownerListLabel(o: Pick<Owner, "full_name" | "phone" | "email">): string {
  return `${o.full_name} · ${o.phone ?? "—"} · ${o.email ?? "—"}`;
}
