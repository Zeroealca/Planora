import { describe, expect, it } from 'vitest'
import { parseCsv, normalizeHeader } from './csv-parse'
import { mapCsvToDrafts, parseOptionalNumber } from './map-row'
import { normalizeItemName } from './normalize-name'
import { buildPreviewRows, applyDuplicateAction, applyDraftField, rebuildPreviewAfterDraftEdit } from './build-preview'
import { buildUpdateDiff, findPossibleDuplicate } from './duplicate-match'
import { computeImportSummary, canConfirmImport } from './import-summary'
import { buildCommitPlan, ImportPlanError } from './build-commit-plan'
import {
  DEFAULT_PRIORITY_OPTIONS,
  DEFAULT_STATUS_OPTIONS,
} from '@/features/projects/project-options'
import type { Category, ItemWithOptions } from '@/types/domain'
import type { MappedDraft } from './import-types'

function draft(partial: Partial<MappedDraft> & Pick<MappedDraft, 'name'>): MappedDraft {
  return {
    rowIndex: 2,
    categoryName: null,
    priorityRaw: null,
    statusRaw: null,
    estimatedCost: null,
    plannedPrice: null,
    actualCost: null,
    store: null,
    notes: null,
    purchaseUrl: null,
    completedAt: null,
    option: null,
    estimatedCostInvalid: false,
    plannedPriceInvalid: false,
    actualCostInvalid: false,
    dateInvalid: false,
    empty: false,
    ...partial,
  }
}

function item(partial: Partial<ItemWithOptions> & Pick<ItemWithOptions, 'id' | 'name'>): ItemWithOptions {
  return {
    project_id: 'p1',
    category_id: null,
    description: null,
    status: 'Pending',
    priority: 'Medium',
    estimated_cost: 100,
    actual_cost: null,
    purchase_url: null,
    notes: null,
    completed_at: null,
    created_at: '',
    updated_at: '',
    options: [],
    ...partial,
  }
}

describe('normalizeItemName', () => {
  it('treats case and spaces as equivalent', () => {
    expect(normalizeItemName('Refrigeradora')).toBe(
      normalizeItemName('refrigeradora'),
    )
    expect(normalizeItemName('  Foo   Bar ')).toBe('foo bar')
  })
})

describe('csv-parse', () => {
  it('parses headers and quoted fields', () => {
    const table = parseCsv(
      'producto,categoria,notas\n"Refrigeradora","Cocina","nota, con coma"\n',
    )
    expect(normalizeHeader(table.headers[0]!)).toBe('producto')
    expect(table.rows[0]).toEqual(['Refrigeradora', 'Cocina', 'nota, con coma'])
  })
})

describe('mapCsvToDrafts', () => {
  it('maps Spanish columns and suggests project budget', () => {
    const table = parseCsv(
      [
        'producto,categoria,prioridad,estado,presupuesto,precio_planeado,precio_pagado,tienda,presupuesto_proyecto',
        'Refrigeradora,Cocina,Alta,Pendiente,500,450,,Éxito,10000',
      ].join('\n'),
    )
    const mapped = mapCsvToDrafts(table)
    expect(mapped.suggestedProjectBudget).toBe(10000)
    expect(mapped.drafts[0]?.name).toBe('Refrigeradora')
    expect(mapped.drafts[0]?.estimatedCost).toBe(500)
    expect(mapped.drafts[0]?.plannedPrice).toBe(450)
    expect(mapped.drafts[0]?.option?.store).toBe('Éxito')
  })

  it('maps the Excel planner columns (presupuesto objetivo / precio real)', () => {
    const table = parseCsv(
      [
        'Estado,Prioridad,Categoria,Producto,Presupuesto objetivo,Precio real,Tienda,Enlace,Fecha compra,Notas',
        'Pendiente,Mudanza,Cocina,Refrigeradora,"$800,00","$723,00",marcimex,https://www.marcimex.com/refri,,',
        'Pendiente,Mudanza,Cocina,Juego de ollas,"$150,00","$130,90",,"https://a.example/1\nhttps://b.example/2",,"12 de cada"',
      ].join('\n'),
    )
    const mapped = mapCsvToDrafts(table)
    const fridge = mapped.drafts[0]!
    expect(fridge.name).toBe('Refrigeradora')
    expect(fridge.categoryName).toBe('Cocina')
    expect(fridge.priorityRaw).toBe('Mudanza')
    expect(fridge.statusRaw).toBe('Pendiente')
    expect(fridge.estimatedCost).toBe(800)
    expect(fridge.plannedPrice).toBe(723)
    expect(fridge.actualCost).toBeNull()
    expect(fridge.store).toBe('marcimex')
    expect(fridge.option?.price).toBe(723)
    expect(fridge.purchaseUrl).toBe('https://www.marcimex.com/refri')

    const pots = mapped.drafts[1]!
    expect(pots.estimatedCost).toBe(150)
    expect(pots.plannedPrice).toBe(130.9)
    expect(pots.purchaseUrl).toBe('https://a.example/1')
    expect(pots.notes).toBe('12 de cada')
  })
})


describe('duplicates', () => {
  it('finds name-equivalent duplicates', () => {
    const match = findPossibleDuplicate(
      draft({ name: 'refrigeradora' }),
      [item({ id: 'i1', name: 'Refrigeradora' })],
      [],
    )
    expect(match?.item.id).toBe('i1')
  })

  it('defaults duplicate action to omit and does not select row', () => {
    const rows = buildPreviewRows({
      drafts: [draft({ name: 'Refrigeradora', statusRaw: 'Pendiente' })],
      categories: [],
      items: [item({ id: 'i1', name: 'refrigeradora' })],
      statusOptions: DEFAULT_STATUS_OPTIONS,
      priorityOptions: DEFAULT_PRIORITY_OPTIONS,
    })
    expect(rows[0]?.duplicateAction).toBe('omit')
    expect(rows[0]?.selected).toBe(false)
    expect(rows[0]?.issues.some((i) => i.code === 'possible_duplicate')).toBe(true)
  })

  it('buildUpdateDiff never marks protected fields as change', () => {
    const existing = item({
      id: 'i1',
      name: 'Refrigeradora',
      status: 'Pending',
      actual_cost: 200,
      notes: 'mías',
      completed_at: '2024-01-01T00:00:00.000Z',
      estimated_cost: 100,
      priority: 'Medium',
      options: [
        {
          id: 'o1',
          item_id: 'i1',
          name: 'Opción A',
          brand: null,
          model: null,
          price: 90,
          store: 'A',
          product_url: null,
          image_url: null,
          description: null,
          specifications: null,
          notes: null,
          selected: true,
          created_at: '',
          updated_at: '',
        },
      ],
    })
    const diffs = buildUpdateDiff(
      draft({
        name: 'Refrigeradora',
        estimatedCost: 150,
        actualCost: 999,
        notes: 'csv',
        completedAt: '2025-01-01T00:00:00.000Z',
        statusRaw: 'Comprado',
        priorityRaw: 'Alta',
        option: { name: 'Otra', price: 80, store: 'B', product_url: null },
      }),
      existing,
      { kind: 'none' },
      { kind: 'existing', id: 'High', label: 'Alta' },
      [],
    )

    expect(diffs.some((d) => d.field === 'estimated_cost' && d.kind === 'change')).toBe(
      true,
    )
    expect(diffs.some((d) => d.field === 'priority' && d.kind === 'change')).toBe(true)
    expect(diffs.find((d) => d.field === 'actual_cost')?.kind).toBe('protected')
    expect(diffs.find((d) => d.field === 'notes')?.kind).toBe('protected')
    expect(diffs.find((d) => d.field === 'completed_at')?.kind).toBe('protected')
    expect(diffs.find((d) => d.field === 'status')?.kind).toBe('protected')
    expect(diffs.find((d) => d.field === 'option')?.kind).toBe('protected')
  })

  it('applyDuplicateAction create_new selects the row', () => {
    const rows = buildPreviewRows({
      drafts: [draft({ name: 'X', statusRaw: 'Pendiente' })],
      categories: [],
      items: [item({ id: 'i1', name: 'x' })],
      statusOptions: DEFAULT_STATUS_OPTIONS,
      priorityOptions: DEFAULT_PRIORITY_OPTIONS,
    })
    const next = applyDuplicateAction(rows[0]!, 'create_new')
    expect(next.selected).toBe(true)
    expect(next.duplicateAction).toBe('create_new')
  })
})

describe('import summary', () => {
  it('counts creates and disables confirm when empty', () => {
    const categories: Category[] = []
    const rows = buildPreviewRows({
      drafts: [
        draft({ name: 'A', statusRaw: 'Pendiente', estimatedCost: 10 }),
        draft({ name: 'B', statusRaw: 'Pendiente', estimatedCost: 20 }),
      ],
      categories,
      items: [],
      statusOptions: DEFAULT_STATUS_OPTIONS,
      priorityOptions: DEFAULT_PRIORITY_OPTIONS,
    })
    const summary = computeImportSummary(rows)
    expect(summary.itemsCreated).toBe(2)
    expect(summary.itemsImported).toBe(2)
    expect(canConfirmImport(summary)).toBe(true)

    const omitted = rows.map((r) => applyDuplicateAction(
      { ...r, duplicateAction: 'omit', matchedItemId: 'x', matchedItemName: 'x' },
      'omit',
    ))
    const forced = omitted.map((r) => ({ ...r, selected: false, duplicateAction: 'omit' as const }))
    expect(canConfirmImport(computeImportSummary(forced))).toBe(false)
  })
})

describe('buildCommitPlan', () => {
  it('builds a validated model before any write', () => {
    const rows = buildPreviewRows({
      drafts: [
        draft({
          name: 'Silla',
          categoryName: 'Sala',
          statusRaw: 'Pendiente',
          estimatedCost: 50,
          plannedPrice: 45,
          store: 'Tienda',
          option: {
            name: 'Silla',
            price: 45,
            store: 'Tienda',
            product_url: null,
          },
        }),
      ],
      categories: [],
      items: [],
      statusOptions: DEFAULT_STATUS_OPTIONS,
      priorityOptions: DEFAULT_PRIORITY_OPTIONS,
    })

    const plan = buildCommitPlan({
      destination: { mode: 'new', name: 'Casa', budget: 1000 },
      rows,
      priorityOptions: DEFAULT_PRIORITY_OPTIONS,
      categories: [],
      items: [],
      displayOrderStart: 0,
    })

    expect(plan.categoriesToCreate).toHaveLength(1)
    expect(plan.itemCreates).toHaveLength(1)
    expect(plan.itemCreates[0]?.option?.price).toBe(45)
    expect(plan.summary.itemsImported).toBe(1)
    expect(plan.summary.categoriesCreated).toBe(1)
    expect(plan.summary.optionsCreated).toBe(1)
  })

  it('rejects empty selection', () => {
    expect(() =>
      buildCommitPlan({
        destination: { mode: 'new', name: 'Casa', budget: null },
        rows: [],
        priorityOptions: DEFAULT_PRIORITY_OPTIONS,
        categories: [],
        items: [],
        displayOrderStart: 0,
      }),
    ).toThrow(ImportPlanError)
  })
})

describe('editable preview drafts', () => {
  it('updates name and revalidates after edit', () => {
    const patched = applyDraftField(
      draft({ name: 'Viejo', statusRaw: 'Pendiente', estimatedCost: 10 }),
      'name',
      'Nuevo',
    )
    expect(patched.name).toBe('Nuevo')

    const rows = buildPreviewRows({
      drafts: [draft({ name: 'A', statusRaw: 'Pendiente', estimatedCost: 10 })],
      categories: [],
      items: [],
      statusOptions: DEFAULT_STATUS_OPTIONS,
      priorityOptions: DEFAULT_PRIORITY_OPTIONS,
    })
    const next = rebuildPreviewAfterDraftEdit({
      rows,
      rowId: rows[0]!.id,
      field: 'estimatedCost',
      value: '99',
      context: {
        categories: [],
        items: [],
        statusOptions: DEFAULT_STATUS_OPTIONS,
        priorityOptions: DEFAULT_PRIORITY_OPTIONS,
      },
    })
    expect(next[0]?.draft.estimatedCost).toBe(99)
    expect(next[0]?.selected).toBe(true)
  })

  it('allows pending items without budget', () => {
    const rows = buildPreviewRows({
      drafts: [draft({ name: 'Sin presupuesto', statusRaw: 'Pendiente' })],
      categories: [],
      items: [],
      statusOptions: DEFAULT_STATUS_OPTIONS,
      priorityOptions: DEFAULT_PRIORITY_OPTIONS,
    })
    expect(rows[0]?.severity).toBe('ok')
    expect(rows[0]?.selected).toBe(true)
    expect(rows[0]?.draft.estimatedCost).toBeNull()
  })

  it('treats empty money placeholders as null, not invalid', () => {
    expect(parseOptionalNumber('')).toEqual({ value: null, invalid: false })
    expect(parseOptionalNumber('-')).toEqual({ value: null, invalid: false })
    expect(parseOptionalNumber('$')).toEqual({ value: null, invalid: false })
  })
})
