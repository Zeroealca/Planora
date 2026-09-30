import { describe, expect, it } from 'vitest'
import { previewReusablePlan } from './templates'

describe('reusable budget previews', () => {
  it('uses cents and omits archived categories', () => {
    const preview = previewReusablePlan(869.67, [
      { financialCategoryId: 'food', amount: 250.12 },
      { financialCategoryId: 'leisure', amount: 40 },
    ], [
      { id: 'food', userId: 'u', name: 'Food', archivedAt: null, createdAt: '', updatedAt: '' },
      { id: 'leisure', userId: 'u', name: 'Leisure', archivedAt: '2027-01-01', createdAt: '', updatedAt: '' },
    ])
    expect(preview.active).toHaveLength(1)
    expect(preview.archived).toHaveLength(1)
    expect(preview.assigned).toBe(250.12)
    expect(preview.unassigned).toBe(619.55)
  })
})
