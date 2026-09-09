import { normalizeHeader, type CsvTable } from './csv-parse'
import type { MappedDraft } from './import-types'

/**
 * Headers aligned with the typical Excel planner export:
 * Estado | Prioridad | Categoria | Producto | Presupuesto objetivo |
 * Precio real | Tienda | Enlace | Fecha compra | Notas
 *
 * Semantics:
 * - Presupuesto objetivo → estimated_cost (item budget)
 * - Precio real → planned option price (researched price; not paid yet)
 * - Precio pagado / actual_cost → only when explicitly paid
 */
const NAME_KEYS = ['producto', 'nombre', 'item', 'name', 'product']
const CATEGORY_KEYS = ['categoria', 'category', 'cat']
const PRIORITY_KEYS = ['prioridad', 'priority']
const STATUS_KEYS = ['estado', 'status']
const ESTIMATED_KEYS = [
  'presupuesto_objetivo',
  'presupuesto',
  'presupuesto_item',
  'estimated_cost',
  'costo_estimado',
  'estimated',
  'target_budget',
]
const PLANNED_KEYS = [
  'precio_real',
  'precio_planeado',
  'precio_planificado',
  'planned_price',
  'precio',
]
const ACTUAL_KEYS = [
  'precio_pagado',
  'costo_real',
  'actual_cost',
  'pagado',
  'paid',
  'purchase_price',
]
const STORE_KEYS = ['tienda', 'store', 'comercio']
const NOTES_KEYS = ['notas', 'notes', 'nota', 'comentarios']
const URL_KEYS = ['enlace', 'url', 'purchase_url', 'link', 'links']
const DATE_KEYS = [
  'fecha_compra',
  'fecha',
  'completed_at',
  'purchase_date',
]
const OPTION_NAME_KEYS = ['opcion', 'option', 'option_name', 'nombre_opcion']
const PROJECT_BUDGET_KEYS = [
  'presupuesto_proyecto',
  'project_budget',
  'presupuesto_disponible',
  'presupuesto_del_proyecto',
]

function findColumn(headers: string[], keys: string[]): number {
  const normalized = headers.map(normalizeHeader)
  for (const key of keys) {
    const idx = normalized.indexOf(key)
    if (idx >= 0) return idx
  }
  return -1
}

function cell(row: string[], index: number): string {
  if (index < 0) return ''
  return (row[index] ?? '').trim()
}

/** Parse money like 800 | 800.50 | 800,50 | $800,00 | 1.234,56 */
export function parseOptionalNumber(raw: string): {
  value: number | null
  invalid: boolean
} {
  const trimmed = raw.trim()
  if (trimmed === '') return { value: null, invalid: false }

  // Empty placeholders from Excel / CSV — allowed (no budget yet)
  if (/^(?:[-–—]|n\/?a|s\/?d|\$+)$/i.test(trimmed)) {
    return { value: null, invalid: false }
  }

  let cleaned = trimmed.replace(/[^\d,.-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === ',') {
    return { value: null, invalid: false }
  }

  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')
  if (hasComma && hasDot) {
    // Last separator is decimal; the other is thousands
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (hasComma) {
    cleaned = cleaned.replace(',', '.')
  }

  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return { value: null, invalid: true }
  return { value: n, invalid: false }
}

function parseOptionalDate(raw: string): {
  value: string | null
  invalid: boolean
} {
  if (raw === '') return { value: null, invalid: false }
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`)
    if (Number.isNaN(d.getTime())) return { value: null, invalid: true }
    return { value: d.toISOString(), invalid: false }
  }
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    const day = dmy[1]!.padStart(2, '0')
    const month = dmy[2]!.padStart(2, '0')
    const year = dmy[3]!
    const d = new Date(`${year}-${month}-${day}T00:00:00`)
    if (Number.isNaN(d.getTime())) return { value: null, invalid: true }
    return { value: d.toISOString(), invalid: false }
  }
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return { value: null, invalid: true }
  return { value: parsed.toISOString(), invalid: false }
}

/** Prefer the first http(s) URL when Excel stacks several links in one cell. */
export function extractFirstUrl(raw: string): string | null {
  if (raw.trim() === '') return null
  const match = raw.match(/https?:\/\/[^\s<>"']+/i)
  if (match) return match[0]!.replace(/[),.;]+$/, '')
  const trimmed = raw.trim()
  if (/^www\./i.test(trimmed)) return `https://${trimmed.split(/\s+/)[0]}`
  return trimmed.includes('://') || trimmed.includes('.') ? trimmed.split(/\s+/)[0]! : trimmed
}

export type MappedCsv = {
  drafts: MappedDraft[]
  suggestedProjectBudget: number | null
}

export function mapCsvToDrafts(table: CsvTable): MappedCsv {
  const { headers, rows } = table
  const nameIdx = findColumn(headers, NAME_KEYS)
  const categoryIdx = findColumn(headers, CATEGORY_KEYS)
  const priorityIdx = findColumn(headers, PRIORITY_KEYS)
  const statusIdx = findColumn(headers, STATUS_KEYS)
  const estimatedIdx = findColumn(headers, ESTIMATED_KEYS)
  const plannedIdx = findColumn(headers, PLANNED_KEYS)
  const actualIdx = findColumn(headers, ACTUAL_KEYS)
  const storeIdx = findColumn(headers, STORE_KEYS)
  const notesIdx = findColumn(headers, NOTES_KEYS)
  const urlIdx = findColumn(headers, URL_KEYS)
  const dateIdx = findColumn(headers, DATE_KEYS)
  const optionNameIdx = findColumn(headers, OPTION_NAME_KEYS)
  const projectBudgetIdx = findColumn(headers, PROJECT_BUDGET_KEYS)

  let suggestedProjectBudget: number | null = null
  if (projectBudgetIdx >= 0) {
    for (const row of rows) {
      const parsed = parseOptionalNumber(cell(row, projectBudgetIdx))
      if (parsed.value != null && !parsed.invalid) {
        suggestedProjectBudget = parsed.value
        break
      }
    }
  }

  const drafts = rows.map((row, rowIndex) => {
    const name = cell(row, nameIdx)
    const categoryName = cell(row, categoryIdx) || null
    const priorityRaw = cell(row, priorityIdx) || null
    const statusRaw = cell(row, statusIdx) || null
    const estimated = parseOptionalNumber(cell(row, estimatedIdx))
    const planned = parseOptionalNumber(cell(row, plannedIdx))
    const actual = parseOptionalNumber(cell(row, actualIdx))
    const store = cell(row, storeIdx) || null
    const notes = cell(row, notesIdx) || null
    const rawUrl = cell(row, urlIdx)
    const purchaseUrl = rawUrl ? extractFirstUrl(rawUrl) : null
    const date = parseOptionalDate(cell(row, dateIdx))
    const optionName = cell(row, optionNameIdx)

    const empty =
      name === '' &&
      !categoryName &&
      !priorityRaw &&
      !statusRaw &&
      estimated.value == null &&
      !estimated.invalid &&
      planned.value == null &&
      !planned.invalid &&
      actual.value == null &&
      !actual.invalid &&
      !store &&
      !notes &&
      !purchaseUrl &&
      date.value == null &&
      !date.invalid &&
      optionName === ''

    const hasOptionSignal =
      optionName !== '' ||
      planned.value != null ||
      (store != null && store !== '') ||
      (purchaseUrl != null && purchaseUrl !== '')

    const option = hasOptionSignal
      ? {
          name: optionName || name || 'Opción',
          price: planned.value,
          store,
          product_url: purchaseUrl,
        }
      : null

    return {
      rowIndex: rowIndex + 2, // 1-based data row accounting for header
      name,
      categoryName,
      priorityRaw,
      statusRaw,
      estimatedCost: estimated.value,
      plannedPrice: planned.value,
      actualCost: actual.value,
      store,
      notes,
      purchaseUrl,
      completedAt: date.value,
      option,
      estimatedCostInvalid: estimated.invalid,
      plannedPriceInvalid: planned.invalid,
      actualCostInvalid: actual.invalid,
      dateInvalid: date.invalid,
      empty,
    } satisfies MappedDraft
  })

  return { drafts, suggestedProjectBudget }
}
