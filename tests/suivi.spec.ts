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

test('la fiche magasin montre l’évolution de la santé et le journal du magasin', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByText(/En recul depuis le 1 oct\. 2026 · avant : Cœur de réseau/)).toBeVisible()
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
  await page.goto('./#/magasins/Lyon%20Test')
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

test('l’accueil liste les visites en retard et les changements de case', async ({ page }) => {
  await seConnecter(page)
  const retard = page.getByRole('region', { name: 'Visites en retard' })
  await expect(retard.getByRole('link', { name: 'Nantes Test' })).toBeVisible()
  await expect(retard.getByRole('link', { name: 'Lyon Test' })).toHaveCount(0)
  const cases = page.getByRole('region', { name: 'Changements de case' })
  await expect(cases.getByText('Cœur de réseau vers Redressement urgent')).toBeVisible()
  await expect(cases.getByText('En recul')).toBeVisible()
})

test('noter un magasin garde l’historique daté', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('button', { name: 'Modifier', exact: true }).first().click()
  const d = page.getByRole('dialog', { name: 'Modifier Lyon Test' })
  await d.getByRole('button', { name: /^Fort : Niveau du franchisé/ }).click()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const sante = ecritures.filter((e) => e.table === 'app_config' && JSON.stringify(e.corps).includes('historique')).at(-1)!
  const valeur = JSON.parse((sante.corps as { value: string }).value)
  expect(valeur['Lyon Test'].historique.map((p: { caseId: string }) => p.caseId)).toEqual(['coeur', 'redressement', 'diagnostic'])
})

test('Magasins s’ouvre sur la carte', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins')
  await expect(page.getByRole('tab', { name: 'Carte', selected: true })).toBeVisible()
})

test('l’icône de l’app est le logo V and B', async ({ page, request }) => {
  await page.goto('./')
  await expect(page.locator('link[rel=icon]')).toHaveAttribute('href', './favicon.png')
  await expect(page.locator('link[rel=manifest]')).toHaveAttribute('href', './manifest.webmanifest')
  for (const f of ['favicon.png', 'apple-touch-icon.png', 'icone-192.png', 'icone-512.png']) expect((await request.get(`./${f}`)).ok()).toBe(true)
  const manifeste = await (await request.get('./manifest.webmanifest')).json()
  expect(manifeste.icons).toHaveLength(2)
})
