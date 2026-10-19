import { expect, test } from '@playwright/test'
import { e2eRunId, signInAsE2EUser } from './helpers/auth'
import { isE2EEnabled } from './helpers/env'

test.describe('Pagos programados (requiere Supabase E2E aislado)', () => {
  test.beforeEach(() => {
    test.skip(
      !isE2EEnabled(),
      'Pendiente: entorno Supabase aislado y variables E2E_*',
    )
  })

  test('crea un pago, lo confirma una sola vez y vincula la transacción', async ({
    page,
  }) => {
    const id = e2eRunId()
    const paymentName = `Pago ${id}`

    await signInAsE2EUser(page)
    await page.goto('/budget/scheduled-payments')
    await page.getByRole('button', { name: 'Nuevo pago', exact: true }).click()
    const ruleDialog = page.getByRole('dialog')
    await expect(ruleDialog).toBeVisible()
    await ruleDialog.getByLabel(/nombre/i).fill(paymentName)
    const category = ruleDialog.getByLabel('Categoría', { exact: true })
    if (await category.isVisible().catch(() => false)) {
      const count = await category.locator('option').count()
      if (count > 1) await category.selectOption({ index: 1 })
    }
    await ruleDialog.getByLabel('Importe esperado', { exact: true }).fill('25')
    await ruleDialog.getByRole('button', { name: 'Guardar pago', exact: true }).click()
    await expect(page.getByRole('listitem').filter({ hasText: paymentName }).first()).toBeVisible()

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
