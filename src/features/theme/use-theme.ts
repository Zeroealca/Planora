import { useSyncExternalStore } from 'react'
import {
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
  toggleTheme,
  type Theme,
} from './theme'

export function useTheme(): {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => Theme
} {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    (): Theme => 'light',
  )
  return { theme, setTheme, toggleTheme }
}
