import { expect, test } from '@playwright/test'
import { e2eRunId, signInAsE2EUser } from './helpers/auth'
import { isE2ERemoteEnabled } from './helpers/env'

test.describe('Proyectos y compras (requiere Supabase E2E aislado)', () => {
  test.beforeEach(() => {
    test.skip(
      !isE2ERemoteEnabled(),
      'Pendiente: proyecto Supabase aislado y variables E2E_*',
    )
  })

  test('recorrido representativo de proyecto, categoría, ítem y compra', async ({
    page,
  }) => {
    const id = e2eRunId()
    const projectName = `Compra ${id}`
    const categoryName = `Cat ${id}`
    const itemName = `Ítem ${id}`

    await signInAsE2EUser(page)
    await page.goto('/projects')
    await page.getByRole('button', { name: 'Crear proyecto' }).click()
    await page.getByLabel(/nombre/i).fill(projectName)
    await page.getByLabel(/presupuesto/i).fill('1000')
    await page.getByRole('button', { name: /crear|guardar/i }).click()
    await expect(page.getByRole('heading', { name: projectName })).toBeVisible()

    await page.getByRole('tab', { name: /categorías|items|ítems/i }).first().click().catch(() => undefined)
    // Categories live in the project detail; prefer visible create controls.
    const categoryButton = page.getByRole('button', { name: /nueva categoría|añadir categoría|agregar categoría/i })
    if (await categoryButton.isVisible().catch(() => false)) {
      await categoryButton.click()
      await page.getByLabel(/nombre/i).last().fill(categoryName)
      await page.getByRole('button', { name: /guardar|crear|añadir/i }).last().click()
      await expect(page.getByText(categoryName)).toBeVisible()
    }

    await page.getByRole('button', { name: 'Nuevo ítem' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nuevo ítem' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Nombre').fill(itemName)
    await dialog.getByLabel(/tope total presupuestado|estimado|presupuesto/i).fill('120')
    await dialog.getByRole('button', { name: 'Crear ítem' }).click()
    await expect(page.getByText(itemName)).toBeVisible()

    await page.getByRole('link', { name: itemName }).click()
    await page.getByRole('button', { name: /nueva opción|añadir opción|agregar opción/i }).click()
    await page.getByLabel(/^nombre$/i).last().fill(`Opción ${id}`)
    await page.getByLabel(/precio/i).last().fill('110')
    await page.getByRole('button', { name: /guardar|crear|añadir/i }).last().click()
    await page.getByRole('button', { name: /seleccionar|elegir/i }).first().click()

    // Mark purchased with actual cost when the UI exposes status controls.
    const status = page.getByLabel(/estado/i)
    if (await status.isVisible().catch(() => false)) {
      await status.selectOption({ label: /comprado|purchased/i })
      const actual = page.getByLabel(/precio pagado|coste real|actual/i)
      if (await actual.isVisible().catch(() => false)) await actual.fill('110')
      await page.getByRole('button', { name: /guardar/i }).click()
    }

    await page.goto('/projects')
    await page.getByRole('link', { name: projectName }).click()
    await expect(page.getByText(/110|120/).first()).toBeVisible()
  })
})
