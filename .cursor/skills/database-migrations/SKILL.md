---
name: database-migrations
description: >-
  Supabase PostgreSQL migrations for Planora: tables, FKs, constraints,
  indexes, timestamps, RLS policies. Use when creating or editing SQL
  migrations, schema, or database policies under supabase/migrations.
---

# Database Migrations (Planora)

Complementa `agent.md` §13–15. No inventar EAV ni schemas dinámicos.

## Propósito

Evolucionar el schema de forma versionada, segura y alineada al dominio.

## Cuándo usarlo

- Crear/alterar tablas, constraints, índices, triggers de `updated_at`, RLS/policies.

## Cuándo NO usarlo

- Cambios solo de UI/cliente.
- “Arreglar prod” a mano sin migración.
- Tablas genéricas `entity` / `property` / `dynamic_field`.

## Reglas obligatorias

1. Migraciones SQL versionadas; descriptivas.
2. RLS + policies en la misma entrega que tablas expuestas al cliente.
3. FKs con `on delete` explícito (p. ej. cascade project → children).
4. Dinero: `numeric` (no float).
5. `status`/`priority`: `check` o enum PG documentado.
6. Índices solo justificados (FKs, filtros frecuentes).
7. Timestamps: `created_at`/`updated_at` con defaults/`updated_at` trigger si se usa.
8. Preferir unique parcial para una sola option `selected` por item.

## Patrones recomendados

Tablas conceptuales: `profiles`, `projects`, `categories`, `items`, `item_options`.

Policy pattern (hijos):

```sql
-- Ejemplo conceptual: items select
create policy items_select_own on items for select using (
  exists (
    select 1 from projects p
    where p.id = items.project_id and p.user_id = auth.uid()
  )
);
```

Ownership raíz: `projects.user_id = auth.uid()`.

## Errores comunes

- Tabla sin RLS.
- Policy solo en `projects` y tablas hijas abiertas.
- Índice en cada columna “por si acaso”.
- `float` para precios.
- Olvidar `category_id` nullable.
- Cambiar schema sin regenerar tipos TS.

## Checklist

- [ ] Migración nombrada y versionada
- [ ] FKs + checks de dominio
- [ ] RLS en tablas nuevas
- [ ] Policies de ownership verificadas (CRUD)
- [ ] Sin índices injustificados
- [ ] Tipos/cliente actualizables documentados
