import {
  ArrowLeft,
  Check,
  CirclePlus,
  Eye,
  GripVertical,
  Pencil,
  RefreshCw,
  Menu,
  Moon,
  Sun,
  Trash2,
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

export function IconPencil({ className, size = 16 }: { className?: string; size?: number }) {
  return <Pencil className={className} size={size} aria-hidden="true" />
}

export function IconTrash({ className, size = 16 }: { className?: string; size?: number }) {
  return <Trash2 className={className} size={size} aria-hidden="true" />
}

export function IconCheck({ className, size = 16 }: { className?: string; size?: number }) {
  return <Check className={className} size={size} aria-hidden="true" />
}

export function IconGrip({ className, size = 16 }: { className?: string; size?: number }) {
  return <GripVertical className={className} size={size} aria-hidden="true" />
}

export function IconEye({ className, size = 16 }: { className?: string; size?: number }) {
  return <Eye className={className} size={size} aria-hidden="true" />
}

export function IconPlusCircle({ className, size = 16 }: { className?: string; size?: number }) {
  return <CirclePlus className={className} size={size} aria-hidden="true" />
}
