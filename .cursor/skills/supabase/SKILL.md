---
name: supabase
description: >-
  Configures and uses Supabase in Planora (client, Auth, queries, mutations,
  RLS, Storage, typed errors, ownership). Use when touching src/lib/supabase,
  auth flows, data access, Storage uploads, or generated DB types.
---

# Supabase (Planora)

Complementa `agent.md`. No reescribir la visión de producto aquí.

## Propósito

Mantener acceso a datos seguro, directo y tipado con Supabase como único backend.

## Cuándo usarlo

- Cliente Supabase, Auth, CRUD, Storage, RLS, regeneración/uso de tipos.

## Cuándo NO usarlo

- Cálculos de presupuesto (skill `budget-domain`).
- Solo UI/presentación sin datos.
- Inventar un backend Nest/API propia.

## Reglas obligatorias

1. Solo **anon/public** key en frontend (`VITE_SUPABASE_*`). Nunca `service_role`.
2. Toda tabla/bucket expuesto: **RLS** + policies por ownership.
3. Ownership: `projects.user_id = auth.uid()`; categories/items/options vía project padre.
4. Siempre revisar `error` de las respuestas Supabase.
5. No Repository/Service que solo envuelva una llamada `.from()`.
6. Tipos alineados al schema; regenerar tras migraciones.

## Patrones recomendados

```ts
// Cliente único (browser)
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

```ts
const { data, error } = await supabase
  .from('items')
  .select('*, category:categories(*), options:item_options(*)')
  .eq('project_id', projectId)

if (error) throw error // o mapear a mensaje UI
```

Auth MVP: `signInWithPassword`, `signUp`, `signOut`, `onAuthStateChange`, sesión persistente.

Storage: paths que permitan policy por user/project (p. ej. `{user_id}/{project_id}/...`).

## Errores comunes

- Usar service role en Vite “para que funcione”.
- Filtrar solo en el cliente y olvidar RLS.
- Ignorar `error` y asumir `data`.
- Policies de hijos sin `EXISTS` al project owner.
- Subir a Storage con bucket público sin ownership.

## Checklist

- [ ] Sin service_role en cliente
- [ ] RLS/policies contempladas (o skill migrations)
- [ ] Errores manejados en UI
- [ ] Tipos coherentes con tablas
- [ ] Auth: rutas protegidas si aplica
- [ ] Storage: path + policy de ownership
