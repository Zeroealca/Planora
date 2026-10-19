# Cierre E2E y propuesta de siguiente fase

Fecha de auditoría: 2026-10-19.

Este documento es una revisión de código y de la configuración del repositorio. No
implica cambios de producto, migraciones ni despliegues.

## 1. Cierre técnico E2E

### Estado del repositorio

- Rama: `main`, sincronizada con `origin/main`.
- Árbol de trabajo: limpio; `git status --short` no devolvió archivos y `git diff`
  no mostró cambios pendientes.
- No hay secretos, `.env.e2e.local`, reportes de Playwright ni resultados de pruebas
  versionados. `.gitignore` excluye los artefactos locales y el preparador genera la
  configuración sensible solamente en el archivo ignorado.
- La documentación de `README.md` describe los dos contextos incompatibles:
  `safe-smoke` con `https://e2e.invalid` y la suite autenticada con Supabase local.

### Cambios de estabilización E2E

Los cambios viven en tres commits ya publicados. Esta separación es adecuada y no
debe reordenarse salvo que se haga un cambio funcional relacionado.

| Commit | Responsabilidad | Contenido principal |
|---|---|---|
| `66df0a6` | Accesibilidad | foco inicial/restauración del modal, validación accesible de transacciones y pruebas del hook |
| `9a3ba06` | Navegación del dashboard | periodo en URL, enlaces contextuales, acciones rápidas y sus pruebas unitarias |
| `ba10779` | E2E aislado | proyectos Playwright, guard de Supabase local, usuarios sintéticos, RLS, runner Windows, documentación y escenarios E2E |

El runner `scripts/run-e2e.ps1` rechaza un Vite de Planora existente en el puerto
4173, espera el proceso de Playwright, expone su código de salida y, en `finally`,
termina únicamente el Vite de este workspace. Esto elimina la reutilización entre
la configuración inválida y la local autenticada.

### Validación confirmada

| Validación | Resultado |
|---|---:|
| `npm run test:e2e:safe` | 3/3 aprobadas |
| `npm run test:e2e:local` | 12/12 aprobadas |
| `npm run test:e2e:all` | 15/15 aprobadas, repetida dos veces |
| Unitarios/integración | 228 aprobados |
| Typecheck | aprobado |
| Lint | aprobado |
| Build | aprobado |

Comandos de repetición:

```powershell
nvm use 22.12.0
npm exec supabase -- start
npm run e2e:local:reset
npm run test:e2e:safe
npm run test:e2e:local
npm run test:e2e:all
```

El reset es exclusivamente local (`supabase db reset --local`). No debe sustituirse
por comandos remotos o `--linked`.

## 2. Auditoría funcional

### Dashboard

**Implementado.** `GeneralDashboard` carga el periodo seleccionado desde URL,
consulta resumen mensual, categorías, proyectos, pagos programados, occurrences y
transacciones del mes. Muestra métricas, distribución por categorías, vencimientos,
proyectos de compra, metas de ahorro y movimientos recientes. Las acciones rápidas
preservan el periodo y pueden abrir gasto o ingreso preseleccionado.

**Hallazgos.**

- La pantalla coordina seis fuentes de datos y consulta movimientos de metas después
  de cargar los proyectos. Es claro para el tamaño actual, pero es el principal punto
  de crecimiento de carga y de estados de error parciales.
- La vista limita tarjetas y transacciones, que es correcto para un resumen; no hay
  una explicación visual explícita de que los datos son una muestra limitada.
- Sigue existiendo una distinción conceptual fuerte entre presupuesto mensual y
  presupuesto de proyecto. El texto actual ayuda, pero los usuarios nuevos pueden
  interpretar ambas cifras como el mismo saldo.

### Proyectos, categorías, ítems y opciones

**Implementado.** Hay CRUD de proyectos, categorías e ítems; estados y prioridades
por proyecto; cantidades, costes planeados/reales, URL de compra, atención, filtros,
ordenación, duplicación, importación CSV y reporte de compra. Las opciones permiten
marca, modelo, tienda, precio, URL, imagen en Storage y una selección exclusiva vía
RPC `select_item_option`.

**Hallazgos.**

- La importación CSV es funcional y conservadora: previsualiza, detecta duplicados y
  revierte el proyecto creado si falla un paso posterior. No es transaccional a nivel
  de base de datos porque crea categorías, ítems y opciones en varias operaciones;
  un fallo de red tras una escritura puede requerir revisión manual.
- El precio de una opción, el coste estimado del ítem y el coste real son conceptos
  distintos. La UI debe seguir haciendo visible cuál alimenta cada métrica para evitar
  una falsa expectativa de sincronización automática.
- El rastreo de precios existe como base y Edge Function, pero su cobertura real
  depende de proveedores/URLs externos. No debe ampliarse sin una política de
  proveedores, límites y manejo de fallos.

### Presupuesto mensual y transacciones

**Implementado.** Categorías financieras por usuario, presupuesto por `YYYY-MM`,
asignaciones, plantillas, snapshots y resumen derivado. Las transacciones son fuente
de gasto real y se filtran por fecha civil. Un gasto requiere categoría; un ingreso
no afecta el gasto presupuestario. Las operaciones de dinero convierten a centavos en
las funciones del dominio antes de sumar/restar.

**Hallazgos y riesgos.**

- El diseño separa correctamente planificación (`allocations`) de gasto real
  (`transactions`) y no persiste agregados calculados.
- Refunds, transferencias, cuentas, recurrencia de transacciones y vínculo manual
  entre una compra de proyecto y una transacción no están implementados; el README lo
  declara explícitamente.
- `BudgetTransactionType` contempla `refund` y `transfer` en cálculos, pero la API
  de transacciones solo admite `expense` e `income`. No es un error si es preparación
  deliberada, pero es una inconsistencia de contrato que conviene resolver antes de
  exponer esos tipos.
- Presupuesto mensual y proyectos usan reglas de cálculo distintas. Es deseable una
  guía de interfaz, no una fusión de modelos: proyecto sirve para planificar compras;
  presupuesto mensual registra capacidad y gasto de un mes.

### Metas y planes de ahorro

**Implementado.** Un proyecto puede tener `none`, `plan` o `goal`; una meta es
inmutable como tipo de proyecto. Se guardan configuración y movimientos, mientras
que la proyección, mes viable y saldos se derivan mediante funciones puras. La
simulación no escribe hasta que se aplica explícitamente.

**Hallazgos.**

- La separación entre meta y plan evita mezclar objetivo/reserva con presupuesto de
  compra, y es una buena decisión de dominio.
- Una meta sin aporte positivo ni movimientos futuros no genera proyección; el
  comportamiento es correcto, pero necesita una explicación más accionable para el
  usuario (por ejemplo, qué campo completar) en vez de solo indicar que no se puede
  proyectar.
- La proyección está limitada a 600 meses, una defensa razonable. No hay todavía
  escenarios alternativos persistentes ni historial de cambios; no son necesarios
  para la siguiente fase.

### Pagos programados y pronóstico

**Implementado.** Reglas mensuales, anuales y únicas; occurrences materializadas
idempotentemente; pago u omisión explícita; pago atómico que crea una transacción;
desvinculación consistente al borrar una transacción; recordatorios y forecast de
3/6/12 meses. El forecast no materializa ni escribe datos y prioriza snapshots de
occurrence sobre la regla actual.

**Hallazgos y riesgos.**

- El modelo evita correctamente confundir obligación prevista con gasto real.
- Los importes variables desconocidos se cuentan y no se convierten artificialmente
  en cero, lo que conserva la honestidad financiera.
- Los recordatorios requieren Vercel Cron, Edge Function y Resend. Son una capacidad
  ya diseñada, pero introducen dependencia operativa externa; su observabilidad de
  producto se limita al historial de deliveries por occurrence.
- El forecast cubre pagos programados, no ingresos ni saldo de cuentas. Debe llamarse
  “próximos gastos” y no “flujo de caja completo”.

### Autenticación y aislamiento de datos

**Implementado.** Email/contraseña, sesión persistente, rutas protegidas, cambio de
contraseña, perfil y moneda. Las migraciones habilitan RLS para perfiles, proyectos,
categorías, ítems, opciones, presupuestos, transacciones, metas, pagos programados y
observaciones de precio. Las RPC de navegador fueron endurecidas para `authenticated`.
La prueba local usa dos usuarios y verifica aislamiento A/B.

**Hallazgos.**

- El aislamiento está respaldado por políticas y por una prueba E2E, no solamente por
  filtros de frontend.
- La ruta protegida conserva solo `location.pathname` al redirigir a login; parámetros
  de navegación como `period`, `create` o una pestaña no se restauran tras iniciar
  sesión. Es una mejora de experiencia de bajo riesgo.
- No se identificaron secretos versionados en la revisión de estado y configuración.

## 3. Mejoras priorizadas

| Prioridad | Mejora | Impacto | Esfuerzo | Dependencias/riesgo | BD |
|---|---|---|---|---|---|
| Alta | Explicar y enlazar el flujo presupuesto mensual ↔ proyectos ↔ transacciones | Alto: reduce errores de interpretación financiera | Medio | Requiere copy, navegación y pruebas; no cambia reglas | No |
| Alta | Restaurar URL completa después de login y conservar contexto de navegación | Medio-alto | Bajo | Auth/routing; riesgo bajo si se valida redirect seguro interno | No |
| Alta | Estados vacíos/errores accionables para metas sin proyección y dashboard con carga parcial | Medio | Bajo-medio | UI y pruebas; sin cambiar cálculos | No |
| Media | Visibilizar que dashboard/recientes son muestras limitadas y mejorar vínculos al detalle | Medio | Bajo | Solo interfaz | No |
| Media | Hacer explícita la separación de precios de opción, estimado y gasto real en formularios | Medio | Medio | Copy y UX; validar con pruebas de formulario | No |
| Media | Revisión de consistencia `refund`/`transfer` entre tipos de cálculo y API | Medio | Bajo para decidir; medio-alto si se implementa | Riesgo financiero: no activar tipos sin reglas, RLS y tests | Posible |
| Media | Mejorar atomicidad/reporting de importación masiva | Medio | Medio-alto | Requiere diseño de recuperación; no asumir transacción cliente | Posible |
| Baja | Persistir escenarios de ahorro o historial de proyecciones | Bajo-medio | Medio | Más modelo y UX; no es necesario para uso básico | Sí |
| Baja | Extender rastreo automático de precios | Variable | Alto | Dependencia de sitios externos y mantenimiento | No/Sí |
| Baja | Forecast de flujo de caja completo | Medio | Alto | Requiere cuentas, ingresos previstos y reglas nuevas | Sí |

## 4. Siguiente fase propuesta: claridad operativa del dinero

### Objetivo

Hacer que un usuario entienda y complete con seguridad el recorrido mensual:
planificar el presupuesto, registrar movimientos reales, ver compromisos próximos y
relacionar ese contexto con sus proyectos, sin alterar reglas financieras ni añadir
infraestructura externa.

### Problemas que resuelve

- Ambigüedad entre presupuesto mensual, presupuesto de un proyecto y gasto real.
- Pérdida de contexto al iniciar sesión desde una URL profunda.
- Estados de ahorro y dashboard que comunican el problema, pero no siempre el
  siguiente paso.
- Navegación desde resumen a detalle que todavía exige interpretación manual.

### Incluye

1. Conservación segura de ruta y query interna al pasar por login.
2. Copy contextual y enlaces cruzados entre presupuesto mensual, transacciones,
   compromisos y proyectos, sin sincronizar importes automáticamente.
3. Estados vacíos y de error accionables para dashboard, presupuesto y metas.
4. Señalización de datos resumidos/limitados y accesos claros al detalle.
5. Pruebas unitarias de enlaces/redirects y E2E de los recorridos de navegación
   críticos, reutilizando el entorno Supabase local.

### Excluye

- Refunds, transferencias, cuentas y conciliación bancaria.
- Cambios de fórmulas de presupuesto, metas o forecast.
- Nuevas integraciones de pago, email, bancos o scraping de precios.
- Migraciones de datos, salvo que durante la implementación aparezca una necesidad
  demostrable y aprobada.
- Persistencia de escenarios de ahorro e historial financiero.

### Cambios técnicos previstos

- React Router: serializar/restaurar `pathname + search` solo cuando sea una ruta
  interna validada.
- Componentes y helpers existentes de navegación (`dashboard-navigation`, páginas
  de presupuesto/transacciones/pagos) en lugar de crear una capa de estado global.
- Reutilizar funciones puras y métricas ya existentes; no duplicar cálculos en JSX.
- Sin dependencias nuevas y sin cambio de schema previsto.

### Criterios de aceptación

1. Una ruta privada profunda con query vuelve exactamente a esa ruta tras login.
2. Ningún redirect puede navegar fuera de la aplicación.
3. Presupuesto, transacciones y pagos explican qué importe es planificado, real o
   compromiso previsto, y enlazan al siguiente flujo relevante.
4. Una meta sin configuración completa informa los campos necesarios y permite llegar
   a ellos sin ambigüedad.
5. Desktop y móvil conservan navegación por teclado, foco y etiquetas accesibles.
6. No cambia el resultado de las funciones financieras existentes.
7. Unitarios, E2E safe/local, typecheck, lint y build aprueban.

### Orden recomendado

1. Especificar copy y criterios de navegación; confirmar que no se cambia semántica
   financiera.
2. Implementar y probar retorno post-login seguro.
3. Mejorar estados vacíos y enlaces del presupuesto/transacciones/pagos.
4. Mejorar guía de metas sin proyección.
5. Añadir pruebas unitarias y E2E de los nuevos recorridos.
6. Ejecutar la matriz completa de validación local.

## 5. Decisiones que requieren aprobación

1. Aprobar la fase propuesta de **claridad operativa del dinero** como siguiente
   alcance, sin cambios de base de datos.
2. Decidir si `refund` y `transfer` permanecen como preparación interna o pasan a ser
   una capacidad de producto posterior; no se deben exponer parcialmente.
3. Decidir si la importación masiva debe priorizar una operación de base de datos
   atómica en una fase futura o mantener el flujo actual con recuperación explícita.
4. Confirmar que recordatorios con Vercel/Resend siguen dentro del alcance operativo;
   no se recomienda ampliar dependencias externas en la siguiente fase.
