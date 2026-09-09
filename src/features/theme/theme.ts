export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'planora-theme'
const DEFAULT_THEME: Theme = 'light'

const listeners = new Set<() => void>()

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark'
}

export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isTheme(stored)) return stored
  } catch {
    // private mode / blocked storage
  }
  return DEFAULT_THEME
}

export function getThemeSnapshot(): Theme {
  const fromDom = document.documentElement.dataset.theme ?? null
  if (isTheme(fromDom)) return fromDom
  return readStoredTheme()
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore
  }
  applyTheme(theme)
  for (const listener of listeners) listener()
}

export function toggleTheme(): Theme {
  const next: Theme = getThemeSnapshot() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Call once at app boot (after CSS). Early script in index.html avoids FOUC. */
export function initTheme(): void {
  applyTheme(readStoredTheme())
}
