# Análisis UX — Promociones, cupones y beneficios

Rama: `feature/promociones-cupones-ux` (front + back)  
Estado: **solo análisis** — implementación pendiente de revisión.

---

## 1. ¿Hay diferencia real entre promociones y cupones?

**En la base de datos: no.** Todo vive en `kira.promotions` (migración `050_promotions.sql`).

| Campo | Cupón | Promoción automática |
|-------|-------|----------------------|
| `kind` | `coupon` | `automatic` |
| `requires_code` | `true` | `false` |
| `code` | obligatorio (ej. `KIRA15`) | `NULL` |
| Cómo se aplica | El cliente/staff **escribe el código** en ventas | El motor **elige sola** la mejor activa (`promotion_engine._best_automatic`) |
| UI actual | Pestaña **Cupones** (`/promotions?coupons_only=true`) | Pestaña **Promociones** (listado completo + formulario alta) |

**Conclusión:** son el **mismo tipo de registro** con un flag. La separación en dos pestañas es solo una **vista filtrada**, no un módulo distinto. Por eso se siente redundante: editás en Promociones y en Cupones solo pausás/activás el mismo dato.

### Ejemplos del seed (para textos de ayuda)

| Nombre | Tipo | Comportamiento |
|--------|------|----------------|
| **KIRA15** / BIENVENIDA | Cupón | 15% o $10.000; hay que ingresar código; límite por cliente. |
| **Martes de Baño** | Automática | 20% los martes en baños; sin código; el sistema la aplica si califica. |
| **Segunda Mascota** | Automática | 15% si el dueño tiene ≥2 mascotas; sin código. |

### Tercer actor: **Beneficios** (no es promoción)

Tabla `kira.loyalty_rewards`. Premio **asignado a un cliente** (manual o por regla de fidelización). Aparece en cierre de cita y mostrador como selector de recompensa, no como código de campaña.

---

## 2. Problemas UX actuales (capturas + código)

1. **Cupones** — tabla plana, sin intro, acciones solo “Pausar/Activar” (botones ghost).
2. **Promociones** — misma tabla + formulario lateral; incluye filas **con código** (ej. KIRAJIRO), duplicando lo de Cupones.
3. **Sin edición inline** en ningún listado; `PromotionPatch` en API permite más campos pero el front no expone editar.
4. **Beneficios** — texto mínimo; no hay alcance servicios/vitrina; el motor descuenta sobre **subtotal de la venta** sin filtrar por tipo de línea.

---

## 3. Propuesta acordada (para mañana)

### 3.1 Unificar Cupones + Promociones

**Opción recomendada (A):** una sola pestaña **“Campañas”** o mantener nombre **Promociones** con:

- Subfiltro chips: `Todas | Con código | Automáticas`
- Eliminar pestaña **Cupones** (el resumen puede seguir contando cupones).
- Formulario único con switch **“Requiere código”** (ya existe en `NewPromoForm`).
- Fila expandible o drawer **Editar** reutilizando el mismo formulario.

**Opción mínima (B):** dejar dos pestañas pero Cupones = solo lectura + link “Editar en Promociones”.

Tu intuición apunta a **A**.

### 3.2 Toggle activo/pausado (marca)

Reemplazar botones “Pausar/Activar” por `<Switch>` (componente ya usado en reglas de fidelización):

- `checked` → `status === 'active'`
- `onCheckedChange` → `patchPromotion(id, { status: active ? 'active' : 'paused' })`
- Colores: `Switch` de shadcn ya usa `primary` / marca vía CSS variables.

Aplicar en listado unificado y, si queda tab Cupones temporal, ahí también.

### 3.3 Textos explicativos (borrador)

**Bloque intro Promociones/Campañas:**

> Las **campañas** definen descuentos del spa. Si llevan **código**, el cliente lo escribe en mostrador (ej. `BIENVENIDA`). Si son **automáticas**, el sistema las aplica cuando se cumplen las reglas (día, servicio, mascotas, etc.).

**Ejemplo cupón:** “Primera visita: código `BIENVENIDA` → $10.000 off con compra mínima $40.000.”

**Ejemplo automática:** “Martes de Baño: 20% en baños los martes, sin escribir nada.”

**Bloque intro Beneficios:**

> Un **beneficio** es un premio **personal** para un cliente (compensación, regalo manual o premio por fidelización). El cliente lo elige al pagar; no es un código público de campaña.

**Ejemplo complejo:** “Ana lleva 12 meses y 8 visitas → regla ‘Aniversario Kira’ emite baño gratis válido 30 días. Solo servicios de baño; no aplica a collares de vitrina.” *(requiere alcance — ver 3.4)*

### 3.4 Beneficios: alcance servicios / vitrina / ambos

**Hoy no existe** en `loyalty_rewards`. El descuento se calcula sobre `subtotal` total de la venta.

**Cambio propuesto:**

| Capa | Cambio |
|------|--------|
| BD | `ALTER loyalty_rewards ADD applies_to text CHECK ('services','store','both') DEFAULT 'both'` (migración `051` o siguiente) |
| API | `issueLoyaltyReward` + PATCH aceptan `applies_to` |
| Motor | `promotion_engine._eval_reward` + `compute_discount`: base imponible = suma líneas servicio, vitrina (`store_purchases` / items inventario `externo`), o ambas |
| UI | Radio o select en `LoyaltyRewardsPanel`: “Solo servicios · Solo vitrina · Servicios y vitrina” |

**Complejidad:** media — ventas ya distinguen servicio vs productos vitrina en `main.py` (`sale_items` vs inventario shoppable).

### 3.5 Diseño “menos plano”

- Intro con icono + fondo `secondary/40` (patrón ya usado en niveles/reglas).
- Filas tipo **card** con borde suave, badge de tipo (`Cupón` / `Automática` / `Pausada`).
- Columna estado = Switch + badge texto.
- Acción secundaria “Editar” en lugar de solo pausar.

---

## 4. Archivos a tocar (implementación)

| Repo | Archivos |
|------|----------|
| Front | `panel.promociones.tsx`, `loyalty-admin.tsx`, opcional `promo-help.tsx`, `spa-queries.ts` |
| Back | migración `loyalty_rewards.applies_to`, `promotions.py` (issue reward), `promotion_engine.py` |

---

## 5. Fuera de alcance (por ahora)

- Edición completa de promoción existente (PATCH ya parcial en API).
- Multitenant / esquemas cupones del ítem PENDIENTES #17 (modelo distinto).
- Notificaciones por correo al pausar campaña.

---

## 6. Checklist revisión mañana

- [ ] ¿Unificamos pestañas (A) o solo mejoramos Cupones (B)?
- [ ] ¿Toggle pausa en listado unificado?
- [ ] ¿Alcance beneficios en esta iteración o solo copy?
- [ ] ¿Editar campaña en v1 o solo crear + pausar?
