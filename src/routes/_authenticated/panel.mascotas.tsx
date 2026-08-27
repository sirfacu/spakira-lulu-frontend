import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useRouteContext, useSearch } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  Cake,
  Weight,
  Scissors,
  CalendarClock,
  X,
  Plus,
  Pencil,
  Trash2,
  ImagePlus,
  Loader2,
  GripVertical,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BreedsManager } from "@/components/breeds-manager";
import { BreedPickerList } from "@/components/breed-select";
import { Empty, StatusPill } from "@/components/ui-kit";
import { KiraLoader } from "@/components/kira-loader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ReorderList } from "@/components/reorder-list";
import {
  appointmentsQuery,
  ownersQuery,
  breedsQuery,
  petHistoryQuery,
  petsInfiniteQuery,
  createPet,
  updatePet,
  deletePet,
  createOwner,
  reorderPets,
  type Pet,
} from "@/lib/spa-queries";
import { shortDate, statusMeta, time, cop, ageLabelFromLifeDate } from "@/lib/format";
import { requirePathAccess } from "@/lib/route-access";
import { permissionsFor } from "@/lib/roles";
import { uploadPhoto, resolveMediaUrl } from "@/lib/api";
import { petCardAgeText, petDetailLifeText, petToFormFields } from "@/lib/entity-forms";
import { cn } from "@/lib/utils";

/** Placeholder cuando la mascota no tiene foto (escala de gris). */
const PET_PLACEHOLDER = "/images/kira-face-grey.png";

function peluditLabel(sex: string | null | undefined) {
  const s = (sex ?? "").toLowerCase();
  if (s.includes("hembra") || s === "f" || s === "female") return "peludita";
  if (s.includes("macho") || s === "m" || s === "male") return "peludito";
  return "peludit@";
}

const SEX_OPTIONS = ["Hembra", "Macho"] as const;

function normalizePetSex(sex: string | null | undefined): string {
  const s = (sex ?? "").trim();
  const low = s.toLowerCase();
  if (low.includes("hembra") || low === "f" || low === "female") return "Hembra";
  if (low.includes("macho") || low === "m" || low === "male") return "Macho";
  return s;
}

export const Route = createFileRoute("/_authenticated/panel/mascotas")({
  beforeLoad: requirePathAccess("/panel/mascotas"),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === "razas" ? ("razas" as const) : ("fichas" as const),
  }),
  head: () => ({
    meta: [
      { title: "Mascotas | Spa Kira" },
      {
        name: "description",
        content:
          "Fichas de mascotas con raza, edad, peso, alergias, vacunas e historial de baños en Spa Kira.",
      },
      { property: "og:title", content: "Mascotas | Spa Kira" },
      { property: "og:description", content: "Fichas completas de cada mascota del spa." },
    ],
  }),
  component: Mascotas,
});

type PetForm = {
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

const emptyForm = (): PetForm => ({
  ...petToFormFields({
    id: "",
    owner_id: null,
    name: "",
    species: "perro",
    breed: null,
    age_years: null,
    sex: "Hembra",
    weight_kg: null,
    photo_url: null,
    allergies: null,
    vaccines: null,
    medical_notes: null,
    notes: null,
  }),
  sex: "Hembra",
});

function petToForm(p: Pet): PetForm {
  return { ...petToFormFields(p) };
}

function Mascotas() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const navigate = useNavigate();
  const perms = permissionsFor(user?.role);
  const { tab } = useSearch({ from: "/_authenticated/panel/mascotas" });
  const showRazas = perms.isAdmin;
  const activeTab = showRazas && tab === "razas" ? "razas" : "fichas";
  const setTab = (next: "fichas" | "razas") => {
    void navigate({
      to: "/panel/mascotas",
      search: next === "razas" ? { tab: "razas" } : { tab: "fichas" },
      replace: true,
    });
  };
  const qc = useQueryClient();
  const appts = useQuery(appointmentsQuery);
  const owners = useQuery(ownersQuery);
  const breeds = useQuery(breedsQuery);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [selected, setSelected] = useState<Pet | null>(null);
  const [editing, setEditing] = useState<Pet | null | "new">(null);
  const [form, setForm] = useState<PetForm>(emptyForm());
  const [ownerSplash, setOwnerSplash] = useState(false);
  const [ownerDraft, setOwnerDraft] = useState({
    full_name: "",
    document_type: "CC",
    document_id: "",
    phone: "",
    whatsapp: "",
    email: "",
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [welcomePet, setWelcomePet] = useState<Pet | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ name: string; id: string } | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const ownersList = owners.data ?? [];
  const hasOwners = ownersList.length > 0;

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const petsInfinite = useInfiniteQuery(petsInfiniteQuery(qDebounced));
  const list = useMemo(
    () => (petsInfinite.data?.pages ?? []).flatMap((page) => page.items),
    [petsInfinite.data],
  );
  const [orderedList, setOrderedList] = useState<Pet[]>([]);
  useEffect(() => {
    setOrderedList(list);
  }, [list]);
  const totalPets = petsInfinite.data?.pages[0]?.total ?? list.length;

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((e) => e.isIntersecting) &&
          petsInfinite.hasNextPage &&
          !petsInfinite.isFetchingNextPage
        ) {
          void petsInfinite.fetchNextPage();
        }
      },
      { rootMargin: "240px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [
    petsInfinite.hasNextPage,
    petsInfinite.isFetchingNextPage,
    petsInfinite.fetchNextPage,
    list.length,
  ]);

  const onPickPhoto = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Elegí una imagen (JPG, PNG, WEBP o GIF)");
      return;
    }
    setUploadingPhoto(true);
    try {
      const { url } = await uploadPhoto(file);
      setForm((f) => ({ ...f, photo_url: url }));
      toast.success("Foto lista — guardá la ficha para confirmar");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const openNewPet = () => {
    setForm(emptyForm());
    if (!perms.canPickOwners) {
      setEditing("new");
      return;
    }
    if (!hasOwners) {
      setOwnerSplash(true);
      return;
    }
    setEditing("new");
  };

  const openEditPet = (pet: Pet) => {
    setForm(petToForm(pet));
    if (!hasOwners) {
      setOwnerSplash(true);
      return;
    }
    setEditing(pet);
  };

  useEffect(() => {
    if (!selected?.id) return;
    const fresh = list.find((p) => p?.id === selected.id);
    if (fresh) setSelected(fresh);
    else if (!petsInfinite.isFetching) setSelected(null);
  }, [list, selected?.id, petsInfinite.isFetching]);

  const historyQ = useQuery({
    ...petHistoryQuery(selected?.id ?? ""),
    enabled: !!selected?.id,
  });

  const breedOptions = useMemo(
    () =>
      (breeds.data ?? []).filter(
        (b) => b.active && (!form.species || b.species === form.species),
      ),
    [breeds.data, form.species],
  );

  const lastBath = (petId: string) =>
    (appts.data ?? [])
      .filter((a) => a.pet_id === petId && a.status === "finalizada")
      .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at))[0]?.starts_at;

  const nextAppt = (petId: string) =>
    (appts.data ?? [])
      .filter(
        (a) =>
          a.pet_id === petId && new Date(a.starts_at) >= new Date() && a.status !== "cancelada",
      )
      .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0]?.starts_at;

  const saveMut = useMutation({
    mutationFn: async () => {
      const owner_ids = perms.canPickOwners
        ? [form.owner_id_1, form.owner_id_2].filter(Boolean)
        : [];
      if (!form.name.trim()) throw new Error("Nombre requerido");
      if (perms.canPickOwners && !owner_ids.length) {
        throw new Error("Seleccioná al menos un humano de compañía");
      }
      const payload = {
        name: form.name.trim(),
        species: form.species,
        breed_id: form.breed_id || null,
        sex: normalizePetSex(form.sex) || null,
        life_date: form.life_date || null,
        life_date_kind: form.life_date_kind,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        photo_url: form.photo_url || null,
        allergies: form.allergies || null,
        vaccines: form.vaccines || null,
        medical_notes: form.medical_notes || null,
        notes: form.notes || null,
        ...(perms.canPickOwners ? { owner_ids } : {}),
      };
      if (editing === "new") return createPet(payload);
      if (editing && typeof editing === "object") return updatePet(editing.id, payload);
      throw new Error("Sin formulario");
    },
    onSuccess: async (saved) => {
      const wasNew = editing === "new";
      setEditing(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["pets"] }),
        qc.invalidateQueries({ queryKey: ["appointments"] }),
      ]);
      if (wasNew && saved) {
        setWelcomePet(saved);
        toast.success("Peludito registrado");
      } else {
        toast.success("Mascota actualizada");
        if (saved?.id) setSelected(saved);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createOwnerMut = useMutation({
    mutationFn: async () => {
      if (!ownerDraft.full_name.trim()) throw new Error("Nombre del humano requerido");
      return createOwner({
        full_name: ownerDraft.full_name.trim(),
        document_type: ownerDraft.document_type,
        document_id: ownerDraft.document_id || null,
        phone: ownerDraft.phone || null,
        whatsapp: ownerDraft.whatsapp || ownerDraft.phone || null,
        email: ownerDraft.email || null,
      });
    },
    onSuccess: async (owner) => {
      toast.success("Humano de compañía creado");
      setOwnerSplash(false);
      setOwnerDraft({
        full_name: "",
        document_type: "CC",
        document_id: "",
        phone: "",
        whatsapp: "",
        email: "",
      });
      await qc.invalidateQueries({ queryKey: ["owners"] });
      if (editing === null) {
        setForm({ ...emptyForm(), owner_id_1: owner.id });
        setEditing("new");
      } else {
        setForm((f) => ({ ...f, owner_id_1: f.owner_id_1 || owner.id }));
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePet(id),
    onSuccess: async () => {
      toast.success("Mascota eliminada");
      setSelected(null);
      await qc.invalidateQueries({ queryKey: ["pets"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => reorderPets(ids),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pets"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setOrderedList(list);
    },
  });

  const ownerLabel = (p: Pet) => {
    const names = (p.owners_list ?? [])
      .filter((o): o is NonNullable<typeof o> => !!o?.full_name)
      .map((o) => o.full_name);
    if (names.length) return names.join(" · ");
    return p.owners?.full_name ?? "—";
  };

  return (
    <AppShell
      title="Mascotas"
      subtitle={
        activeTab === "razas"
          ? "Catálogo de razas para las fichas"
          : petsInfinite.isLoading
            ? "Cargando fichas…"
            : perms.canManagePets
              ? `Arrastrá las fichas para ordenar · ${totalPets} ficha${totalPets === 1 ? "" : "s"}`
              : `${totalPets} ficha${totalPets === 1 ? "" : "s"} registrada${totalPets === 1 ? "" : "s"}`
      }
      actions={
        activeTab === "fichas" && perms.canManagePets ? (
          <Button className="rounded-xl" onClick={openNewPet}>
            <Plus className="mr-2 h-4 w-4" /> Nueva mascota
          </Button>
        ) : null
      }
    >
      {showRazas ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["fichas", "Fichas"],
              ["razas", "Razas"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                activeTab === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === "razas" ? (
        <BreedsManager />
      ) : (
        <>
      <div className="card-soft flex items-center gap-3 p-4">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, raza o humano…"
          className="h-10 rounded-xl border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </div>

      {petsInfinite.isLoading ? (
        <KiraLoader variant="inline" className="mt-6" />
      ) : list.length || perms.canManagePets ? (
        <>
          <ReorderList
            items={orderedList}
            disabled={!perms.canReorderPets}
            className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
            onReorder={(next) => {
              setOrderedList(next);
              reorderMut.mutate(next.map((p) => p.id));
            }}
            renderItem={(p, { isDragging, dragHandleProps }) => (
              <article
                role="button"
                tabIndex={0}
                onClick={() => setSelected(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(p);
                  }
                }}
                className={cn(
                  "card-soft group h-full w-full cursor-pointer overflow-hidden text-left transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift",
                  isDragging && "opacity-60",
                )}
              >
                <div className="relative h-44 overflow-hidden bg-secondary">
                  <img
                    src={resolveMediaUrl(p.photo_url) || PET_PLACEHOLDER}
                    alt={`${p.name}, ${p.breed ?? "mascota"}`}
                    loading="lazy"
                    className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                      p.photo_url ? "" : "object-contain p-6 opacity-80 grayscale"
                    }`}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = PET_PLACEHOLDER;
                    }}
                  />
                  {perms.canReorderPets ? (
                    <div
                      title="Arrastrar para reordenar"
                      aria-label={`Reordenar ${p.name}`}
                      className="absolute left-3 top-3 z-10 grid h-9 w-9 cursor-grab place-items-center rounded-xl bg-card/95 text-primary shadow-sm backdrop-blur active:cursor-grabbing"
                      onClick={(e) => e.stopPropagation()}
                      {...dragHandleProps}
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>
                  ) : null}
                  <span
                    className={`absolute ${perms.canReorderPets ? "left-14" : "left-3"} top-3 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-medium capitalize text-primary backdrop-blur`}
                  >
                    {p.species}
                  </span>
                  {perms.canManagePets ? (
                    <button
                      type="button"
                      title="Eliminar mascota"
                      aria-label={`Eliminar ${p.name}`}
                      className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-xl bg-card/95 text-destructive shadow-sm backdrop-blur transition hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete({ name: p.name, id: p.id });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <h3 className="truncate font-display text-lg font-bold text-primary">{p.name}</h3>
                    <span className="shrink-0 text-xs text-muted-foreground">{p.sex}</span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {p.breed_name || p.breed}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Cake className="h-3.5 w-3.5" /> {petCardAgeText(p)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Weight className="h-3.5 w-3.5" /> {p.weight_kg ?? "?"} kg
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
                    <p className="truncate text-muted-foreground">
                      Humano(s): <span className="text-foreground">{ownerLabel(p)}</span>
                    </p>
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <Scissors className="h-3.5 w-3.5" /> Último baño:{" "}
                      {lastBath(p.id) ? shortDate(lastBath(p.id)!) : "—"}
                    </p>
                    <p className="flex items-center gap-1.5 text-accent">
                      <CalendarClock className="h-3.5 w-3.5" /> Próxima cita:{" "}
                      {nextAppt(p.id) ? shortDate(nextAppt(p.id)!) : "sin agendar"}
                    </p>
                  </div>
                </div>
              </article>
            )}
          />

          {perms.canManagePets ? (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              <button
                type="button"
                onClick={openNewPet}
                className="card-soft group flex min-h-[22rem] flex-col items-center justify-center gap-3 border-dashed border-primary/25 bg-primary/[0.03] text-primary transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/45 hover:bg-primary/[0.06] hover:shadow-lift"
                aria-label="Agregar un peludito"
              >
                <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 transition-transform duration-300 group-hover:scale-105">
                  <Plus className="h-8 w-8" strokeWidth={2.25} />
                </span>
                <span className="font-display text-lg font-bold">Agregar un peludito</span>
              </button>
            </div>
          ) : null}

          {!list.length && qDebounced ? (
            <Empty message="No encontramos mascotas con ese criterio." />
          ) : null}

          <div ref={loadMoreRef} className="h-8 w-full" aria-hidden />
          {petsInfinite.isFetchingNextPage ? (
            <div className="flex justify-center pb-4 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando más…
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-6">
          <Empty
            message={
              qDebounced
                ? "No encontramos mascotas con ese criterio."
                : "Todavía no hay mascotas. Creá la primera ficha."
            }
          />
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-3xl p-0"
        >
          {selected ? (
            <div>
              <div className="relative h-48 overflow-hidden bg-secondary">
                <img
                  src={resolveMediaUrl(selected.photo_url) || PET_PLACEHOLDER}
                  alt={selected.name}
                  className={`h-full w-full object-cover ${
                    selected.photo_url ? "" : "object-contain p-8 opacity-80 grayscale"
                  }`}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = PET_PLACEHOLDER;
                    e.currentTarget.classList.add("object-contain", "p-8", "opacity-80", "grayscale");
                  }}
                />
                <button
                  onClick={() => setSelected(null)}
                  className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl bg-card/90 text-primary backdrop-blur"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-primary">
                      {selected.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selected.breed_name || selected.breed} · {selected.sex} ·{" "}
                      {petDetailLifeText(selected)} · {selected.weight_kg ?? "?"} kg · Humano(s):{" "}
                      {ownerLabel(selected)}
                    </p>
                  </div>
                  {perms.canManagePets ? (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => openEditPet(selected)}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="rounded-xl"
                        title="Eliminar mascota"
                        aria-label={`Eliminar ${selected.name}`}
                        onClick={() => {
                          setPendingDelete({ name: selected.name, id: selected.id });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {[
                    { t: "Alergias", v: selected.allergies },
                    { t: "Vacunas", v: selected.vaccines },
                    { t: "Historial médico", v: selected.medical_notes },
                  ].map((b) => (
                    <div key={b.t} className="rounded-2xl bg-secondary/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {b.t}
                      </p>
                      <p className="mt-1.5 text-sm text-foreground">{b.v || "Sin registros"}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl bg-blush/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blush-foreground">
                    Observaciones
                  </p>
                  <p className="mt-1.5 text-sm text-foreground">
                    {selected.notes || "Sin observaciones"}
                  </p>
                </div>

                <h3 className="mt-6 font-display text-lg font-bold text-primary">
                  Historial de baños, servicios y misceláneos
                </h3>
                <ul className="mt-3 space-y-2">
                  {(historyQ.data ?? []).map((a) => {
                    const meta = statusMeta(a.status);
                    return (
                      <li
                        key={`${a.kind}-${a.id}`}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {a.kind === "store_purchase" ? "Tienda · " : ""}
                            {a.service_name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {shortDate(a.starts_at)} {time(a.starts_at)} ·{" "}
                            {a.staff_name ?? "—"} · {cop(a.price)}
                          </p>
                        </div>
                        <StatusPill
                          label={a.kind === "store_purchase" ? "Misceláneo" : meta.label}
                          className={meta.className}
                          hint={a.kind === "store_purchase" ? undefined : meta.hint}
                        />
                      </li>
                    );
                  })}
                  {!historyQ.data?.length ? (
                    <Empty message="Aún no hay servicios registrados." />
                  ) : null}
                </ul>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-3xl">
          <h2 className="font-display text-xl font-bold text-primary">
            {editing === "new" ? "Nueva mascota" : "Editar mascota"}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Especie</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={form.species === "gato" ? "gato" : "perro"}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    species: e.target.value === "gato" ? "gato" : "perro",
                    breed_id: "",
                  }))
                }
              >
                <option value="perro">Perro</option>
                <option value="gato">Gato</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Raza</Label>
              <BreedPickerList
                value={form.breed_id}
                onChange={(breedId) => setForm((f) => ({ ...f, breed_id: breedId }))}
                options={breedOptions}
              />
            </div>
            <div className="space-y-2">
              <Label>Sexo</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={normalizePetSex(form.sex) || "Hembra"}
                onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}
              >
                {SEX_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
                {form.sex && !SEX_OPTIONS.includes(normalizePetSex(form.sex) as (typeof SEX_OPTIONS)[number]) ? (
                  <option value={form.sex}>{form.sex}</option>
                ) : null}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  type="date"
                  value={form.life_date}
                  onChange={(e) => setForm((f) => ({ ...f, life_date: e.target.value }))}
                  className="h-11 rounded-xl"
                />
                <select
                  className="flex h-11 rounded-xl border border-input bg-background px-2 text-sm"
                  value={form.life_date_kind}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      life_date_kind: e.target.value === "home" ? "home" : "birth",
                    }))
                  }
                  aria-label="Tipo de fecha"
                >
                  <option value="birth">Nacimiento</option>
                  <option value="home">Llegada a casa</option>
                </select>
              </div>
              {form.life_date ? (
                <p className="text-xs text-muted-foreground">
                  Edad calculada: {ageLabelFromLifeDate(form.life_date)}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Peso (kg)</Label>
              <Input
                type="number"
                value={form.weight_kg}
                onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Humano principal *</Label>
              {perms.canPickOwners ? (
                <>
              <select
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={form.owner_id_1}
                onChange={(e) => setForm((f) => ({ ...f, owner_id_1: e.target.value }))}
                required
              >
                <option value="">Seleccionar…</option>
                {ownersList.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.full_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => setOwnerSplash(true)}
              >
                + Crear humano de compañía
              </button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Queda a tu nombre ({user?.email}). El spa te verá como humano de compañía.
                </p>
              )}
            </div>
            {perms.canPickOwners ? (
            <div className="space-y-2">
              <Label>2.º humano (opcional)</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={form.owner_id_2}
                onChange={(e) => setForm((f) => ({ ...f, owner_id_2: e.target.value }))}
              >
                <option value="">Ninguno</option>
                {ownersList
                  .filter((o) => o.id !== form.owner_id_1)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.full_name}
                    </option>
                  ))}
              </select>
            </div>
            ) : null}
            <div className="space-y-2 sm:col-span-2">
              <Label>Alergias</Label>
              <Textarea
                value={form.allergies}
                onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Vacunas</Label>
              <Textarea
                value={form.vaccines}
                onChange={(e) => setForm((f) => ({ ...f, vaccines: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Historial médico</Label>
              <Textarea
                value={form.medical_notes}
                onChange={(e) => setForm((f) => ({ ...f, medical_notes: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Observaciones</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Foto</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-muted">
                  <img
                    src={resolveMediaUrl(form.photo_url) || PET_PLACEHOLDER}
                    alt=""
                    className={
                      "h-full w-full object-cover " +
                      (form.photo_url ? "" : "object-contain p-3 opacity-80 grayscale")
                    }
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = PET_PLACEHOLDER;
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 text-sm hover:bg-muted/50">
                    {uploadingPhoto ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    {uploadingPhoto ? "Subiendo…" : "Elegir archivo o galería"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      disabled={uploadingPhoto}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        void onPickPhoto(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    En el celular abre la galería o archivos (no fuerza la cámara).
                  </p>
                  <Input
                    value={form.photo_url}
                    onChange={(e) => setForm((f) => ({ ...f, photo_url: e.target.value }))}
                    placeholder="o pegá una URL"
                    className="h-11 rounded-xl"
                    disabled={uploadingPhoto}
                  />
                  {form.photo_url ? (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => setForm((f) => ({ ...f, photo_url: "" }))}
                    >
                      Quitar foto
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl"
              disabled={saveMut.isPending || (perms.canPickOwners && !form.owner_id_1)}
              onClick={() => {
                if (perms.canPickOwners && !form.owner_id_1) {
                  toast.error("Toda mascota necesita un humano de compañía");
                  setOwnerSplash(true);
                  return;
                }
                saveMut.mutate();
              }}
            >
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={ownerSplash}
        onOpenChange={(o) => {
          if (!o) setOwnerSplash(false);
        }}
      >
        <DialogContent className="max-w-md rounded-3xl">
          <div className="flex flex-col items-center text-center">
            <img
              src={PET_PLACEHOLDER}
              alt=""
              className="mb-4 h-24 w-24 rounded-2xl object-cover opacity-90 grayscale"
            />
            <h2 className="font-display text-xl font-bold text-primary">
              Primero necesitamos un humano de compañía
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Toda mascota debe tener al menos un humano responsable. Crealo y después seguimos
              con la ficha del peludito.
            </p>
          </div>
          <div className="mt-5 grid gap-3">
            <div className="space-y-2">
              <Label>Nombre completo *</Label>
              <Input
                value={ownerDraft.full_name}
                onChange={(e) => setOwnerDraft((d) => ({ ...d, full_name: e.target.value }))}
                className="h-11 rounded-xl"
                placeholder="Ej. María López"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo doc.</Label>
                <select
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  value={ownerDraft.document_type}
                  onChange={(e) =>
                    setOwnerDraft((d) => ({ ...d, document_type: e.target.value }))
                  }
                >
                  {["CC", "NIT", "CE", "PAS", "TI"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Documento</Label>
                <Input
                  value={ownerDraft.document_id}
                  onChange={(e) => setOwnerDraft((d) => ({ ...d, document_id: e.target.value }))}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Teléfono / WhatsApp</Label>
              <Input
                value={ownerDraft.phone}
                onChange={(e) => setOwnerDraft((d) => ({ ...d, phone: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input
                type="email"
                value={ownerDraft.email}
                onChange={(e) => setOwnerDraft((d) => ({ ...d, email: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setOwnerSplash(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl"
              disabled={createOwnerMut.isPending}
              onClick={() => createOwnerMut.mutate()}
            >
              Crear humano y continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!welcomePet}
        onOpenChange={(o) => {
          if (!o) setWelcomePet(null);
        }}
      >
        <DialogContent className="max-w-md rounded-3xl p-8">
          {welcomePet ? (
            <div className="flex flex-col items-center text-center">
              <img
                src={resolveMediaUrl(welcomePet.photo_url) || PET_PLACEHOLDER}
                alt={welcomePet.name}
                className={`mb-5 h-28 w-28 rounded-full object-cover shadow-soft ring-4 ring-primary/10 ${
                  welcomePet.photo_url ? "" : "object-contain p-4 opacity-80 grayscale"
                }`}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = PET_PLACEHOLDER;
                }}
              />
              <h2 className="font-display text-2xl font-bold leading-snug text-primary">
                ¡Hola! Bienvenid
                {peluditLabel(welcomePet.sex) === "peludita"
                  ? "a"
                  : peluditLabel(welcomePet.sex) === "peludito"
                    ? "o"
                    : "@"}{" "}
                {peluditLabel(welcomePet.sex)}{" "}
                <span className="text-accent">{welcomePet.name}</span> bienvenid
                {peluditLabel(welcomePet.sex) === "peludita"
                  ? "a"
                  : peluditLabel(welcomePet.sex) === "peludito"
                    ? "o"
                    : "@"}{" "}
                a nuestro SPA para consentirte como te mereces.
                {perms.isCliente ? (
                  <>
                    <br />
                    <span className="mt-2 inline-block text-lg font-semibold">
                      ¿Qué deseas hacer ahora?
                    </span>
                  </>
                ) : null}
              </h2>
              {perms.isCliente ? (
                <div className="mt-7 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button
                    className="rounded-xl"
                    onClick={() => {
                      setWelcomePet(null);
                      void navigate({ to: "/panel/precios" });
                    }}
                  >
                    Ver servicios disponibles
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setWelcomePet(null)}
                  >
                    Seguir en mascotas
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pendingDelete}
        title={
          <>
            ¿Eliminar a <span className="text-accent">{pendingDelete?.name}</span>?
          </>
        }
        description="Se quitará la ficha de esta mascota."
        onConfirm={() => {
          if (pendingDelete) deleteMut.mutate(pendingDelete.id);
        }}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      />
        </>
      )}
    </AppShell>
  );
}
