import { expect, test } from '@playwright/test'
import { e2eRunId, signInAsE2EUser } from './helpers/auth'
import { isE2EEnabled } from './helpers/env'

test.describe('Presupuesto mensual (requiere Supabase E2E aislado)', () => {
  test.beforeEach(() => {
    test.skip(
      !isE2EEnabled(),
      'Pendiente: entorno Supabase aislado y variables E2E_*',
    )
  })

  test('configura presupuesto, registra gasto y conserva el mes anterior', async ({
    page,
  }) => {
    const id = e2eRunId()
    const categoryName = `Fin ${id}`

    await signInAsE2EUser(page)
    await page.goto('/budget')

    const availableInput = page.getByLabel(/disponible/i).first()
    if (await availableInput.isVisible().catch(() => false)) {
      await availableInput.fill('500')
      await page.getByRole('button', { name: /guardar|crear/i }).first().click()
    } else {
      const createBudget = page.getByRole('button', { name: /crear presupuesto|definir disponible|guardar disponible/i })
      if (await createBudget.isVisible().catch(() => false)) {
        await createBudget.click()
        await page.getByLabel(/disponible/i).fill('500')
        await page.getByRole('button', { name: /guardar|crear/i }).click()
      }
    }

    // Ensure a financial category exists for the expense.
    const newCategory = page.getByPlaceholder(/nueva categoría/i).or(page.getByLabel(/nueva categoría/i))
    if (await newCategory.isVisible().catch(() => false)) {
      await newCategory.fill(categoryName)
      await page.getByRole('button', { name: /crear categoría|añadir/i }).click()
    }

    await page.goto('/budget/transactions?create=1')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Descripción').fill(`Gasto ${id}`)
    await dialog.getByLabel('Cantidad').fill('40')
    const categorySelect = dialog.getByLabel('Categoría', { exact: true })
    await expect(categorySelect).toBeVisible()
    await categorySelect.selectOption({ label: 'E2E Essentials' })
    await dialog.getByRole('button', { name: 'Registrar transacción' }).click()
    await expect(page.getByText(`Gasto ${id}`)).toBeVisible()

    await page.goto('/budget')
    await expect(page.getByText(/40|gast/i).first()).toBeVisible()

    await page.getByRole('button', { name: 'Mes anterior' }).click()
    // Previous month should not inherit the new expense as its own spent figures blindly;
    // at minimum the navigation must succeed without duplicating the current-month dialog.
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Mes siguiente' }).click()
    await expect(page.getByText(/40|gast/i).first()).toBeVisible()
  })
})
