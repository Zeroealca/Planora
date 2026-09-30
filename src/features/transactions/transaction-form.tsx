import { useState, type FormEvent } from 'react'
import type { FinancialCategory } from '@/features/monthly-budget/domain'
import { createFinancialCategory } from '@/features/monthly-budget/monthly-budget-api'
import { costInputValue, emptyToNull, parseCost } from '@/utils/form'
import type { FinancialTransaction, TransactionType } from './domain'
import { createTransaction, updateTransaction } from './transaction-api'

export function TransactionForm({ userId, categories, transaction, defaultDate, defaultCategoryId, onSaved, onCategoryCreated }: { userId: string; categories: readonly FinancialCategory[]; transaction?: FinancialTransaction; defaultDate: string; defaultCategoryId?: string; onSaved: () => void; onCategoryCreated: (category: FinancialCategory) => void }) {
  const [name, setName] = useState(transaction?.name ?? '')
  const [amount, setAmount] = useState(costInputValue(transaction?.amount ?? null))
  const [date, setDate] = useState(transaction?.occurredOn ?? defaultDate)
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense')
  const [categoryId, setCategoryId] = useState(transaction?.financialCategoryId ?? defaultCategoryId ?? '')
  const [notes, setNotes] = useState(transaction?.notes ?? '')
  const [newCategory, setNewCategory] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const activeCategories = categories.filter((category) => !category.archivedAt || category.id === categoryId)

  async function save(event: FormEvent) {
    event.preventDefault(); setError(null)
    const parsed = parseCost(amount)
    if (parsed == null || Number.isNaN(parsed) || parsed <= 0) { setError('El monto debe ser mayor a cero.'); return }
    if (type === 'expense' && !categoryId) { setError('Selecciona una categoría para el gasto.'); return }
    const input = { name, amount: parsed, occurredOn: date, type, financialCategoryId: type === 'expense' ? categoryId : null, notes: emptyToNull(notes) }
    setSubmitting(true)
    try { if (transaction) await updateTransaction(transaction.id, input); else await createTransaction(userId, input); onSaved() }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar la transacción.') }
    finally { setSubmitting(false) }
  }
  async function addCategory() {
    try { const category = await createFinancialCategory(userId, newCategory); onCategoryCreated(category); setCategoryId(category.id); setNewCategory(''); setError(null) }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo crear la categoría.') }
  }
  return <form className="stack" onSubmit={save}>
    <div className="field"><label htmlFor="transaction-name">Nombre</label><input id="transaction-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
    <div className="field"><label htmlFor="transaction-type">Tipo</label><select id="transaction-type" value={type} onChange={(e) => setType(e.target.value as TransactionType)}><option value="expense">Gasto</option><option value="income">Ingreso</option></select></div>
    <div className="field"><label htmlFor="transaction-amount">Cantidad</label><input id="transaction-amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
    <div className="field"><label htmlFor="transaction-date">Fecha</label><input id="transaction-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
    {type === 'expense' ? <><div className="field"><label htmlFor="transaction-category">Categoría</label><select id="transaction-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required><option value="">Selecciona una categoría</option>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.archivedAt ? ' (archivada)' : ''}</option>)}</select></div><div className="row"><input aria-label="Nueva categoría financiera" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nueva categoría" /><button type="button" className="btn" disabled={!newCategory.trim()} onClick={() => void addCategory()}>Crear categoría</button></div></> : null}
    <div className="field"><label htmlFor="transaction-notes">Notas (opcional)</label><textarea id="transaction-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
    {error ? <p className="field-error" role="alert">{error}</p> : null}<button className="btn btn-primary" disabled={submitting}>{submitting ? 'Guardando…' : transaction ? 'Guardar cambios' : 'Registrar transacción'}</button>
  </form>
}
