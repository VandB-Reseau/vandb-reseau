import { expect, test } from '@playwright/test'
import { ouvrirOnglet, seConnecter, textesTropPetits } from './supabase-simule'

// Refonte (Joseph, 09/11/2026, 3A) : 5 onglets, Vue d'ensemble, Activité (tâches, visites, journal), Chiffres (suivi, santé,
// saisies), Budget, Ressources ; les anciens noms d'onglets passent par ouvrirOnglet.
// L3 (Joseph, 21/10/2026) : fiche magasin en onglets regroupés ; la santé avec les chiffres, les campagnes avec les tâches,
// journal et bonnes pratiques chacun dans leur onglet (Joseph, 22/10/2026) ; les anciens liens ouvrent l'onglet qui les accueille

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const largeurTenue = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

test('chaque onglet regroupé montre ses deux parties, sans déborder de l’écran', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test?vue=journal')
  await expect(page.getByRole('region', { name: 'Historique' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Historique' }).getByText('Classé Cœur de réseau')).toBeVisible()
  expect(await largeurTenue(page)).toBe(true)
  await ouvrirOnglet(page, 'Chiffres et santé')
  await expect(page.getByText(/En recul depuis le 1 oct\. 2026/)).toBeVisible()
  expect(await largeurTenue(page)).toBe(true)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-chiffres-sante.png`, fullPage: true })
  await ouvrirOnglet(page, 'Tâches')
  await expect(page.getByRole('main').getByRole('button', { name: /^Campagnes/ })).toBeVisible()
  expect(await largeurTenue(page)).toBe(true)
})

for (const { ancienne, onglet, vu } of [
  { ancienne: 'sante', onglet: /^Nine box/, vu: /En recul depuis le 1 oct\. 2026/ },
  { ancienne: 'fil', onglet: /^Historique/, vu: 'Classé Cœur de réseau' },
]) {
  test(`un ancien lien ?vue=${ancienne} ouvre l’onglet qui l’accueille`, async ({ page, isMobile }) => {
    await seConnecter(page)
    await page.goto(`./#/magasins/Lyon%20Test?vue=${ancienne}`)
    if (!isMobile) await expect(page.getByRole('tablist', { name: 'Rubriques de Lyon Test' }).getByRole('tab', { name: onglet, selected: true })).toBeVisible()
    // Vague 3 (23A) : l'activité commence par « À venir », le fil suit
    await expect(page.getByText(vu).first()).toBeVisible()
  })
}

// Téléphone (Joseph, 17/11/2026) : tous les onglets dans la bande, qui défile vers la droite ; Historique en dernier
for (const largeur of [375, 430]) {
  test(`téléphone de ${largeur} px : tous les onglets, la bande défile sans déborder de la page`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'téléphone seulement')
    await page.setViewportSize({ width: largeur, height: 900 })
    await seConnecter(page)
    await page.goto('./#/magasins/Lyon%20Test')
    const onglets = page.getByRole('tablist', { name: 'Rubriques de Lyon Test' })
    await expect(onglets.getByRole('tab')).toHaveText(['Aperçu', 'Tâches', 'Chiffres', 'Budget', 'Simuler', 'Extérieur', 'Nine box', 'Historique'])
    expect(await largeurTenue(page)).toBe(true)
    for (const t of await onglets.getByRole('tab').all()) {
      const b = (await t.boundingBox())!
      expect(b.width).toBeGreaterThanOrEqual(48)
      expect(b.height).toBeGreaterThanOrEqual(48)
    }
    // Plus d'onglet dans le menu « ⋯ »
    await page.getByRole('button', { name: 'Autres actions' }).click()
    await expect(page.getByRole('menuitem', { name: /Nine box|Simulateurs|Marché extérieur/ })).toHaveCount(0)
    await page.keyboard.press('Escape')
    // Le dernier onglet s'atteint en faisant défiler la bande
    await onglets.getByRole('tab', { name: 'Historique' }).click()
    await expect(page).toHaveURL(/vue=activite/)
    expect(await largeurTenue(page)).toBe(true)
    await onglets.getByRole('tab', { name: 'Marché extérieur' }).click()
    await expect(page).toHaveURL(/vue=exterieur/)
  })
}
