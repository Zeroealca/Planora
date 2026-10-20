/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectTabList } from './project-tabs'

describe('ProjectTabList', () => {
  let container: HTMLDivElement
  let root: Root
  const onChange = vi.fn()

  beforeEach(async () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    onChange.mockReset()
    await act(async () => {
      root.render(<ProjectTabList activeTab="items" onChange={onChange} savingsMode="plan" />)
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function tabs() {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
  }

  async function press(index: number, key: string) {
    await act(async () => {
      tabs()[index].dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    })
  }

  it('moves selection and focus with arrows, Home, and End', async () => {
    await press(1, 'ArrowRight')
    expect(onChange).toHaveBeenLastCalledWith('categorias')
    expect(document.activeElement).toBe(tabs()[2])

    await press(2, 'End')
    expect(onChange).toHaveBeenLastCalledWith('ahorros')
    expect(document.activeElement).toBe(tabs()[4])

    await press(4, 'Home')
    expect(onChange).toHaveBeenLastCalledWith('resumen')
    expect(document.activeElement).toBe(tabs()[0])

    await press(0, 'ArrowLeft')
    expect(onChange).toHaveBeenLastCalledWith('ahorros')
  })
})
