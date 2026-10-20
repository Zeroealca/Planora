import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { SavingsMode } from '@/types/domain'
import type { ProjectTabId } from './project-tab-ids'
import { projectTabsForMode } from './project-kind'

export function ProjectTabList({
  activeTab,
  onChange,
  savingsMode,
}: {
  activeTab: ProjectTabId
  onChange: (tab: ProjectTabId) => void
  savingsMode: SavingsMode
}) {
  const tabs = projectTabsForMode(savingsMode)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const activeIndex = tabs.findIndex((tab) => tab.id === activeTab)
    tabRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [activeTab, tabs])

  function selectTab(index: number) {
    const nextIndex = (index + tabs.length) % tabs.length
    onChange(tabs[nextIndex].id)
    tabRefs.current[nextIndex]?.focus()
    tabRefs.current[nextIndex]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        selectTab(index + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        selectTab(index - 1)
        break
      case 'Home':
        event.preventDefault()
        selectTab(0)
        break
      case 'End':
        event.preventDefault()
        selectTab(tabs.length - 1)
        break
    }
  }

  return (
    <div className="project-tabs-wrap">
      <p className="project-tabs-hint">Desliza para ver más secciones</p>
      <div className="project-tabs" role="tablist" aria-label="Secciones del proyecto">
      {tabs.map((tab, index) => {
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
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(element) => {
              tabRefs.current[index] = element
            }}
          >
            {tab.label}
          </button>
        )
      })}
      </div>
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
