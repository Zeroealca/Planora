/** @vitest-environment jsdom */
import { act, useRef, useState } from 'react'
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
  useModalAccessibility(
    open,
    dialogRef,
    () => {
      setOpen(false)
      onClose()
    },
    { dismissible },
  )

  return (
    <div>
      <button type="button" id="opener" onClick={() => setOpen(true)}>
        Abrir
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          ref={dialogRef}
          tabIndex={-1}
        >
          <h2 id="dialog-title">Diálogo de prueba</h2>
          <input id="first" aria-label="Primero" />
          <input id="second" aria-label="Segundo" />
          <button
            type="button"
            id="close"
            onClick={() => {
              setOpen(false)
              onClose()
            }}
          >
            Cerrar
          </button>
        </div>
      ) : null}
    </div>
  )
}

describe('useModalAccessibility', () => {
  let container: HTMLDivElement
  let root: Root
  let previousActFlag: boolean | undefined
  const originalGetClientRects = HTMLElement.prototype.getClientRects

  beforeEach(() => {
    previousActFlag = (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    // jsdom reports empty client rects; the hook uses them to skip hidden controls.
    HTMLElement.prototype.getClientRects = () =>
      [{ width: 1, height: 1, top: 0, left: 0, bottom: 1, right: 1, x: 0, y: 0, toJSON: () => ({}) }] as unknown as DOMRectList

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    document.body.style.overflow = ''
    HTMLElement.prototype.getClientRects = originalGetClientRects
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      previousActFlag
  })

  async function renderHarness(
    onClose: () => void,
    dismissible = true,
  ): Promise<void> {
    await act(async () => {
      root.render(
        <DialogHarness onClose={onClose} dismissible={dismissible} />,
      )
    })
  }

  async function openDialog(): Promise<void> {
    const opener = container.querySelector<HTMLButtonElement>('#opener')!
    await act(async () => {
      opener.focus()
      opener.click()
    })
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    })
  }

  it('moves focus into the dialog and restores it on close', async () => {
    const onClose = vi.fn()
    await renderHarness(onClose)
    const opener = container.querySelector<HTMLButtonElement>('#opener')!
    await openDialog()

    expect(document.activeElement?.id).toBe('first')
    expect(document.body.style.overflow).toBe('hidden')

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('')
  })

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    const onClose = vi.fn()
    await renderHarness(onClose)
    await openDialog()

    container.querySelector<HTMLInputElement>('#first')!.focus()
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
        }),
      )
    })
    expect(document.activeElement?.id).toBe('close')

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
      )
    })
    expect(document.activeElement?.id).toBe('first')
  })

  it('does not dismiss with Escape when dismissible is false', async () => {
    const onClose = vi.fn()
    await renderHarness(onClose, false)
    await openDialog()

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })

    expect(onClose).not.toHaveBeenCalled()
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
  })
})
