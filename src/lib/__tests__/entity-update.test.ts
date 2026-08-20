import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ownerListLabel,
  ownerToFormFields,
  petCardAgeText,
  petDetailLifeText,
  petToFormFields,
  replaceById,
} from "../entity-forms";
import { updateOwner, updatePet, type Owner, type Pet } from "../spa-queries";

const sampleOwner = (over: Partial<Owner> = {}): Owner => ({
  id: "owner-1",
  full_name: "Ana Pérez",
  document_type: "CC",
  document_id: "123",
  phone: "3001112222",
  whatsapp: "3001112222",
  email: "ana@example.com",
  address: "Calle 1",
  photo_url: null,
  city: "Bogotá",
  ...over,
});

const samplePet = (over: Partial<Pet> = {}): Pet => ({
  id: "pet-1",
  owner_id: "owner-1",
  name: "Kira",
  species: "perro",
  breed: "Criollo",
  breed_id: "breed-1",
  age_years: 2,
  life_date: "2024-01-01",
  life_date_kind: "birth",
  sex: "Hembra",
  weight_kg: 10,
  photo_url: null,
  allergies: null,
  vaccines: null,
  medical_notes: null,
  notes: null,
  owners_list: [sampleOwner()],
  ...over,
});

describe("entity-forms — mapeo y refresco de UI", () => {
  it("ownerToFormFields refleja el humano cargado", () => {
    const form = ownerToFormFields(sampleOwner({ full_name: "Nuevo", city: "Cali" }));
    expect(form.full_name).toBe("Nuevo");
    expect(form.city).toBe("Cali");
    expect(form.email).toBe("ana@example.com");
  });

  it("petToFormFields refleja life_date y humanos", () => {
    const form = petToFormFields(
      samplePet({
        life_date: "2020-06-15",
        life_date_kind: "home",
        weight_kg: 14.2,
      }),
    );
    expect(form.life_date).toBe("2020-06-15");
    expect(form.life_date_kind).toBe("home");
    expect(form.weight_kg).toBe("14.2");
    expect(form.owner_id_1).toBe("owner-1");
  });

  it("replaceById actualiza el listado como tras invalidateQueries", () => {
    const list = [sampleOwner(), sampleOwner({ id: "owner-2", full_name: "Otro" })];
    const updated = sampleOwner({ full_name: "Ana Editada", phone: "3110000000" });
    const next = replaceById(list, updated);
    expect(next.find((o) => o.id === "owner-1")?.full_name).toBe("Ana Editada");
    expect(next.find((o) => o.id === "owner-1")?.phone).toBe("3110000000");
    expect(next.find((o) => o.id === "owner-2")?.full_name).toBe("Otro");
  });

  it("textos de tarjeta/detalle cambian al modificar life_date", () => {
    const before = samplePet({ life_date: "2024-01-01", life_date_kind: "birth" });
    const after = samplePet({ life_date: "2019-03-01", life_date_kind: "home" });
    expect(petCardAgeText(before)).not.toBe(petCardAgeText(after));
    expect(petDetailLifeText(after)).toContain("Llegada a casa");
    expect(petDetailLifeText(after)).toContain("2019");
  });

  it("ownerListLabel refleja patch de contacto", () => {
    const before = ownerListLabel(sampleOwner());
    const after = ownerListLabel(
      sampleOwner({ full_name: "Ana Editada", phone: "399", email: "x@y.com" }),
    );
    expect(after).toContain("Ana Editada");
    expect(after).toContain("399");
    expect(after).toContain("x@y.com");
    expect(after).not.toBe(before);
  });
});

describe("spa-queries — updateOwner / updatePet envían PATCH y devuelven entidad actualizada", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("updateOwner PATCH y respuesta lista para refrescar UI", async () => {
    const updated = sampleOwner({ full_name: "Desde API", phone: "3009998888" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => updated,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateOwner("owner-1", {
      full_name: "Desde API",
      phone: "3009998888",
    });
    expect(result.full_name).toBe("Desde API");
    expect(result.phone).toBe("3009998888");

    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/owners/owner-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toMatchObject({
      full_name: "Desde API",
      phone: "3009998888",
    });

    const list = replaceById([sampleOwner()], result);
    expect(list[0].full_name).toBe("Desde API");
  });

  it("updatePet PATCH y listado de mascotas queda sincronizado", async () => {
    const updated = samplePet({
      name: "Kira Edit",
      weight_kg: 12.5,
      life_date: "2018-08-08",
      life_date_kind: "home",
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => updated,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await updatePet("pet-1", {
      name: "Kira Edit",
      weight_kg: 12.5,
      life_date: "2018-08-08",
      life_date_kind: "home",
    });
    expect(result.name).toBe("Kira Edit");
    expect(result.life_date_kind).toBe("home");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/pets/pet-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body)).name).toBe("Kira Edit");

    const cards = replaceById([samplePet(), samplePet({ id: "pet-2", name: "Toby" })], result);
    expect(cards.find((p) => p.id === "pet-1")?.name).toBe("Kira Edit");
    expect(petCardAgeText(cards.find((p) => p.id === "pet-1")!)).toContain("2018");
    expect(cards.find((p) => p.id === "pet-2")?.name).toBe("Toby");
  });
});
