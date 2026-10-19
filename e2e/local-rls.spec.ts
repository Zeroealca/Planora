import { expect, test } from '@playwright/test'
import { e2eRunId, signInAsE2EUser } from './helpers/auth'
import { readE2EConfig } from './helpers/env'

test.describe('RLS local entre usuarios sintéticos', () => {
  test.beforeEach(() => {
    test.skip(
      readE2EConfig()?.mode !== 'local',
      'Requiere el entorno E2E local preparado con los usuarios A y B.',
    )
  })

  test('el usuario B no puede ver el proyecto creado por el usuario A', async ({ browser }) => {
    const projectName = `Aislado ${e2eRunId()}`
    const userAContext = await browser.newContext()
    const userBContext = await browser.newContext()

    try {
      const userAPage = await userAContext.newPage()
      await signInAsE2EUser(userAPage, 'primary')
      await userAPage.goto('/projects')
      await userAPage.getByRole('button', { name: 'Crear proyecto' }).click()
      await userAPage.getByLabel(/nombre/i).fill(projectName)
      await userAPage.getByRole('spinbutton', { name: 'Presupuesto del proyecto' }).fill('100')
      await userAPage.getByRole('button', { name: /crear|guardar/i }).click()
      await expect(userAPage.getByRole('heading', { name: projectName })).toBeVisible()

      const userBPage = await userBContext.newPage()
      await signInAsE2EUser(userBPage, 'secondary')
      await userBPage.goto('/projects')
      await expect(userBPage.getByText(projectName)).toHaveCount(0)
    } finally {
      await Promise.all([userAContext.close(), userBContext.close()])
    }
  })
})
