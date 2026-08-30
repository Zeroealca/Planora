---
name: budget-domain
description: >-
  Pure budget and completion rules for Planora items (Pending, Purchased,
  AlreadyOwned), planned/spent/pending/remaining, completion %, breakdowns by
  priority/category, filters and null costs. Use when implementing or changing
  src/utils/budget, dashboard metrics, or item status cost behavior.
---

# Budget Domain (Planora)

Complementa `agent.md` §19–22. Toda lógica aquí es **pura**, sin React/DOM/Supabase.

## Propósito

Una sola fuente de verdad para métricas financieras y de progreso.

## Cuándo usarlo

- Implementar/editar `src/utils/budget/*`, métricas de dashboard, reglas status→costo, filtros que afectan totales.

## Cuándo NO usarlo

- Persistencia/CRUD (Supabase).
- Labels de UI en español (solo mapear presentación).
- Softcodear “habitación” o “mueble” en el dominio.

## Reglas obligatorias — Status

| Status | Pending $ | Spent $ | Completed |
|--------|-----------|---------|----------|
| `Pending` | `estimated_cost` | — | no |
| `Purchased` | — | `actual_cost` | sí |
| `AlreadyOwned` | — | — | sí |

`AlreadyOwned` **nunca** suma su `estimated_cost` al presupuesto necesario/planeado.

## Métricas

- **Pending budget**: Σ `estimated_cost` donde status = `Pending`
- **Actual spent**: Σ `actual_cost` donde status = `Purchased`
- **Planned total**: pending + spent
- **Remaining**: `project.budget - actualSpent` (documentar si budget null)
- **Completion %**: `(Purchased + AlreadyOwned) / totalItems` (0 si total = 0)
- **By priority / by category**: mismas reglas sobre el subconjunto

Funciones conceptuales: `calculatePlannedBudget`, `calculateActualSpent`, `calculatePendingBudget`, `calculateRemainingBudget`, `calculateCompletionPercentage`, `calculateBudgetByPriority`, `calculateBudgetByCategory`.

## Filtros

Priority: `All` | `Critical` | `High` | `Medium` | `Optional`  
Category: `All` | id de categoría del project  

Aplicar filtros al conjunto de items **antes** de calcular (o pasar items ya filtrados). Una sola implementación de cálculo.

## Nulls (política MVP)

- `estimated_cost` / `actual_cost` null → `0` en sumas.
- `Purchased` sin `actual_cost` → `0` (la UI debería pedir el valor; no mezclar fallback silencioso a estimated salvo decisión explícita + tests).
- Lista vacía → totales `0`, completion `0`.

## Ejemplo canónico

| Item | Status | estimated | actual |
|------|--------|-----------|--------|
| Sofá | Pending | 600 | — |
| Refrigeradora | Purchased | 650 | 620 |
| Escritorio | AlreadyOwned | 180 | — |

→ Pending **600**, Spent **620**, Planned **1220**, Completion **2/3**. El 180 no entra.

## Prioridades

Interno: `Critical` | `High` | `Medium` | `Optional`.  
UI ejemplo: Mudanza / Primer mes / Después / Opcional — solo labels.

## Errores comunes

- Sumar `estimated_cost` de `Purchased` al planned además del actual.
- Incluir `AlreadyOwned` en pending/planned.
- Recalcular distinto en dashboard vs lista.
- Usar float y comparar con `toBe` frágil (preferir enteros/centavos o `numeric` estable).
- Filtrar en UI pero calcular sobre lista completa.

## Checklist

- [ ] Funciones puras en `src/utils/budget/`
- [ ] Reglas status respetadas
- [ ] AlreadyOwned excluido de $ pending/spent/planned
- [ ] Filtros no duplican fórmulas
- [ ] Nulls con política MVP + tests
- [ ] Tests del ejemplo canónico pasan
