---
name: pwa
description: >-
  Progressive Web App setup for Planora: web manifest, icons, service worker,
  installability, safe caching, updates, basic offline UX. Use when configuring
  PWA, vite-plugin-pwa, manifest, SW, or install/update behavior.
---

# PWA (Planora)

Complementa `agent.md` §26.

## Propósito

App instalable y usable como standalone sin fingir offline de datos.

## Cuándo usarlo

- Manifest, icons, SW, install prompts, estrategia de cache/update.

## Cuándo NO usarlo

- Offline-first de CRUD Supabase en MVP.
- Cache agresivo de respuestas API autenticadas.
- Sustituir manejo de errores de red por “modo offline” inventado.

## Reglas obligatorias

1. Manifest con name, icons, `display: standalone`, theme/background.
2. Icons en tamaños adecuados (incl. maskable cuando se añadan).
3. SW: cache seguro de **assets estáticos** del build.
4. No cachear de forma opaca datos privados de usuario como fuente de verdad.
5. Si Supabase/red falla: error claro (no UI “offline sync” compleja).
6. Actualizaciones: permitir refrescar a nueva versión sin romper sesión de forma sorpresiva e inexplicable.

## Patrones recomendados

- `vite-plugin-pwa` (o equivalente) cuando se configure el toolchain.
- Precache del app shell; network-first o no-cache para API.
- Probar “Add to Home Screen” en Android Chrome.

## Errores comunes

- Cachear API Graph/REST de Supabase y mostrar datos viejos como actuales.
- Manifest incompleto → no instalable.
- Ignorar actualización del SW (usuarios atrapados en build viejo).
- Prometer offline completo en copy de UI.

## Checklist

- [ ] Manifest + icons OK
- [ ] Standalone display
- [ ] SW no cachea datos de usuario como SoT
- [ ] Error de red/API explícito
- [ ] Estrategia de update definida
- [ ] Build de producción genera assets PWA
