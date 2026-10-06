import { describe, expect, it } from 'vitest'
import { DEFAULT_STATUS_OPTIONS } from './project-options'
import {
  buildPurchaseReportEntries,
  createPurchaseReportPdf,
} from './purchase-report-pdf'
import type { ItemWithOptions } from '@/types/domain'

function item(partial: Partial<ItemWithOptions>): ItemWithOptions {
  return {
    id: 'item-1',
    project_id: 'project-1',
    category_id: null,
    name: 'Refrigeradora',
    description: null,
    status: 'Pending',
    priority: 'High',
    quantity: 2,
    estimated_cost: 1000,
    actual_cost: null,
    purchase_url: null,
    notes: null,
    include_in_purchase_report: false,
    completed_at: null,
    created_at: '',
    updated_at: '',
    options: [],
    ...partial,
  }
}

describe('purchase-report-pdf', () => {
  it('includes only items pending purchase with selected model and total price', () => {
    const entries = buildPurchaseReportEntries(
      [
        item({
          include_in_purchase_report: true,
          options: [
            {
              id: 'option-1', item_id: 'item-1', name: 'LG', brand: 'LG', model: 'GT40', price: 450,
              store: null, product_url: null, image_url: null, description: null, specifications: null,
              notes: null, selected: true, tracking_enabled: false, tracked_price_type: 'primary',
              target_price: null, alert_on_drop: false, alert_on_increase: false, alert_drop_percentage: null,
              last_checked_at: null, tracking_status: 'inactive', created_at: '', updated_at: '',
            },
          ],
        }),
        item({ id: 'item-2', status: 'Purchased', name: 'Microondas' }),
      ],
      DEFAULT_STATUS_OPTIONS,
    )

    expect(entries).toEqual([
      { itemName: 'Refrigeradora', model: 'GT40', price: 900 },
    ])
  })

  it('creates a PDF blob with the report headings', async () => {
    const pdf = createPurchaseReportPdf({
      projectName: 'Mi casa',
      entries: [{ itemName: 'Cocina', model: 'X200', price: 500 }],
      formatPrice: (value) => `$${value}`,
      generatedAt: new Date('2026-10-06T12:00:00Z'),
    })

    expect(pdf.type).toBe('application/pdf')
    expect(await pdf.text()).toContain('Lista de electrodomesticos por comprar')
  })
})
