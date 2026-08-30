import { Route, Routes } from 'react-router'
import { AppLayout } from './app-layout'
import { HomePage } from '@/pages/home-page'
import { LoginPage } from '@/pages/login-page'
import { ProjectsPage } from '@/pages/projects-page'
import { ProjectPage } from '@/pages/project-page'
import { ItemPage } from '@/pages/item-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { RequireSession } from '@/features/auth/require-session'

/**
 * Client-side routing (history API). Basename follows Vite `base`.
 *
 * Public: `/login`
 * Protected: `/projects`, `/projects/:projectId`, `/projects/:projectId/items/:itemId`
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route element={<RequireSession />}>
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectPage />} />
          <Route path="projects/:projectId/items/:itemId" element={<ItemPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
