/** @vitest-environment jsdom */
import { createElement, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useModalAccessibility } from './use-modal-accessibility'

function DialogHarness({
  onClose,
  dismissible = true,
}: {
  onClose: () => void
  dismissible?: boolean
}) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalAccessibility(open, dialogRef, () => {
    setOpen(false)
    onClose()
  }, { dismissible })

  return createElement(
    'div',
    null,
    createElement(
      'button',
      { type: 'button', id: 'opener', onClick: () => setOpen(true) },
      'Abrir',
    ),
    open
      ? createElement(
          'div',
          {
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'dialog-title',
            ref: dialogRef,
            tabIndex: -1,
          },
          createElement('h2', { id: 'dialog-title' }, 'Diálogo de prueba'),
          createElement('input', { id: 'first', 'aria-label': 'Primero' }),
          createElement('input', { id: 'second', 'aria-label': 'Segundo' }),
          createElement(
            'button',
            { type: 'button', id: 'close', onClick: () => {
              setOpen(false)
              onClose()
            } },
            'Cerrar',
          ),
        )
      : null,
  )
}

describe('useModalAccessibility', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    root.unmount()
    container.remove()
    document.body.style.overflow = ''
  })

  async function renderHarness(
    onClose: () => void,
    dismissible = true,
  ): Promise<void> {
    await vi.waitFor(() => {
      root.render(
        createElement(DialogHarness, { onClose, dismissible }),
      )
    })
    await Promise.resolve()
  }

  it('moves focus into the dialog and restores it on close', async () => {
    const onClose = vi.fn()
    await renderHarness(onClose)

    const opener = container.querySelector<HTMLButtonElement>('#opener')!
    opener.focus()
    opener.click()
    await vi.waitFor(() => {
      expect(document.activeElement?.id).toBe('first')
    })
    expect(document.body.style.overflow).toBe('hidden')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(container.querySelector('[role="dialog"]')).toBeNull()
      expect(document.activeElement).toBe(opener)
    })
    expect(document.body.style.overflow).toBe('')
  })

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    const onClose = vi.fn()
    await renderHarness(onClose)

    container.querySelector<HTMLButtonElement>('#opener')!.click()
    await vi.waitFor(() => {
      expect(document.activeElement?.id).toBe('first')
    })

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
    )
    // Native Tab movement is not simulated by KeyboardEvent; assert trap on edges.
    container.querySelector<HTMLInputElement>('#first')!.focus()
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    )
    expect(document.activeElement?.id).toBe('close')

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
    )
    expect(document.activeElement?.id).toBe('first')
  })

  it('does not dismiss with Escape when dismissible is false', async () => {
    const onClose = vi.fn()
    await renderHarness(onClose, false)

    container.querySelector<HTMLButtonElement>('#opener')!.click()
    await vi.waitFor(() => {
      expect(document.activeElement?.id).toBe('first')
    })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await Promise.resolve()
    expect(onClose).not.toHaveBeenCalled()
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
  })
})
