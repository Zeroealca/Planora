import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './app-layout'
import { RequireSession } from '@/features/auth/require-session'

const HomePage = lazy(() => import('@/pages/home-page').then(({ HomePage }) => ({ default: HomePage })))
const AuthCallbackPage = lazy(() => import('@/pages/auth-callback-page').then(({ AuthCallbackPage }) => ({ default: AuthCallbackPage })))
const LoginPage = lazy(() => import('@/pages/login-page').then(({ LoginPage }) => ({ default: LoginPage })))
const ProjectsPage = lazy(() => import('@/pages/projects-page').then(({ ProjectsPage }) => ({ default: ProjectsPage })))
const ProjectPage = lazy(() => import('@/pages/project-page').then(({ ProjectPage }) => ({ default: ProjectPage })))
const ItemPage = lazy(() => import('@/pages/item-page').then(({ ItemPage }) => ({ default: ItemPage })))
const ImportPage = lazy(() => import('@/pages/import-page').then(({ ImportPage }) => ({ default: ImportPage })))
const SettingsPage = lazy(() => import('@/pages/settings-page').then(({ SettingsPage }) => ({ default: SettingsPage })))
const NotFoundPage = lazy(() => import('@/pages/not-found-page').then(({ NotFoundPage }) => ({ default: NotFoundPage })))
const BudgetPage = lazy(() => import('@/pages/budget-page').then(({ BudgetPage }) => ({ default: BudgetPage })))
const TransactionsPage = lazy(() => import('@/pages/transactions-page').then(({ TransactionsPage }) => ({ default: TransactionsPage })))
const ScheduledPaymentsPage = lazy(() => import('@/pages/scheduled-payments-page').then(({ ScheduledPaymentsPage }) => ({ default: ScheduledPaymentsPage })))

/**
 * Client-side routing (history API). Basename follows Vite `base`.
 *
 * Public: `/login`, `/auth/callback`; `/` redirects guests and renders the authenticated overview.
 * Protected: `/projects`, `/import`, `/projects/:projectId`, `/projects/:projectId/items/:itemId`, `/settings`
 */
export function AppRoutes() {
  return (
    <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="auth/callback" element={<AuthCallbackPage />} />
          <Route element={<RequireSession />}>
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="budget" element={<BudgetPage />} />
            <Route path="budget/transactions" element={<TransactionsPage />} />
            <Route path="budget/scheduled-payments" element={<ScheduledPaymentsPage />} />
            <Route path="transactions" element={<Navigate to="/budget/transactions" replace />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="projects/:projectId" element={<ProjectPage />} />
            <Route path="projects/:projectId/items/:itemId" element={<ItemPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
    </Routes>
  )
}
