import { BrowserRouter } from 'react-router'
import { AuthProvider } from '@/features/auth/auth-provider'
import { ProfileProvider } from '@/features/profile/profile-provider'
import { AppRoutes } from './router'

/** Matches Vite `base` (`/` locally, `/Planora/` on GitHub Pages). */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export function App() {
  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <ProfileProvider>
          <AppRoutes />
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
