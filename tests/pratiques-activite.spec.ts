import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Joseph (14/11/2026) : plus d'onglet « Ressources » ; les bonnes pratiques du magasin sont dans son Activité.
// Sur téléphone, les cinq onglets de la fiche tiennent dès 375 px de large (« Plus » seulement en dessous).
const pratiques = [
  { id: 'bp_1', magasin: 'Lyon Test', date: '2026-10-12', titre: 'Coffrets à composer', theme: 'Vente additionnelle', texte: 'Le client choisit trois bouteilles.', par: 'Hugo FICTIF', photos: [], reprises: [] },
  { id: 'bp_2', magasin: 'Annecy Test', date: '2026-09-02', titre: 'Dégustation du samedi', theme: 'Animation et événements', texte: 'Trois vins ouverts.', par: 'Hugo FICTIF', photos: [], reprises: ['Lyon Test'] },
]

test('les bonnes pratiques du magasin sont dans son activité, sans onglet Ressources', async ({ page, isMobile }, info) => {
  await seConnecter(page, { config: { bonnes_pratiques: pratiques } })
  await page.goto('./#/magasins/Lyon%20Test?vue=activite')
  const onglets = page.getByRole('tablist', { name: 'Rubriques de Lyon Test' })
  await expect(onglets.getByRole('tab', { name: /Ressources/ })).toHaveCount(0)
  // Dans le fil « Tout »
  await expect(page.getByText('Coffrets à composer').first()).toBeVisible()
  // Le filtre Bonnes pratiques : la carte entière, modifiable, et les reprises d'autres magasins
  await page.getByRole('group', { name: 'Filtrer l’activité' }).getByRole('button', { name: 'Bonnes pratiques', exact: true }).click()
  await expect(page).toHaveURL(/fil=pratiques/)
  await expect(page.getByRole('article', { name: 'Coffrets à composer' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Modifier la bonne pratique Coffrets à composer' })).toBeVisible()
  await expect(page.getByText('Reprises d’autres magasins')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Annecy Test' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-pratiques-activite.png`, fullPage: !isMobile })
})

test('un ancien lien vers les bonnes pratiques du magasin ouvre l’activité sur ce filtre', async ({ page }) => {
  await seConnecter(page, { config: { bonnes_pratiques: pratiques } })
  await page.goto('./#/magasins/Lyon%20Test?vue=pratiques')
  await expect(page.getByRole('tablist', { name: 'Rubriques de Lyon Test' }).getByRole('tab', { name: 'Activité', selected: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Filtrer l’activité' }).getByRole('button', { name: 'Bonnes pratiques', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('article', { name: 'Coffrets à composer' })).toBeVisible()
})

test('sans bonne pratique, le filtre propose d’en ajouter une', async ({ page }) => {
  await seConnecter(page, { config: { bonnes_pratiques: [] } })
  await page.goto('./#/magasins/Brest%20Test?vue=activite&fil=pratiques')
  await expect(page.getByText('Aucune bonne pratique pour ce magasin.')).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter une bonne pratique' }).click()
  await expect(page.getByRole('dialog', { name: 'Nouvelle bonne pratique' })).toBeVisible()
})

test('téléphone courant : les cinq onglets de la fiche visibles, sans déborder', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'téléphone seulement')
  await seConnecter(page)
  for (const largeur of [375, 390]) {
    await page.setViewportSize({ width: largeur, height: 812 })
    await page.goto('./#/magasins/Lyon%20Test')
    const onglets = page.getByRole('tablist', { name: 'Rubriques de Lyon Test' })
    await expect(onglets.getByRole('tab')).toHaveText(['Aperçu', 'Activité', 'Chiffres', 'Nine box', 'Budget'])
    for (const t of await onglets.getByRole('tab').all()) {
      const b = (await t.boundingBox())!
      expect(b.x + b.width).toBeLessThanOrEqual(largeur)
      expect(b.height).toBeGreaterThanOrEqual(48)
      expect(b.width).toBeGreaterThanOrEqual(48)
    }
  }
  await page.screenshot({ path: `captures/${info.project.name}-onglets-fiche-cinq.png` })
})

test('fiche du franchisé : ses bonnes pratiques dans l’Activité, quatre onglets', async ({ page, isMobile }) => {
  await seConnecter(page, { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Lyon Test'] }, espace: { pratiques } })
  await page.goto('./#/magasins/Lyon%20Test')
  const onglets = page.getByRole('tablist', { name: 'Rubriques de Lyon Test' })
  await expect(onglets.getByRole('tab')).toHaveText(isMobile ? ['Aperçu', 'Activité', 'Chiffres', 'Budget'] : ['Vue d’ensemble', 'Activité', 'Chiffres', 'Budget'])
  await onglets.getByRole('tab', { name: 'Activité' }).click()
  await page.getByRole('tablist', { name: 'Parties de l’activité' }).getByRole('tab', { name: 'Bonnes pratiques' }).click()
  await expect(page.getByRole('article', { name: 'Coffrets à composer' })).toBeVisible()
  await page.goto('./#/magasins/Lyon%20Test?vue=pratiques')
  await expect(page.getByRole('tablist', { name: 'Parties de l’activité' }).getByRole('tab', { name: 'Bonnes pratiques', selected: true })).toBeVisible()
})
