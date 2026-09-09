import { describe, expect, it } from 'vitest'
import { parseProjectTab } from './project-tab-ids'

describe('parseProjectTab', () => {
  it('accepts known tabs', () => {
    expect(parseProjectTab('resumen')).toBe('resumen')
    expect(parseProjectTab('items')).toBe('items')
    expect(parseProjectTab('categorias')).toBe('categorias')
    expect(parseProjectTab('configuracion')).toBe('configuracion')
    expect(parseProjectTab('ahorros')).toBe('ahorros')
  })

  it('rejects unknown values', () => {
    expect(parseProjectTab(null)).toBeNull()
    expect(parseProjectTab('')).toBeNull()
    expect(parseProjectTab('otros')).toBeNull()
  })
})
