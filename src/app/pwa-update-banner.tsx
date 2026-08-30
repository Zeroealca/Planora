import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaUpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="update-banner" role="status">
      <p>Hay una nueva versión de Planora.</p>
      <button type="button" className="btn" onClick={() => void updateServiceWorker(true)}>
        Actualizar
      </button>
    </div>
  )
}
