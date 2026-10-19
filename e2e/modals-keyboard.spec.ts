import { expect, test } from '@playwright/test'
import { e2eRunId, signInAsE2EUser } from './helpers/auth'
import { isE2EEnabled } from './helpers/env'

test.describe('Modales y teclado (capa segura + remota)', () => {
  test('la pantalla de login es navegable con teclado sin Supabase', async ({
    page,
  }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Planora' })).toBeVisible()
    await page.keyboard.press('Tab')
    // Focus lands on a control inside the auth shell (segmented or status).
    await expect(page.locator(':focus')).toBeVisible()
  })

  test.describe('con sesión E2E', () => {
    test.beforeEach(() => {
      test.skip(
        !isE2EEnabled(),
        'Pendiente: entorno Supabase aislado y variables E2E_*',
      )
    })

    test('abre un modal, atrapa el foco, Escape cierra y restaura el foco', async ({
      page,
    }) => {
      await signInAsE2EUser(page)
      await page.goto('/budget/transactions')
      const openButton = page.getByRole('button', { name: 'Nueva transacción' })
      await openButton.focus()
      await openButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByLabel('Descripción')).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(dialog.locator(':focus')).toBeVisible()
      await page.keyboard.press('Shift+Tab')
      await expect(dialog.locator(':focus')).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(openButton).toBeFocused()
    })

    test('muestra error accesible en el formulario del modal', async ({ page }) => {
      await signInAsE2EUser(page)
      await page.goto('/budget/transactions?create=1')
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel('Descripción').fill(`Err ${e2eRunId()}`)
      await dialog.getByLabel('Cantidad').fill('0')
      await dialog.getByRole('button', { name: 'Registrar transacción' }).click()
      await expect(dialog.getByRole('alert')).toBeVisible()
    })

    test('funciona en viewport móvil', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await signInAsE2EUser(page)
      await page.goto('/budget/scheduled-payments')
      await page.getByRole('button', { name: 'Nuevo pago', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
    })
  })
})
