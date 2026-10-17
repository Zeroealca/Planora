import { useEffect } from 'react'

/** Closes an active modal with Escape without changing its data or submit flow. */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, onEscape])
}
