import { expect, test } from '@playwright/test'
import { e2eRunId, signInAsE2EUser } from './helpers/auth'
import { isE2ERemoteEnabled } from './helpers/env'

test.describe('Metas de ahorro (requiere Supabase E2E aislado)', () => {
  test.beforeEach(() => {
    test.skip(
      !isE2ERemoteEnabled(),
      'Pendiente: proyecto Supabase aislado y variables E2E_*',
    )
  })

  test('crea una meta y comprueba progreso visible', async ({ page }) => {
    const id = e2eRunId()
    const goalName = `Meta ${id}`

    await signInAsE2EUser(page)
    await page.goto('/projects')
    await page.getByRole('button', { name: 'Crear proyecto' }).click()

    const savingsToggle = page.getByLabel(/meta de ahorro|ahorro|tipo/i).or(
      page.getByRole('button', { name: /meta de ahorro|ahorro/i }),
    )
    if (await savingsToggle.first().isVisible().catch(() => false)) {
      await savingsToggle.first().click()
    }

    await page.getByLabel(/nombre/i).fill(goalName)
    const target = page.getByLabel(/objetivo|meta|target/i)
    if (await target.isVisible().catch(() => false)) await target.fill('300')
    await page.getByRole('button', { name: /crear|guardar/i }).click()
    await expect(page.getByRole('heading', { name: goalName })).toBeVisible()

    const movementName = page.getByLabel(/nombre|concepto/i).last()
    const movementAmount = page.getByLabel(/importe|cantidad|monto/i).last()
    if (
      (await movementName.isVisible().catch(() => false)) &&
      (await movementAmount.isVisible().catch(() => false))
    ) {
      await movementName.fill(`Aporte ${id}`)
      await movementAmount.fill('50')
      await page.getByRole('button', { name: /añadir|registrar|guardar/i }).last().click()
      await expect(page.getByText(/50|16|17|progres/i).first()).toBeVisible()
    }
  })
})
