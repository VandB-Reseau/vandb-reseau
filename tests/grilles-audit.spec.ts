import { expect, test } from '@playwright/test'
import { PNG, seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

async function petitesZones(page: import('@playwright/test').Page, selecteur: string) {
  return page.locator(selecteur).evaluateAll((els) => els.filter((e) => {
    const r = e.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && r.height < 47.5 && getComputedStyle(e).visibility !== 'hidden'
  }).map((e) => (e.textContent || e.getAttribute('aria-label') || '').trim()))
}

const photo = { name: 'vitrine.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') }
const FRIGOS = 'Températures des frigos relevées et notées chaque jour'
const PERIMES = 'Aucun produit périmé en rayon, au bar ou en réserve'

// Audit déjà rempli avec la grille, un écart photographié
const auditRempli = {
  'Nantes Test': [{
    date: '2026-03-10', type: 'hygiene', conforme: false, score: 50,
    reponses: {
      froid_1: { theme: 'Chaîne du froid', libelle: FRIGOS, critique: true, etat: 'non', commentaire: 'Relevés arrêtés depuis le 2 septembre', photos: [{ chemin: 'audits/2026-09/a.jpg', taille: 240000 }] },
      froid_2: { theme: 'Chaîne du froid', libelle: PERIMES, critique: true, etat: 'oui' },
    },
  }],
}

test('construire les grilles d’audit dans Paramètres', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/parametres/reglages')
  const carte = page.getByRole('heading', { name: 'Grilles d’audit' }).locator('xpath=ancestor::div[contains(@class,"MuiCard-root")]')
  await expect(carte.getByRole('tab', { name: 'Hygiène', selected: true })).toBeVisible()
  await expect(carte.getByLabel('Seuil de conformité (%)')).toHaveValue('80')
  await expect(carte.getByLabel('Point 1').first()).toHaveValue(FRIGOS)
  await carte.getByRole('heading', { name: 'Grilles d’audit' }).scrollIntoViewIfNeeded()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await petitesZones(page, '.MuiCard-root button:not(.MuiTab-root)')).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-parametres-grilles.png` })

  // Excellence opérationnelle : seuil, nouveau point critique, point supprimé
  await carte.getByRole('tab', { name: /Excellence/ }).click()
  await carte.getByLabel('Seuil de conformité (%)').fill('85')
  await carte.getByRole('button', { name: 'Supprimer le point 3 de Façade et vitrine' }).click()
  await carte.getByRole('button', { name: 'Ajouter un point' }).first().click()
  await expect(carte.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await carte.getByLabel('Point 3').first().fill('Opération Beaujolais en vitrine')
  await carte.getByRole('checkbox', { name: 'Critique' }).nth(2).check()
  await carte.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Grilles d’audit enregistrées.')).toBeVisible()
  const ecrit = ecritures.filter((e) => e.table === 'app_config').at(-1)!
  expect((ecrit.corps as { key: string }).key).toBe('grilles_audit')
  const grilles = JSON.parse((ecrit.corps as { value: string }).value)
  expect(grilles.excellence.seuil).toBe(85)
  expect(grilles.excellence.themes[0].points.map((p: { libelle: string }) => p.libelle)).toEqual(['Façade, enseigne et vitres propres, enseigne éclairée', 'Vitrine conforme à l’opération commerciale en cours', 'Opération Beaujolais en vitrine'])
  expect(grilles.excellence.themes[0].points[2].critique).toBe(true)
  expect(grilles.hygiene.themes[0].points[0].libelle).toBe(FRIGOS)
})

test('remplir la grille pendant un audit, avec une photo', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Annecy%20Test')
  await page.getByRole('button', { name: 'Saisir', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  await d.getByLabel('Type').click()
  await page.getByRole('option', { name: 'Audit hygiène' }).click()
  const grille = d.getByRole('region', { name: 'Grille hygiène' })
  await expect(grille.getByText('Aucun point noté')).toBeVisible()
  await expect(d.getByLabel('Résultat de l’audit')).toBeVisible()
  // Tous les points conformes sauf un point critique
  for (const g of await grille.getByRole('group').all()) await g.getByRole('button', { name: 'Oui' }).click()
  await expect(grille.getByText('Score 100 %')).toBeVisible()
  await expect(grille.getByText('Conforme', { exact: true })).toBeVisible()
  await expect(d.getByLabel('Résultat de l’audit')).toBeHidden()
  await grille.getByRole('group', { name: FRIGOS }).getByRole('button', { name: 'Non' }).click()
  await grille.getByRole('group', { name: 'Sanitaires clients propres et approvisionnés' }).getByRole('button', { name: 'Sans objet' }).click()
  await expect(grille.getByText('Non conforme', { exact: true })).toBeVisible()
  await expect(grille.getByText('Point critique non conforme')).toBeVisible()
  await expect(grille.getByText(/Score 92,9 %/)).toBeVisible()
  await grille.getByLabel('Écart constaté').fill('Relevés arrêtés depuis 3 semaines')
  await d.getByTestId('photo-froid_1').setInputFiles(photo)
  await expect(grille.getByRole('img', { name: 'Photo 1' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await petitesZones(page, '[role="dialog"] section button')).toEqual([])
  await grille.getByRole('group', { name: FRIGOS }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `captures/${info.project.name}-audit-grille.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()

  const envoi = ecritures.find((e) => e.table === 'storage' && e.methode === 'POST')!
  expect(envoi.filtre).toMatch(/^photos\/audits\/\d{4}-\d{2}\/.+\.jpg$/)
  const audits = JSON.parse((ecritures.filter((e) => e.table === 'app_config').at(-1)!.corps as { value: string }).value)
  const a = audits['Annecy Test'][0]
  expect(a).toEqual(expect.objectContaining({ type: 'hygiene', conforme: false, score: 92.9 }))
  expect(a.reponses.froid_1).toEqual(expect.objectContaining({ etat: 'non', critique: true, libelle: FRIGOS, commentaire: 'Relevés arrêtés depuis 3 semaines' }))
  expect(a.reponses.froid_1.photos).toHaveLength(1)
  expect(a.reponses.froid_1.photos[0].taille).toBeGreaterThan(0)
  expect(a.reponses.locaux_2.etat).toBe('na')
})

test('la fiche magasin montre les écarts du dernier audit et leurs photos', async ({ page, isMobile }, info) => {
  await seConnecter(page, { config: { audits: auditRempli } })
  await page.goto('./#/magasins/Nantes%20Test')
  await expect(page.getByText('Non conforme · 50 % · 10 mars 2026')).toBeVisible()
  await expect(page.getByText(FRIGOS)).toBeVisible()
  await expect(page.getByText('Relevés arrêtés depuis le 2 septembre')).toBeVisible()
  await expect(page.getByText(PERIMES)).toHaveCount(0)
  const img = page.getByRole('img', { name: 'Photo 1' })
  await expect(img).toBeVisible()
  await img.scrollIntoViewIfNeeded()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-ecarts-audit.png`, fullPage: !isMobile })
  // Espace photos dans Paramètres
  await page.goto('./#/parametres/reglages')
  await expect(page.getByText('1 photo · 234 Ko sur 1 Go')).toBeVisible()
})

test('retirer une photo d’un audit l’efface de l’espace photos', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, config: { audits: auditRempli } })
  await page.goto('./#/magasins/Nantes%20Test')
  await page.getByRole('button', { name: /Modifier la visite du 10 mars/ }).first().click()
  const d = page.getByRole('dialog', { name: 'Modifier la visite de Nantes Test' })
  const grille = d.getByRole('region', { name: 'Grille hygiène' })
  await expect(grille.getByRole('group', { name: FRIGOS }).getByRole('button', { name: 'Non' })).toHaveAttribute('aria-pressed', 'true')
  await grille.getByRole('button', { name: 'Retirer la photo 1' }).click()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const suppression = ecritures.find((e) => e.table === 'storage' && e.methode === 'DELETE')!
  expect(suppression.corps).toEqual({ prefixes: ['audits/2026-09/a.jpg'] })
})

test('sans espace photos activé, un message clair', async ({ page }) => {
  await seConnecter(page, { sansPhotos: true })
  await page.goto('./#/magasins/Annecy%20Test')
  await page.getByRole('button', { name: 'Saisir', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  await d.getByLabel('Type').click()
  await page.getByRole('option', { name: 'Audit hygiène' }).click()
  await d.getByTestId('photo-froid_1').setInputFiles(photo)
  await expect(d.getByText('L’espace photos n’est pas encore activé : le script SQL des photos doit être lancé dans Supabase.')).toBeVisible()
})
