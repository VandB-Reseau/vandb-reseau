import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture, deplierATraiter } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

type Libre = { id: string; action: string; porteur: string; echeance: string; creeLe: string; faite?: string }
const derniere = (ecritures: Ecriture[]): Record<string, Libre[]> | undefined => {
  const e = ecritures.filter((x) => x.table === 'app_config' && ((x.corps as { key?: string }).key === 'actions' || x.filtre.includes('key=eq.actions'))).at(-1)
  return e ? JSON.parse((e.corps as { value: string }).value) : undefined
}

test('ajouter une action hors visite, la cocher faite, puis la modifier et la supprimer', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, persister: true })
  await page.goto('./#/magasins/Brest%20Test?vue=actions')
  await page.getByRole('button', { name: 'Ajouter une tâche' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une tâche' })
  await d.getByLabel('Tâche', { exact: true }).fill('Relancer la commande de coffrets')
  await d.getByLabel('Porteur').click()
  // Porteurs du magasin : franchisé, Coach, Responsable Régional, Directeur de réseau
  await expect(page.getByRole('option')).toContainText(['Franchisé 11', 'Noé MODELE', 'Dominique DIRECTION'])
  await page.getByRole('option', { name: 'Franchisé 11' }).click()
  await d.getByLabel('Échéance', { exact: true }).fill('2099-02-15')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-action-hors-visite.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Tâche ajoutée.')).toBeVisible()
  const ajoutee = derniere(ecritures)!['Brest Test']
  expect(ajoutee).toHaveLength(1)
  expect(ajoutee[0]).toMatchObject({ action: 'Relancer la commande de coffrets', porteur: 'Franchisé 11', echeance: '2099-02-15', creeLe: new Date().toISOString().slice(0, 10) })

  // Elle rejoint les actions des visites, avec sa date d'ajout
  const liste = page.getByRole('list', { name: 'Tâches en cours de Brest Test' })
  const ligne = liste.getByRole('listitem').filter({ hasText: 'Relancer la commande de coffrets' })
  await expect(ligne).toContainText('ajoutée le')
  await expect(ligne).toContainText('15 févr. 2099')
  await expect(liste.getByRole('listitem')).toHaveCount(3)
  await page.screenshot({ path: `captures/${info.project.name}-actions-hors-visite.png`, fullPage: !isMobile })

  // Validée sans visite
  await ligne.getByRole('checkbox', { name: 'Marquer faite : Relancer la commande de coffrets' }).click()
  await expect(page.getByText('Tâche marquée faite.')).toBeVisible()
  expect(derniere(ecritures)!['Brest Test'][0].faite).toBe(new Date().toISOString().slice(0, 10))
  await page.getByRole('button', { name: 'Tâches faites (2)' }).click()
  const faites = page.getByRole('list', { name: 'Tâches en cours de Brest Test : faites' })
  await faites.getByRole('checkbox', { name: 'Remettre en cours : Relancer la commande de coffrets' }).click()
  await expect(page.getByText('Tâche remise en cours.')).toBeVisible()
  expect(derniere(ecritures)!['Brest Test'][0].faite).toBeUndefined()

  // Modifiée puis supprimée
  await page.getByRole('button', { name: 'Modifier la tâche Relancer la commande de coffrets' }).click()
  const m = page.getByRole('dialog', { name: 'Modifier la tâche' })
  await m.getByLabel('Tâche', { exact: true }).fill('Relancer la commande de coffrets de Noël')
  await m.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Tâche mise à jour.')).toBeVisible()
  expect(derniere(ecritures)!['Brest Test'][0].action).toBe('Relancer la commande de coffrets de Noël')
  await page.getByRole('button', { name: 'Modifier la tâche Relancer la commande de coffrets de Noël' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await page.getByRole('alert').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByText('Tâche supprimée.')).toBeVisible()
  expect(derniere(ecritures)!['Brest Test']).toBeUndefined()
})

test('une action hors visite se coche faite pendant la visite suivante et apparaît à l’accueil', async ({ page }) => {
  const ecritures: Ecriture[] = []
  const actions = { 'Brest Test': [{ id: 'l1', action: 'Commander la nouvelle PLV', porteur: 'Noé MODELE', echeance: '2026-10-01', creeLe: '2026-09-25' }] }
  await seConnecter(page, { ecritures, config: { actions } })
  await page.goto('./#/')
  await deplierATraiter(page)
  await expect(page.getByRole('region', { name: 'À traiter' }).getByRole('link', { name: /^Commander la nouvelle PLV/ })).toBeVisible()
  await page.goto('./#/magasins/Brest%20Test?vue=visites')
  await page.getByRole('button', { name: 'Saisir', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  const enCours = d.getByRole('group', { name: 'Tâches en cours' })
  await expect(enCours).toContainText('Commander la nouvelle PLV')
  await expect(enCours).toContainText('depuis le 25 sept. 2026')
  await enCours.getByText('Commander la nouvelle PLV').click()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Visite enregistrée.')).toBeVisible()
  expect(derniere(ecritures)!['Brest Test'][0].faite).toBe(new Date().toISOString().slice(0, 10))
})

test('depuis la fiche Coach, une action s’ajoute sur l’un de ses magasins', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/equipe/coach/No%C3%A9%20MODELE?vue=actions')
  await page.getByRole('button', { name: 'Ajouter une tâche' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une tâche' })
  await expect(d.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await d.getByLabel('Magasin').click()
  await page.getByRole('option', { name: 'Brest Test' }).click()
  await d.getByLabel('Tâche', { exact: true }).fill('Préparer le bilan de fin d’année')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Tâche ajoutée.')).toBeVisible()
  expect(derniere(ecritures)!['Brest Test'][0]).toMatchObject({ action: 'Préparer le bilan de fin d’année', echeance: '' })
})

test('la ligne des titres d’un tableau reste visible au défilement', async ({ page, isMobile }) => {
  // Sur téléphone, plus aucun tableau : les listes sont en lignes (refonte visuelle)
  test.skip(isMobile, 'Aucun tableau sur téléphone : listes en lignes')
  await seConnecter(page)
  await page.goto('./#/plus/sante?vue=chiffres')
  await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Tableau' }).click()
  const table = page.getByRole('table', { name: 'Chiffres des magasins' })
  const tete = table.locator('thead')
  await expect(tete).toHaveCSS('position', 'sticky')
  const boite = table.locator('xpath=..')
  const haut = (await boite.boundingBox())!.y
  // Le tableau défile dans sa carte : la ligne des titres reste en haut
  expect(await boite.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true)
  await boite.evaluate((e) => { e.scrollTop = 400 })
  await expect.poll(async () => Math.round((await tete.boundingBox())!.y - haut)).toBeLessThanOrEqual(1)
  await expect(tete.getByRole('columnheader').first()).toBeInViewport()
})
