# Planora

Aplicación web para gestionar proyectos personales con presupuesto, categorías, ítems, prioridades, estados, opciones de compra y progreso.

El dominio es **genérico** (no acoplado a casas ni muebles). El primer caso de uso previsto es “Amueblar mi casa” (plantilla opcional).

## Stack

React · Vite · TypeScript · Supabase (Auth, PostgreSQL, Storage) · PWA · GitHub Pages

## Para agentes y contribuidores

- Instrucciones del proyecto: [`agent.md`](./agent.md)
- Roadmap de implementación: [`PROJECT_PLAN.md`](./PROJECT_PLAN.md)
- Entrada Cursor Agents: [`AGENTS.md`](./AGENTS.md)
- Skills: [`.cursor/skills/`](./.cursor/skills/)
- Reglas: [`.cursor/rules/`](./.cursor/rules/)

## Desarrollo local

```bash
npm install
cp .env.example .env
npm run dev
```

Completa `.env` con la URL y la **anon key** de Supabase (nunca `service_role`).

La app estará en `http://localhost:5173`.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Typecheck + build de producción |
| `npm run typecheck` | Verificación de tipos TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Tests (Vitest) |
| `npm run preview` | Vista previa del build de producción |

## Supabase

1. Crea un proyecto en [Supabase](https://supabase.com).
2. Aplica la migración `supabase/migrations/20260830120000_initial_schema.sql` (SQL Editor o CLI).
3. Copia URL y anon key a `.env`.
4. En Authentication, habilita email/password.

Tras cambiar el schema, regenera tipos:

```bash
npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
```

Los tipos de dominio (`src/types/domain.ts`) se mantienen; los mappers convierten `numeric` de Postgres a `number`.

## GitHub Pages

El workflow `.github/workflows/deploy-pages.yml` hace lint, tests y build, y publica `dist`.

Secrets de Actions (públicos en el bundle, no `service_role`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`GITHUB_PAGES_BASE` en CI es `/Planora/` (ajústalo si el repo no se llama Planora). En local el `base` es `/`.

El build copia `index.html` a `404.html` para que el refresh de rutas SPA funcione en Pages.

## PWA

El build genera manifest + service worker. Cachea el app shell y assets estáticos; no cachea datos de Supabase. Si hay una versión nueva, la app ofrece actualizar.

## Variables de entorno

- `VITE_SUPABASE_URL` — URL del proyecto Supabase
- `VITE_SUPABASE_ANON_KEY` — clave anónima (pública en el cliente)

Nunca commitear `.env` con secretos reales. No usar `service_role` en el frontend.

## Estructura

```text
src/
  app/                 # shell, layout y router
  features/
    auth/
    projects/
    dashboard/
    categories/
    items/
    item-options/
  lib/supabase/
  pages/
  types/
  utils/budget/
  styles/
supabase/migrations/
```

## Alias de importación

```ts
import { supabase } from '@/lib/supabase/client'
```
