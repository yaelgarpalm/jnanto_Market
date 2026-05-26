# Deploy en Render

Este proyecto se despliega como Web Service de Node usando el `render.yaml` incluido en la raiz.

## Antes de desplegar

1. Sube el repositorio a GitHub.
2. Crea las tablas en Supabase con `schema.sql`.
3. Configura las variables de entorno en Render.

## Blueprint

1. En Render abre **New > Blueprint**.
2. Conecta el repositorio de GitHub.
3. Render detectara `render.yaml`.
4. Completa las variables marcadas como `sync: false`.
5. Aplica el Blueprint.

## Variables obligatorias

```bash
NODE_ENV=production
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
APP_URL=https://jnanto-market.onrender.com
```

## Variables opcionales

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
BLOCKCHAIN_PRIVATE_KEY=0x...
GEMINI_API_KEY=...
```

No configures `PORT`; Render lo inyecta automaticamente.
