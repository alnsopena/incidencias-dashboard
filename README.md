# Incidencias & Mejoras Go Live — dashboard público

Dashboard estático que muestra el tablero de monday.com "Incidencias & Mejoras Go Live".
Se actualiza solo cada 30 minutos vía GitHub Actions y se sirve gratis con GitHub Pages.
No depende de Claude ni consume tokens de Claude.

## Cómo funciona

- `.github/workflows/update.yml` corre cada 30 minutos, ejecuta `scripts/fetch-monday.mjs`
  (que llama a la API de monday.com con el secret `MONDAY_API_TOKEN`) y guarda el resultado
  en `data/raw.json`.
- `index.html` es 100% estático: cuando alguien lo abre, hace `fetch('./data/raw.json')` y
  renderiza el reporte en el navegador. No hay servidor, no hay costo por visita.
- El token de monday.com vive **solo** como secret de GitHub Actions — nunca llega al
  navegador de quien visita la página.

## Configuración (una sola vez)

1. **Generar un token de monday.com**: en monday.com, ícono de tu avatar (arriba a la
   derecha) → "Administración" → "API" (o "Developers" → "My Access Tokens") → generar un
   token personal con acceso de lectura al tablero `18429643827`.

2. **Guardarlo como secret en GitHub**: en este repo, ve a `Settings` → `Secrets and
   variables` → `Actions` → `New repository secret`.
   - Name: `MONDAY_API_TOKEN`
   - Value: (pega el token de monday.com)

3. **Activar GitHub Pages**: `Settings` → `Pages` → en "Build and deployment", Source:
   `Deploy from a branch` → Branch: `main` y carpeta `/ (root)` → `Save`.

4. **Primera ejecución**: ve a la pestaña `Actions` → workflow "Actualizar datos de
   monday.com" → `Run workflow` para generar `data/raw.json` con datos reales de una vez
   (si no, se genera solo en un máximo de 30 minutos).

El link público quedará como `https://<tu-usuario>.github.io/<nombre-del-repo>/`.

## Cambiar la frecuencia de actualización

Edita el `cron` en `.github/workflows/update.yml` (la sintaxis es en UTC). Por ejemplo,
`*/15 * * * *` para cada 15 minutos, o `0 * * * *` para cada hora. GitHub Actions es
gratuito para repos públicos dentro de límites muy generosos — cada 30 min está muy lejos
de cualquier límite.
