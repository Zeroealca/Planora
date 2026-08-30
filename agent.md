# Planora — Agent Instructions

Fuente principal de instrucciones para cualquier agente de IA que trabaje en este repositorio.
Los skills en `.cursor/skills/` complementan este documento; no lo duplican.

---

## 1. Project Overview

**Planora** es una aplicación web para gestionar proyectos personales con presupuesto, categorías, ítems, prioridades, estados, opciones de compra y seguimiento de progreso.

Es una app **genérica de dominio de proyecto**, no un constructor de apps ni un framework. El primer caso de uso es “Amueblar mi casa”, pero el dominio **no** debe acoplarse a casas, habitaciones ni muebles.

---

## 2. Product Vision

Un usuario gestiona múltiples **Projects**. Cada proyecto agrupa categorías, ítems, opciones de compra y métricas de presupuesto/progreso.

Ejemplos futuros del mismo modelo:

- Comprar un auto
- Armar una PC
- Planificar un viaje
- Preparar una mudanza
- Organizar un evento
- Remodelar una habitación
- Montar un setup
- Cualquier proyecto personal con presupuesto, ítems y seguimiento

La UI puede usar etiquetas amigables por contexto (p. ej. “Pendiente”, “Mudanza”), pero los valores internos del dominio deben permanecer genéricos (`Pending`, `Critical`, etc.).

---

## 3. Current MVP Scope

Incluir eventualmente (cuando se implemente, no en esta fase de instrucciones):

- Auth email/password (Supabase Auth), sesión persistente, logout, rutas protegidas
- CRUD de projects, categories, items
- Item options (varias por ítem; una seleccionada)
- Dashboard por proyecto con métricas y filtros (priority, category)
- Cálculos de presupuesto vía funciones puras
- UI responsive mobile-first
- PWA instalable (sin offline complejo)
- Deploy en GitHub Pages

Estados fijos MVP: `Pending` | `Purchased` | `AlreadyOwned`  
Prioridades fijas MVP: `Critical` | `High` | `Medium` | `Optional`

---

## 4. Non Goals

No construir en el MVP (ni como “por si acaso”):

- Dominio acoplado a casas/habitaciones/muebles
- Estados/prioridades totalmente configurables por proyecto
- Tablas genéricas (`entity`, `property`, `dynamic_field`, `custom_schema`)
- Backend NestJS / API propia / microservicios
- Clean/Hexagonal Architecture, DDD complejo, CQRS, event sourcing
- Repository pattern sobre Supabase, DI containers, factories innecesarias
- Redux; Zustand por defecto
- Offline-first complejo
- Social login (puede quedar post-MVP)
- Sobreabstracciones “enterprise”

---

## 5. Tech Stack

| Área | Tecnología |
|------|------------|
| UI | React, TypeScript, Vite |
| Backend/DB | Supabase (Auth, PostgreSQL, Storage) |
| Estado | Local → derivado → servidor; Zustand solo si aporta valor real |
| Hosting | GitHub Pages |
| PWA | Manifest + service worker (vite-plugin-pwa o equivalente cuando se configure) |
| Tests | Vitest + React Testing Library |
| Lint | ESLint (config del repo) |

No agregar dependencias si se resuelve razonablemente con las existentes.

---

## 6. Core Domain Concepts

### Project

Entidad principal. Un usuario tiene muchos projects.

Campos conceptuales: `id`, `user_id`, `name`, `description`, `budget`, `icon` (emoji/opcional), timestamps. Contiene categories, items y progreso derivado.

### Category

Agrupación **dentro de un project**. No asumir que es una habitación. Campos: `id`, `project_id`, `name`, `display_order`, timestamps.

### Item

Algo a adquirir, completar o controlar. Campos: `id`, `project_id`, `category_id?`, `name`, `description?`, `status`, `priority`, `estimated_cost`, `actual_cost`, `notes`, `completed_at`, timestamps.

### ItemOption

Alternativa de compra para un item. Campos: `id`, `item_id`, `name`, `brand`, `model`, `price`, `store`, `product_url`, `image_url`, `description`, `specifications`, `notes`, `selected`, timestamps. Solo una opción `selected` por item (enforcement a documentar/implementar con constraint o lógica explícita).

### Profile

`profiles`: `id` (auth user), `display_name`, timestamps.

---

## 7. Architecture Principles

- Proyecto personal pequeño → **pocas capas**, código directo.
- Lógica de negocio (presupuesto, estados) en **funciones puras** fuera de React y de Supabase.
- Features colocadas por dominio (`src/features/...`).
- Componentes pequeños; hooks solo con reutilización real.
- No crear abstracciones hasta que haya dolor real y repetido.
- Preferir tipado fuerte y nombres claros a indirection.

---

## 8. Folder Structure

Estructura objetivo (crear carpetas cuando haga falta, no vacías “por arquitectura”):

```text
src/
  app/                 # shell, providers, router
  components/          # UI compartida solo con reutilización real
  features/
    auth/
    projects/
    dashboard/
    categories/
    items/
    item-options/
  hooks/               # hooks compartidos (no uno por archivo trivial)
  lib/
    supabase/          # cliente, helpers mínimos
  pages/               # páginas de ruta
  types/               # tipos de dominio / DB generados o alineados
  utils/
    budget/            # cálculos puros de presupuesto
  styles/
supabase/
  migrations/          # SQL versionado (cuando exista)
```

Reglas:

- Funcionalidad relacionada dentro del mismo feature.
- Evitar profundidad excesiva y `index.ts` innecesarios.
- No un archivo por función trivial.
- No componente “reutilizable” hasta haber reutilización real (≥2 usos).

---

## 9. Coding Standards

- Cambios acotados al alcance pedido; sin refactors no solicitados.
- No cambiar librerías/arquitectura sin justificación explícita.
- Código legible > clever; comentarios solo si aclaran el “por qué”.
- Sin secretos en el repo; sin `service_role` en frontend.
- Preferir edición de archivos existentes a proliferación de nuevos.

---

## 10. TypeScript Conventions

- `strict` habilitado; evitar `any`; preferir `unknown` + narrowing.
- Tipos de dominio en `src/types/` o junto al feature si son locales.
- Alinear tipos con schema Supabase (tipos generados cuando estén disponibles).
- Enums de dominio: unions string literales (`'Pending' | 'Purchased' | 'AlreadyOwned'`).
- Nombres en inglés en código; labels de UI pueden estar en español.

---

## 11. React Conventions

- Solo functional components + hooks.
- Composición; props claras; evitar prop drilling excesivo (pasar lo mínimo o elevar con cuidado).
- **No** lógica financiera en JSX: llamar utils de `utils/budget`.
- Evitar `useEffect` innecesarios; no `useMemo`/`useCallback` por defecto.
- Estados de UI: loading, empty, error, siempre explícitos en pantallas de datos.
- Formularios cortos; validación cercana al input.

---

## 12. Supabase Conventions

- Un solo cliente browser con anon key.
- Queries/mutations directas desde hooks o módulos de feature; **no** repositorios vacíos que solo envuelven Supabase.
- Manejar `{ data, error }` siempre; no ignorar errores.
- Tipos alineados con tablas; regenerar tras migraciones.
- Storage paths deben permitir ownership vía policies (projects/items/options).

Detalle operativo: skill `supabase`.

---

## 13. Database Conventions

Modelo conceptual inicial (sin migraciones aún):

| Tabla | Notas |
|-------|--------|
| `profiles` | `id` = `auth.users.id` |
| `projects` | `user_id` → owner |
| `categories` | `project_id`, `display_order` |
| `items` | `project_id`, `category_id` nullable, `status`, `priority`, costs |
| `item_options` | `item_id`, `selected` |

Mejoras simples aceptables:

- `check` constraints en `status` / `priority`
- Partial unique index: una sola `item_options.selected = true` por `item_id`
- `numeric`/`decimal` para dinero, no `float`
- Índices solo en FKs y filtros frecuentes (`project_id`, etc.)

No introducir EAV ni schemas dinámicos.

---

## 14. Migration Rules

- Toda evolución de schema vía migraciones SQL versionadas.
- Sin cambios manuales no documentados en producción/staging.
- Incluir RLS + policies en la misma migración que crea tablas accesibles.
- Nombrar migraciones de forma descriptiva.
- Tras migrar: regenerar tipos TS cuando el flujo lo permita.

Detalle: skill `database-migrations`.

---

## 15. Row Level Security Rules

- RLS **obligatorio** en todas las tablas expuestas al cliente.
- Un usuario solo ve/edita sus `projects` (`auth.uid() = user_id`).
- `categories`, `items`, `item_options`: acceso vía ownership del project padre (join/`exists`).
- `profiles`: el usuario solo gestiona su fila.
- Storage policies equivalentes por path/ownership.
- Nunca confiar solo en filtros del frontend.

---

## 16. Authentication Rules

MVP:

- Email/password
- Sesión persistente (Supabase default session)
- Logout
- Rutas protegidas (redirigir a login si no hay sesión)

Post-MVP opcional: social login.

No exponer datos de otros usuarios en ningún flujo.

---

## 17. State Management Rules

Orden de preferencia:

1. Estado local del componente
2. Estado derivado (cálculos, filtros aplicados)
3. Estado del servidor (Supabase queries / cache ligera en hooks)
4. Zustand **solo** para estado realmente global (p. ej. proyecto activo, preferencias UI, filtros compartidos entre pantallas)

No meter en Zustand datos de Supabase “porque sí”.

---

## 18. Data Fetching Rules

- Fetch cerca del feature que lo necesita.
- Mostrar loading/empty/error.
- Invalidar/refetch de forma explícita tras mutations.
- Evitar waterfalls innecesarios; preferir queries con `select` de relaciones cuando aporte claridad.
- No duplicar la misma query en tres componentes hermanos: elevar o compartir hook.

---

## 19. Business Rules

- Categories no implican “habitaciones”.
- Items pueden existir sin category (`category_id` null).
- Completion: `Purchased` y `AlreadyOwned` cuentan como completados; `Pending` no.
- Costos: ver sección 20–21.
- Una sola opción seleccionada por item (diseño; enforcement en DB + UI).

---

## 20. Budget Calculation Rules

Implementar como funciones puras en `src/utils/budget/` (nombres conceptuales):

- `calculatePlannedBudget`
- `calculateActualSpent`
- `calculatePendingBudget`
- `calculateRemainingBudget`
- `calculateCompletionPercentage`
- `calculateBudgetByPriority`
- `calculateBudgetByCategory`

Definiciones:

| Métrica | Regla |
|---------|--------|
| Pending budget | Suma `estimated_cost` de items `Pending` |
| Actual spent | Suma `actual_cost` de items `Purchased` |
| Planned total | Pending budget + Actual spent (AlreadyOwned **no** suma) |
| Remaining | `project.budget - actualSpent` (definir nulls de forma consistente y documentada en código) |
| Completion | `(Purchased + AlreadyOwned) / totalItems` |

Filtros del dashboard (priority/category) deben aplicarse **antes** o como input a estas funciones; no recalcular ad-hoc en JSX.

Nulls: tratar `estimated_cost`/`actual_cost` null como `0` en sumas, salvo que se documente otra política; si `Purchased` sin `actual_cost`, preferir `0` o fallback explícito a `estimated_cost` — **elegir una política, testearla y no mezclar**.

Recomendación MVP: `Purchased` usa `actual_cost ?? 0` (forzar captura de actual en UI más adelante).

Detalle: skill `budget-domain`.

---

## 21. Item State Rules

| Status | Pending $ | Spent $ | Completed? |
|--------|-----------|---------|------------|
| `Pending` | `estimated_cost` | no | no |
| `Purchased` | no | `actual_cost` | sí |
| `AlreadyOwned` | no | no | sí |

Labels UI ejemplo (es): Pendiente / Comprado / Ya lo tengo — solo presentación.

---

## 22. Priority Rules

Valores fijos: `Critical` | `High` | `Medium` | `Optional`.

Labels UI ejemplo (primer caso de uso): Mudanza / Primer mes / Después / Opcional — solo presentación; no modelar “mudanza” en el dominio.

Desgloses de presupuesto por prioridad usan estos valores internos.

---

## 23. Item Options Rules

- Un item puede tener 0..n options.
- Como máximo una `selected: true` por item.
- Seleccionar una opción implica deseleccionar la anterior (transacción o update atómico cuando se implemente).
- Campos de producto (brand, model, price, store, urls) son opcionales salvo `name`.
- No implementar lógica ahora en esta fase de docs; al implementar, seguir esta regla.

---

## 24. UI/UX Guidelines

- Moderno, limpio, minimalista, rápido.
- Cards para items; dashboards claros; filtros sencillos; acciones visibles.
- Estados visuales claros (status/priority/cost).
- Evitar densidad excesiva y paneles saturados.
- Respetar design system del repo cuando exista; no inventar un sistema paralelo.

---

## 25. Responsive / Mobile-First Guidelines

- Diseñar primero para viewport móvil (Android usable).
- Touch targets adecuados; tipografía legible; sin hover-only crítico.
- Desktop: aprovechar espacio sin forzar layouts densos.

---

## 26. PWA Guidelines

- Manifest, icons, `display: standalone`, theme color.
- Service worker con caching seguro de assets estáticos.
- Actualización de SW sin sorprender con datos stale críticos.
- MVP: **sin** modo offline de datos de Supabase; si no hay red/API, error claro.

Detalle: skill `pwa`.

---

## 27. GitHub Pages Deployment Considerations

- Configurar `base` de Vite según path del repo.
- SPA: fallback/`404.html` o estrategia equivalente para refresh en rutas client-side.
- GitHub Actions para build + deploy; secrets solo en Actions, nunca en el bundle salvo `VITE_*` públicos.
- Sin dependencias de SSR ni server features del host.

Detalle: skill `github-pages-deployment`.

---

## 28. Loading States

- Skeleton o indicador explícito en listas/dashboard.
- No flash de contenido vacío confundido con empty state.
- Deshabilitar submits duplicados mientras muta.

---

## 29. Empty States

- Mensaje + CTA (crear primer project/item/category).
- Distinguir “sin datos” de “filtro sin resultados”.

---

## 30. Error States

- Mensaje entendible; acción de reintento cuando aplique.
- No pantallas en blanco silenciosas.
- Errores de red/Supabase: mensaje genérico seguro + log en consola en dev.

---

## 31. Error Handling

- Propagar/manejar errores de Supabase (`error` object).
- No tragar errores en `catch` vacíos.
- Validar inputs en cliente; constraints en DB como red de seguridad.
- Auth errors: mensajes claros sin filtrar detalles internos.

---

## 32. Testing Strategy

Prioridad:

1. Lógica de presupuesto
2. Reglas de estados
3. Filtros
4. Selección de opciones
5. Componentes críticos
6. Formularios críticos

Evitar tests triviales de texto estático o detalles de implementación.

Herramientas: Vitest + RTL. Detalle: skill `testing`.

---

## 33. Accessibility

- Semántica HTML correcta; labels en forms; contraste suficiente.
- Focus visible; teclado usable en flujos principales.
- No transmitir información solo por color (status/priority).

---

## 34. Performance

- Evitar re-renders innecesarios sin micro-optimizar prematuramente.
- Listas grandes: considerar virtualización solo si hay evidencia.
- Imágenes de Storage: tamaños razonables; lazy load cuando ayude.
- Bundle: no importar librerías pesadas sin necesidad.

---

## 35. Security

- Solo anon key en frontend; **nunca** service_role.
- RLS en todas las tablas/storage expuestos.
- Sanitizar/escapar contenido renderizado; cuidado con URLs de usuario (`product_url`).
- No loguear tokens ni PII sensible.
- Variables secretas solo en CI/Supabase dashboard.

---

## 36. Environment Variables

Públicas (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, y `base`/path si aplica.

Documentar en `.env.example` cuando se configure. Nunca commitear `.env` con secretos reales. Service role solo en herramientas server-side si algún día existieran (no en esta app Pages).

---

## 37. Naming Conventions

| Ámbito | Convención |
|--------|------------|
| Archivos/carpetas | `kebab-case` |
| Componentes React | `PascalCase` |
| Funciones/vars | `camelCase` |
| Tipos/Interfaces | `PascalCase` |
| Tablas/columnas DB | `snake_case` |
| Status/priority (código) | inglés PascalCase literales |
| Commits | Conventional Commits (sección 39) |

---

## 38. Definition of Done

Una tarea está hecha cuando:

- [ ] Cumple el alcance pedido sin extras no solicitados
- [ ] Tipos OK (`tsc` / `build` typecheck)
- [ ] Lint OK
- [ ] Tests relevantes OK (si aplica lógica)
- [ ] Build OK cuando el cambio afecta runtime/deploy
- [ ] RLS/seguridad revisada si toca datos
- [ ] Loading/empty/error contemplados en UI nueva
- [ ] Sin secretos ni `service_role` en cliente
- [ ] Resumen de archivos tocados

---

## 39. Git Conventions

Conventional Commits simples; scopes solo si aportan claridad:

```text
feat: add project dashboard
feat: add item creation form
fix: exclude owned items from pending budget
test: add budget calculation tests
chore: ...
refactor: ...
docs: ...
```

No commits proactivos: solo cuando el usuario lo pida.

---

## 40. Instructions for AI Agents

### Antes de modificar código

1. Leer este `agent.md`.
2. Identificar skills relevantes en `.cursor/skills/`.
3. Leer **solo** los skills necesarios para la tarea.
4. Revisar implementaciones existentes antes de crear nuevas.
5. Evitar duplicar lógica (especialmente presupuesto).
6. Mantener cambios limitados al alcance solicitado.

### Después de modificar código

1. Ejecutar TypeScript check
2. Ejecutar lint
3. Ejecutar tests relevantes
4. Ejecutar build cuando corresponda
5. Revisar errores
6. Resumir archivos modificados

### Prohibiciones

- No refactors no solicitados salvo bloqueo real de la tarea.
- No cambiar librerías/arquitectura sin justificación.
- No agregar dependencias si se puede con lo existente.
- No implementar features no pedidas “de regalo”.
- No acoplar el dominio a casas/habitaciones/muebles.
- No sobrearquitectura (ver Non Goals).

### Skills del proyecto

| Skill | Usar cuando |
|-------|-------------|
| `supabase` | Cliente, auth, queries, RLS, Storage, tipos |
| `frontend-react` | Componentes, hooks, forms, estados UI, a11y |
| `database-migrations` | SQL, schema, policies, constraints |
| `testing` | Vitest, RTL, tests de reglas/filtros |
| `pwa` | Manifest, SW, install, caching |
| `github-pages-deployment` | Base path, Actions, SPA routing |
| `budget-domain` | Cálculos, estados de item, filtros de dashboard |

Reglas Cursor adicionales: `.cursor/rules/`.
