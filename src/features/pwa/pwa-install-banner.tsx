import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return true
  const media = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return media || iosStandalone
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const webkit = /WebKit/.test(ua)
  const chrome = /CriOS|Chrome|Firefox|EdgiOS/.test(ua)
  return iOS && webkit && !chrome
}

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('planora-install-dismissed') === '1'
    } catch {
      return false
    }
  })
  const [iosHint, setIosHint] = useState(() => !isStandaloneDisplay() && isIosSafari())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isStandaloneDisplay()) return

    function onBeforeInstall(event: Event) {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      setIosHint(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }, [])

  if (dismissed || isStandaloneDisplay()) return null
  if (!deferred && !iosHint) return null

  async function onInstall() {
    if (!deferred) return
    setBusy(true)
    try {
      await deferred.prompt()
      await deferred.userChoice
      setDeferred(null)
    } finally {
      setBusy(false)
    }
  }

  function onDismiss() {
    setDismissed(true)
    try {
      sessionStorage.setItem('planora-install-dismissed', '1')
    } catch {
      // ignore
    }
  }

  return (
    <div className="install-banner" role="region" aria-label="Instalar aplicación">
      <div className="install-banner-copy">
        <p className="install-banner-title">
          <Download size={18} aria-hidden="true" />
          Instala Planora
        </p>
        <p className="muted">
          {iosHint && !deferred
            ? 'En Safari: Compartir → Añadir a pantalla de inicio.'
            : 'Añádela a tu pantalla de inicio para abrirla como app.'}
        </p>
      </div>
      <div className="row install-banner-actions">
        {deferred ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void onInstall()}
          >
            {busy ? 'Abrir…' : 'Instalar'}
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={onDismiss}>
          Ahora no
        </button>
      </div>
    </div>
  )
}
