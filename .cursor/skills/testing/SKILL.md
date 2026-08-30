---
name: testing
description: >-
  Testing strategy for Planora with Vitest and React Testing Library: budget
  rules, status/priority, filters, option selection, critical UI. Use when
  writing or fixing tests, or when changing budget/filter/business logic.
---

# Testing (Planora)

Complementa `agent.md` §32.

## Propósito

Proteger reglas de negocio deterministas y flujos críticos sin tests ruidosos.

## Cuándo usarlo

- Añadir/cambiar tests; tocar `utils/budget`, filtros, selección de options, forms críticos.

## Cuándo NO usarlo

- Tests que solo asertan texto estático decorativo.
- Probar detalles internos de implementación (spies de cada setState).
- Snapshot masivos frágiles sin valor.

## Reglas obligatorias

1. Preferir Vitest + React Testing Library.
2. Prioridad: presupuesto → estados → filtros → options → UI crítica → forms críticos.
3. Funciones puras: tests unitarios densos, casos borde (null, vacío, filtros).
4. Mocks mínimos: mockear Supabase solo en frontera; no mockear el cálculo.
5. Nombres de test describen la regla de negocio.

## Patrones recomendados

```ts
// Ejemplo conceptual
it('excludes AlreadyOwned from pending and spent', () => {
  const items = [
    { status: 'Pending', estimated_cost: 600, actual_cost: null },
    { status: 'Purchased', estimated_cost: 650, actual_cost: 620 },
    { status: 'AlreadyOwned', estimated_cost: 180, actual_cost: null },
  ]
  expect(calculatePendingBudget(items)).toBe(600)
  expect(calculateActualSpent(items)).toBe(620)
  expect(calculatePlannedBudget(items)).toBe(1220)
})
```

RTL: interactuar como usuario (`getByRole`, `userEvent`); asertar resultados visibles.

## Errores comunes

- Duplicar lógica de budget en el test “helper” distinto al prod.
- Mockear funciones puras en vez de inputs.
- Un solo test feliz sin nulls/filtros.
- Assert de classNames irrelevantes.

## Checklist

- [ ] Cubre la regla de negocio cambiada
- [ ] Casos null/vacío/filtro si aplica
- [ ] Sin mocks innecesarios
- [ ] Tests pasan en Vitest
- [ ] No tests triviales añadidos
