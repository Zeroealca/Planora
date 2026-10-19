import { expect, type Page } from '@playwright/test'
import { readE2EConfig } from './env'

/** Signs in with a synthetic E2E account from the isolated configuration. */
export async function signInAsE2EUser(
  page: Page,
  user: 'primary' | 'secondary' = 'primary',
): Promise<void> {
  const config = readE2EConfig()
  if (!config) {
    throw new Error('signInAsE2EUser requires isolated E2E environment variables.')
  }

  const email = user === 'secondary' ? config.secondaryUserEmail : config.userEmail
  const password = user === 'secondary' ? config.secondaryUserPassword : config.userPassword
  if (!email || !password) {
    throw new Error('The secondary E2E user is only available in prepared local runs.')
  }

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.locator('button[type="submit"]').click()
  await expect(page).not.toHaveURL(/\/login$/)
}

export async function signOut(page: Page): Promise<void> {
  const logout = page.getByRole('button', { name: /cerrar sesión|salir/i })
  if (await logout.isVisible().catch(() => false)) {
    await logout.click()
    await expect(page).toHaveURL(/\/login$/)
    return
  }

  // Fallback: open the mobile menu if the header collapses actions.
  const menu = page.getByRole('button', { name: /menú|menu/i })
  if (await menu.isVisible().catch(() => false)) {
    await menu.click()
  }
  await page.getByRole('button', { name: /cerrar sesión|salir/i }).click()
  await expect(page).toHaveURL(/\/login$/)
}

/** Unique suffix so independent runs do not collide on names. */
export function e2eRunId(): string {
  return `e2e-${Date.now().toString(36)}`
}
