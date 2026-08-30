import { describe, expect, it } from 'vitest'
import { flagsForSingleSelection } from './selection'

describe('item option selection', () => {
  it('selects one option and deselects the others', () => {
    expect(flagsForSingleSelection(['a', 'b', 'c'], 'b')).toEqual([
      { id: 'a', selected: false },
      { id: 'b', selected: true },
      { id: 'c', selected: false },
    ])
  })

  it('keeps a single option selected when it is the only one', () => {
    expect(flagsForSingleSelection(['only'], 'only')).toEqual([
      { id: 'only', selected: true },
    ])
  })
})
