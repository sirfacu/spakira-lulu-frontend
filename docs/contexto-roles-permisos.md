# Contexto: roles, módulos y cómo levantar el proyecto

Para otro agente o persona: leé este archivo + `AGENTS.md`. No hace falta el chat completo.

Fecha de este recorte: 2026-08-15. Rama típica: `feature/roles-permisos` (sobre inventario). **No** commit/push a `main`; PR desde `feature/...`.

## Qué se pidió

Sistema de roles y permisos por módulo, pestaña Admin, perfiles (Admin / Staff / Usuario) y override por usuario. Después: nivel ver vs editar (ej. clientes ven servicios y no los modifican), tests del registro, staff que también es cliente, y este documento de handoff + comandos.

## Modelo actual (importante)

Hay **dos capas**, no una sola tabla de “CRUD”:

| Capa | Dónde | Qué controla |
|------|--------|----------------|
| **Módulo (ver el menú / entrar a la ruta)** | BD `kira.role_module_access` y `kira.user_module_access` | Si aparece Agenda, Servicios, Inventario, etc. |
| **Acción (crear/editar/borrar)** | Código: `require_admin` / `require_staff` / `is_cliente` + `permissionsFor()` en `src/lib/roles.ts` | Ej. PUT `/services` solo admin |

**En BD hoy no está** el par ver/editar por módulo. Las tablas solo guardan `module_id` (encendido/apagado). Servicios ya es de solo lectura para cliente y staff porque `PUT/DELETE /services` usa `require_admin`, y en UI `canManagePrices` es `false` salvo admin.

### Cómo conviene segregar ver vs editar (siguiente paso, no hecho)

No hace falta un rol nuevo. Por módulo, dos flags (editar implica ver):

- `view` — entra al módulo / GET
- `edit` — POST/PATCH/PUT/DELETE de ese módulo

Propuesta de BD (migración futura `030`):

```text
role_module_access (role, module_id, can_edit boolean default false)
user_module_access (user_id, module_id, can_edit boolean default false)
```

Reglas fijas (igual que ahora con módulos):

- Usuario (`cliente`): nunca `edit` en servicios, inventario, ventas, staff, reportes, configuración, permisos.
- Staff: por defecto `view` en servicios; `edit` solo si el admin lo marca (hoy ni siquiera se puede marcar: está hardcodeado a no).
- Admin: `edit` en todo; `permisos` no se quita.

UI: en `/panel/permisos`, junto a cada módulo, “Ver” y “Editar” (Editar deshabilitado si el rol no puede).

Hasta que exista `030`, no expongas “editar servicios” en la pestaña de permisos: seguiría mintiendo respecto de la API.

## Los tres roles

Un usuario tiene **un solo** `app_users.role` (`admin` | `colaborador` | `cliente`). CHECK en BD. No hay roles simultáneos.

| Rol BD | UI | Alta |
|--------|-----|------|
| `admin` | Admin | Invite o seed `admin@spakira.local` |
| `colaborador` | Staff | Invite / promoción PATCH `/auth/users/{id}` `{role: colaborador}` → crea ficha `kira.staff` |
| `cliente` | Usuario | Default: `POST /auth/register` y Google si el mail **no** existía |

Cuentas locales: `admin@spakira.local` / `AdminKira2026!`, `colaborador@spakira.local` / `ColaboradorKira2026!`.

### Staff que también es cliente — **no está como doble rol**

- Si el mail **ya es staff** y entra con Google, sigue siendo staff (no se pisa a `cliente`).
- Si era cliente y lo promovés a staff, deja de ser `cliente`: una sola sesión, menú de staff, ve **todas** las mascotas/agenda de operación (no el portal “solo lo mío”).
- Si borrás staff (`DELETE /staff/{id}`), el usuario pasa a `role = cliente` y `staff.active = false`. Ahí sí usa portal de dueño.
- Un groomer que trae a su perro **hoy** no tiene “modo cliente” en la misma cuenta. Opciones futuras: segundo flag `also_client`, o impersonar portal, o segunda cuenta. No implementar sin decidir producto.

## Módulos por defecto

- Admin: todos + `permisos` obligatorio.
- Staff: `agenda`, `mascotas`, `propietarios`, `precios`. El admin puede sumar inventario/ventas/etc. en la pestaña.
- Usuario: `agenda`, `mascotas`, `precios`. Prohibido: dashboard, ventas, inventario, personal, reportes, configuración, permisos.

Override por usuario: `user_module_access`. Si no hay filas, hereda el perfil. Cambiar el rol borra el override.

Pestaña: `/panel/permisos` (solo admin). API: `GET/PUT /settings/role-modules`, `GET/PUT /auth/users/{id}/modules`. `/auth/me` trae `modules`, `modules_custom`, `modules_inherited`.

Inventario API: `require_inventario`. Alta de venta: `require_ventas`. GET ventas sigue staff (reportes).

## Archivos clave

- `backend/migrations/029_role_module_access.sql`
- `backend/app/module_access.py`, `routers_permissions.py`, `db_bootstrap.py` (plan 029 + `ensure_role_module_access`)
- `src/routes/_authenticated/panel.permisos.tsx`, `src/lib/roles.ts`, `src/lib/route-access.ts`, `src/components/app-shell.tsx`
- Tests: `backend/tests/test_module_access.py`, `test_client_portal.py` (registro + servicios 403), `test_services_crud.py` (staff no edita), `test_staff_from_user_role.py` (promoción y vuelta a cliente), `src/lib/__tests__/roles.test.ts`

### Bug que ya se corrigió en bootstrap

`ensure_app_users_staff_profile` falla (`must be owner of table app_users`). Si eso ocurría **en la misma transacción** que 029, el COMMIT abortado **deshacía** la migración. Ahora se hace `commit` de migraciones **antes** de esos `ensure`. Si 029 no está, `/auth/me` 500 por tabla faltante; hay fallback `ProgrammingError` a defaults.

## Flujos de alta (tests)

1. Registro correo → `role=cliente`, `profile_complete=false`, módulos agenda/mascotas/precios, PUT `/services` 403, completar `/owners/me`.
2. Google mail nuevo → `cliente`. Mail existente → conserva rol.
3. Invite admin elige rol; colaborador crea fila staff.
4. PATCH rol `cliente` → `colaborador` crea staff; al revés queda `cliente` (ficha staff puede seguir existiendo).

## Comandos locales

Puertos: Vite **9000**, API **9001**, Postgres kira **5434**. Túnel Cloudflare **aparte** de `start` (no recrear el túnel para recargar código).

```bash
# App
./scripts/spakira-lulu-run.sh start|stop|status|restart
./scripts/spakira-lulu-run.sh backend-restart    # recarga API; no cambia URL del túnel
./scripts/spakira-lulu-run.sh frontend-restart

# Túnel (genera local-secrets/vite-tunnel.env — gitignored)
./scripts/spakira-lulu-run.sh tunnel
./scripts/spakira-lulu-run.sh tunnel-stop

# Migraciones (postgres OS; incluye 029)
./scripts/apply-db-scripts.sh

# Hooks: no commit a main
./scripts/install-git-hooks.sh

# Tests
cd backend && APP_ENV=local .venv/bin/pytest tests/test_module_access.py tests/test_client_portal.py tests/test_staff_from_user_role.py tests/test_services_crud.py -q
npx vitest run src/lib/__tests__/roles.test.ts
```

Deploy AWS: `docs/aws-deploy.md` (`AUTO_MIGRATE` en ECS aplica SQL pendiente). No subir facturas por Cloudflare.

No commitear: `local-secrets/`, `.env`, xlsx/zip de razas/cursores, `whatsapp-data`.

## Git

Trabajar en `feature/...`, PR a `main`. No force-push a `main`.
