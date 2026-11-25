import { expect, test } from '@playwright/test'
import { toutATraiter, deplierGroupes, ouvrirOnglet, seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('la fiche magasin montre l’évolution de la santé et le journal du magasin', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test?vue=sante')
  await expect(page.getByText(/En recul depuis le 1 oct\. 2026 · avant : Cœur de réseau/)).toBeVisible()
  await ouvrirOnglet(page, 'Journal')
  // Le journal (santé, déploiements, Coachs, notes) dans son onglet ; les visites restent dans le leur
  const journal = page.getByRole('region', { name: 'Historique' })
  await expect(journal.getByText('Passe en Redressement urgent')).toBeVisible()
  await expect(journal.getByText('Classé Cœur de réseau')).toBeVisible()
  await expect(journal.getByText('Concept 2.0 : Fait')).toBeVisible()
  await expect(journal.getByText('Coach : Noé MODELE')).toBeVisible()
  await expect(journal.getByText('Appel du franchisé : travaux de vitrine prévus.')).toBeVisible()
  await expect(journal.getByText(/visite terrain/)).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Journal de Lyon Test' })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-journal.png`, fullPage: !isMobile })
})

test('ajouter, modifier et supprimer une note du journal', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Lyon%20Test?vue=journal')
  // 25/11/2026 : le « + » de la fiche mène au carnet, la note s'y écrit
  await page.getByRole('main').getByRole('button', { name: 'Ajouter', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Note au carnet' }).click()
  const barre = page.getByRole('region', { name: 'Nouvelle note' })
  await barre.getByRole('textbox', { name: 'Note sur Lyon Test' }).fill('Franchisé motivé par la terrasse.')
  await barre.getByRole('button', { name: 'Noter' }).click()
  await expect(page.getByText('Note enregistrée.')).toBeVisible()
  await page.goto('./#/magasins/Lyon%20Test?vue=journal')
  const ajout = ecritures.filter((e) => e.table === 'app_config').at(-1)!
  expect(JSON.stringify(ajout.corps)).toContain('Franchisé motivé par la terrasse.')
  expect(JSON.stringify(ajout.corps)).toContain('travaux de vitrine')
  await page.getByRole('button', { name: /Modifier la note du 15 sept\. 2026/ }).click()
  const m = page.getByRole('dialog', { name: 'Modifier la note' })
  await m.getByRole('button', { name: 'Supprimer' }).click()
  await page.getByRole('alert').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByText('Note supprimée.')).toBeVisible()
  const suppression = ecritures.filter((e) => e.table === 'app_config').at(-1)!
  expect(JSON.stringify(suppression.corps)).not.toContain('travaux de vitrine')
})

// 434 et 436 (25/11/2026) : le Coach voit chaque magasin pas vu ; le Directeur, une ligne par Coach. Les changements de
// case (santé du parc) ne remontent plus à l'accueil
test('l’accueil signale les magasins pas vus depuis longtemps', async ({ page }) => {
  await seConnecter(page)
  const aTraiter = page.getByRole('region', { name: 'À traiter' })
  await toutATraiter(page)
  const parCoach = aTraiter.getByRole('region', { name: 'Magasins à visiter' }).getByRole('link')
  await expect(parCoach.filter({ hasText: 'Hugo FICTIF' })).toContainText('Agen Test')
  await expect(parCoach.filter({ hasText: 'Inès EXEMPLE' })).toContainText('Nantes Test')
  await expect(aTraiter).not.toContainText('Cœur de réseau vers Redressement urgent')

  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Inès EXEMPLE' } })
  await toutATraiter(page)
  const aVoir = aTraiter.getByRole('link').filter({ hasText: /pas vu depuis|jamais visité/ })
  // Nantes (Cœur de réseau, vu en mars) dépasse son délai de 150 jours ; Lyon (autre Coach) n'apparaît pas
  await expect(aVoir.filter({ hasText: 'Nantes Test' })).toContainText(/Cœur de réseau · pas vu depuis \d+ j/)
  await expect(aVoir.filter({ hasText: 'Lyon Test' })).toHaveCount(0)
})

test('noter un magasin garde l’historique daté', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/plus/sante?vue=evaluer&magasin=Lyon%20Test')
  await page.getByRole('dialog', { name: 'Lyon Test' }).getByRole('button', { name: /^Fort : Gestion/ }).click()
  await expect.poll(() => ecritures.filter((e) => e.table === 'app_config' && JSON.stringify(e.corps).includes('historique')).length).toBeGreaterThan(0)
  const sante = ecritures.filter((e) => e.table === 'app_config' && JSON.stringify(e.corps).includes('historique')).at(-1)!
  const valeur = JSON.parse((sante.corps as { value: string }).value)
  expect(valeur['Lyon Test'].historique.map((p: { caseId: string }) => p.caseId)).toEqual(['coeur', 'redressement', 'diagnostic'])
})

test('Magasins s’ouvre sur la liste', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins')
  await expect(page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Liste' })).toHaveAttribute('aria-pressed', 'true')
})

test('l’icône de l’app est le logo V and B', async ({ page, request }) => {
  await page.goto('./')
  await expect(page.locator('link[rel=icon]')).toHaveAttribute('href', './favicon.png')
  await expect(page.locator('link[rel=manifest]')).toHaveAttribute('href', './manifest.webmanifest')
  for (const f of ['favicon.png', 'apple-touch-icon.png', 'icone-192.png', 'icone-512.png']) expect((await request.get(`./${f}`)).ok()).toBe(true)
  const manifeste = await (await request.get('./manifest.webmanifest')).json()
  expect(manifeste.icons).toHaveLength(2)
})
