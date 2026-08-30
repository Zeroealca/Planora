---
name: github-pages-deployment
description: >-
  Deploy Planora SPA to GitHub Pages with Vite: base path, Actions workflow,
  client-side routing fallback, assets, public env vars. Use when configuring
  deploy, vite base, gh-pages, or GitHub Actions for Pages.
---

# GitHub Pages Deployment (Planora)

Complementa `agent.md` §27.

## Propósito

Publicar el SPA de Vite en GitHub Pages sin SSR ni secretos en el bundle.

## Cuándo usarlo

- `base` de Vite, workflows Actions, 404/SPA fallback, env de build, assets públicos.

## Cuándo NO usarlo

- Features server-side del host.
- Meter `service_role` o secretos privados en variables `VITE_*`.
- Configurar Vercel/Netlify salvo que el usuario lo pida explícitamente.

## Reglas obligatorias

1. `base` de Vite acorde al path del repo (p. ej. `/Planora/` o `/` si project site).
2. Router en modo adecuado al base path (`basename` si React Router).
3. Refresh en rutas profundas: estrategia Pages (p. ej. copiar `index.html` → `404.html` o script equivalent).
4. Build en CI: `npm ci` → typecheck/build → upload artifact / pages deploy.
5. Solo env públicos en build (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
6. Secretos de CI nunca impresos ni embebidos más allá de `VITE_*` intencionalmente públicos.

## Patrones recomendados

```ts
// vite.config.ts (conceptual)
export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE ?? '/',
})
```

Actions: `actions/checkout`, setup Node, build, `actions/upload-pages-artifact`, `actions/deploy-pages` (o flujo equivalente del repo).

## Errores comunes

- Assets 404 por `base` incorrecto.
- Ruta `/project/1` falla al F5 sin fallback SPA.
- Hardcodear URL de Supabase en código.
- Asumir filesystem server o redirects avanzados no disponibles en Pages.

## Checklist

- [ ] `base` correcto
- [ ] Router basename alineado
- [ ] Fallback SPA / refresh OK
- [ ] Actions build + deploy
- [ ] Solo `VITE_*` públicos en bundle
- [ ] Preview local (`vite preview`) con mismo base si se prueba
