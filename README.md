# Planora

Aplicación web para gestionar proyectos personales con presupuesto, categorías, ítems, prioridades, estados, opciones de compra y progreso.

El dominio es **genérico** (no acoplado a casas ni muebles). El primer caso de uso previsto es “Amueblar mi casa” (plantilla opcional).

## Stack

React · Vite · TypeScript · Supabase (Auth, PostgreSQL, Storage) · PWA · GitHub Pages

## Presupuesto mensual — estado actual

El módulo de presupuesto mensual es independiente de Projects. En esta fase se
persisten categorías financieras por usuario, presupuestos identificados por
`YYYY-MM` y asignaciones por categoría. `availableAmount` es una decisión
manual; las asignaciones son planificación y pueden superar el disponible.

No se persisten agregados como asignado, sin asignar, gastado o restante: se
derivan en el dominio. Las categorías financieras no son las categorías de
Projects y se archivan para preservar el historial.

Las transacciones son la fuente de movimientos reales y no pertenecen a un
presupuesto mensual: el mes se deriva de `occurred_on` como fecha civil. Un
`expense` requiere categoría y suma a `spent`; un `income` puede no tenerla y
no cambia `spent` ni `availableAmount`. Los gastos sin asignación siguen
formando parte del gasto mensual. Refunds, transfers, cuentas, recurrencia y
vínculos con Projects todavía no están implementados.

La navegación incluye **Presupuesto** y **Transacciones**. Desde Presupuesto
puedes crear el disponible del mes, añadir o editar asignaciones y registrar
gastos; las métricas se actualizan desde los movimientos reales. Transacciones
permite registrar, editar y eliminar gastos e ingresos por mes.

## Pagos programados — Fase 6A / 6B / 6C / 6D

Un **Scheduled Payment** es una regla de vencimiento por categoría financiera;
una **Occurrence** es una obligación concreta y persistida para una fecha. No
son transacciones ni asignaciones de presupuesto mensual. Las occurrences se
materializan de forma idempotente por regla y fecha, conservan el importe
esperado como snapshot y nacen en `pending`.

Frecuencias: `monthly`, `annual` y `one_time`. Las fechas son civiles
`YYYY-MM-DD`. La regla mensual/anual conserva el día base: el 31 usa el último
día de los meses cortos, y una regla anual del 29 de febrero vuelve al 29 cuando
el año es bisiesto. Un pago `one_time` usa `startDate` como única fecha de
vencimiento (`endDate` debe ser `null`) y produce como máximo una occurrence.
`overdue` se deriva de `pending` y `dueDate < today`; no se persiste.

Una categoría financiera archivada conserva la regla y su historial, pero hace
que la regla deje de ser elegible para crear occurrences nuevas. Desactivar una
regla tiene el mismo efecto y nunca borra su historial. También puedes
**eliminar** una regla: se borran sus occurrences y deliveries de recordatorio;
las Transactions ya registradas se conservan. Una occurrence `paid`
se confirma mediante una operación atómica: crea una Transaction `expense` y
vincula la occurrence como `paid`, o no cambia nada. El usuario puede ajustar
importe, fecha real y notas antes de confirmar; llegar al vencimiento nunca
crea una Transaction automáticamente. Omitir una occurrence no crea gasto.

Editar una regla **no reescribe** occurrences ya materializadas (fecha e importe
siguen siendo snapshot). Si aún no hay occurrence, la próxima materialización
usa la configuración actual.

El gasto pertenece al mes de `Transaction.occurred_on`, no necesariamente al
mes de `Occurrence.due_date`; por ello las métricas mensuales siguen leyendo
solamente Transactions. Si se elimina una Transaction vinculada, una operación
atómica devuelve la occurrence a `pending` y elimina el vínculo. Las reglas,
los vencimientos y las transacciones siguen siendo conceptos separados.

### Próximos gastos (proyección)

La sección **Próximos gastos** en Pagos programados calcula un forecast
derivado (no persistido) a 3 / 6 / 12 meses a partir del mes visible:

- Incluye reglas `active` con categoría no archivada (`monthly`, `annual`,
  `one_time`).
- **No materializa** occurrences futuras solo para proyectar: usa la lógica
  pura de recurrencia más las occurrences ya existentes en el rango.
- Si ya existe occurrence para un vencimiento, su snapshot (`expectedAmount`,
  status) tiene prioridad sobre el importe actual de la regla.
- Solo `pending` suma a “esperado conocido”. `paid` y `skipped` no inflan el
  pendiente. Variables sin importe incrementan el contador de variables; **no**
  se tratan como $0.
- El forecast **no** crea Transactions, allocations ni altera spent / metas de
  ahorro.

### Recordatorios por correo (Fase 6C)

Cada regla puede activar **un** recordatorio por correo (`reminder_enabled`,
apagado por defecto) con `reminder_days_before` días civiles antes del
vencimiento (`0` = el mismo día). El destinatario es el email de la cuenta
Supabase Auth del propietario.

`reminderDate = dueDate − daysBeforeDue` (fechas civiles). El envío se asocia a
una **occurrence**, no solo a la regla: September y October son independientes.
Solo se envía si la regla está activa, el reminder está enabled, la categoría no
está archivada, la occurrence sigue `pending`, `reminderDate <= today` y no
existe un delivery `sent` para esa occurrence. Paid/skipped no reciben correo.
Cambiar `daysBeforeDue` antes del envío usa la config actual; si ya se envió,
no se reenvía.

Ventana del job: occurrences `pending` con `due_date` en el **mes civil
anterior, actual o siguiente** respecto de `today`. Así se cubren recordatorios
que cruzan de mes (p. ej. due 3 ene, 7 días → 27 dic) y un atraso breve, sin
reabrir historial antiguo al activar reminders hoy.

Persistencia: tabla `scheduled_payment_reminder_deliveries` con unicidad por
`occurrence_id` y estados `pending | processing | sent | failed`. El claim
atómico (`claim_scheduled_payment_reminder`) evita duplicados bajo concurrencia;
un `processing` stale (>15 min) puede reclamarse. Si Resend falla, queda
`failed` y el job diario reintenta mientras siga elegible (tope blando
`REMINDER_MAX_ATTEMPTS = 10`). El correo no crea Transaction ni cambia el status
de la occurrence.

Infraestructura de ejecución (hosting en Vercel, backend Supabase):

- **Scheduler:** Vercel Cron (`0 13 * * *` → 13:00 UTC ≈ 08:00 Ecuador continental)
- **Proxy:** Vercel Function `/api/cron/scheduled-payment-reminders` (solo auth + forward)
- **Procesador:** Edge Function `process-scheduled-payment-reminders`
- **Email:** Resend (secretos solo en Supabase)
- **Auth del proxy:** `Authorization: Bearer <CRON_SECRET>` (Vercel)
- **Auth del processor:** header `x-reminder-job-secret: <REMINDER_JOB_SECRET>`

Ver sección «Recordatorios — despliegue» más abajo.

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
2. Aplica las migraciones de `supabase/migrations/` en orden (SQL Editor o CLI).
3. Copia URL y anon key a `.env`.
4. En Authentication, habilita email/password.
5. En **Authentication → URL Configuration**, configura:
   - **Site URL**: `https://<usuario>.github.io/Planora/` (o `http://localhost:5173` en local)
   - **Redirect URLs** (añade ambas):
     - `http://localhost:5173/auth/callback`
     - `https://<usuario>.github.io/Planora/auth/callback`

Sin esas URLs, el enlace del correo de confirmación no redirige correctamente a la app.

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

Públicas (cliente / build):

- `VITE_SUPABASE_URL` — URL del proyecto Supabase (no es secreta; también usable server-side en el cron proxy)
- `VITE_SUPABASE_ANON_KEY` — clave anónima (pública en el cliente)
- `VITE_SITE_URL` — (opcional) URL pública del sitio para redirects de auth

Solo server-side en **Vercel** (cron proxy; nunca `VITE_*` para secretos):

- `CRON_SECRET` — Bearer que Vercel Cron envía al endpoint; solo en Vercel
- `REMINDER_JOB_SECRET` — mismo valor que en Supabase; el proxy lo reenvía a la Edge Function

Solo server-side en **Supabase** Edge Function secrets:

- `REMINDER_JOB_SECRET` — autentica el processor
- `RESEND_API_KEY` — API key de Resend
- `REMINDER_FROM_EMAIL` — remitente verificado en Resend
- `PLANORA_SITE_URL` — (opcional) enlace “Abrir Planora” en el correo
- `SUPABASE_SERVICE_ROLE_KEY` — inyectada automáticamente en Edge Functions; nunca en el cliente

Nunca commitear `.env` con secretos reales. No usar `service_role` en el frontend.

## Recordatorios — despliegue

Arquitectura:

```text
Vercel Cron (0 13 * * *)
  → Vercel Function /api/cron/scheduled-payment-reminders
  → Supabase Edge Function process-scheduled-payment-reminders
  → Resend
```

Horario: **13:00 UTC** ≈ **08:00 Ecuador continental (UTC−5)**. Una pequeña
variación de horario no afecta el producto (`reminderDate <= today`).

1. Aplica la migración `20260930140000_scheduled_payment_reminders.sql` (si aún no).
2. Edge Function ya desplegada + secrets Supabase (`REMINDER_JOB_SECRET`,
   `RESEND_API_KEY`, `REMINDER_FROM_EMAIL`, `PLANORA_SITE_URL` opcional).
3. En **Vercel → Project → Settings → Environment Variables** (Production), añade:

| Variable | Notas |
|----------|--------|
| `CRON_SECRET` | Genera un valor aleatorio largo; solo Vercel |
| `REMINDER_JOB_SECRET` | **Exactamente** el mismo valor que en Supabase |
| `VITE_SUPABASE_URL` | Ya debería existir en el proyecto |

4. Despliega a Production para que `vercel.json` registre el cron
   (`crons[0].path` = `/api/cron/scheduled-payment-reminders`).
5. Comprueba en **Vercel → Settings → Cron Jobs** que el job aparece
   (`0 13 * * *`).

Prueba manual del proxy (local o contra el deployment; no loguees secretos):

```bash
curl -i -X GET "$VERCEL_URL/api/cron/scheduled-payment-reminders" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Prueba directa del processor (bypass Vercel; útil para aislar fallos):

```bash
curl -X POST "$VITE_SUPABASE_URL/functions/v1/process-scheduled-payment-reminders" \
  -H "Content-Type: application/json" \
  -H "x-reminder-job-secret: $REMINDER_JOB_SECRET" \
  -d "{\"today\":\"2027-01-08\"}"
```

La lógica de elegibilidad, claim, concurrencia, retry, delivery y email
**permanece en Supabase**. Vercel solo autentica el cron y reenvía la petición.
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
    scheduled-payments/
  lib/supabase/
  pages/
  types/
  utils/budget/
  styles/
api/
  cron/                # Vercel Functions (proxy de cron; sin lógica de dominio)
supabase/migrations/
supabase/functions/
```

## Alias de importación

```ts
import { supabase } from '@/lib/supabase/client'
```
