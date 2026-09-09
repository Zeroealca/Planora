import { describe, expect, it } from 'vitest'
import { fuzzyMatch, isSubsequence, normalizeSearchText } from './fuzzy'

describe('fuzzy search', () => {
  it('normalizes accents and case', () => {
    expect(normalizeSearchText('  Refrigeradóra  ')).toBe('refrigeradora')
  })

  it('matches exact and substring ignoring accents', () => {
    expect(fuzzyMatch('refri', 'Refrigeradora')).toBe(true)
    expect(fuzzyMatch('refrigeradora', 'Refrigeradora Samsung')).toBe(true)
    expect(fuzzyMatch('café', 'Mesa Cafe')).toBe(true)
  })

  it('matches fuzzy subsequences', () => {
    expect(fuzzyMatch('rfr', 'Refrigeradora')).toBe(true)
    expect(fuzzyMatch('smsg', 'Samsung')).toBe(true)
    expect(fuzzyMatch('xyz', 'Samsung')).toBe(false)
  })

  it('matches multi-token queries', () => {
    expect(fuzzyMatch('mesa madera', 'Mesa de madera roble')).toBe(true)
    expect(fuzzyMatch('mesa metal', 'Mesa de madera')).toBe(false)
  })

  it('empty query matches everything', () => {
    expect(fuzzyMatch('', 'Cualquier cosa')).toBe(true)
    expect(fuzzyMatch('   ', 'Cualquier cosa')).toBe(true)
  })

  it('isSubsequence checks ordered characters', () => {
    expect(isSubsequence('abc', 'aXbYc')).toBe(true)
    expect(isSubsequence('acb', 'abc')).toBe(false)
  })
})
