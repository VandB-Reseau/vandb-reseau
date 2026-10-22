import { expect, test } from '@playwright/test'
import { ouvrirOnglet, seConnecter, textesTropPetits } from './supabase-simule'

// Tâche née dans « Équipe seule » (fil = equipe) : l'équipe la voit, marquée ; le franchisé jamais (base 0019 et app)

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const actions = { 'Annecy Test': [
  { id: 'l1', action: 'Refaire la vitrine', porteur: 'Paul MULTI', echeance: '', creeLe: '2026-09-25' },
  { id: 'l2', action: 'Préparer le point marge', porteur: 'Hugo FICTIF', echeance: '', creeLe: '2026-09-26', fil: 'equipe' },
] }

test('le franchisé ne voit pas une tâche de l’équipe seule', async ({ page }) => {
  await seConnecter(page, { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] }, espace: { actions } })
  const liste = page.getByRole('list', { name: 'Tâches en cours' })
  await expect(liste.getByText('Refaire la vitrine')).toBeVisible()
  await expect(page.getByText('Préparer le point marge')).toHaveCount(0)
})

test('l’équipe voit la tâche, marquée « Équipe seule »', async ({ page }, info) => {
  await seConnecter(page, { config: { actions } })
  await page.goto('#/magasins/Annecy%20Test?vue=actions')
  await ouvrirOnglet(page, 'Tâches')
  const ligne = page.getByRole('listitem').filter({ hasText: 'Préparer le point marge' })
  await expect(ligne).toContainText('Équipe seule')
  await expect(page.getByRole('listitem').filter({ hasText: 'Refaire la vitrine' })).not.toContainText('Équipe seule')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-taches-equipe.png` })
})
