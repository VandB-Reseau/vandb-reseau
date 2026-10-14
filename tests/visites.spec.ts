import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('le rythme de visite suit la nine box et signale les retards', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/visites')
  await expect(page.getByRole('tab', { name: 'Rythme de visite', selected: true })).toBeVisible()
  // Lyon (redressement, 8 visites par an) vu le 2 octobre : à jour ; Nantes (cœur de réseau, 3 par an) vu en mars : en retard
  const lyon = isMobile ? page.locator('.MuiCard-root', { hasText: 'Lyon Test' }) : page.getByRole('row', { name: /Lyon Test/ })
  const nantes = isMobile ? page.locator('.MuiCard-root', { hasText: 'Nantes Test' }) : page.getByRole('row', { name: /Nantes Test/ })
  await expect(lyon.getByText(/1 sur 8/)).toBeVisible()
  await expect(lyon.getByText(/avant le 17 nov/)).toBeVisible()
  await expect(nantes.getByText(/j de retard/)).toBeVisible()
  // Filtres : seulement les magasins en retard, puis une case de la nine box
  if (isMobile) await page.getByRole('button', { name: 'Filtres' }).click()
  await page.getByRole('button', { name: 'Filtre État' }).click()
  await page.getByRole('menuitem', { name: /En retard/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('link', { name: 'Lyon Test' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Nantes Test' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-visites-rythme.png`, fullPage: !isMobile })
  await page.getByRole('button', { name: 'Filtre Nine box' }).click()
  await page.getByRole('menuitem', { name: /Locomotive/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('link', { name: 'Nantes Test' })).toHaveCount(0)
})

test('saisir une tournée crée une visite par magasin', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/visites')
  await page.getByRole('button', { name: 'Saisir une visite pour Nantes Test' }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  await d.getByLabel('Magasins visités').fill('Rennes')
  await page.getByRole('option', { name: 'Rennes Test' }).click()
  await page.keyboard.press('Escape')
  await d.getByLabel('Type').click()
  await page.getByRole('option', { name: 'Audit excellence' }).click()
  await d.getByLabel('Notes de visite', { exact: true }).fill('Bonne tenue générale.')
  await d.getByText('Visite contractuelle, à faire signer').click()
  await d.getByRole('button', { name: 'Ajouter un document' }).click()
  await d.getByLabel('Intitulé').fill('Grille')
  await d.getByLabel('Lien', { exact: true }).fill('https://exemple.test/grille')
  await page.screenshot({ path: `captures/${info.project.name}-saisir-visite.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('2 visites enregistrées.')).toBeVisible()
  const ecrite = ecritures.find((e) => e.table === 'visits' && e.methode === 'POST')!
  const lignes = ecrite.corps as Record<string, unknown>[]
  expect(lignes.map((l) => l.store)).toEqual(['Nantes Test', 'Rennes Test'])
  expect(lignes[0]).toMatchObject({ type: 'excellence', visitor: 'Inès EXEMPLE', signed_required: true, notes: 'Bonne tenue générale.', docs: [{ label: 'Grille', url: 'https://exemple.test/grille' }] })
  expect(lignes[0].group_id).toBeTruthy()
  expect(lignes[0].group_id).toBe(lignes[1].group_id)
})

test('l’historique se filtre et ouvre le compte rendu à imprimer', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/visites?vue=historique')
  await expect(page.getByText('2 visites', { exact: true })).toBeVisible()
  if (isMobile) await page.getByRole('button', { name: 'Filtres' }).click()
  await page.getByRole('button', { name: 'Filtre Type' }).click()
  await page.getByRole('menuitem', { name: 'Audit hygiène' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByText('1 visite', { exact: true })).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-visites-historique.png`, fullPage: !isMobile })
  await page.getByRole('link', { name: /Compte rendu de Nantes Test/ }).click()
  await expect(page.getByRole('heading', { name: 'Nantes Test', level: 1 })).toBeVisible()
  await expect(page.getByText('Audit conforme.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Télécharger en PDF' })).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-compte-rendu.png`, fullPage: true })
  // En impression, menus et boutons disparaissent
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('button', { name: 'Télécharger en PDF' })).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeHidden()
})

test('modifier puis supprimer une visite depuis la fiche magasin', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByText(/^1 visite sur 8 en FY27 · prochaine avant le/)).toBeVisible()
  await page.getByRole('button', { name: /Modifier la visite du/ }).click()
  const d = page.getByRole('dialog', { name: 'Modifier la visite de Lyon Test' })
  await d.getByLabel('Lien du compte rendu signé (Drive)').fill('https://exemple.test/cr')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Visite mise à jour.')).toBeVisible()
  expect(ecritures.at(-1)).toMatchObject({ methode: 'PATCH', table: 'visits', filtre: '?id=eq.1', corps: { signed_url: 'https://exemple.test/cr', store: 'Lyon Test' } })
  await page.getByRole('button', { name: /Modifier la visite du/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await page.getByRole('alert').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByText('Visite supprimée.')).toBeVisible()
  expect(ecritures.at(-1)).toMatchObject({ methode: 'DELETE', table: 'visits', filtre: '?id=eq.1' })
})

test('l’agenda montre ouvertures, événements et absences avec remplaçant suggéré', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/plus/agenda?mois=2026-10')
  await expect(page.getByText('Séminaire des Coachs').first()).toBeVisible()
  await expect(page.getByText('Hugo FICTIF absent').first()).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-agenda.png`, fullPage: !isMobile })
  // Filtrer les catégories
  await page.getByRole('button', { name: 'Événements' }).click()
  await expect(page.getByText('Séminaire des Coachs')).toHaveCount(0)
  // Ouvertures du mois suivant
  await page.getByRole('button', { name: 'Mois suivant' }).click()
  await expect(page.getByText('Ouverture Dax Test').first()).toBeVisible()
  // Ajouter une absence
  await page.getByRole('button', { name: 'Absence', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une absence' })
  await d.getByLabel('Personne').click()
  await page.getByRole('option', { name: 'Camille TESTARD' }).click()
  await expect(d.getByText('Remplaçant suggéré')).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Absence enregistrée.')).toBeVisible()
  expect(ecritures.at(-1)).toMatchObject({ methode: 'POST', table: 'leaves', corps: { person: 'Camille TESTARD', role: 'cs' } })
  expect(await textesTropPetits(page)).toEqual([])
})
