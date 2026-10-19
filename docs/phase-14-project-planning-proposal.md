# Fase 14 — propuesta de planificación de proyectos y compras

Fecha de análisis: 2026-10-19.

Este documento se basa en código, migraciones y pruebas actuales. Es una propuesta
de producto: no aplica cambios de comportamiento, migraciones, dependencias ni
operaciones sobre Supabase.

## Resumen ejecutivo

Planora ya permite planificar proyectos de compras con categorías, prioridades,
ítems, alternativas, presupuesto y costes reales. También mantiene separadas dos
formas de ahorro: un plan opcional para un proyecto de compras y una meta de ahorro
con objetivo, reserva y mes viable.

La necesidad principal no es otro modelo financiero. El resumen responde cuánto
costará un proyecto, pero no convierte con suficiente claridad esos datos en una
lista breve de qué preparar o comprar después. La Fase 14 recomendada es un
**panel de decisión de compra** de solo lectura basado en las capacidades actuales.
Debe priorizar pendientes, mostrar su preparación y enlazar al detalle para actuar.
No debe inferir disponibilidad de dinero, crear compromisos ni cambiar fórmulas.

No requiere cambios de base de datos. Antes de implementarla debe aprobarse si las
prioridades actuales son suficientes como orden sugerido o si se requiere más adelante
una planificación persistente por etapas.

## 1. Evidencia revisada

- Modelo y RLS: `supabase/migrations/20260830120000_initial_schema.sql`,
  `20260909170000_savings_goal.sql` y `20260909180000_savings_mode.sql`.
- Interfaz: `src/pages/project-page.tsx`, formularios de proyectos e ítems,
  `ItemTable`, `OptionList`, `DashboardPanel` y `ProjectSavingsSection`.
- Dominio: `src/utils/budget/calculations.ts`, `item-savings.ts`, `savings.ts` y
  `savings-goal.ts`.
- Cobertura: pruebas de cálculos, atención, ordenación y selección de opciones; E2E
  de proyectos/compras y metas de ahorro.

Los importes conservan la semántica actual: Planora planifica compras personales; no
representa un ledger, saldos de cuentas ni conciliación bancaria.

## 2. Proyectos y compras hoy

| Área | Implementado | Límite u oportunidad |
|---|---|---|
| Proyecto | CRUD, tope manual, icono, descripción, plantilla y duplicación. Se crea como compras/presupuesto o como meta de ahorro. | Un proyecto de compras no tiene fecha objetivo ni etapas persistentes. |
| Organización | Categorías ordenables; estados y prioridades por proyecto; búsqueda, filtros, ordenación y contexto en URL. | Las prioridades clasifican, pero no existe una cola explícita de próximas decisiones. |
| Ítems | Cantidad, categoría, prioridad, estado, tope estimado total, coste real total, enlace y notas. | No agenda compras ni reserva presupuesto mensual; no debe fingir que existe disponibilidad. |
| Alternativas | Varias opciones por ítem con marca, modelo, tienda, precio, URL, imagen y seguimiento. Una selección exclusiva se garantiza con RPC e índice único. | Falta una síntesis transversal de ítems sin alternativa/precio seleccionados. |
| Costes | Opción seleccionada para proyección; coste real separado para compra; revisión de precio cuando hay URL compatible. | El rastreo externo depende del proveedor y no debe sostener recomendaciones automáticas. |
| Resumen | Presupuesto disponible, coste proyectado, saldo, progreso, gasto, pendiente y desgloses por prioridad/categoría. Atención detecta datos incompletos. | El usuario navega entre resumen, filtros y detalle para saber qué resolver primero. |
| UX | Pestañas, tarjetas, filtros desplegables, modal accesible y rejillas adaptables. E2E cubre proyecto → ítem → opción → compra. | En móvil conviene una lista corta con enlaces, no duplicar una tabla extensa. |

### Reglas que deben preservarse

- **Pendiente**: opción seleccionada por cantidad; si no existe, tope estimado total.
- **Gastado**: solo coste real de ítems comprados; una opción no inventa gasto real.
- **Proyectado**: `gastado + pendiente`; el saldo es el tope del proyecto menos ese
  coste proyectado.
- **Ya lo tengo**: completa el ítem, pero no consume presupuesto, pendiente ni gasto.
- **Ahorro esperado y real**: son métricas distintas frente al estimado y no son
  efectivo disponible.

Estas reglas están centralizadas y probadas en `src/utils/budget/`. La próxima fase
debe consumirlas, no reimplementarlas en JSX.

## 3. Ahorro y planificación hoy

| Concepto | Implementado | Relación con compras/presupuesto |
|---|---|---|
| Plan de ahorro | Aportes mensuales entre fechas, interés opcional y movimientos extraordinarios para un proyecto de compras. | Es informativo: `projects.budget` sigue siendo el único tope de compras y el plan no lo sobrescribe. |
| Meta de ahorro | Proyecto fijo `goal`: saldo inicial, objetivo, reserva, aporte mensual, fecha inicial, movimientos y simulación antes de aplicar. | No tiene ítems ni categorías. El mes viable deriva de objetivo + reserva, no de un calendario de compras. |
| Proyección | Calcula mes viable, meses, saldo y saldo posterior; hay límite defensivo de 600 meses. | No consulta presupuesto mensual, transacciones, pagos programados ni cuentas. |
| Presupuesto mensual | Asignaciones, gasto real por transacción, pagos programados y forecast son otro módulo. | No hay vínculo automático a ítems, metas o compras; así se evita doble contabilización. |

Ya hay relación **informativa** entre alternativas, coste de proyecto y ahorro, pero
no una relación temporal ni de capacidad de efectivo. Una fecha de finalización para
compras o una recomendación de ahorro por ítem exigiría definir asignación de aportes,
pagos programados y el significado de “disponible”. El modelo actual no permite
deducirlo de forma honesta.

## 4. Mejoras evaluadas

| Prioridad | Mejora | Beneficio y reutilización | Complejidad / BD | Riesgo |
|---|---|---|---|---|
| Alta | Panel de decisión de compra | Hace accionables prioridades, estados, atención y costes derivados; reduce la navegación para saber qué atender. | Media / sin migración | Confundir prioridad con financiación; el texto debe impedirlo. |
| Alta | Resumen de preparación de alternativas | Expone pendientes sin opción, sin precio planeado o con opción sin precio. Reutiliza atención y selección exclusiva. | Baja-media / sin migración | Duplicar el CRUD; debe ser una lista breve de enlaces. |
| Media | Comparación visual más rica | Ayuda a comparar precio, tienda y enlace de alternativas del mismo ítem. | Media / sin migración | “Mejor” no puede significar automáticamente “más barato”. |
| Media | Etapas visuales derivadas | Agrupa ahora/próximamente/después con prioridades y estados actuales. | Baja derivada; alta y con BD si persiste | Una etapa automática puede contradecir el criterio del usuario. |
| Baja | Fecha de finalización del proyecto | Podría servir a proyectos grandes. | Alta / posibles reglas nuevas | Sin asignación ahorro→ítems produciría precisión falsa. |
| Baja | Recomendación automática de aporte | Podría explicar cuánto ahorrar para una fecha. | Alta / posible migración | Requiere disponibilidad mensual explícita; no debe mezclar dominios sin decisión. |
| Baja | Escenarios persistentes | Conserva simulaciones de metas. | Media-alta / migración | Añade modelo sin resolver la decisión inmediata de compra. |

## 5. Fase 14 propuesta: panel de decisión de compra

### Objetivo

Llevar al usuario del resumen de un proyecto de compras a una acción clara: completar
datos, elegir una alternativa o abrir el ítem que conviene revisar primero. La fase
solo usa información persistida y métricas derivadas existentes.

### Alcance incluido

1. Un bloque **“Próximas decisiones”** de solo lectura en el resumen de proyectos
   de compras.
2. Una lista corta de ítems pendientes, ordenada por las prioridades ya configuradas,
   con estado: listo para revisar, falta alternativa, falta precio planeado o requiere
   completar datos.
3. El coste planeado vigente de cada ítem y un enlace contextual a su detalle.
4. Un resumen de pendientes, listos y elementos con atención; enlaces a la pestaña
   de ítems con filtros/URL existentes para ver el conjunto completo.
5. Composición de tarjetas breve y accesible para móvil y escritorio.

### Exclusiones

- No crear pagos, reservas, compromisos ni transacciones automáticas.
- No vincular automáticamente ítems con presupuesto mensual, pagos programados o
  transacciones.
- No cambiar prioridades, estados, cálculos, RLS ni datos existentes.
- No implementar fechas de compra/finalización, recomendaciones de ahorro o etapas
  persistentes.
- No implementar refunds, transfers, cuentas, CSV atómico ni capacidades de ledger.

### Cambios técnicos previstos

- Selector puro bajo `src/features/projects/` para producir decisiones a partir de
  ítems, estados y prioridades. Delegará dinero a `toBudgetItem`/`plannedCost` e
  incidencias a `item-attention`.
- Componente de resumen que reutilice `ProjectPage` y sus rutas `tab=items` y filtros.
- Sin schema, RPC, Edge Function ni dependencia nueva.
- Etiquetas, enlaces y estados semánticos verificables por teclado y lector de
  pantalla; diseño compacto sobre las reglas CSS responsive existentes.

### Criterios de aceptación

1. La lista de decisiones de un proyecto es determinista según sus prioridades.
2. Los importes coinciden con el coste planeado actual, incluida cantidad y opción
   seleccionada; `AlreadyOwned` no se muestra como compra pendiente.
3. Falta de precio, categoría u opción seleccionada sin precio se presenta como
   preparación pendiente y lleva al detalle correcto.
4. El panel no afirma que haya dinero disponible ni que una compra esté pagada.
5. En móvil y escritorio se puede abrir el ítem y volver al contexto filtrado con
   navegación por teclado.
6. Los cálculos financieros existentes mantienen exactamente sus resultados.

### Pruebas necesarias

- Unitarias del selector: prioridad, estados, cantidad, opción seleccionada, ausencia
  de coste y atención.
- Unitarias de componente/enlaces: destino con `tab=items` y filtro relevante.
- E2E local: crear proyecto con ítems de prioridades/estados distintos, verificar la
  decisión y navegar al detalle/lista filtrada.
- Regresión de cálculos, atención, selección de opciones, E2E de proyectos/compras,
  typecheck, lint y build.

### Orden de implementación

1. Acordar la semántica de “listo”: propuesta = pendiente con coste planeado válido y
   sin incidencia bloqueante; no significa disponibilidad de efectivo.
2. Especificar y probar el selector puro con las reglas actuales.
3. Implementar panel y enlaces profundos reutilizando filtros existentes.
4. Revisar copy, responsive y navegación por teclado.
5. Añadir E2E local y ejecutar regresión completa.

## 6. Decisiones para aprobar

1. Aprobar el panel de decisión de compra como alcance de Fase 14, sin migraciones ni
   automatismos financieros.
2. Confirmar la definición de **“listo para revisar/comprar”** propuesta arriba.
3. Confirmar que el orden de prioridades existente es suficiente como orden sugerido.
   Un orden manual o etapas persistentes requerirían una fase posterior y probablemente
   schema nuevo.
4. Decidir si una comparación visual más densa de alternativas entra en esta fase. La
   recomendación es dejarla fuera: la comparación por ítem ya existe y el mayor valor
   inmediato es decidir qué ítem atender.

## Resultado

**Fase 14 recomendada: sí.** El panel de decisión de compra tiene alto valor y bajo
riesgo: reutiliza cálculos y datos ya probados, mejora la acción cotidiana y evita
convertir Planora en contabilidad o en un motor de recomendaciones financieras.
