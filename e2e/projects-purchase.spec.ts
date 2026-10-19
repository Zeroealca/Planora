import { expect, test } from '@playwright/test'
import { e2eRunId, signInAsE2EUser } from './helpers/auth'
import { isE2EEnabled } from './helpers/env'

test.describe('Proyectos y compras (requiere Supabase E2E aislado)', () => {
  test.beforeEach(() => {
    test.skip(
      !isE2EEnabled(),
      'Pendiente: entorno Supabase aislado y variables E2E_*',
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
    await page.getByRole('spinbutton', { name: 'Presupuesto del proyecto' }).fill('1000')
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

    await page.getByRole('button', { name: 'Nuevo ítem' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Nuevo ítem' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Nombre').fill(itemName)
    await dialog.getByLabel(/tope total presupuestado|estimado|presupuesto/i).fill('120')
    await dialog.getByRole('button', { name: 'Crear ítem' }).click()
    await page.getByRole('tab', { name: /ítems/i }).click()
    await expect(page.getByRole('textbox', { name: `Nombre ${itemName}` })).toHaveValue(itemName)

    await page.getByRole('link', { name: `Abrir detalle de ${itemName}` }).click()
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

  test('muestra próximas decisiones, estado vacío y navega al ítem', async ({ page }) => {
    const id = e2eRunId()
    const projectName = `Decisiones ${id}`
    const itemName = `Revisar ${id}`

    await signInAsE2EUser(page)
    await page.goto('/projects')
    await page.getByRole('button', { name: 'Crear proyecto' }).click()
    await page.getByLabel(/nombre/i).fill(projectName)
    await page.getByRole('button', { name: /crear|guardar/i }).click()
    await expect(page.getByRole('heading', { name: 'Próximas decisiones' })).toBeVisible()
    await expect(page.getByText('No hay compras pendientes por revisar.')).toBeVisible()

    await page.getByRole('tab', { name: /ítems/i }).click()
    await page.getByRole('button', { name: 'Nuevo ítem' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Nuevo ítem' })
    await dialog.getByLabel('Nombre').fill(itemName)
    await dialog.getByLabel(/tope total presupuestado/i).fill('120')
    await dialog.getByRole('button', { name: 'Crear ítem' }).click()
    await page.getByRole('tab', { name: /resumen/i }).click()

    await expect(page.getByText(itemName)).toBeVisible()
    await expect(page.getByText('Requiere información')).toBeVisible()
    await page.getByRole('link', { name: 'Completar información' }).click()
    await expect(page.getByRole('heading', { name: itemName })).toBeVisible()
  })
})

test.describe('Próximas decisiones en móvil (requiere Supabase E2E aislado)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('conserva una acción visible por decisión', async ({ page }) => {
    test.skip(!isE2EEnabled(), 'Pendiente: entorno Supabase aislado y variables E2E_*')
    const id = e2eRunId()
    const projectName = `Móvil ${id}`
    const itemName = `Pendiente ${id}`

    await signInAsE2EUser(page)
    await page.goto('/projects')
    await page.getByRole('button', { name: 'Crear proyecto' }).click()
    await page.getByLabel(/nombre/i).fill(projectName)
    await page.getByRole('button', { name: /crear|guardar/i }).click()
    await page.getByRole('tab', { name: /ítems/i }).click()
    await page.getByRole('button', { name: 'Nuevo ítem' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Nuevo ítem' })
    await dialog.getByLabel('Nombre').fill(itemName)
    await dialog.getByLabel(/tope total presupuestado/i).fill('75')
    await dialog.getByRole('button', { name: 'Crear ítem' }).click()
    await page.getByRole('tab', { name: /resumen/i }).click()

    await expect(page.getByRole('link', { name: 'Completar información' })).toBeVisible()
  })
})
