import { expect, test } from '@playwright/test'
import { isE2EEnabled, readE2EConfig } from './helpers/env'
import { signInAsE2EUser, signOut } from './helpers/auth'

test.describe('Autenticación (requiere Supabase E2E aislado)', () => {
  test.beforeEach(() => {
    test.skip(
      !isE2EEnabled(),
      'Pendiente: entorno Supabase aislado y variables E2E_*',
    )
  })

  test('inicia sesión con credenciales correctas y cierra la sesión', async ({
    page,
  }) => {
    await signInAsE2EUser(page)
    await expect(page.getByRole('link', { name: 'Planora' })).toBeVisible()
    await page.reload()
    await expect(page).not.toHaveURL(/\/login$/)
    await signOut(page)
    await page.goto('/projects')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('rechaza credenciales incorrectas sin filtrar datos de otra sesión', async ({
    page,
  }) => {
    const config = readE2EConfig()!
    await page.goto('/login')
    await page.getByLabel('Email').fill(config.userEmail)
    await page.getByLabel('Contraseña', { exact: true }).fill('clave-incorrecta-e2e')
    await page.locator('button[type="submit"]').click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/budget')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('redirige rutas privadas sin sesión', async ({ page }) => {
    await page.goto('/projects')
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/budget/transactions')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('vuelve a una ruta privada profunda después de iniciar sesión', async ({ page }) => {
    const config = readE2EConfig()!
    const destination = '/budget/transactions?period=2026-10&create=1&type=income'

    await page.goto(destination)
    await expect(page).toHaveURL(/\/login$/)
    await page.getByLabel('Email').fill(config.userEmail)
    await page.getByLabel('Contraseña', { exact: true }).fill(config.userPassword)
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL(destination)
    await expect(page.getByRole('dialog', { name: 'Nueva transacción' })).toBeVisible()
    await expect(page.getByLabel('Tipo')).toHaveValue('income')
  })
})
