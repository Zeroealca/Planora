import type { SavingsMode } from '@/types/domain'
import type { ProjectTabId } from './project-tab-ids'

export function isSavingsGoalProject(mode: SavingsMode): boolean {
  return mode === 'goal'
}

/** Tabs available for a project kind. Goal projects are savings-only. */
export function projectTabsForMode(
  mode: SavingsMode,
): readonly { id: ProjectTabId; label: string }[] {
  if (isSavingsGoalProject(mode)) {
    return [
      { id: 'resumen', label: 'Resumen' },
      { id: 'ahorros', label: 'Meta' },
    ] as const
  }
  return [
    { id: 'resumen', label: 'Resumen' },
    { id: 'items', label: 'Ítems' },
    { id: 'categorias', label: 'Categorías' },
    { id: 'configuracion', label: 'Estados' },
    { id: 'ahorros', label: 'Ahorros' },
  ] as const
}

export function isTabAllowedForMode(tab: ProjectTabId, mode: SavingsMode): boolean {
  return projectTabsForMode(mode).some((entry) => entry.id === tab)
}
