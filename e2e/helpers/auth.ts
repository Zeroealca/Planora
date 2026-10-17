import { expect, type Page } from '@playwright/test'
import { readE2ERemoteConfig } from './env'

/** Signs in with the synthetic E2E account. Requires remote E2E env. */
export async function signInAsE2EUser(page: Page): Promise<void> {
  const config = readE2ERemoteConfig()
  if (!config) {
    throw new Error('signInAsE2EUser requires remote E2E environment variables.')
  }

  await page.goto('/login')
  await page.getByLabel('Email').fill(config.userEmail)
  await page.getByLabel('Contraseña').fill(config.userPassword)
  await page.getByRole('button', { name: 'Entrar' }).click()
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
