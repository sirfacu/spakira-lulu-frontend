# spakira-lulu-frontend

Panel Vite / TanStack (puerto **9000**).

Repo hermano: [spakira-lulu-backend](https://github.com/sirfacu/spakira-lulu-backend) (`:9001`).

## Local

```bash
# Primero la API
cd ../spakira-lulu-backend && ./scripts/spakira-lulu-run.sh start

# Luego el panel
cd ../spakira-lulu-frontend
./scripts/spakira-lulu-run.sh start    # http://localhost:9000
./scripts/spakira-lulu-run.sh stop
./scripts/spakira-lulu-run.sh status
./scripts/spakira-lulu-run.sh restart
```

Sin `VITE_API_URL`, el cliente usa `http://<host>:9001` (`src/lib/api.ts`).

Opcional `.env`:

```
VITE_API_URL=http://127.0.0.1:9001
```

## Túnel (backup)

Vive en el backend: `../spakira-lulu-backend/scripts/tunnel-backup.sh` (también hay copia en `scripts/`).

## Tests

```bash
npm install
npm test
```
