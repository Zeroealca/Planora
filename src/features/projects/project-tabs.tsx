import type { ReactNode } from 'react'
import { PROJECT_TABS, type ProjectTabId } from './project-tab-ids'

export function ProjectTabList({
  activeTab,
  onChange,
}: {
  activeTab: ProjectTabId
  onChange: (tab: ProjectTabId) => void
}) {
  return (
    <div className="project-tabs" role="tablist" aria-label="Secciones del proyecto">
      {PROJECT_TABS.map((tab) => {
        const selected = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`project-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`project-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={selected ? 'project-tab project-tab-active' : 'project-tab'}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function ProjectTabPanel({
  id,
  activeTab,
  description,
  toolbar,
  children,
}: {
  id: ProjectTabId
  activeTab: ProjectTabId
  description?: string
  toolbar?: ReactNode
  children: ReactNode
}) {
  if (id !== activeTab) return null

  return (
    <section
      id={`project-panel-${id}`}
      role="tabpanel"
      aria-labelledby={`project-tab-${id}`}
      className="project-tab-panel stack"
    >
      {toolbar || description ? (
        <div className="project-tab-panel-head row-between">
          {description ? <p className="muted project-tab-description">{description}</p> : <span />}
          {toolbar}
        </div>
      ) : null}
      {children}
    </section>
  )
}
