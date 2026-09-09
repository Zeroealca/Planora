import type { ReactNode } from 'react'

export type ProjectSectionId =
  | 'ahorros'
  | 'configuracion'
  | 'resumen'
  | 'items'
  | 'categorias'

export function CollapsibleSection({
  id,
  title,
  description,
  open,
  onOpenChange,
  headerActions,
  children,
}: {
  id: ProjectSectionId | string
  title: string
  description?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  headerActions?: ReactNode
  children: ReactNode
}) {
  const panelId = `${id}-panel`
  return (
    <section id={id} className="project-section collapsible-section stack">
      <div className="collapsible-header row-between">
        <button
          type="button"
          className="collapsible-trigger"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onOpenChange(!open)}
        >
          <span className="collapsible-title">{title}</span>
          <span className="collapsible-chevron" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
        </button>
        {headerActions}
      </div>
      {open && description ? <p className="muted">{description}</p> : null}
      {open ? (
        <div id={panelId} className="collapsible-panel stack">
          {children}
        </div>
      ) : null}
    </section>
  )
}
