import { expect, test } from '@playwright/test'
import { e2eRunId, signInAsE2EUser } from './helpers/auth'
import { isE2EEnabled } from './helpers/env'

test.describe('Metas de ahorro (requiere Supabase E2E aislado)', () => {
  test.beforeEach(() => {
    test.skip(
      !isE2EEnabled(),
      'Pendiente: entorno Supabase aislado y variables E2E_*',
    )
  })

  test('crea una meta y comprueba progreso visible', async ({ page }) => {
    const id = e2eRunId()
    const goalName = `Meta ${id}`

    await signInAsE2EUser(page)
    await page.goto('/projects')
    await page.getByRole('button', { name: 'Crear proyecto' }).click()

    await page.getByRole('radio', { name: /Meta de ahorro/ }).check()

    await page.getByLabel(/nombre/i).fill(goalName)
    await page.getByRole('button', { name: /crear|guardar/i }).click()
    await expect(page.getByRole('heading', { name: goalName })).toBeVisible()

    await page.getByRole('tab', { name: 'Meta' }).click()
    await page.getByLabel('Saldo inicial').fill('0')
    await page.getByLabel('Cantidad objetivo').fill('300')
    await page.getByLabel('Reserva mínima').fill('0')
    await page.getByLabel('Aporte mensual').fill('50')
    await page.getByLabel('Fecha de inicio').fill('2026-01-01')
    await page.getByRole('button', { name: 'Aplicar a la meta' }).click()
    await expect(page.getByRole('region', { name: 'Proyección' })).toContainText('300 US$')

    const movementName = `Aporte ${id}`
    await page.getByLabel('Nombre').fill(movementName)
    await page.getByLabel('Fecha', { exact: true }).fill('2026-02-01')
    await page.getByLabel('Monto').fill('50')
    await page.getByRole('button', { name: 'Añadir movimiento' }).click()
    await expect(page.getByText(movementName)).toBeVisible()
  })
})
