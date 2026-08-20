# Nota split

Repos separados: `spakira-lulu-backend` (:9001) + `spakira-lulu-frontend` (:9000).
Local: `./scripts/spakira-lulu-run.sh start` en cada repo. Túnel: `scripts/tunnel-backup.sh`.

# spakira-lulu

Este repo **ya no depende de Lovable** para desarrollo local ni para el runtime.
El aviso histórico de sync Lovable se conserva abajo solo como referencia.

## Flujo Git

- **No** commits ni push directos a `main`.
- Trabajá en ramas `feature/...` y abrí PR a `main`.
- Activar bloqueo local: `./scripts/install-git-hooks.sh`

## Roles de panel

| Rol (BD) | UI | Acceso |
|----------|-----|--------|
| `admin` | Admin | Todo el panel |
| `colaborador` | Staff | Misma fila que el usuario: menú Staff, Mi agenda, Mascotas, Humanos, Servicios (solo lectura). |
| `cliente` | Usuario | Default al registrarse (Google/público). **Mis mascotas** (crear/editar/borrar las suyas), **Mi agenda** (pedir, cambiar o cancelar turno) y **Servicios** (solo lectura). |

Cambiar roles: Configuración → Usuarios (solo admin). Auto-registro Google crea `cliente`.

### Roles y Google

- El menú izquierdo se filtra por `app_users.role` (`admin` | `colaborador` | `cliente`) vía `ROLE_TABS` en `src/lib/roles.ts`.
- Para ver pestañas de admin: el usuario debe tener `role = admin` (invitar en Configuración eligiendo Admin, o el seed `admin@spakira.local`).
- **Google OAuth de login** crea o entra como `cliente` (Usuario) si el correo no es staff. Conectar Google Calendar sigue siendo de personal.

Usuarios locales de prueba:
- `admin@spakira.local` / `AdminKira2026!`
- `colaborador@spakira.local` / `ColaboradorKira2026!`

Contexto de roles/módulos, ver vs editar, staff↔cliente y comandos locales: `docs/contexto-roles-permisos.md`.

Si el proyecto sigue vinculado en lovable.dev, desconectalo desde su UI
(ver `docs/legacy-supabase-lovable/DISCONNECT_LOVABLE.md`).

<!-- HISTÓRICO LOVABLE (ya no aplica al runtime local) -->
> Si en el pasado este repo estaba conectado a Lovable, evitá reescribir
> historia ya publicada (force-push / rebase de commits remotos) mientras
> ese vínculo exista.

## Workspace padre

Si abrís `/facu/learning-n8n/kirajiro/` en Cursor, el mapa multi-repo está en `../AGENTS.md` (o `/facu/learning-n8n/kirajiro/AGENTS.md`).
