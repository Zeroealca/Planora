import { describe, expect, it } from 'vitest'
import { normalizeProductUrl } from './url-normalization'

describe('normalizeProductUrl', () => {
  it('keeps a URL without parameters', () => {
    expect(normalizeProductUrl('https://www.kywi.com.ec/producto/p')).toBe(
      'https://www.kywi.com.ec/producto/p',
    )
  })

  it('removes known UTM parameters', () => {
    expect(
      normalizeProductUrl(
        'https://www.kywi.com.ec/producto/p?utm_source=chatgpt&utm_medium=ref',
      ),
    ).toBe('https://www.kywi.com.ec/producto/p')
  })

  it('preserves functional parameters while removing tracking parameters', () => {
    expect(
      normalizeProductUrl(
        'https://www.kywi.com.ec/producto/p?sku=abc123&utm_campaign=sale&color=gris',
      ),
    ).toBe('https://www.kywi.com.ec/producto/p?sku=abc123&color=gris')
  })

  it('rejects invalid URLs', () => {
    expect(normalizeProductUrl('not a url')).toBeNull()
  })

  it('removes fragments', () => {
    expect(normalizeProductUrl('https://www.kywi.com.ec/producto/p#details')).toBe(
      'https://www.kywi.com.ec/producto/p',
    )
  })

  it('normalizes hostname casing', () => {
    expect(normalizeProductUrl('https://WWW.KYWI.COM.EC/producto/p')).toBe(
      'https://www.kywi.com.ec/producto/p',
    )
  })

  it('removes click identifiers without dropping unknown parameters', () => {
    expect(
      normalizeProductUrl('https://example.com/p?variant=xl&fbclid=1&gclid=2'),
    ).toBe('https://example.com/p?variant=xl')
  })
})

