import {
  ArrowLeft,
  RefreshCw,
  Menu,
  Moon,
  Sun,
  X,
} from 'lucide-react'

/** Re-export Lucide icons used across the app. */
export function IconBack({ className, size = 18 }: { className?: string; size?: number }) {
  return <ArrowLeft className={className} size={size} aria-hidden="true" />
}

export function IconMenu({ className, size = 20 }: { className?: string; size?: number }) {
  return <Menu className={className} size={size} aria-hidden="true" />
}

export function IconClose({ className, size = 20 }: { className?: string; size?: number }) {
  return <X className={className} size={size} aria-hidden="true" />
}

export function IconRefresh({ className, size = 18 }: { className?: string; size?: number }) {
  return <RefreshCw className={className} size={size} aria-hidden="true" />
}

export function IconSun({ className, size = 22 }: { className?: string; size?: number }) {
  return <Sun className={className} size={size} aria-hidden="true" />
}

export function IconMoon({ className, size = 22 }: { className?: string; size?: number }) {
  return <Moon className={className} size={size} aria-hidden="true" />
}
