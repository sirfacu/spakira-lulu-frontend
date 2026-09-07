# Spike: HyperFrames ([heygen-com/hyperframes](https://github.com/heygen-com/hyperframes))

Fecha: 2026-09-07 · Rama: `spike/hyperframes-eval`

## Resumen

HyperFrames convierte **HTML → MP4**. Es un monorepo Bun/Node 22 para agentes y pipelines de video (HeyGen), **no** un kit UI para el panel Spa Kira.

## ¿Meterlo en el frontend?

**No como dependencia del Vite/TanStack app.** Razones:

- Stack ajeno (Bun workspaces, studio, producer, Lambda)
- Peso y superficie enormes vs una app de agenda/grooming
- El home ya embebe Instagram/YouTube; HyperFrames **genera** archivos de video nuevos

## Si hubiera producto de video (ej. reel after-grooming)

1. Front: botón “Generar video” → llama API Spa Kira.
2. Backend: encola job; **no** corre el render dentro de uvicorn.
3. Worker aparte (imagen con HyperFrames CLI/SDK) escribe MP4 a S3; front muestra preview.

Detalle y no-go de vendoreo: ver copia en backend  
`spakira-lulu-backend/docs/spike-hyperframes.md`.

## Recomendación

Mantener esta rama solo como **evaluación**. Experimentos: clonar el repo al lado del workspace, no dentro de `src/`.
