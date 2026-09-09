import { useTheme } from './use-theme'

export function ThemeToggle({ className = 'btn btn-ghost' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const nextLabel = theme === 'dark' ? 'Modo claro' : 'Modo oscuro'

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        toggleTheme()
      }}
      aria-label={nextLabel}
      title={nextLabel}
    >
      {theme === 'dark' ? 'Claro' : 'Oscuro'}
    </button>
  )
}
