import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type TrackedPriceType = 'primary' | 'regular' | 'promotional' | 'cash' | 'card'
type ObservationStatus =
  | 'success'
  | 'price_not_found'
  | 'unavailable'
  | 'error'
  | 'needs_review'
type Availability = 'available' | 'unavailable' | 'unknown'
type PriceSource =
  | 'kywi'
  | 'marcimex'
  | 'crecos'
  | 'frecuento'
  | 'casasmart'
  | 'electrolux'
  | 'generic'

type DetectedPrice = {
  type: TrackedPriceType
  value: number
}

type ExtractorResult =
  | {
      success: true
      source: string
      currency: string
      availability: Availability
      prices: DetectedPrice[]
    }
  | {
      success: false
      source: string
      status: Exclude<ObservationStatus, 'success' | 'needs_review'>
      availability: Availability
      currency?: string
      prices: DetectedPrice[]
      message: string
    }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
  'gclid',
])

const MAX_REASONABLE_PRICE = 1_000_000
const EXTREME_DECREASE_RATIO = 0.2
const EXTREME_INCREASE_RATIO = 5
const STORE_LABELS: Record<Exclude<PriceSource, 'generic'>, string> = {
  kywi: 'Kywi',
  marcimex: 'Marcimex',
  crecos: 'Crecos',
  frecuento: 'Frecuento',
  casasmart: 'Casa Smart',
  electrolux: 'Electrolux',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeProductUrl(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(withProtocol)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    url.hostname = url.hostname.toLowerCase()
    url.hash = ''

    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key)
    }

    return url.toString()
  } catch {
    return null
  }
}

function parseMoney(value: string): number | null {
  const normalized = value.trim()
  if (normalized === '') return null

  const decimalComma = /,\d{2}$/.test(normalized)
  const decimalDot = /\.\d{2}$/.test(normalized)
  const compact = decimalComma
    ? normalized.replace(/\./g, '').replace(',', '.')
    : decimalDot
      ? normalized.replace(/,/g, '')
      : normalized.replace(/[,.]/g, '')
  const parsed = Number(compact)
  return Number.isFinite(parsed) ? parsed : null
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function uniquePrices(values: number[]): number[] {
  const result: number[] = []
  for (const value of values) {
    if (!result.some((existing) => Math.abs(existing - value) < 0.01)) {
      result.push(value)
    }
  }
  return result
}

function stripNoise(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

function sourceLabel(source: PriceSource): string {
  return source === 'generic' ? 'la tienda' : STORE_LABELS[source]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function moneyValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') return parseMoney(value.replace(/^\$/, ''))
  return null
}

function walkJson(value: unknown, visit: (record: Record<string, unknown>) => void) {
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, visit)
    return
  }

  if (!isRecord(value)) return
  visit(value)
  for (const item of Object.values(value)) walkJson(item, visit)
}

function availabilityFromText(value: string): Availability | null {
  if (/\b(outofstock|soldout|agotado|sin stock|no disponible)\b/i.test(value)) {
    return 'unavailable'
  }
  if (/\b(instock|available|disponible|en stock)\b/i.test(value)) return 'available'
  return null
}

function extractPricesFromStructuredJson(value: unknown): {
  prices: number[]
  currency: string | null
  availability: Availability | null
} {
  const prices: number[] = []
  let currency: string | null = null
  let availability: Availability | null = null

  walkJson(value, (record) => {
    const type = stringValue(record['@type'])?.toLowerCase() ?? ''
    const looksLikeOffer =
      type.includes('offer') ||
      record.priceCurrency != null ||
      record.availability != null ||
      record.price != null ||
      record.sale_price != null ||
      record.salePrice != null

    if (!looksLikeOffer) return

    const price =
      moneyValue(record.price) ??
      moneyValue(record.sale_price) ??
      moneyValue(record.salePrice) ??
      moneyValue(record.lowPrice) ??
      moneyValue(record.highPrice) ??
      moneyValue(record.amount)
    if (price != null && price > 0) prices.push(price)

    currency ??=
      stringValue(record.priceCurrency) ??
      stringValue(record.currency) ??
      stringValue(record.currencyCode)
    const nextAvailability = stringValue(record.availability)
    if (nextAvailability) availability ??= availabilityFromText(nextAvailability)
  })

  return { prices: uniquePrices(prices), currency, availability }
}

function structuredPricesFromScripts(html: string): {
  prices: number[]
  currency: string | null
  availability: Availability | null
} {
  const prices: number[] = []
  let currency: string | null = null
  let availability: Availability | null = null
  const scripts = html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)

  for (const match of scripts) {
    const attributes = match[1] ?? ''
    const raw = decodeHtml(match[2] ?? '').trim()
    if (raw === '') continue

    const isStructuredScript =
      /\btype=["'][^"']*(?:ld\+json|application\/json)[^"']*["']/i.test(attributes) ||
      /\bid=["']__NEXT_DATA__["']/i.test(attributes) ||
      /"@type"\s*:|"price"\s*:|"sale[_-]?price"\s*:/i.test(raw)
    if (!isStructuredScript) continue

    try {
      const parsed: unknown = JSON.parse(raw)
      const extracted = extractPricesFromStructuredJson(parsed)
      prices.push(...extracted.prices)
      currency ??= extracted.currency
      availability ??= extracted.availability
    } catch {
      // Invalid embedded JSON should not block visible-price extraction.
    }
  }

  return { prices: uniquePrices(prices), currency, availability }
}

function attributeValue(tag: string, name: string): string | null {
  const pattern = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i')
  return decodeHtml(pattern.exec(tag)?.[1] ?? '').trim() || null
}

function structuredPricesFromMeta(html: string): number[] {
  const prices: number[] = []
  const tags = html.matchAll(/<(?:meta|span|div)\b[^>]*>/gi)

  for (const match of tags) {
    const tag = match[0]
    const key =
      attributeValue(tag, 'property') ??
      attributeValue(tag, 'itemprop') ??
      attributeValue(tag, 'name')
    if (!key || !/(^|:)(price|amount)$/i.test(key)) continue

    const raw = attributeValue(tag, 'content') ?? attributeValue(tag, 'value')
    const price = raw ? moneyValue(raw) : null
    if (price != null && price > 0) prices.push(price)
  }

  return uniquePrices(prices)
}

function priceTypeFromContext(context: string): TrackedPriceType | null {
  if (/\b(efectivo|transferencia|contado)\b/i.test(context)) return 'cash'
  if (/\b(tarjeta|cr[eé]dito|credito|d[eé]bito|debito)\b/i.test(context)) return 'card'
  if (/\b(antes|regular|normal|pvp|precio\s+normal)\b/i.test(context)) return 'regular'
  if (/\b(oferta|promoci[oó]n|promo|ahora|online|especial|descuento)\b/i.test(context)) {
    return 'promotional'
  }
  return null
}

function isInstallmentContext(context: string): boolean {
  return /\b(cuota|cuotas|mensual|mensuales|meses|quincenal|entrada|financia)\b/i.test(
    context,
  )
}

function visiblePricesFromText(text: string): DetectedPrice[] {
  const candidates: Array<DetectedPrice & { index: number }> = []
  const normalized = decodeHtml(text)
  const matches = [
    ...normalized.matchAll(/\$\s*([0-9][0-9.,]*)/g),
    ...normalized.matchAll(/\b([0-9][0-9.,]*)\s*(?:usd|d[oó]lares)\b/gi),
  ]

  for (const match of matches) {
    const raw = match[1] ?? ''
    const value = parseMoney(raw)
    if (value == null || value <= 0) continue

    const index = match.index ?? 0
    const context = normalized.slice(Math.max(0, index - 80), index + 120)
    if (isInstallmentContext(context)) continue

    candidates.push({
      type: priceTypeFromContext(context) ?? 'primary',
      value,
      index,
    })
  }

  const ordered = candidates.sort((a, b) => a.index - b.index)
  const result: DetectedPrice[] = []
  const add = (price: DetectedPrice) => {
    if (!result.some((existing) => existing.type === price.type)) result.push(price)
  }

  const nonRegularValues = ordered
    .filter((candidate) => candidate.type !== 'regular')
    .map((candidate) => candidate.value)
  const primary = nonRegularValues.length > 0 ? Math.min(...nonRegularValues) : null
  if (primary != null) add({ type: 'primary', value: primary })

  for (const candidate of ordered) add(candidate)

  const uniqueByType: DetectedPrice[] = []
  for (const price of result) {
    if (!uniqueByType.some((existing) => existing.type === price.type)) {
      uniqueByType.push(price)
    }
  }
  return uniqueByType
}

function extractStorePrice(html: string, source: PriceSource): ExtractorResult {
  const text = stripNoise(html)
  const availability: Availability = /\b(agotado|no disponible|sin stock)\b/i.test(text)
    ? 'unavailable'
    : 'available'
  const structured = structuredPricesFromScripts(html)
  const metaPrices = structuredPricesFromMeta(html)
  const visiblePrices = visiblePricesFromText(text)
  const structuredValues = uniquePrices([...structured.prices, ...metaPrices])
  const prices: DetectedPrice[] =
    structuredValues.length > 0
      ? [
          { type: 'primary', value: structuredValues[0] },
          ...structuredValues.slice(1, 3).map((value, index) => ({
            type: index === 0 ? 'regular' : 'promotional',
            value,
          }) satisfies DetectedPrice),
        ]
      : visiblePrices

  const resolvedAvailability = structured.availability ?? availability

  if (resolvedAvailability === 'unavailable' && prices.length === 0) {
    return {
      success: false,
      source,
      status: 'unavailable',
      availability: resolvedAvailability,
      currency: 'USD',
      prices: [],
      message: `El producto aparece como no disponible en ${sourceLabel(source)}.`,
    }
  }

  if (prices.length === 0) {
    return {
      success: false,
      source,
      status: 'price_not_found',
      availability: resolvedAvailability,
      currency: structured.currency ?? 'USD',
      prices: [],
      message: `No se encontró un precio en la página de ${sourceLabel(source)}.`,
    }
  }

  return {
    success: true,
    source,
    currency: structured.currency ?? 'USD',
    availability: resolvedAvailability,
    prices,
  }
}

function sourceForUrl(url: string): PriceSource {
  const hostname = new URL(url).hostname
  if (hostname === 'kywi.com.ec' || hostname.endsWith('.kywi.com.ec')) return 'kywi'
  if (hostname === 'marcimex.com' || hostname.endsWith('.marcimex.com')) {
    return 'marcimex'
  }
  if (hostname === 'marcimex.com.ec' || hostname.endsWith('.marcimex.com.ec')) {
    return 'marcimex'
  }
  if (hostname === 'crecos.com' || hostname.endsWith('.crecos.com')) return 'crecos'
  if (hostname === 'creditoseconomicos.com' || hostname.endsWith('.creditoseconomicos.com')) {
    return 'crecos'
  }
  if (
    hostname === 'creditoseconomicos.com.ec' ||
    hostname.endsWith('.creditoseconomicos.com.ec')
  ) {
    return 'crecos'
  }
  if (hostname === 'frecuento.com' || hostname.endsWith('.frecuento.com')) {
    return 'frecuento'
  }
  if (hostname === 'frecuento.com.ec' || hostname.endsWith('.frecuento.com.ec')) {
    return 'frecuento'
  }
  if (hostname === 'frecuento.ec' || hostname.endsWith('.frecuento.ec')) {
    return 'frecuento'
  }
  if (hostname === 'casasmart.com.ec' || hostname.endsWith('.casasmart.com.ec')) {
    return 'casasmart'
  }
  if (hostname === 'casasmart.ec' || hostname.endsWith('.casasmart.ec')) {
    return 'casasmart'
  }
  if (hostname === 'electrolux.com.ec' || hostname.endsWith('.electrolux.com.ec')) {
    return 'electrolux'
  }
  return 'generic'
}

function extractPriceForSource(html: string, source: PriceSource): ExtractorResult {
  return extractStorePrice(html, source)
}

function resolveTrackedPrice(
  result: ExtractorResult,
  trackedPriceType: TrackedPriceType,
): DetectedPrice | null {
  if (!result.success) return null
  return result.prices.find((price) => price.type === trackedPriceType) ?? null
}

function validateDetectedPrice(
  previousPrice: number | null,
  detectedPrice: number,
): 'valid' | 'suspicious' | 'invalid' {
  if (!Number.isFinite(detectedPrice)) return 'invalid'
  if (detectedPrice <= 0) return 'invalid'
  if (detectedPrice > MAX_REASONABLE_PRICE) return 'invalid'

  if (previousPrice != null && Number.isFinite(previousPrice) && previousPrice > 0) {
    const ratio = detectedPrice / previousPrice
    if (ratio <= EXTREME_DECREASE_RATIO || ratio >= EXTREME_INCREASE_RATIO) {
      return 'suspicious'
    }
  }

  return 'valid'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido.' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Sesión requerida.' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: 'Configuración de Supabase incompleta.' }, 500)
  }

  const body = await req.json().catch(() => null)
  const optionId = typeof body?.optionId === 'string' ? body.optionId : null
  if (!optionId) {
    return json({ error: 'optionId es obligatorio.' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: option, error: optionError } = await supabase
    .from('item_options')
    .select('id, price, product_url, tracked_price_type')
    .eq('id', optionId)
    .single()

  if (optionError || !option) {
    return json({ error: 'No se encontró la opción o no tienes acceso.' }, 404)
  }

  const normalizedUrl = option.product_url ? normalizeProductUrl(option.product_url) : null
  const checkedAt = new Date().toISOString()
  if (!normalizedUrl) {
    await supabase
      .from('item_options')
      .update({ last_checked_at: checkedAt, tracking_status: 'error' })
      .eq('id', optionId)
    return json({ error: 'La opción no tiene una URL de producto válida.' }, 400)
  }

  const source = sourceForUrl(normalizedUrl)
  let result: ExtractorResult
  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; PlanoraPriceTracker/0.1; +https://planora.local)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!response.ok) {
      result = {
        success: false,
        source,
        status: 'error',
        availability: 'unknown',
        prices: [],
        message: `${sourceLabel(source)} respondió con HTTP ${response.status}.`,
      }
    } else {
      result = extractPriceForSource(await response.text(), source)
    }
  } catch (err) {
    result = {
      success: false,
      source,
      status: 'error',
      availability: 'unknown',
      prices: [],
      message: err instanceof Error ? err.message : `No se pudo consultar ${sourceLabel(source)}.`,
    }
  }

  const trackedPriceType = option.tracked_price_type as TrackedPriceType
  const detected = resolveTrackedPrice(result, trackedPriceType)
  const validation = detected
    ? validateDetectedPrice(option.price == null ? null : Number(option.price), detected.value)
    : null
  const observationStatus: ObservationStatus =
    result.success && detected && validation === 'valid'
      ? 'success'
      : result.success && detected
        ? 'needs_review'
        : result.success
          ? 'needs_review'
          : result.status
  const nextTrackingStatus = observationStatus

  const { error: observationError } = await supabase
    .from('item_option_price_observations')
    .insert({
      option_id: optionId,
      price: detected?.value ?? null,
      checked_at: checkedAt,
      status: observationStatus,
      availability: result.availability,
      source: result.source,
      price_type: detected?.type ?? trackedPriceType,
      origin: 'manual',
      currency: result.currency ?? null,
      detected_prices: result.prices,
      message:
        observationStatus === 'needs_review'
          ? detected
            ? 'El precio detectado requiere revisión antes de actualizar Planora.'
            : `No se encontró el tipo de precio configurado: ${trackedPriceType}.`
          : result.success
            ? null
            : result.message,
    })

  if (observationError) {
    return json({ error: observationError.message }, 500)
  }

  const update: Record<string, unknown> = {
    product_url: normalizedUrl,
    last_checked_at: checkedAt,
    tracking_status: nextTrackingStatus,
  }

  if (detected && validation === 'valid' && observationStatus === 'success') {
    update.price = detected.value
  }

  const { error: updateError } = await supabase
    .from('item_options')
    .update(update)
    .eq('id', optionId)

  if (updateError) {
    return json({ error: updateError.message }, 500)
  }

  return json({
    status: observationStatus,
    updatedPrice: update.price ?? null,
    detectedPrice: detected?.value ?? null,
    detectedPrices: result.prices,
    trackedPriceType,
    availability: result.availability,
    source: result.source,
    checkedAt,
  })
})
