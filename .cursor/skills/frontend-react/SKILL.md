---
name: frontend-react
description: >-
  React UI patterns for Planora: components, hooks, forms, composition, local
  state, responsive mobile-first, a11y, loading/empty/error. Use when building
  or editing React components, pages, forms, or feature UI under src/.
---

# Frontend React (Planora)

Complementa `agent.md`. No duplicar reglas de presupuesto ni Supabase.

## Propósito

UI clara, mobile-first y mantenible sin abstracciones prematuras.

## Cuándo usarlo

- Componentes, páginas, hooks de UI, formularios, estados visuales, responsive/a11y.

## Cuándo NO usarlo

- Schema SQL / RLS (skills de DB/Supabase).
- Fórmulas de presupuesto (skill `budget-domain`): solo consumir resultados.
- Introducir Zustand sin necesidad global real.

## Reglas obligatorias

1. Functional components + TypeScript.
2. Sin lógica financiera en JSX.
3. Sin `useMemo`/`useCallback` por defecto; sin effects innecesarios.
4. Pantallas de datos: **loading**, **empty**, **error** (y “filtro sin resultados”).
5. No componente compartido hasta reutilización real (≥2).
6. Mobile-first; acciones principales visibles.

## Patrones recomendados

- Feature folders: `src/features/<feature>/` con UI + hooks del feature.
- Formularios cortos; labels asociados; validación cercana al campo.
- Estado: local → derivado → datos servidor en hooks → Zustand solo si global.
- Cards de item: nombre, status, priority, estimated/actual, nº options.
- Composición: pasar callbacks/datos mínimos; evitar god-components.

## Errores comunes

- Dashboard que recalcula costos en el render tree.
- Empty state igual que “cargando” o “filtro vacío”.
- Prop drilling de todo el project tree.
- Crear `components/ui/*` genéricos sin segundo uso.
- Hover-only en flujos críticos móviles.

## Checklist

- [ ] Loading / empty / error cubiertos
- [ ] Sin cálculos de budget en JSX
- [ ] Usable en móvil
- [ ] Forms con labels / focus
- [ ] Status/priority no solo por color
- [ ] Sin abstracción nueva injustificada
