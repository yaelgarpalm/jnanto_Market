# Jnatjo Market

Marketplace web para productos mazahuas con React, Express, Supabase Auth, Supabase Postgres, Stripe Checkout, trazabilidad QR/NFC y ledger de hashes con anclaje opcional en Polygon Amoy.

## Stack

- React 19 + Vite
- Express
- Supabase Auth y Postgres
- Stripe Checkout
- Render Web Service

## Requisitos

- Node.js 20 o superior
- npm
- Proyecto de Supabase configurado
- Cuenta de Stripe, solo si usaras checkout real

## Configuracion local

1. Instala dependencias:

```bash
npm install
```

2. Copia las variables de ejemplo:

```bash
cp .env.example .env.local
```

En Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

3. Completa `.env.local` con tus claves reales.

4. Crea la base de datos en Supabase usando `schema.sql`.

5. Ejecuta la app:

```bash
npm run dev
```

La app local corre en `http://localhost:3000`.

## Scripts

```bash
npm run dev      # servidor local con Vite middleware
npm run lint     # type-check de TypeScript
npm run build    # compila frontend y servidor
npm run start    # ejecuta dist/server.cjs
```

## Variables de entorno

Obligatorias:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
APP_URL=http://localhost:3000
```

Opcionales segun modulos activos:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
POLYGON_RPC_URL=...
BLOCKCHAIN_PRIVATE_KEY=...
GEMINI_API_KEY=...
```

## Stripe

El checkout usa Stripe en modo test. Para que una compra cambie a `paid` por webhook en local:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copia el `whsec_...` generado en `STRIPE_WEBHOOK_SECRET`.

## Subir a GitHub

Si el repo aun no esta inicializado:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/jnatjo-market.git
git push -u origin main
```

No subas `.env.local`, `node_modules`, `dist`, logs ni capturas QA; ya estan cubiertos por `.gitignore`.

## Deploy en Render

Este repositorio esta listo para desplegarse como Web Service de Node con Blueprint.

1. Sube el proyecto a GitHub.
2. En Render selecciona **New > Blueprint**.
3. Elige el repositorio.
4. Render detectara `render.yaml` y creara el servicio `jnatjo-market`.
5. Completa las variables marcadas como `sync: false`.
6. Usa `APP_URL=https://jnanto-market.onrender.com`.

Valores usados por Render:

```bash
Build Command: npm ci && npm run build
Start Command: npm run start
Health Check Path: /api/health
Node: 20+
```

Mas detalle en `docs/RENDER.md`.

## Notas de seguridad

- Nunca publiques `.env.local`.
- Rota cualquier clave secreta que haya sido compartida fuera de Supabase, Stripe o Render.
- `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y `BLOCKCHAIN_PRIVATE_KEY` deben configurarse como secretos en Render.
