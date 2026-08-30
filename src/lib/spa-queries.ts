import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { api, ApiError, getApiBase, getToken } from "@/lib/api";

export type Owner = {
  id: string;
  full_name: string;
  document_type?: string | null;
  document_id: string | null;
  legal_name?: string | null;
  dv?: string | null;
  tax_regime?: string | null;
  fiscal_responsibilities?: string | null;
  city?: string | null;
  department?: string | null;
  invoice_email?: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  photo_url: string | null;
  sort_order?: number;
  pii_masked?: boolean;
  system_key?: string | null;
  role?: string | null;
  active?: boolean | null;
  auth_provider?: string | null;
  pets?: Array<{
    id: string;
    name: string;
    breed: string | null;
    photo_url: string | null;
    link_role?: string;
  }>;
};

export type PetOwnerLink = Owner & { link_role?: string };

export type Pet = {
  id: string;
  owner_id: string | null;
  name: string;
  species: string;
  breed: string | null;
  breed_id?: string | null;
  breed_name?: string | null;
  age_years: number | null;
  life_date?: string | null;
  life_date_kind?: "birth" | "home" | string | null;
  sex: string | null;
  weight_kg: number | null;
  photo_url: string | null;
  allergies: string | null;
  vaccines: string | null;
  medical_notes: string | null;
  notes: string | null;
  sort_order?: number;
  owners?: Owner | null;
  owners_list?: PetOwnerLink[];
};

export type Breed = {
  id: string;
  name: string;
  species: string;
  active: boolean;
  image_url?: string | null;
  breed_group?: string | null;
};

export type StorePurchase = {
  id: string;
  owner_id: string | null;
  pet_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  purchased_at: string;
  notes: string | null;
};

export type PetHistoryItem = {
  id: string;
  kind: "appointment" | "store_purchase" | string;
  starts_at: string;
  status: string;
  price: number;
  notes: string | null;
  service_name: string | null;
  staff_name: string | null;
  quantity?: number;
  unit_price?: number;
};

export type Staff = {
  id: string;
  full_name: string;
  role_title: string;
  specialty: string | null;
  shift_rate: number;
  payment_mode: string;
  commission_pct: number;
  pay_frequency?: string;
  active: boolean;
  photo_url: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  birth_date?: string | null;
  hired_at?: string | null;
  skills?: string[];
  user_id?: string | null;
};

export type StaffPayTerm = {
  id: string;
  staff_id: string;
  effective_from: string;
  effective_to: string | null;
  payment_mode: string;
  shift_rate: number;
  commission_pct: number;
  note?: string | null;
};

export type PayrollPreview = {
  staff_id: string;
  staff_name: string;
  frequency: string;
  period_start: string;
  period_end: string;
  segments: {
    from: string;
    to: string;
    payment_mode: string | null;
    worked_days: number;
    shift_pay: number;
    sales_base: number;
    commission: number;
    subtotal: number;
    commission_pct?: number;
    shift_rate?: number;
  }[];
  total: number;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  meta?: unknown;
  read_at: string | null;
  created_at: string;
};

export type CalendarRequest = {
  id: string;
  staff_id: string;
  staff_name?: string;
  day_date: string;
  status: string;
  reason?: string | null;
  appointments_count: number;
  created_at: string;
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  price_min?: number | null;
  price_max?: number | null;
  price_note?: string | null;
  price_pending?: boolean;
  duration_min: number;
  image_url: string | null;
  is_public: boolean;
  is_addon?: boolean;
  sort_order: number;
  publish_at?: string | null;
  /** IDs de actividades del catálogo (bano, secado, cepillado, …) */
  activities?: string[];
};

export type ServiceActivityCatalogItem = {
  id: string;
  label: string;
  icon: string | null;
  sort_order: number;
  required_skills?: string[];
  active?: boolean;
};

export type Appointment = {
  id: string;
  pet_id: string | null;
  service_id: string | null;
  staff_id: string | null;
  starts_at: string;
  duration_min: number;
  status: string;
  price: number | null;
  price_pending?: boolean;
  /** Suma de extras vinculados a la cita (store_purchases.appointment_id). */
  extras_total?: number;
  extras_count?: number;
  notes: string | null;
  photo_before_url: string | null;
  photo_after_url: string | null;
  pets?: (Pet & { owners?: Owner | null }) | null;
  services?: Service | null;
  staff?: Staff | null;
  reschedule_count?: number;
  reschedule_locked?: boolean;
};

/** Total a cobrar: servicio + extras. */
export function appointmentChargeTotal(a: {
  price?: number | null;
  extras_total?: number | null;
}): number {
  return Number(a.price ?? 0) + Number(a.extras_total ?? 0);
}

export type InventoryItem = {
  id: string;
  name: string;
  category: string | null;
  sku?: string | null;
  barcode?: string | null;
  photo_url: string | null;
  quantity: number;
  reserved?: number;
  available?: number;
  min_stock: number;
  purchase_price: number;
  sale_price: number;
  sale_price_unit?: number;
  margin_pct?: number;
  unit_kind?: string;
  pack_size?: number;
  pack_label?: string | null;
  channel?: string;
  expires_at: string | null;
  next_expires_at?: string | null;
};

export type InventoryCategory = {
  id: string;
  name: string;
  sort_order?: number;
};

export type InventoryMovement = {
  id: string;
  item_id: string;
  delta: number;
  quantity_after: number;
  kind: string;
  note: string | null;
  created_at: string;
  actor_name?: string | null;
  actor_email?: string | null;
};

export type Sale = {
  id: string;
  owner_id: string | null;
  staff_id: string | null;
  total: number;
  payment_method: string;
  sold_at: string;
  source?: "mostrador" | "cita" | string;
  status?: "activa" | "anulada" | string;
  appointment_id?: string | null;
  invoice_id?: string | null;
  invoice_number?: string | null;
  pet_name?: string | null;
  service_name?: string | null;
  payment_method_label?: string | null;
  payment_evidence_url?: string | null;
  owners?: Owner | null;
  staff?: Staff | null;
};

export type PaymentMethod = {
  id: string;
  code: string;
  label: string;
  require_evidence: boolean;
  active: boolean;
  sort_order: number;
};

export type AppUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  active: boolean;
  activated_at: string | null;
  created_at: string;
  auth_provider?: "password" | "google" | "both" | string;
  modules?: string[];
  modules_custom?: boolean;
  modules_inherited?: string[];
};

/** Landing (sin auth). */
export const publicServicesQuery = queryOptions({
  queryKey: ["services", "public"],
  queryFn: async () => {
    try {
      return await api<Service[]>("/services/public", { auth: false });
    } catch {
      return [];
    }
  },
});

/** Alias usado por la landing. */
export const servicesQuery = publicServicesQuery;

export const panelServicesQuery = queryOptions({
  queryKey: ["services", "all"],
  queryFn: () => api<Service[]>("/services"),
});

export const ownersQuery = queryOptions({
  queryKey: ["owners"],
  queryFn: () => api<Owner[]>("/owners"),
});

export const petsQuery = queryOptions({
  queryKey: ["pets"],
  queryFn: () => api<Pet[]>("/pets"),
});

export type PetsPage = {
  items: Pet[];
  total: number;
  limit: number;
  offset: number;
};

export const PETS_PAGE_SIZE = 12;

export function petsInfiniteQuery(search: string) {
  const q = search.trim();
  return infiniteQueryOptions({
    queryKey: ["pets", "infinite", q] as const,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: String(PETS_PAGE_SIZE),
        offset: String(pageParam),
      });
      if (q) params.set("q", q);
      return api<PetsPage>(`/pets?${params}`);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const next = lastPage.offset + lastPage.items.length;
      return next < lastPage.total ? next : undefined;
    },
  });
}

export const breedsQuery = queryOptions({
  queryKey: ["breeds"],
  queryFn: () => api<Breed[]>("/breeds"),
});

export const staffQuery = queryOptions({
  queryKey: ["staff"],
  queryFn: () => api<Staff[]>("/staff"),
});

export const notificationsQuery = queryOptions({
  queryKey: ["notifications"],
  queryFn: () =>
    api<{ items: AppNotification[]; unread_count: number }>("/notifications"),
  refetchInterval: 60_000,
});

export async function createStaff(input: Partial<Staff> & { full_name: string }) {
  return api<Staff>("/staff", { method: "POST", body: input });
}

export async function updateStaff(id: string, input: Partial<Staff> & { open_new_pay_term?: boolean }) {
  return api<Staff>(`/staff/${id}`, { method: "PATCH", body: input });
}

export async function updateMyStaffDisplay(role_title: string) {
  return api<Staff>("/staff/me", { method: "PATCH", body: { role_title } });
}

export async function deleteStaff(id: string) {
  await api(`/staff/${id}`, { method: "DELETE" });
}

export async function listStaffPayTerms(staffId: string) {
  return api<StaffPayTerm[]>(`/staff/${staffId}/pay-terms`);
}

export async function createStaffPayTerm(
  staffId: string,
  input: {
    effective_from: string;
    effective_to?: string | null;
    payment_mode: string;
    shift_rate: number;
    commission_pct: number;
    note?: string;
  },
) {
  return api<StaffPayTerm>(`/staff/${staffId}/pay-terms`, { method: "POST", body: input });
}

export async function getPayrollSettings() {
  return api<{ default_frequency: string }>("/payroll/settings");
}

export async function savePayrollSettings(default_frequency: string) {
  return api<{ default_frequency: string }>("/payroll/settings", {
    method: "PUT",
    body: { default_frequency },
  });
}

export async function previewPayroll(input: {
  staff_id: string;
  frequency?: string;
  period_start?: string;
  period_end?: string;
  anchor?: string;
}) {
  return api<PayrollPreview>("/payroll/preview", { method: "POST", body: input });
}

export async function closePayroll(input: {
  staff_id: string;
  frequency: string;
  period_start: string;
  period_end: string;
  notes?: string;
  mark_paid?: boolean;
}) {
  return api<PayrollPreview & { id: string; status: string }>("/payroll/close", {
    method: "POST",
    body: input,
  });
}

export async function listPayrollRuns(staffId?: string) {
  const q = staffId ? `?staff_id=${encodeURIComponent(staffId)}` : "";
  return api<
    {
      id: string;
      staff_id: string;
      staff_name: string;
      frequency: string;
      period_start: string;
      period_end: string;
      status: string;
      total: number;
      breakdown: unknown;
    }[]
  >(`/payroll/runs${q}`);
}

export async function listCalendarRequests(status = "pending") {
  return api<CalendarRequest[]>(`/staff/calendar-requests?status=${encodeURIComponent(status)}`);
}

export async function reviewCalendarRequest(
  id: string,
  input: { status: "approved" | "rejected"; review_note?: string; unassign_appointments?: boolean },
) {
  return api<{ ok: boolean }>(`/staff/calendar-requests/${id}/review`, {
    method: "POST",
    body: input,
  });
}

export async function deleteStaffCalendarDay(staffId: string, day: string, reason?: string) {
  const q = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  return api<{ ok: boolean; requires_approval?: boolean; request_id?: string }>(
    `/staff/${staffId}/calendar/${day}${q}`,
    { method: "DELETE" },
  );
}

export async function upsertStaffCalendarDay(
  staffId: string,
  input: { day_date: string; kind: string; note?: string },
) {
  return api<{ ok: boolean }>(`/staff/${staffId}/calendar`, { method: "POST", body: input });
}

export async function markNotificationsRead(ids?: string[]) {
  return api<{ ok: boolean }>("/notifications/read", {
    method: "POST",
    body: ids ? { ids } : {},
  });
}

export async function getStaffWorkHours(staffId: string, onDate?: string) {
  const q = onDate ? `?on_date=${encodeURIComponent(onDate)}` : "";
  return api<
    {
      id: string;
      weekday: number;
      start_time: string;
      end_time: string;
      note?: string | null;
      valid_from?: string | null;
      valid_to?: string | null;
    }[]
  >(`/staff/${staffId}/work-hours${q}`);
}

export async function getStaffWorkHoursHistory(staffId: string) {
  return api<
    {
      id: string;
      weekday: number;
      start_time: string;
      end_time: string;
      note?: string | null;
      valid_from?: string | null;
      valid_to?: string | null;
      created_at?: string;
    }[]
  >(`/staff/${staffId}/work-hours/history`);
}

export async function saveStaffWorkHours(
  staffId: string,
  hours: {
    weekday: number;
    start_time: string;
    end_time: string;
    note?: string;
    valid_from?: string | null;
    valid_to?: string | null;
  }[],
) {
  return api(`/staff/${staffId}/work-hours`, { method: "PUT", body: { hours } });
}

export async function eligibleStaffForService(serviceId: string) {
  return api<{ service_id: string; items: Staff[] }>(`/services/${serviceId}/eligible-staff`);
}

export async function skillCatalog() {
  return api<{
    skills: { id: string; label: string }[];
    activities: { id: string; label: string }[];
  }>("/staff/skill-catalog");
}

export const serviceActivityCatalogQuery = queryOptions({
  queryKey: ["service-activity-catalog"],
  queryFn: () => api<ServiceActivityCatalogItem[]>("/services/activity-catalog"),
});

export const serviceActivityCatalogAdminQuery = queryOptions({
  queryKey: ["service-activity-catalog", "admin"],
  queryFn: () => api<ServiceActivityCatalogItem[]>("/services/activity-catalog/all"),
});

export async function upsertServiceActivity(input: {
  id: string;
  label: string;
  icon?: string | null;
  sort_order: number;
  required_skills: string[];
  active?: boolean;
}) {
  return api<ServiceActivityCatalogItem>("/services/activity-catalog", {
    method: "PUT",
    body: input,
  });
}

export async function deactivateServiceActivity(id: string) {
  return api<void>(`/services/activity-catalog/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export const appointmentsQuery = queryOptions({
  queryKey: ["appointments"],
  queryFn: () => api<Appointment[]>("/appointments"),
});

export const inventoryQuery = queryOptions({
  queryKey: ["inventory"],
  queryFn: () => api<InventoryItem[]>("/inventory"),
});

export const inventoryCategoriesQuery = queryOptions({
  queryKey: ["inventory", "categories"] as const,
  queryFn: () => api<InventoryCategory[]>("/inventory/categories"),
});

export const inventoryShopQuery = queryOptions({
  queryKey: ["inventory", "shop"],
  queryFn: () => api<InventoryItem[]>("/inventory/shop"),
});

export const salesQuery = queryOptions({
  queryKey: ["sales"],
  queryFn: () => api<Sale[]>("/sales"),
});

export const paymentMethodsQuery = queryOptions({
  queryKey: ["payment-methods"],
  queryFn: () => api<PaymentMethod[]>("/payment-methods"),
});

export const paymentMethodsAdminQuery = queryOptions({
  queryKey: ["payment-methods", "admin"],
  queryFn: () => api<PaymentMethod[]>("/payment-methods?include_inactive=true"),
});

export async function createPaymentMethod(input: {
  label: string;
  code?: string;
  require_evidence?: boolean;
  active?: boolean;
  sort_order?: number;
}) {
  return api<PaymentMethod>("/payment-methods", { method: "POST", body: input });
}

export async function patchPaymentMethod(
  id: string,
  input: {
    label?: string;
    require_evidence?: boolean;
    active?: boolean;
    sort_order?: number;
  },
) {
  return api<PaymentMethod>(`/payment-methods/${id}`, { method: "PATCH", body: input });
}

export async function deletePaymentMethod(id: string) {
  await api(`/payment-methods/${id}`, { method: "DELETE" });
}

export const appUsersQuery = queryOptions({
  queryKey: ["app-users"],
  queryFn: () => api<AppUser[]>("/auth/users"),
});

export type MailPrefItem = {
  key: string;
  name: string;
  enabled: boolean;
  template_enabled?: boolean;
};

export async function getMyMailPrefs() {
  return api<{ items: MailPrefItem[] }>("/me/mail-prefs");
}

export async function putMyMailPrefs(items: { key: string; enabled: boolean }[]) {
  return api<{ items: MailPrefItem[] }>("/me/mail-prefs", { method: "PUT", body: { items } });
}

export type AuditEntry = {
  id: string;
  actor_email: string | null;
  action: string;
  action_label?: string;
  entity_type: string;
  entity_label?: string;
  entity_id: string | null;
  created_at: string;
  summary?: string;
  meta?: unknown;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
};

export type AuditPage = {
  items: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
};

export function auditQuery(limit = 10, offset = 0) {
  return queryOptions({
    queryKey: ["audit", limit, offset],
    queryFn: () => api<AuditPage>(`/audit?limit=${limit}&offset=${offset}`),
  });
}

export type BusinessHourDay = {
  weekday: number;
  label: string;
  is_open: boolean;
  open_time: string;
  close_time: string;
  slots_per_hour: number;
};

export async function getBusinessHours() {
  return api<{ days: BusinessHourDay[] }>("/settings/business-hours");
}

export async function putBusinessHours(days: Omit<BusinessHourDay, "label">[]) {
  return api<{ days: BusinessHourDay[] }>("/settings/business-hours", {
    method: "PUT",
    body: { days },
  });
}

export type NextSlot = {
  starts_at: string;
  starts_at_local?: string;
  band_end_local?: string;
  slots_used: number;
  slots_per_hour: number;
  weekday: number;
  label: string;
};

export async function fetchNextAppointmentSlot(opts?: {
  service_id?: string;
  duration_min?: number;
}) {
  const q = new URLSearchParams();
  if (opts?.service_id) q.set("service_id", opts.service_id);
  if (opts?.duration_min != null) q.set("duration_min", String(opts.duration_min));
  const qs = q.toString();
  return api<NextSlot>(`/appointments/next-slot${qs ? `?${qs}` : ""}`);
}
export function petHistoryQuery(petId: string) {
  return queryOptions({
    queryKey: ["pets", petId, "history"],
    queryFn: () => api<PetHistoryItem[]>(`/pets/${petId}/history`),
    enabled: !!petId,
  });
}

export async function createOwner(input: Partial<Owner> & { full_name: string }) {
  return api<Owner>("/owners", { method: "POST", body: input });
}

export async function updateOwner(id: string, input: Partial<Owner>) {
  return api<Owner>(`/owners/${id}`, { method: "PATCH", body: input });
}

export async function fetchMyOwner() {
  return api<Owner & { profile_complete?: boolean }>("/owners/me");
}

export async function updateMyOwner(input: {
  full_name?: string;
  phone: string;
  address: string;
  whatsapp?: string;
  document_type: string;
  document_id: string;
}) {
  return api<Owner & { profile_complete?: boolean }>("/owners/me", { method: "PATCH", body: input });
}

export async function setOwnerPets(id: string, pet_ids: string[]) {
  return api<Owner>(`/owners/${id}/pets`, { method: "PUT", body: { pet_ids } });
}

export async function deleteOwner(id: string, opts?: { confirmOrphan?: boolean }) {
  const q = opts?.confirmOrphan ? "?confirm_orphan=true" : "";
  await api(`/owners/${id}${q}`, { method: "DELETE" });
}

export async function createPet(
  input: Partial<Pet> & { name: string; owner_ids?: string[] },
) {
  return api<Pet>("/pets", { method: "POST", body: input });
}

export async function updatePet(
  id: string,
  input: Partial<Pet> & { owner_ids?: string[] },
) {
  return api<Pet>(`/pets/${id}`, { method: "PATCH", body: input });
}

export async function deletePet(id: string) {
  await api(`/pets/${id}`, { method: "DELETE" });
}

export async function createBreed(input: { name: string; species?: string; active?: boolean }) {
  return api<Breed>("/breeds", { method: "POST", body: input });
}

export async function updateBreed(id: string, input: Partial<Breed>) {
  return api<Breed>(`/breeds/${id}`, { method: "PATCH", body: input });
}

export async function deleteBreed(id: string) {
  await api(`/breeds/${id}`, { method: "DELETE" });
}

export async function importBreedsCsv(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const token = getToken();
  const res = await fetch(`${getApiBase()}/breeds/import`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: fd,
  });
  if (!res.ok) {
    let message = res.statusText;
    let detail: unknown = message;
    try {
      const j = (await res.json()) as { detail?: unknown };
      detail = j.detail ?? message;
      if (typeof j.detail === "string") message = j.detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message, detail);
  }
  return (await res.json()) as {
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  };
}

export async function getMyStaff() {
  return api<{
    id: string;
    full_name: string;
    email?: string | null;
    active: boolean;
  } | null>("/staff/me");
}

export async function createStorePurchase(input: {
  item_name: string;
  owner_id?: string | null;
  pet_id?: string | null;
  quantity?: number;
  unit_price?: number;
  notes?: string | null;
}) {
  return api<StorePurchase>("/store-purchases", { method: "POST", body: input });
}

export async function inviteAppUser(input: {
  email: string;
  full_name: string;
  role: string;
}) {
  return api<{ ok: boolean; message: string; email?: string }>("/auth/users", {
    method: "POST",
    body: input,
  });
}

export type BusinessSettings = {
  trade_name: string;
  slogan: string;
  address: string;
  whatsapp: string;
  logo_url?: string | null;
  barcode_scanner_enabled?: boolean;
  barcode_scanner_mode?: string;
  barcode_suffix?: string;
  contact_email?: string | null;
  site_url?: string | null;
  legal_effective_from?: string | null;
  privacy_url?: string | null;
  terms_url?: string | null;
  privacy_pdf_url?: string | null;
  terms_pdf_url?: string | null;
  updated_at?: string | null;
};

export type HomeNewsItem = {
  id: string;
  kind: "html" | "image";
  title: string;
  html?: string | null;
  image_url?: string | null;
  active?: boolean;
  sort?: number;
};

export type HomeVideoItem = {
  id: string;
  title: string;
  embed_url: string;
  active?: boolean;
  sort?: number;
};

export type HomeContent = {
  news: HomeNewsItem[];
  client_videos: HomeVideoItem[];
  section_order?: string[];
  updated_at?: string | null;
};

export type PublicBusinessSettings = Pick<
  BusinessSettings,
  | "trade_name"
  | "slogan"
  | "address"
  | "whatsapp"
  | "logo_url"
  | "contact_email"
  | "site_url"
  | "legal_effective_from"
  | "privacy_url"
  | "terms_url"
  | "privacy_pdf_url"
  | "terms_pdf_url"
>;

export async function getBusinessSettings() {
  return api<BusinessSettings>("/settings/business");
}

export async function getPublicBusinessSettings() {
  return api<PublicBusinessSettings>("/settings/business/public", { auth: false });
}

export async function patchBusinessSettings(input: Partial<BusinessSettings>) {
  return api<BusinessSettings>("/settings/business", { method: "PATCH", body: input });
}

export async function getPublicHomeContent() {
  return api<HomeContent>("/settings/home/public", { auth: false });
}

export async function getHomeContent() {
  return api<HomeContent>("/settings/home");
}

export async function putHomeContent(input: {
  news?: HomeNewsItem[];
  client_videos?: HomeVideoItem[];
  section_order?: string[];
}) {
  return api<HomeContent>("/settings/home", { method: "PUT", body: input });
}

export type MailSettings = {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_from: string;
  smtp_tls: boolean;
  smtp_configured: boolean;
  password_set: boolean;
  source: string;
  app_env?: string;
  backup?: string;
};

export async function getMailSettings() {
  return api<MailSettings>("/settings/mail");
}

export async function putMailSettings(input: {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_from?: string;
  smtp_tls?: boolean;
  smtp_password?: string;
}) {
  return api<MailSettings>("/settings/mail", { method: "PUT", body: input });
}

export async function patchAppUser(
  id: string,
  input: { role?: string; active?: boolean; full_name?: string },
) {
  return api<AppUser>(`/auth/users/${id}`, { method: "PATCH", body: input });
}

export async function resetAppUserPassword(id: string, password: string) {
  return api<{ ok: boolean; email: string }>(`/auth/users/${id}/reset-password`, {
    method: "POST",
    body: { password },
  });
}

export async function forceActivateAppUser(id: string, password: string) {
  return api<{ ok: boolean; email: string; message: string }>(
    `/auth/users/${id}/force-activate`,
    { method: "POST", body: { password } },
  );
}

export async function deleteAppUser(id: string) {
  return api<{ ok: boolean; message: string; label?: string }>(`/auth/users/${id}`, {
    method: "DELETE",
  });
}

export async function fetchRoleModules() {
  return api<{
    profiles: { role: string; label: string; modules: string[] }[];
  }>("/settings/role-modules");
}

export async function saveRoleModules(role: string, modules: string[]) {
  return api<{ role: string; modules: string[] }>("/settings/role-modules", {
    method: "PUT",
    body: { role, modules },
  });
}

export async function saveUserModules(
  userId: string,
  input: { inherit: true } | { inherit?: false; modules: string[] },
) {
  return api<{
    user_id: string;
    role: string;
    modules: string[];
    modules_custom: boolean;
    modules_inherited: string[];
  }>(`/auth/users/${userId}/modules`, { method: "PUT", body: input });
}

export async function createSale(input: {
  owner_id: string | null;
  staff_id: string | null;
  payment_method: string;
  payment_evidence_url?: string | null;
  service_id?: string | null;
  lines?: { inventory_item_id: string; quantity: number }[];
  total?: number;
}) {
  return api<Sale>("/sales", { method: "POST", body: input });
}

export async function updateAppointmentStatus(
  id: string,
  status: string,
  extra?: { price?: number },
) {
  await api(`/appointments/${id}/status`, {
    method: "PATCH",
    body: { status, ...(extra?.price != null ? { price: extra.price } : {}) },
  });
}

export async function updateAppointment(
  id: string,
  input: {
    pet_id?: string;
    service_id?: string;
    staff_id?: string | null;
    starts_at?: string;
    duration_min?: number;
    notes?: string | null;
    status?: string;
    price?: number;
  },
) {
  return api<Appointment & { email_notifications?: { sent: boolean; email?: string }[] }>(
    `/appointments/${id}`,
    { method: "PATCH", body: input },
  );
}

export async function notifyAppointmentUpdate(appointmentId: string) {
  return api<{
    ok: boolean;
    template_key: string;
    when_label: string;
    context: Record<string, string>;
    email_notifications: { sent: boolean; email?: string; full_name?: string }[];
  }>(`/appointments/${appointmentId}/notify-update`, { method: "POST", body: {} });
}

export type EmailTemplate = {
  key: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
  enabled?: boolean;
  system?: boolean;
  updated_at?: string | null;
};

export async function listEmailTemplates() {
  return api<{ items: EmailTemplate[]; variables: string[] }>("/email-templates");
}

export async function getEmailTemplate(key: string) {
  return api<EmailTemplate & { variables: string[] }>(`/email-templates/${key}`);
}

export async function createEmailTemplate(name = "Nueva plantilla") {
  return api<EmailTemplate>("/email-templates", { method: "POST", body: { name } });
}

export async function saveEmailTemplate(
  key: string,
  input: {
    name?: string;
    subject: string;
    body_html: string;
    body_text?: string;
    enabled?: boolean;
  },
) {
  return api<EmailTemplate>(`/email-templates/${key}`, { method: "PUT", body: input });
}

export async function patchEmailTemplateEnabled(key: string, enabled: boolean) {
  return api<EmailTemplate>(`/email-templates/${key}`, { method: "PATCH", body: { enabled } });
}

export async function deleteEmailTemplate(key: string) {
  return api<{ ok: boolean; key: string }>(`/email-templates/${key}`, { method: "DELETE" });
}

export async function previewEmailTemplate(
  key: string,
  input: {
    subject?: string;
    body_html?: string;
    body_text?: string;
    sample?: Record<string, string>;
  },
) {
  return api<{ subject: string; body_html: string; body_text: string }>(
    `/email-templates/${key}/preview`,
    { method: "POST", body: input },
  );
}

export async function deleteAppointment(id: string) {
  await api(`/appointments/${id}`, { method: "DELETE" });
}

export type AppointmentExtra = {
  id: string;
  appointment_id: string | null;
  pet_id: string | null;
  owner_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes?: string | null;
};

export async function listAppointmentExtras(appointmentId: string) {
  return api<AppointmentExtra[]>(`/appointments/${appointmentId}/extras`);
}

export async function addAppointmentExtra(
  appointmentId: string,
  input: { item_name: string; quantity?: number; unit_price?: number },
) {
  return api<AppointmentExtra & { email_notifications?: { sent: boolean; email?: string }[] }>(
    `/appointments/${appointmentId}/extras`,
    { method: "POST", body: input },
  );
}

export async function updateAppointmentExtra(
  appointmentId: string,
  extraId: string,
  input: { quantity?: number; unit_price?: number },
) {
  return api<AppointmentExtra>(`/appointments/${appointmentId}/extras/${extraId}`, {
    method: "PATCH",
    body: input,
  });
}

export async function deleteAppointmentExtra(appointmentId: string, extraId: string) {
  await api(`/appointments/${appointmentId}/extras/${extraId}`, { method: "DELETE" });
}

export async function completeAppointment(
  id: string,
  input: {
    include_service?: boolean;
    service_price?: number;
    lines?: { name: string; quantity: number; unit_price: number }[];
    notes?: string | null;
    payment_method: string;
    payment_evidence_url?: string | null;
  },
) {
  return api<{
    ok: boolean;
    invoice_number: string;
    invoice_id?: string;
    sale_id?: string;
    total: number;
    misc: { id: string; name: string; quantity: number; unit_price: number; total: number }[];
    email_notifications: {
      owner_id?: string;
      full_name?: string;
      email?: string | null;
      sent: boolean;
      reason?: string;
    }[];
    owners: { id?: string; full_name?: string; email?: string | null }[];
    smtp_configured?: boolean;
    email_queued?: boolean;
    invoice_pdf?: string;
  }>(`/appointments/${id}/complete`, { method: "POST", body: input });
}

export async function upsertService(
  input: Partial<Service> & { name: string; id?: string; publish_at?: string | null },
) {
  return api<Service>("/services", {
    method: "PUT",
    body: {
      id: input.id,
      name: input.name,
      description: input.description ?? null,
      price: input.price ?? 0,
      price_min: input.price_min ?? null,
      price_max: input.price_max ?? null,
      price_note: input.price_note ?? null,
      duration_min: input.duration_min ?? 60,
      image_url: input.image_url ?? null,
      is_public: input.is_public ?? true,
      sort_order: input.sort_order ?? 0,
      publish_at: input.publish_at ?? null,
      activities: input.activities ?? [],
    },
  });
}

export async function deleteService(id: string) {
  await api(`/services/${id}`, { method: "DELETE" });
}

export async function reorderServices(ordered_ids: string[]) {
  return api<{ ok: boolean }>("/services/reorder", {
    method: "PUT",
    body: { ordered_ids },
  });
}

export async function reorderPets(ordered_ids: string[]) {
  return api<{ ok: boolean }>("/pets/reorder", {
    method: "PUT",
    body: { ordered_ids },
  });
}

export async function reorderOwners(ordered_ids: string[]) {
  return api<{ ok: boolean }>("/owners/reorder", {
    method: "PUT",
    body: { ordered_ids },
  });
}

export async function updateInventoryQuantity(id: string, quantity: number) {
  await api(`/inventory/${id}/quantity`, { method: "PATCH", body: { quantity } });
}

export async function createInventoryItem(body: {
  name: string;
  category?: string | null;
  sku?: string | null;
  barcode?: string | null;
  quantity?: number;
  min_stock?: number;
  purchase_price?: number;
  sale_price?: number;
  sale_price_unit?: number;
  margin_pct?: number;
  unit_kind?: string;
  pack_size?: number;
  pack_label?: string | null;
  channel?: string;
}) {
  return api<InventoryItem>("/inventory", { method: "POST", body });
}

export async function patchInventoryItem(
  id: string,
  body: Partial<{
    name: string;
    category: string | null;
    sku: string | null;
    barcode: string | null;
    min_stock: number;
    purchase_price: number;
    sale_price: number;
    sale_price_unit: number;
    margin_pct: number;
    unit_kind: string;
    pack_size: number;
    pack_label: string | null;
    channel: string;
  }>,
) {
  return api<InventoryItem>(`/inventory/${id}`, { method: "PATCH", body });
}

export async function createInventoryCategory(name: string) {
  return api<InventoryCategory>("/inventory/categories", { method: "POST", body: { name } });
}

export async function createInventoryMove(
  id: string,
  body: { delta: number; kind: string; note?: string; expires_at?: string | null },
) {
  return api<InventoryMovement>(`/inventory/${id}/movements`, { method: "POST", body });
}

export function inventoryMovementsQuery(id: string | null) {
  return queryOptions({
    queryKey: ["inventory", id, "movements"] as const,
    queryFn: () => api<InventoryMovement[]>(`/inventory/${id}/movements`),
    enabled: !!id,
  });
}

export async function createAppointment(input: {
  pet_id: string;
  service_id: string;
  staff_id?: string | null;
  starts_at: string;
  duration_min?: number;
  notes?: string;
  sync_google?: boolean;
}) {
  return api<
    Appointment & {
      google?: {
        synced: boolean;
        id?: string;
        htmlLink?: string;
        error?: string;
        attendees?: string[];
      };
      whatsapp_link?: string | null;
      whatsapp_links?: { owner_id?: string; full_name?: string; link: string }[];
      owner_email?: string | null;
      owner_emails?: string[];
      email_notifications?: {
        owner_id?: string;
        full_name?: string;
        email?: string | null;
        sent: boolean;
        reason?: string;
      }[];
    }
  >("/appointments", { method: "POST", body: input });
}

export async function requestAppointmentReschedule(id: string, starts_at: string) {
  return api<{ ok: boolean; id: string; status: string; reschedule_count: number }>(
    `/appointments/${id}/reschedule`,
    { method: "POST", body: { starts_at } },
  );
}

export async function listAppointmentReschedules(status = "pending") {
  return api<
    {
      id: string;
      appointment_id: string;
      status: string;
      previous_starts_at: string;
      requested_starts_at: string;
      pet_name?: string | null;
      requested_email?: string | null;
    }[]
  >(`/appointments/reschedules?status=${encodeURIComponent(status)}`);
}

export async function reviewAppointmentReschedule(
  id: string,
  input: { status: "approved" | "rejected"; lock_further?: boolean; review_note?: string },
) {
  return api<{ ok: boolean; status: string; assigned_staff_id?: string | null; locked: boolean }>(
    `/appointments/reschedules/${id}/review`,
    { method: "POST", body: input },
  );
}

export async function seedMonthAgenda() {
  return api<{ ok: boolean; appointments?: number; staff?: number; from?: string; to?: string }>(
    "/dev/seed-month-agenda",
    { method: "POST", body: {} },
  );
}

export async function googleIntegrationStatus() {
  return api<{
    client_secret: boolean;
    authorized: boolean;
    token_file?: boolean;
    spa_email?: string;
    calendar_id?: string;
    error?: string;
  }>("/integrations/google/status");
}

export async function startGoogleCalendarConnect() {
  return api<{ url: string }>("/auth/google/start", { method: "POST" });
}
