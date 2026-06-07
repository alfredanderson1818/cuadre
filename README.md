# Cuadre — control de cambios para cambistas

App móvil (PWA) + backend multi-cliente. Cada cambista entra con su cuenta y sus datos quedan aislados y guardados en el servidor.

## Cómo correrlo (2 procesos)

Necesitas **dos terminales** (backend + frontend).

### 1) Backend (API + login)
```bash
cd cuadre/server
npm install      # solo la primera vez
npm start        # corre en http://localhost:8788
```

### 2) Frontend (la app)
```bash
cd cuadre
npm install      # solo la primera vez
npm run dev      # corre en http://localhost:5173
```

Abre **http://localhost:5173** en el navegador. El frontend habla con el backend automáticamente (proxy `/api`).

### Verlo en el teléfono (misma red WiFi)
```bash
cd cuadre
npm run dev -- --host    # muestra una URL tipo http://192.168.x.x:5173
```
Abre esa URL en el teléfono. (El backend debe seguir corriendo en la PC.)

## Arquitectura

- **Frontend:** Vite + React. Estado reactivo en `src/store.js`, que carga/guarda contra la API.
- **Backend:** Node + Express (`server/index.js`). Auth con bcrypt (contraseñas hasheadas) + JWT (token 30 días). Datos por usuario en `server/db.json` (un blob de estado por cuenta).
- **Tasas en vivo:** DolarAPI Venezuela (BCV, Euro, Binance/paralelo).

## Demo pública (GitHub Pages)

Hay una demo en vivo en **https://alfredanderson1818.github.io/cuadre/**.
En `github.io` la app corre en **modo demo** (sin backend): los datos viven en el navegador
de cada visitante. Para probar el modo demo localmente: abre `http://localhost:5173/?demo=1`.

Para **volver a desplegar** la demo tras cambios (rama `gh-pages`):
```bash
cd cuadre
VITE_DEMO=1 npm run build
cd dist && touch .nojekyll && git init -q && git add -A \
  && git commit -q -m "deploy" \
  && git push -f "https://<TU_USUARIO>:<TU_TOKEN>@github.com/alfredanderson1818/cuadre.git" HEAD:gh-pages
```
(GitHub Pages debe estar configurado con fuente = rama `gh-pages`, carpeta `/`.)

## Notas para producción (siguiente nivel)

Esto es un prototipo funcional. Para vender en serio conviene:
- Cambiar `db.json` por una base de datos real (Postgres / SQLite / Supabase).
- Mover el `JWT_SECRET` a variable de entorno (`CUADRE_SECRET`).
- Desplegar el backend (Render/Railway/Fly) y el frontend (Vercel/Netlify) con HTTPS.
- Agregar verificación de correo y recuperación de contraseña.
