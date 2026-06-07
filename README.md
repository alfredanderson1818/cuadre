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

## Notas para producción (siguiente nivel)

Esto es un prototipo funcional. Para vender en serio conviene:
- Cambiar `db.json` por una base de datos real (Postgres / SQLite / Supabase).
- Mover el `JWT_SECRET` a variable de entorno (`CUADRE_SECRET`).
- Desplegar el backend (Render/Railway/Fly) y el frontend (Vercel/Netlify) con HTTPS.
- Agregar verificación de correo y recuperación de contraseña.
