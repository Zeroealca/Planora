import { IconMoon, IconSun } from '@/components/icons'
import { useTheme } from './use-theme'

/** Floating theme control (sun / moon). */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const nextLabel = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'

  return (
    <button
      type="button"
      className="theme-fab"
      onClick={() => {
        toggleTheme()
      }}
      aria-label={nextLabel}
      title={nextLabel}
    >
      {theme === 'dark' ? <IconSun /> : <IconMoon />}
    </button>
  )
}
