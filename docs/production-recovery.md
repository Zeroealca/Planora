# Seguridad y recuperación de producción

Este procedimiento protege los datos financieros de Planora. No se debe usar
para probar cambios ordinarios ni ejecutar restauraciones sin una decisión
explícita del responsable del proyecto.

## Estado verificable desde el repositorio

- El cliente usa únicamente la anon key de Supabase; los secretos de cron,
  Resend y service role permanecen en entornos server-side.
- Las respuestas de Supabase no se cachean por el service worker: solo se
  precachean assets estáticos versionados.
- RLS y las RPC sensibles se definen en migraciones versionadas. Las RPC de
  navegador revocan `EXECUTE` a `PUBLIC` y lo conceden a `authenticated`.
- El cron de Vercel exige `CRON_SECRET`; el procesador de recordatorios exige
  `REMINDER_JOB_SECRET` y usa el service role solo en la Edge Function.

Este repositorio no permite confirmar el plan de Supabase, backups disponibles,
PITR, secretos configurados, historial remoto de migraciones ni variables de
Vercel. Esas verificaciones deben hacerse en los dashboards, sin copiar valores
secretos a tickets, logs o al repositorio.

## Respuesta a un incidente

1. Registra hora, alcance y síntomas. No modifiques filas para “probar”.
2. Detén las escrituras riesgosas: pausa temporalmente el deployment o limita
   el acceso de la aplicación; si el incidente afecta recordatorios, desactiva
   el cron en Vercel antes de tocar la Edge Function.
3. En Supabase, abre **Database → Backups** y registra el último backup válido
   anterior al incidente. Revisa también **Point in Time** para comprobar si
   PITR está habilitado y cuál es su ventana real.
4. Para investigar o recuperar filas concretas, prefiere restaurar o clonar a
   un proyecto aislado y comparar allí. Una restauración completa del proyecto
   interrumpe el servicio y puede descartar escrituras posteriores al punto
   elegido.
5. Valida el resultado con conteos por usuario y muestras no sensibles de
   proyectos, transacciones, presupuestos y occurrences. Comprueba RLS y el
   flujo de recordatorios antes de reabrir escrituras.
6. Reanuda cron/deployment solo después de documentar la causa y las acciones
   correctivas. Rota secretos manualmente si existe sospecha de exposición.

## Límites de backups

Los backups de base de datos no restauran por sí solos los objetos de Storage;
conserva un procedimiento separado para el bucket de imágenes. La disponibilidad
real, retención y PITR dependen del plan/configuración. Consulta la
[documentación oficial de backups](https://supabase.com/docs/guides/platform/backups)
antes de un incidente y confirma la ventana en el dashboard.

## Cambios de esquema y despliegue seguro

1. Revisa la migración para confirmar que es incremental y no destructiva.
2. Confirma un backup o una ruta de recuperación antes de aplicarla.
3. Aplica la migración compatible primero; después despliega el frontend/Edge
   Function que la requiere.
4. Comprueba auth, una lectura de datos propia, una escritura no financiera de
   prueba en entorno aislado y los logs sin secretos.
5. Para un error de código, revierte el deployment en Vercel. Para un error de
   esquema, no asumas que revertir código recupera datos: prepara una migración
   correctiva o una recuperación aislada.
