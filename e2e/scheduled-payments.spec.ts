import { expect, test } from '@playwright/test'
import { e2eRunId, signInAsE2EUser } from './helpers/auth'
import { isE2ERemoteEnabled } from './helpers/env'

test.describe('Pagos programados (requiere Supabase E2E aislado)', () => {
  test.beforeEach(() => {
    test.skip(
      !isE2ERemoteEnabled(),
      'Pendiente: proyecto Supabase aislado y variables E2E_*',
    )
  })

  test('crea un pago, lo confirma una sola vez y vincula la transacción', async ({
    page,
  }) => {
    const id = e2eRunId()
    const paymentName = `Pago ${id}`

    await signInAsE2EUser(page)
    await page.goto('/budget/scheduled-payments')
    await page.getByRole('button', { name: /nuevo pago|crear pago|añadir/i }).click()
    const ruleDialog = page.getByRole('dialog')
    await expect(ruleDialog).toBeVisible()
    await ruleDialog.getByLabel(/nombre/i).fill(paymentName)
    const category = ruleDialog.getByLabel(/categoría/i)
    if (await category.isVisible().catch(() => false)) {
      const count = await category.locator('option').count()
      if (count > 1) await category.selectOption({ index: 1 })
    }
    const amount = ruleDialog.getByLabel(/importe|monto|cantidad/i)
    if (await amount.isVisible().catch(() => false)) await amount.fill('25')
    await ruleDialog.getByRole('button', { name: /guardar|crear/i }).click()
    await expect(page.getByText(paymentName)).toBeVisible()

    const payButton = page.getByRole('button', { name: /registrar pago|marcar.*pagado|pagar/i }).first()
    await payButton.click()
    const paymentDialog = page.getByRole('dialog', { name: /registrar pago/i })
    await expect(paymentDialog).toBeVisible()
    await paymentDialog.getByLabel(/importe pagado/i).fill('25')
    await paymentDialog.getByRole('button', { name: 'Confirmar pago' }).click()
    await expect(paymentDialog).toHaveCount(0)

    // Second confirmation must not be available for the same occurrence.
    await expect(
      page.getByRole('button', { name: /registrar pago|marcar.*pagado|pagar/i }),
    ).toHaveCount(0)

    await page.goto('/budget/transactions')
    await expect(page.getByText(paymentName).or(page.getByText('25')).first()).toBeVisible()
  })
})
