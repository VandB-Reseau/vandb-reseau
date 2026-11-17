import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Joseph (17/11/2026) : un onglet Tâches dans la fiche magasin (filtres, ajout), avis Google et itinéraire en haut à
// droite de l'en-tête, déploiements plus faciles à trouver (tuile de l'aperçu, onglet nommé)

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('onglet Tâches : filtres À faire, En retard, Bloquées, Faites et ajout d’une tâche', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  const onglets = page.getByRole('tablist', { name: 'Rubriques de Lyon Test' })
  await onglets.getByRole('tab', { name: 'Tâches', exact: true }).click()
  await expect(page).toHaveURL(/vue=taches/)
  const bloc = page.getByRole('region', { name: 'Tâches du magasin' })
  const filtres = bloc.getByRole('group', { name: 'Filtrer les tâches' })
  for (const f of ['À faire', 'En cours', 'En retard', 'Bloquées', 'Faites']) await expect(filtres.getByRole('button', { name: new RegExp(`^${f} · \\d+$`) })).toBeVisible()
  // Lyon Test a au moins une tâche à faire dans le réseau fictif
  await expect(bloc.getByRole('list', { name: 'Tâches en cours de Lyon Test' }).getByRole('listitem').first()).toBeVisible()
  await filtres.getByRole('button', { name: /^Faites/ }).click()
  await expect(bloc.getByRole('list', { name: 'Tâches faites' }).or(bloc.getByText('Aucune tâche faite pour l’instant.'))).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await bloc.getByRole('button', { name: 'Ajouter une tâche' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('en-tête : avis Google et itinéraire en haut à droite', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  const avis = page.getByRole('link', { name: 'Avis Google' }).first()
  const trajet = page.getByRole('link', { name: 'Itinéraire' }).first()
  await expect(avis).toHaveAttribute('href', /google\.com\/search\?q=V%20and%20B%20Lyon%20Test%20avis/)
  await expect(trajet).toHaveAttribute('href', /google\.com\/maps\/dir\/\?api=1&destination=/)
  const nom = (await page.getByRole('heading', { level: 1, name: 'Lyon Test' }).boundingBox())!
  for (const l of [avis, trajet]) {
    const b = (await l.boundingBox())!
    expect(b.width).toBeGreaterThanOrEqual(48)
    expect(b.height).toBeGreaterThanOrEqual(48)
    // À droite du nom, sur sa hauteur (téléphone : sur la ligne du nom)
    expect(b.x).toBeGreaterThan(nom.x + nom.width - 1)
    if (isMobile) expect(b.y).toBeLessThan(nom.y + nom.height)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('déploiements : tuile de l’aperçu vers l’onglet Nine box et déploiements', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('link', { name: /^Déploiements : / }).click()
  await expect(page).toHaveURL(/vue=ninebox/)
  await expect(page.getByRole('heading', { name: 'Déploiements' })).toBeVisible()
})
