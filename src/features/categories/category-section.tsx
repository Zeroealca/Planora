import { useState, type FormEvent } from 'react'
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
        <ul className="plain-list">
          {categories.map((category) => (
            <li key={category.id} className="row-between">
              {editingId === category.id ? (
                <div className="row">
                  <label className="sr-only" htmlFor={`edit-cat-${category.id}`}>
                    Nombre de categoría
                  </label>
                  <input
                    id={`edit-cat-${category.id}`}
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void onSaveEdit(category.id)}
                  >
                    Guardar
                  </button>
                </div>
              ) : (
                <span>{category.name}</span>
              )}
              <span className="row">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setEditingId(category.id)
                    setEditingName(category.name)
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void onDelete(category)}
                >
                  Eliminar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form className="stack" onSubmit={onCreate}>
        <div className="field">
          <label htmlFor="new-category">Nueva categoría</label>
          <input
            id="new-category"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Añadiendo…' : 'Añadir categoría'}
        </button>
      </form>
    </div>
  )
}
