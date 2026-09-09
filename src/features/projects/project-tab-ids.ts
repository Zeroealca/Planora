export type ProjectTabId =
  | 'resumen'
  | 'items'
  | 'categorias'
  | 'configuracion'
  | 'ahorros'

export const PROJECT_TABS: readonly { id: ProjectTabId; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'items', label: 'Ítems' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'configuracion', label: 'Estados' },
  { id: 'ahorros', label: 'Ahorros' },
]

export function parseProjectTab(value: string | null): ProjectTabId | null {
  if (PROJECT_TABS.some((tab) => tab.id === value)) {
    return value as ProjectTabId
  }
  return null
}
