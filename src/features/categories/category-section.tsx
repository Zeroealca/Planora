import { useState, type FormEvent } from 'react'
import { IconCheck, IconPencil, IconTrash } from '@/components/icons'
import { createCategory, deleteCategory, updateCategory } from './category-api'
import type { Category } from '@/types/domain'

export function CategorySection({
  projectId,
  categories,
  onChanged,
}: {
  projectId: string
  categories: readonly Category[]
  onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (name.trim() === '') {
      setError('El nombre es obligatorio.')
      return
    }
    setSubmitting(true)
    try {
      await createCategory(projectId, name, categories.length)
      setName('')
      onChanged()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo crear la categoría.')
    } finally {
      setSubmitting(false)
    }
  }

  async function onSaveEdit(categoryId: string) {
    if (editingName.trim() === '') {
      setError('El nombre es obligatorio.')
      return
    }
    try {
      await updateCategory(categoryId, editingName)
      setEditingId(null)
      onChanged()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo actualizar.')
    }
  }

  async function onDelete(category: Category) {
    if (
      !window.confirm(
        `¿Eliminar “${category.name}”? Los ítems de esta categoría quedarán sin categoría.`,
      )
    ) {
      return
    }
    try {
      await deleteCategory(category.id)
      onChanged()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.')
    }
  }

  return (
    <div className="stack">
      {categories.length === 0 ? (
        <p className="muted">Todavía no hay categorías.</p>
      ) : (
        <ul className="category-card-grid">
          {categories.map((category) => (
            <li key={category.id} className="category-card">
              {editingId === category.id ? (
                <div className="category-card-edit">
                  <label className="sr-only" htmlFor={`edit-cat-${category.id}`}>
                    Nombre de categoría
                  </label>
                  <input
                    id={`edit-cat-${category.id}`}
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    autoFocus
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void onSaveEdit(category.id)
                      }
                      if (event.key === 'Escape') setEditingId(null)
                    }}
                  />
                  <button
                    type="button"
                    className="btn-icon"
                    disabled={editingName.trim() === ''}
                    onClick={() => void onSaveEdit(category.id)}
                    aria-label={`Guardar ${category.name}`}
                    title="Guardar"
                  >
                    <IconCheck />
                  </button>
                </div>
              ) : (
                <>
                  <span className="category-card-name">{category.name}</span>
                  <div className="category-card-actions">
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => {
                        setEditingId(category.id)
                        setEditingName(category.name)
                        setError(null)
                      }}
                      aria-label={`Editar ${category.name}`}
                      title="Editar"
                    >
                      <IconPencil />
                    </button>
                    <button
                      type="button"
                      className="btn-icon btn-icon-danger"
                      onClick={() => void onDelete(category)}
                      aria-label={`Eliminar ${category.name}`}
                      title="Eliminar"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="budget-form-compact category-add-form" onSubmit={onCreate}>
        <div className="field">
          <label htmlFor="new-category">Nueva categoría</label>
          <input
            id="new-category"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Cocina"
            autoComplete="off"
          />
        </div>
        <div className="budget-form-compact-actions">
          <button
            className="btn"
            type="submit"
            disabled={submitting || name.trim() === ''}
          >
            {submitting ? 'Añadiendo…' : 'Añadir'}
          </button>
        </div>
      </form>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
