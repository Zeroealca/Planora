# Fase 15 — auditoría UX/UI

Fecha de auditoría: 2026-10-19.

## Alcance y metodología

Esta auditoría cubre dashboard, proyectos y compras, **Próximas decisiones**,
presupuesto mensual, transacciones, metas de ahorro, pagos programados, login y
navegación. Planora se evalúa como herramienta de planificación financiera
personal: presupuesto, compromisos y compras deben conservar su semántica
distinta; no se proponen cuentas, conciliación ni reglas contables nuevas.

Evidencia revisada:

- Componentes de páginas, formularios y navegación en `src/pages/`,
  `src/features/` y `src/app/`.
- Sistema de estilos y breakpoints en `src/styles/global.css`.
- Pruebas de dominio y E2E, en particular `e2e/auth.spec.ts`,
  `e2e/modals-keyboard.spec.ts`, `e2e/monthly-budget.spec.ts` y
  `e2e/projects-purchase.spec.ts`.
- Documentación de producto y arquitectura: `README.md`,
  `docs/e2e-closure-and-next-phase.md` y
  `docs/phase-14-project-planning-proposal.md`.

### Límite de inspección visual

Se inspeccionó visualmente en `127.0.0.1` el estado público sin configuración
de Supabase: muestra el mensaje de configuración y el control de tema, sin
navegación autenticada. No se inició sesión ni se crearon datos. Las conclusiones
sobre dashboard y pantallas autenticadas proceden de código, CSS y pruebas, no
de una afirmación de inspección visual directa. Antes de implementar conviene
hacer una pasada visual con datos sintéticos locales en escritorio, tablet y
móvil.

## 1. Estado actual de la interfaz

La base es consistente y apta para una iteración de UX focalizada:

- El shell mantiene navegación global, carga diferida de rutas y estado de carga
  accesible (`src/app/app-layout.tsx`, `src/app/router.tsx`).
- Hay una escala visual reutilizada para botones, tarjetas, grids, campos,
  estados vacíos, modales y foco visible (`src/styles/global.css`).
- Los conceptos financieros se explicitan: presupuestado es planificación,
  gasto es una transacción confirmada y los pagos programados son previsión
  (`src/pages/budget-page.tsx`).
- El proyecto separa compras y metas de ahorro; el panel de decisiones declara
  que prioridad no equivale a disponibilidad de dinero
  (`src/features/projects/next-decisions-panel.tsx`).
- El foco de modales, Escape y retorno al invocador tienen cobertura E2E para
  transacciones; también hay cobertura móvil puntual para modales y decisiones.

La oportunidad principal no es añadir más métricas. Es reducir la carga de
decisión al entrar por primera vez a un flujo, conservar el contexto al navegar
al detalle y completar los huecos de navegación/teclado.

## 2. Hallazgos por pantalla

| Área | Hallazgo concreto | Evidencia | Impacto / frecuencia | Recomendación acotada |
|---|---|---|---|---|
| Dashboard | La cabecera tiene `Registrar transacción` y, justo debajo, acciones rápidas con `Registrar gasto`; las dos acciones compiten por ser la principal. | `src/features/dashboard/general-dashboard.tsx` | Medio / alto | Dejar una CTA principal contextual y hacer que el bloque de atajos priorice acciones distintas o se contraiga en móvil. |
| Dashboard | Carga seis fuentes en paralelo y luego movimientos de metas; solo esta pantalla dispone de skeleton estructurado. | `loadDashboard` y `DashboardSkeleton` en `general-dashboard.tsx` | Medio / alto | Mantener el cálculo actual, pero hacer visibles secciones pendientes o errores parciales y reutilizar un patrón de skeleton mínimo. |
| Dashboard | Las tarjetas limitan proyectos, metas, pagos y movimientos, pero la señal de “muestra” no es uniforme en todas las secciones. | Constantes `*_LIMIT` y enlaces de detalle en `general-dashboard.tsx` | Bajo-medio / alto | Añadir copy breve y consistente cuando haya elementos ocultos, junto al enlace de detalle existente. |
| Proyectos | El estado vacío dice qué falta, pero no usa el patrón visual/acción `empty-state`; la CTA queda separada más abajo. | `src/pages/projects-page.tsx` | Medio / medio | Convertirlo en estado vacío estructurado con una única CTA inmediata. |
| Proyecto / compras | Las pestañas usan roles ARIA correctos, pero solo la activa está en el tab order y no hay manejo de flechas, Inicio o Fin. | `src/features/projects/project-tabs.tsx` | Alto / medio; accesibilidad | Implementar el patrón de teclado de tabs sin cambiar sus rutas o contenido. |
| Proyecto / compras | En móvil las pestañas se mantienen en una fila desplazable; no hay indicación de desbordamiento ni de cuántas secciones quedan fuera de vista. | `.project-tabs` en `src/styles/global.css` | Medio / medio | Añadir affordance de desplazamiento y comprobar foco/visibilidad de la pestaña activa. |
| Próximas decisiones | El panel clasifica y ofrece una acción por ítem; es una buena traducción de atención a acciones. Sin embargo, `Ver ítems pendientes` abre solo `sort=priority`, por lo que no conserva el estado “por completar/con incidencia” mostrado en el resumen. | `src/features/projects/next-decisions-panel.tsx` | Medio / medio | Enlazar al filtro de atención pertinente o sustituir el enlace global por un texto que no prometa conservar esa clasificación. |
| Próximas decisiones | El estado vacío es claro, pero no ofrece un siguiente paso para un proyecto sin ítems. | `next-decisions-panel.tsx`; E2E valida el texto vacío | Medio / medio | Añadir una CTA contextual a “Nuevo ítem”, conservando el tab de ítems. |
| Presupuesto mensual | El primer mes sin presupuesto combina creación, copiar mes, usar plantilla y gestión completa de plantillas en la misma vista. Es potente, pero el primer objetivo queda diluido. | `BudgetReusePanel` y `BudgetCreationOptions` en `src/features/monthly-budget/budget-reuse-panel.tsx` | Alto / medio | Separar “crear este mes” de “gestionar plantillas” mediante divulgación progresiva; no cambiar asignaciones ni cálculos. |
| Presupuesto mensual | La pantalla ya explica bien plan, gasto y compromiso; el bloque de compromisos añade cinco cifras antes de la lista de categorías. En móvil puede retrasar la acción principal de asignar o registrar gasto. | `src/pages/budget-page.tsx`, `.financial-commitments` | Medio / alto | Hacer el resumen de compromisos plegable o resumirlo cuando no haya vencidos, sin ocultar alertas. |
| Transacciones | El selector de mes cambia estado local pero no sincroniza `period` en la URL al navegar entre meses. Presupuesto y dashboard sí lo hacen. | `src/pages/transactions-page.tsx` frente a `budget-page.tsx` | Medio / alto | Sincronizar el periodo en URL para que volver, recargar y compartir conservan el contexto. |
| Transacciones | Crear categoría dentro del formulario es útil, pero compite visualmente con el formulario principal y no muestra feedback local de éxito/error junto al bloque. | `src/features/transactions/transaction-form.tsx` | Medio / medio | Convertirlo en una revelación opcional con mensaje de resultado y retorno claro al selector. |
| Metas de ahorro | El mensaje de proyección incompleta es ahora accionable y nombra los campos requeridos. La configuración aún agrupa varios conceptos financieros sin una progresión explícita. | `src/features/projects/project-savings-section.tsx` | Medio / medio | Ordenar los campos por “objetivo”, “punto de partida” y “ritmo”, con resumen de campos faltantes enlazable. |
| Pagos programados | Una sola página reúne vencimientos, forecast de 3/6/12 meses, reglas, historial y dos modales. La información es correcta, pero la jerarquía crece con el número de reglas. | `src/pages/scheduled-payments-page.tsx` | Alto / alto | Añadir navegación interna por secciones y un resumen de reglas accionable; mantener el forecast como lectura, no como gasto. |
| Pagos programados | Las tarjetas de reglas acumulan editar, activar/desactivar, eliminar e historial; el peligro de una acción destructiva está solo en color/icono y confirmación nativa. | `scheduled-payments-page.tsx` | Medio / medio | Agrupar acciones secundarias en menú o divulgación y sustituir confirmaciones nativas por el patrón de diálogo existente si se toca el flujo. |
| Login y navegación | La redirección post-login conserva ruta, query y fragmento y está cubierta. La barra global no comunica la sección activa; en móvil el menú se cierra con Escape pero no gestiona foco explícitamente al abrir/cerrar. | `require-session.tsx`, `app-layout.tsx`, `e2e/auth.spec.ts` | Medio / alto | Añadir estado activo (`aria-current`) y definir un recorrido de foco predecible para el menú sin convertirlo en modal. |

## 3. Problemas transversales

### Navegación y contexto

El periodo se conserva en dashboard y presupuesto, pero no de forma uniforme en
transacciones. Las decisiones del resumen de proyecto enlazan bien al detalle,
pero el enlace de lista pierde parte de la clasificación que motivó la acción.
Son inconsistencias pequeñas que aumentan la fricción en tareas repetitivas.

### Jerarquía y densidad

El sistema visual es coherente, pero varios primeros estados muestran toda la
capacidad disponible de una vez: reutilización/plantillas de presupuesto,
forecast/reglas de pagos y atajos del dashboard. La fase debe aplicar
divulgación progresiva, no eliminar capacidades ni sumar paneles.

### Formularios y mensajes

Los formularios tienen labels, ayudas y validaciones locales. El formulario de
ítem tiene nueve grupos de campos; el de pago programado agrega frecuencia,
importe, fechas y recordatorio. Deben seguir permitiendo edición completa, pero
los campos opcionales o avanzados pueden presentarse tras una elección básica.

### Responsive y accesibilidad

Hay breakpoints relevantes a 560, 640, 720, 900, 960 y 1120 px, modales tipo
bottom sheet por debajo de 640 px y foco visible global. La cobertura E2E móvil
actual prueba una acción visible del panel de decisiones y apertura/cierre de un
modal; no prueba desbordamiento de tabs, navegación de cabecera, presupuestos
ni listas densas. El patrón de tabs requiere teclado de flechas para completar
su semántica ARIA.

### Rendimiento percibido

El dashboard es el único flujo con skeleton. Proyectos, presupuesto,
transacciones y pagos usan mensajes de carga planos. No hay evidencia de un
problema de rendimiento de red, pero un patrón común de carga y de error parcial
reduciría los saltos visuales y la incertidumbre sin modificar consultas.

## 4. Mejoras recomendadas y priorización

Escala: impacto y frecuencia de 1 (bajo) a 5 (alto); esfuerzo y riesgo de 1
(bajo) a 5 (alto). La prioridad privilegia cambios pequeños, reversibles y sin
semántica financiera nueva.

| Prioridad | Mejora | Impacto | Frecuencia | Esfuerzo | Riesgo | Motivo |
|---|---|---:|---:|---:|---:|---|
| P0 | Teclado completo y desbordamiento visible en pestañas de proyecto. | 5 | 3 | 2 | 2 | Corrige una brecha de accesibilidad y mejora móvil sin tocar datos. |
| P0 | Creación de presupuesto con flujo inicial simple; plantillas bajo divulgación progresiva. | 5 | 3 | 3 | 2 | Reduce abandono en un momento de alto valor y evita confundir planificación con configuración avanzada. |
| P1 | Sincronizar periodo de transacciones en URL y reforzar retorno contextual. | 4 | 5 | 1 | 1 | Alinea flujos financieros frecuentes con presupuesto y dashboard. |
| P1 | Hacer accionable el estado vacío de Próximas decisiones y conservar contexto de atención en la lista. | 4 | 3 | 2 | 1 | Completa el flujo de Fase 14 con una mejora local. |
| P1 | Estado activo de navegación y foco predecible en menú móvil. | 3 | 5 | 2 | 1 | Reduce desorientación en todas las pantallas. |
| P2 | Reordenar la jerarquía de pagos programados y agrupar acciones secundarias. | 4 | 4 | 3 | 2 | Importante para usuarios con varias reglas; requiere validación visual cuidadosa. |
| P2 | Reducir duplicación de CTAs en dashboard y señalar límites de listas. | 3 | 4 | 2 | 1 | Mejora exploración sin alterar cálculos. |
| P2 | Divulgación progresiva para campos avanzados de ítem y categoría inline de transacción. | 3 | 3 | 3 | 2 | Reduce carga cognitiva, con riesgo de esconder un campo necesario. |
| P3 | Unificar skeletons/estados de carga y errores parciales. | 3 | 4 | 3 | 2 | Mejora percepción; no hay evidencia de lentitud real que justifique una reescritura. |

## 5. Propuesta concreta de implementación para la Fase 15

### Objetivo

Hacer que las tareas recurrentes —crear el presupuesto del mes, registrar un
movimiento, revisar una compra pendiente y volver al contexto anterior— sean
más directas y accesibles, conservando íntegramente las reglas actuales.

### Incluye

1. Completar `ProjectTabList` con flechas, Inicio/Fin, foco de la pestaña
   activa y una indicación visual de desplazamiento horizontal en móvil.
2. Reorganizar el estado inicial de `BudgetReusePanel`: crear/copy como camino
   principal y plantillas como sección secundaria expandible.
3. Sincronizar navegación de periodo en `TransactionsPage` con search params.
4. Añadir CTA de primer ítem al vacío de `NextDecisionsPanel` y decidir un
   enlace de lista que conserve o explique el contexto de atención.
5. Añadir `aria-current` a la navegación global y comportamiento de foco
   definido al abrir/cerrar el menú móvil.

### Excluye

- Cambios en fórmulas de presupuesto, ahorro, forecast o prioridades.
- Nuevos tipos de transacción, cuentas, conciliación, pagos o migraciones.
- Rediseño total, nueva biblioteca visual o dependencias.
- Cambios de datos de producción, Supabase, despliegue o credenciales.

### Secuencia sugerida

1. Especificar interacciones de tabs, menú y URLs; añadir sus pruebas primero.
2. Simplificar el primer flujo de presupuesto conservando todas las opciones.
3. Cerrar el flujo de decisiones y revisar la jerarquía de CTAs del dashboard.
4. Validar visualmente con datos E2E locales en 390 px, 768 px y 1280 px.
5. Dejar pagos programados y formularios avanzados para una iteración posterior
   si los cambios anteriores consumen el alcance.

## 6. Criterios de aceptación

1. Una persona puede crear el presupuesto de un mes sin encontrarse con la
   edición de plantillas hasta pedirla explícitamente.
2. Flechas, Inicio y Fin cambian de forma predecible entre pestañas de proyecto;
   el foco sigue a la pestaña seleccionada y ésta permanece visible en móvil.
3. Cambiar el mes en transacciones actualiza la URL; recarga, atrás/adelante y
   enlaces desde presupuesto conservan el periodo correcto.
4. Un proyecto sin ítems ofrece una acción directa para crear el primero; cada
   decisión sigue teniendo una acción visible en móvil.
5. La navegación principal indica la sección actual y el menú móvil no deja el
   foco en un control oculto al cerrarse.
6. Ningún texto nuevo presenta compromisos como gasto real, ni presupuesto de
   proyecto como saldo disponible.
7. Escritorio, tablet y móvil mantienen objetivos táctiles, contraste, foco
   visible, labels y diálogo de modales existentes.

## 7. Pruebas necesarias

- Unitarias para navegación de periodo y construcción de enlaces de decisiones.
- Pruebas de componente para teclado de tabs: flechas, Inicio, Fin, selección y
  foco; incluir modo meta de ahorro, cuyas tabs son distintas.
- Pruebas de componente para divulgación de plantillas y estado inicial de
  presupuesto, sin simular ni cambiar cálculos financieros.
- E2E local para periodo de transacciones, creación de presupuesto inicial,
  estado vacío de decisiones y menú móvil.
- E2E de teclado para tabs y regresión de foco en modales existentes.
- Revisión manual con Supabase local y datos sintéticos en 390×844, 768 px y
  1280 px; comprobar modo claro/oscuro y zoom de navegador al 200 %.

## Resumen ejecutivo: cinco mejoras de mayor impacto

1. Simplificar el primer presupuesto mensual y relegar la gestión de plantillas
   a divulgación progresiva.
2. Completar accesibilidad por teclado y comportamiento móvil de las pestañas
   de proyecto.
3. Conservar el periodo de transacciones en URL para evitar pérdida de contexto.
4. Hacer que el vacío y la lista de Próximas decisiones lleven al siguiente
   paso correcto sin perder la razón de la alerta.
5. Dar estado activo y foco predecible a la navegación global, especialmente en
   menú móvil.
