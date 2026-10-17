import { expect, test } from '@playwright/test'
import { isE2ERemoteEnabled, readE2ERemoteConfig } from './helpers/env'
import { signInAsE2EUser, signOut } from './helpers/auth'

test.describe('Autenticación (requiere Supabase E2E aislado)', () => {
  test.beforeEach(() => {
    test.skip(
      !isE2ERemoteEnabled(),
      'Pendiente: proyecto Supabase aislado y variables E2E_*',
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
    const config = readE2ERemoteConfig()!
    await page.goto('/login')
    await page.getByLabel('Email').fill(config.userEmail)
    await page.getByLabel('Contraseña').fill('clave-incorrecta-e2e')
    await page.getByRole('button', { name: 'Entrar' }).click()
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
})
