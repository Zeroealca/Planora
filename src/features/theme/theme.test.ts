import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  applyTheme,
  getThemeSnapshot,
  readStoredTheme,
  setTheme,
  toggleTheme,
} from './theme'

const KEY = 'planora-theme'

function installDomMocks() {
  const store = new Map<string, string>()
  const dataset: Record<string, string | undefined> = {}
  const style: { colorScheme: string } = { colorScheme: '' }

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
  })

  vi.stubGlobal('document', {
    documentElement: {
      dataset,
      style,
      removeAttribute: (name: string) => {
        if (name === 'data-theme') delete dataset.theme
      },
    },
  })

  return { store, dataset, style }
}

describe('theme preference', () => {
  let mocks: ReturnType<typeof installDomMocks>

  beforeEach(() => {
    mocks = installDomMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to light when nothing is stored', () => {
    expect(readStoredTheme()).toBe('light')
  })

  it('persists and applies light/dark without system preference', () => {
    setTheme('dark')
    expect(mocks.store.get(KEY)).toBe('dark')
    expect(mocks.dataset.theme).toBe('dark')
    expect(mocks.style.colorScheme).toBe('dark')
    expect(getThemeSnapshot()).toBe('dark')

    setTheme('light')
    expect(mocks.store.get(KEY)).toBe('light')
    expect(mocks.dataset.theme).toBe('light')
  })

  it('toggles between light and dark', () => {
    applyTheme('light')
    expect(toggleTheme()).toBe('dark')
    expect(toggleTheme()).toBe('light')
  })
})
