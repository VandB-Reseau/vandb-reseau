import { expect, test } from '@playwright/test'
import { ouvrirOnglet, seConnecter, textesTropPetits, type Ecriture, actionFiche } from './supabase-simule'

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
  const journal = page.getByRole('list', { name: 'Journal de Lyon Test' })
  await expect(journal.getByText('Passe en Redressement urgent')).toBeVisible()
  await expect(journal.getByText('Classé Cœur de réseau')).toBeVisible()
  await expect(journal.getByText('Concept 2.0 : Fait')).toBeVisible()
  await expect(journal.getByText('Coach : Noé MODELE')).toBeVisible()
  await expect(journal.getByText('Appel du franchisé : travaux de vitrine prévus.')).toBeVisible()
  await expect(journal.getByText(/^Visite terrain · Noé MODELE/)).toBeVisible()
  // Le plus récent en premier
  await expect(journal.getByRole('listitem').first()).toContainText('Visite terrain')
  expect(await textesTropPetits(page)).toEqual([])
  await page.getByRole('heading', { name: 'Journal', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `captures/${info.project.name}-fiche-journal.png`, fullPage: !isMobile })
  // Filtrer le journal
  await page.getByRole('button', { name: 'Filtre Afficher' }).click()
  await page.getByRole('menuitem', { name: /^Santé/ }).click()
  await page.keyboard.press('Escape')
  await expect(journal.getByText('Concept 2.0 : Fait')).toHaveCount(0)
  await expect(journal.getByText('Passe en Redressement urgent')).toBeVisible()
})

test('ajouter, modifier et supprimer une note du journal', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Lyon%20Test?vue=journal')
  await page.getByRole('button', { name: 'Note', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Nouvelle note' })
  await d.getByLabel('Note').fill('Franchisé motivé par la terrasse.')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Note enregistrée.')).toBeVisible()
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

test('l’accueil signale les magasins pas vus depuis longtemps et les changements de case', async ({ page }) => {
  await seConnecter(page)
  const aTraiter = page.getByRole('region', { name: 'À traiter' })
  await aTraiter.getByRole('button', { name: /^Voir les \d+$/ }).click()
  await expect(aTraiter).not.toContainText('retard de visite')
  const aVoir = aTraiter.getByRole('link').filter({ hasText: /pas vu depuis|jamais visité/ })
  // Nantes (Cœur de réseau, vu en mars) dépasse son délai de 150 jours ; Agen n'a eu qu'un appel ; Lyon vient d'être vu
  await expect(aVoir.filter({ hasText: 'Nantes Test' })).toContainText(/Cœur de réseau · pas vu depuis \d+ j/)
  await expect(aVoir.filter({ hasText: 'Agen Test' })).toContainText('jamais visité · appel le 1 oct.')
  await expect(aVoir.filter({ hasText: 'Lyon Test' })).toHaveCount(0)
  const recul = aTraiter.getByRole('link').filter({ hasText: 'Cœur de réseau vers Redressement urgent' })
  await expect(recul).toBeVisible()
  await expect(recul).toContainText('Recule')
})

test('noter un magasin garde l’historique daté', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Lyon%20Test')
  await actionFiche(page, 'Modifier la fiche')
  const d = page.getByRole('dialog', { name: 'Modifier Lyon Test' })
  await d.getByRole('button', { name: /^Fort : Gestion/ }).click()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const sante = ecritures.filter((e) => e.table === 'app_config' && JSON.stringify(e.corps).includes('historique')).at(-1)!
  const valeur = JSON.parse((sante.corps as { value: string }).value)
  expect(valeur['Lyon Test'].historique.map((p: { caseId: string }) => p.caseId)).toEqual(['coeur', 'redressement', 'diagnostic'])
})

test('Magasins s’ouvre sur la liste', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins')
  await expect(page.getByRole('tab', { name: 'Liste', selected: true })).toBeVisible()
})

test('l’icône de l’app est le logo V and B', async ({ page, request }) => {
  await page.goto('./')
  await expect(page.locator('link[rel=icon]')).toHaveAttribute('href', './favicon.png')
  await expect(page.locator('link[rel=manifest]')).toHaveAttribute('href', './manifest.webmanifest')
  for (const f of ['favicon.png', 'apple-touch-icon.png', 'icone-192.png', 'icone-512.png']) expect((await request.get(`./${f}`)).ok()).toBe(true)
  const manifeste = await (await request.get('./manifest.webmanifest')).json()
  expect(manifeste.icons).toHaveLength(2)
})
