import { Link, useSearchParams } from 'react-router'
import { ImportWizard } from '@/features/import/import-wizard'

export function ImportPage() {
  const [searchParams] = useSearchParams()
  const lockedProjectId = searchParams.get('projectId')

  return (
    <div className="page">
      <header className="page-header row-between">
        <div className="stack">
          <h1>{lockedProjectId ? 'Subida masiva' : 'Importar'}</h1>
          <p className="muted">
            {lockedProjectId
              ? 'Importa ítems desde un CSV a este proyecto.'
              : 'Trae ítems desde un CSV a un proyecto nuevo o existente.'}
          </p>
        </div>
        <Link
          to={lockedProjectId ? `/projects/${lockedProjectId}` : '/projects'}
          className="btn btn-ghost"
        >
          {lockedProjectId ? 'Volver al proyecto' : 'Proyectos'}
        </Link>
      </header>
      <ImportWizard lockedProjectId={lockedProjectId} />
    </div>
  )
}
