# Planora — Project Roadmap

## 1. Objetivo

Planora es una aplicación genérica para gestionar proyectos personales con presupuesto, categorías, ítems, prioridades, estados, opciones de compra y progreso.

El primer caso de uso será **“Amueblar mi casa”**, pero la arquitectura debe mantenerse genérica para futuros proyectos como:

- Comprar un auto
- Armar una PC
- Planificar un viaje
- Preparar una mudanza
- Organizar un evento
- Remodelar un espacio

Este documento define el orden recomendado de implementación.

---

## 2. Reglas generales de ejecución

Antes de iniciar cualquier tarea:

- Leer `agent.md`.
- Identificar los skills relevantes en `.cursor/skills/`.
- Leer únicamente los skills necesarios.
- Revisar el código existente antes de crear nuevas abstracciones.
- Mantener cada tarea pequeña y enfocada.
- No hacer refactors fuera del alcance de la tarea.
- No instalar dependencias sin necesidad.
- No introducir un backend adicional.
- Mantener la lógica financiera separada de React y Supabase.

Al finalizar cada tarea:

- Ejecutar TypeScript check.
- Ejecutar lint.
- Ejecutar tests relevantes.
- Ejecutar build cuando corresponda.
- Revisar errores de consola.
- Resumir archivos creados/modificados.

---

## 3. Definición del MVP

El MVP estará completo cuando un usuario pueda:

1. Registrarse e iniciar sesión.
2. Crear un proyecto.
3. Definir presupuesto del proyecto.
4. Crear categorías.
5. Crear ítems.
6. Asignar estado y prioridad.
7. Añadir presupuesto estimado.
8. Marcar un ítem como comprado e indicar precio real.
9. Marcar un ítem como “Ya lo tengo”.
10. Añadir varias opciones de compra a un ítem.
11. Seleccionar una opción preferida.
12. Ver dashboard financiero del proyecto.
13. Filtrar dashboard e ítems por prioridad y categoría.
14. Ver progreso del proyecto.
15. Usar la aplicación correctamente desde móvil.
16. Instalar la aplicación como PWA.
17. Acceder a la app desplegada en GitHub Pages.

---

# 4. Fase 0 — Inicialización del proyecto

## TASK-001 — Inicializar React + Vite + TypeScript

### Objetivo
Crear la base técnica del proyecto.

### Tareas
- [ ] Inicializar Vite con React y TypeScript.
- [ ] Configurar estructura inicial de carpetas.
- [ ] Configurar aliases si aportan claridad.
- [ ] Añadir ESLint.
- [ ] Añadir configuración de formato si es necesaria.
- [ ] Crear `.env.example`.
- [ ] Crear README inicial.
- [ ] Confirmar que `npm run build` funciona.

### Definition of Done
- [ ] La aplicación inicia localmente.
- [ ] TypeScript compila.
- [ ] Lint pasa.
- [ ] Build de producción funciona.

## TASK-002 — Preparar estructura base de aplicación

### Objetivo
Crear únicamente la estructura necesaria para empezar a desarrollar.

### Estructura sugerida

```text
src/
  app/
  components/
  features/
    auth/
    projects/
    dashboard/
    categories/
    items/
    item-options/
  hooks/
  lib/
    supabase/
  pages/
  types/
  utils/
    budget/
  styles/
```

### Tareas
- [ ] Crear estructura.
- [ ] Añadir layout principal mínimo.
- [ ] Configurar estilos globales.
- [ ] Definir estrategia básica de routing.

### No hacer todavía
- CRUD.
- Supabase.
- Dashboard real.
- Componentes genéricos innecesarios.

---

# 5. Fase 1 — Dominio y lógica financiera

## TASK-003 — Definir tipos de dominio

### Objetivo
Establecer los conceptos principales de Planora.

### Tareas
- [ ] Crear tipos para `Project`.
- [ ] Crear tipos para `Category`.
- [ ] Crear tipos para `Item`.
- [ ] Crear tipos para `ItemOption`.
- [ ] Definir estados: `Pending`, `Purchased`, `AlreadyOwned`.
- [ ] Definir prioridades: `Critical`, `High`, `Medium`, `Optional`.
- [ ] Documentar cómo se muestran inicialmente en español.

### Definition of Done
Los tipos no contienen conceptos específicos de casas.

## TASK-004 — Implementar cálculos de presupuesto

### Funciones esperadas
- [ ] `calculatePlannedBudget`
- [ ] `calculateActualSpent`
- [ ] `calculatePendingBudget`
- [ ] `calculateRemainingBudget`
- [ ] `calculateCompletionPercentage`
- [ ] `calculateBudgetByPriority`
- [ ] `calculateBudgetByCategory`

### Reglas

**Pending**
- Usa `estimated_cost`.
- Cuenta como pendiente.

**Purchased**
- Usa `actual_cost`.
- Cuenta como gastado.

**AlreadyOwned**
- No suma gasto.
- No suma pendiente.
- Cuenta como completado.

### Consideraciones
- [ ] Definir comportamiento con valores `null`.
- [ ] Evitar `NaN`.
- [ ] No depender de React.
- [ ] No depender de Supabase.

## TASK-005 — Tests del dominio de presupuesto

### Casos mínimos
- [ ] Solo pendientes.
- [ ] Solo comprados.
- [ ] Solo AlreadyOwned.
- [ ] Mezcla de los tres estados.
- [ ] Precio real menor al estimado.
- [ ] Precio real mayor al estimado.
- [ ] Costos `null`.
- [ ] Lista vacía.
- [ ] Filtro por prioridad.
- [ ] Filtro por categoría.
- [ ] Filtros combinados.
- [ ] Completion percentage.

---

# 6. Fase 2 — Supabase y base de datos

## TASK-006 — Crear proyecto Supabase y cliente frontend
- [ ] Crear proyecto Supabase.
- [ ] Configurar variables de entorno.
- [ ] Configurar cliente Supabase.
- [ ] Añadir `.env.example`.
- [ ] Confirmar que ningún secreto sensible queda en frontend.
- [ ] No usar `service_role`.

## TASK-007 — Crear migración inicial

### Tablas iniciales
- [ ] `profiles`
- [ ] `projects`
- [ ] `categories`
- [ ] `items`
- [ ] `item_options`

### Requisitos
- [ ] Primary keys.
- [ ] Foreign keys.
- [ ] Timestamps.
- [ ] Constraints.
- [ ] Índices solo donde aporten valor.
- [ ] `category_id` opcional en items.
- [ ] Ownership mediante `user_id` en project.
- [ ] Restricción adecuada para selected option.

## TASK-008 — Implementar Row Level Security
- [ ] Usuario solo puede leer sus proyectos.
- [ ] Usuario solo puede modificar sus proyectos.
- [ ] Categorías heredan ownership del proyecto.
- [ ] Items heredan ownership del proyecto.
- [ ] Item options heredan ownership del item/proyecto.
- [ ] No confiar en filtros del frontend.

## TASK-009 — Generar tipos de Supabase
- [ ] Generar tipos.
- [ ] Integrarlos con el cliente.
- [ ] Evitar duplicaciones innecesarias entre tipos de DB y dominio.
- [ ] Documentar cómo regenerarlos tras migraciones.

---

# 7. Fase 3 — Autenticación

## TASK-010 — Registro, login y logout
- [ ] Registro con email/password.
- [ ] Login.
- [ ] Logout.
- [ ] Persistencia de sesión.
- [ ] Loading inicial de sesión.
- [ ] Mensajes claros de error.

## TASK-011 — Rutas protegidas
- [ ] Proteger proyectos.
- [ ] Redirigir a login si no existe sesión.
- [ ] Evitar flashes incorrectos durante carga de auth.
- [ ] Manejar sesión expirada.

---

# 8. Fase 4 — Gestión de proyectos

## TASK-012 — Listado de proyectos
- [ ] Estado loading.
- [ ] Estado vacío.
- [ ] Estado error.
- [ ] Cards simples.
- [ ] Mostrar nombre, icono, presupuesto y progreso básico.

## TASK-013 — Crear proyecto
- [ ] Nombre.
- [ ] Descripción opcional.
- [ ] Presupuesto.
- [ ] Icono/emoji opcional.
- [ ] Validar nombre obligatorio.
- [ ] Validar presupuesto >= 0.

## TASK-014 — Editar y eliminar proyecto
- [ ] Editar datos.
- [ ] Confirmación antes de eliminar.
- [ ] Manejar cascade correctamente.
- [ ] Mostrar errores claros.

---

# 9. Fase 5 — Categorías

## TASK-015 — CRUD de categorías
- [ ] Crear categoría.
- [ ] Editar.
- [ ] Eliminar.
- [ ] Listar.
- [ ] Ordenar mediante `display_order`.
- [ ] Definir comportamiento de items cuando se elimina categoría.

Las categorías de casa deben ser datos, no lógica hardcodeada.

---

# 10. Fase 6 — Items

## TASK-016 — Listado de ítems
- [ ] Nombre.
- [ ] Categoría.
- [ ] Estado.
- [ ] Prioridad.
- [ ] Costo estimado.
- [ ] Costo real cuando aplique.
- [ ] Indicador de opciones disponibles.
- [ ] Filtro por estado.
- [ ] Filtro por prioridad.
- [ ] Filtro por categoría.

## TASK-017 — Crear item
- [ ] Nombre.
- [ ] Descripción opcional.
- [ ] Categoría opcional.
- [ ] Estado.
- [ ] Prioridad.
- [ ] Estimated cost.
- [ ] Actual cost cuando corresponda.
- [ ] Notas.

## TASK-018 — Editar item
- [ ] Editar campos.
- [ ] Cambiar estado.
- [ ] Cambiar prioridad.
- [ ] Actualizar costos.
- [ ] Gestionar `completed_at`.

## TASK-019 — Eliminar item
- [ ] Confirmación.
- [ ] Eliminar opciones relacionadas según reglas de DB.
- [ ] Actualizar dashboard automáticamente.

---

# 11. Fase 7 — Opciones de compra

## TASK-020 — Listar opciones de un item
- [ ] Nombre.
- [ ] Marca.
- [ ] Modelo.
- [ ] Precio.
- [ ] Tienda.
- [ ] URL.
- [ ] Imagen.
- [ ] Características.
- [ ] Notas.
- [ ] Seleccionada.

## TASK-021 — Crear y editar opción
- [ ] URL opcional.
- [ ] Precio >= 0.
- [ ] Imagen opcional.
- [ ] Formulario usable desde móvil.

## TASK-022 — Seleccionar opción preferida
- [ ] Solo una opción seleccionada por item.
- [ ] Desmarcar selección anterior de forma segura.
- [ ] Testear comportamiento.

---

# 12. Fase 8 — Dashboard

## TASK-023 — Dashboard financiero principal
- [ ] Presupuesto del proyecto.
- [ ] Presupuesto planeado.
- [ ] Gastado realmente.
- [ ] Pendiente.
- [ ] Saldo restante.
- [ ] Progreso.
- [ ] Items pendientes.
- [ ] Items completados.

## TASK-024 — Filtro reactivo por prioridad
Selector: `All`, `Critical`, `High`, `Medium`, `Optional`.

- [ ] Todos los indicadores relevantes reaccionan al filtro.

## TASK-025 — Filtro por categoría
- [ ] `All` + categorías del proyecto.
- [ ] Compatible con filtro de prioridad.
- [ ] Cálculos combinados correctos.
- [ ] No modificar los datos originales.

## TASK-026 — Desglose visual
- [ ] Presupuesto por categoría.
- [ ] Presupuesto por prioridad.
- [ ] Gastado vs pendiente.
- [ ] Progreso.

Evitar gráficos que no aporten información útil.

---

# 13. Fase 9 — Caso de uso inicial: Amueblar mi casa

## TASK-027 — Crear seed o flujo inicial opcional

### Proyecto
`Amueblar mi casa`

### Categorías sugeridas
- Sala
- Comedor
- Cocina
- Dormitorio
- Oficina
- Baño
- Lavandería
- Limpieza
- General

### Mapping inicial de prioridades
- Critical → Mudanza
- High → Primer mes
- Medium → Después
- Optional → Opcional

El mapping pertenece a presentación/configuración del proyecto y no debe acoplar el dominio general a una casa.

---

# 14. Fase 10 — Imágenes y Supabase Storage

## TASK-028 — Configurar Storage
- [ ] Crear bucket adecuado.
- [ ] Definir estructura de paths.
- [ ] Implementar políticas de acceso.
- [ ] Validar tipo de archivo.
- [ ] Validar tamaño.
- [ ] Manejar errores.

## TASK-029 — Upload de imagen
- [ ] Seleccionar imagen desde móvil.
- [ ] Mostrar preview.
- [ ] Subir.
- [ ] Reemplazar.
- [ ] Eliminar imagen antigua cuando corresponda.

---

# 15. Fase 11 — Mobile UX y accesibilidad

## TASK-030 — Revisión mobile-first
- [ ] 360px.
- [ ] 390px.
- [ ] Tablet.
- [ ] Desktop.
- [ ] Formularios cómodos.
- [ ] Botones fáciles de tocar.
- [ ] Tablas evitadas o adaptadas en móvil.
- [ ] Cards legibles.

## TASK-031 — Accesibilidad básica
- [ ] Labels.
- [ ] Focus visible.
- [ ] Navegación por teclado.
- [ ] Contraste.
- [ ] Botones con nombre accesible.
- [ ] Formularios con mensajes de error asociados.

---

# 16. Fase 12 — PWA

## TASK-032 — Configurar PWA
- [ ] Manifest.
- [ ] Nombre.
- [ ] Short name.
- [ ] Iconos.
- [ ] Theme.
- [ ] Standalone display.
- [ ] Service worker.

## TASK-033 — Estrategia de cache
- [ ] Cachear app shell.
- [ ] Cachear assets estáticos.
- [ ] No cachear agresivamente datos sensibles o dinámicos de Supabase.

## TASK-034 — Flujo de actualización
- [ ] Detectar nueva versión.
- [ ] Evitar que usuario quede atrapado en versión vieja.
- [ ] Probar instalación en Android.

---

# 17. Fase 13 — GitHub Pages

## TASK-035 — Configurar build para GitHub Pages
- [ ] Configurar `base` de Vite.
- [ ] Revisar assets.
- [ ] Resolver estrategia SPA routing.
- [ ] Confirmar URLs directas.
- [ ] Configurar variables públicas de Supabase.

## TASK-036 — GitHub Actions deployment
- [ ] Workflow de build.
- [ ] Deployment a Pages.
- [ ] Fallar si lint/test/build falla.
- [ ] No incluir secretos sensibles.

---

# 18. Fase 14 — QA del MVP

## TASK-037 — Flujo end-to-end manual
1. Crear cuenta.
2. Crear proyecto.
3. Definir presupuesto.
4. Crear categorías.
5. Crear item pendiente.
6. Crear item comprado.
7. Crear item AlreadyOwned.
8. Añadir opciones.
9. Seleccionar opción.
10. Cambiar prioridad.
11. Aplicar filtros.
12. Revisar dashboard.
13. Editar item.
14. Eliminar item.
15. Cerrar sesión.
16. Volver a entrar.
17. Verificar persistencia.

## TASK-038 — Validar cálculos con caso real

```text
Sofá
Pending
Critical
estimated_cost: 600

Refrigeradora
Purchased
Critical
estimated_cost: 650
actual_cost: 620

Escritorio
AlreadyOwned
Critical
estimated_cost: 180
```

### Resultados esperados

```text
Pending budget = 600
Actual spent = 620
Planned total = 1220
Completed items = 2
Total items = 3
Completion = 66.67%
```

## TASK-039 — Revisión de seguridad
- [ ] RLS activo.
- [ ] Ownership correcto.
- [ ] Storage policies.
- [ ] Sin service role en frontend.
- [ ] Sin secretos en repository.
- [ ] Usuario A no puede ver datos de usuario B.

---

# 19. Post-MVP

No implementar hasta completar y estabilizar el MVP.

- [ ] Compartir proyectos con otros usuarios.
- [ ] Roles de colaboradores.
- [ ] Historial de cambios.
- [ ] Garantías.
- [ ] Fechas de compra.
- [ ] Adjuntar facturas.
- [ ] Recordatorios.
- [ ] Plantillas de proyectos.
- [ ] Duplicar proyectos.
- [ ] Custom priorities.
- [ ] Custom statuses.
- [ ] Exportar CSV/Excel.
- [ ] Importar CSV.
- [ ] Analytics históricos.
- [ ] Multi-moneda.
- [ ] Favoritos.
- [ ] Comparación avanzada de opciones.
- [ ] Notificaciones push.
- [ ] Modo offline más avanzado.

---

# 20. Orden recomendado de ejecución

```text
TASK-001 → TASK-002
        ↓
TASK-003 → TASK-004 → TASK-005
        ↓
TASK-006 → TASK-007 → TASK-008 → TASK-009
        ↓
TASK-010 → TASK-011
        ↓
TASK-012 → TASK-013 → TASK-014
        ↓
TASK-015
        ↓
TASK-016 → TASK-017 → TASK-018 → TASK-019
        ↓
TASK-020 → TASK-021 → TASK-022
        ↓
TASK-023 → TASK-024 → TASK-025 → TASK-026
        ↓
TASK-027
        ↓
TASK-028 → TASK-029
        ↓
TASK-030 → TASK-031
        ↓
TASK-032 → TASK-033 → TASK-034
        ↓
TASK-035 → TASK-036
        ↓
TASK-037 → TASK-038 → TASK-039
```

---

# 21. Regla para Cursor

Cursor debe trabajar **una tarea a la vez**.

Evitar:

> Implementa todas las fases pendientes.

Preferir:

> Implementa únicamente TASK-004 del PROJECT_PLAN.md. Lee agent.md y los skills relevantes antes de comenzar. No avances a TASK-005. Al finalizar ejecuta tests, lint y typecheck y resume los cambios.

---

# 22. Estado del roadmap

| Fase | Estado |
|---|---|
| Inicialización | ✅ Hecho |
| Dominio | ✅ Hecho |
| Supabase | ✅ Schema/cliente listos (aplicar migración en el proyecto) |
| Auth | ✅ Hecho |
| Projects | ✅ Hecho |
| Categories | ✅ Hecho |
| Items | ✅ Hecho |
| Item Options | ✅ Hecho |
| Dashboard | ✅ Hecho |
| Caso de uso Casa | ✅ Plantilla opcional |
| Storage | ✅ Hecho |
| Mobile / A11y | ✅ Básico en UI |
| PWA | ✅ Hecho |
| GitHub Pages | ✅ Workflow listo |
| QA / Seguridad | ✅ Tests + RLS en migración |

---

# 23. Criterio final de MVP

Planora estará lista para considerarse MVP cuando:

- La aplicación esté desplegada.
- Sea instalable como PWA.
- La autenticación funcione.
- Los datos estén protegidos mediante RLS.
- Se puedan crear múltiples proyectos.
- Se puedan gestionar categorías, items y opciones.
- Los estados financieros sean correctos.
- Los filtros del dashboard sean reactivos.
- `AlreadyOwned` esté correctamente excluido del gasto.
- La UI sea cómoda desde Android.
- Los tests críticos estén pasando.
- El build de producción sea estable.
