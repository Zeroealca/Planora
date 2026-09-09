---
name: budget-domain
description: >-
  Pure budget and completion rules for Planora items (Pending, Purchased,
  AlreadyOwned), plannedPrice/plannedCost, planned/spent/pending/remaining,
  completion %, breakdowns by priority/category, filters and null costs. Use
  when implementing or changing src/utils/budget, dashboard metrics, or item
  status cost behavior.
---

# Budget Domain (Planora)

Complementa `agent.md` §19–22. Toda lógica aquí es **pura**, sin React/DOM/Supabase.

## Propósito

Una sola fuente de verdad para métricas financieras y de progreso.

## Fuente de verdad del presupuesto del proyecto

- `projects.budget` es el tope/presupuesto disponible (manual).
- `resolveProjectBudget` solo lee `projects.budget`.
- Por proyecto, `savings_mode` es exclusivo y el tipo **meta (`goal`) es inmutable**
  (solo se elige al crear).
  - `plan` / `none`: proyectos de compras (ítems + presupuesto).
  - `goal`: proyecto solo de meta; dashboard y pestañas distintos (sin ítems).
- Los planes/meta **no** sobrescriben automáticamente `budget`.

## Funciones centrales (derivadas, no persistidas)

### `plannedPrice(item)`

1. Si hay opción seleccionada con precio finito → ese precio
2. Si no → `estimated_cost ?? 0`

### `plannedCost(item)`

| Behavior | Valor |
|----------|--------|
| `owned` | `0` |
| `purchased` | `actual_cost ?? selected_option_price ?? estimated_cost ?? 0` |
| `pending` | `plannedPrice(item)` |

Status behavior via `getStatusBehavior` + `ProjectStatusOption` del proyecto.

## Agregados (dashboard)

- **Presupuesto disponible**: `projects.budget`
- **Presupuesto original**: Σ `estimated_cost` de ítems que no son `owned` (pending + purchased)
- **Pending**: Σ `plannedCost` de ítems pending
- **Spent**: Σ `actual_cost` de purchased (null → 0 en suma; no inventar con fallback)
- **Costo proyectado / Planeado**: `spent + pending` (`calculateProjectedCost` ≡ `calculatePlannedBudget`)
- **Saldo proyectado**: `budget − projectedCost` (negativo = supera tope)
- **Completion %**: `(purchased + owned) / total`
- Conteos: `countItemsByBehavior` → pending / purchased / owned / completed / total

## Ahorro vs presupuesto del ítem (derivado, no persistido)

Módulo: `src/utils/budget/item-savings.ts` (distinto del plan de ahorro mensual en `savings.ts`).

### `expectedSavingsForItem`

Solo `pending` con `estimated_cost` finito:

`estimated_cost − plannedPrice(item)`

- positivo → ahorro esperado
- negativo → sobrecosto esperado
- `null` → no aplica

### `actualSavingsForItem`

Solo `purchased` con `estimated_cost` y `actual_cost` finitos:

`estimated_cost − actual_cost`

- positivo → ahorro real
- negativo → sobrecosto real
- `null` → no aplica (p. ej. sin precio real)

Agregados: `calculateExpectedSavings` / `calculateActualSavings`, y por prioridad/categoría.
**No mezclar** esperados con reales.

## Resúmenes por categoría / prioridad

Módulo: `src/utils/budget/summary.ts`.

- `calculateBudgetSliceMetrics(items)` reutiliza las mismas funciones del dashboard
  (original, pending, spent, projectedCost, ahorros).
- `calculateMetricsByCategory` / `calculateMetricsByPriority` particionan con `filterItems`
  y aplican ese slice — **sin** `plannedCost` alternativo.
- Si todos los ítems tienen categoría (o se incluye el bucket sin categoría),
  `sum(slices) === totals`. Igual para prioridades.

`BudgetItem` incluye `selected_option_price` (derivado de la opción seleccionada). Usar `toBudgetItem` / `mapBudgetItem`.

## Nulls

- Costos no finitos → tratados como ausentes / `0` según la función.
- Purchased sin `actual_cost` → no suma a spent ni a ahorro real.
- Lista vacía → totales `0`, completion `0`.

## Errores comunes

- Sumar `estimated_cost` directo en dashboard en vez de `plannedCost` para pendiente.
- Usar `budget − spent` como saldo (debe ser `budget − projectedCost`).
- Mezclar ahorro esperado y real en una sola métrica.
- Dejar que savings mensuales controlen `projects.budget`.
- Duplicar fórmulas en JSX.
- Incluir `AlreadyOwned` en presupuesto original / pending / spent / planned.

## Checklist

- [ ] Funciones puras en `src/utils/budget/`
- [ ] `plannedPrice` / `plannedCost` únicos
- [ ] `projectedCost === spent + pending`
- [ ] `projectedBalance === budget - projectedCost`
- [ ] Ahorro esperado/real separados + tests
- [ ] Pending usa opción seleccionada cuando existe
- [ ] Spent usa solo `actual_cost`
- [ ] `projects.budget` no depende de savings
- [ ] Tests del ejemplo refrigeradora y proyección pasan
