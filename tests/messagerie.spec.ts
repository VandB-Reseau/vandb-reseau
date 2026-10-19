import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture, type MessageSimule, type OptionsSimulation } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

// Annecy Test : Coach Hugo FICTIF, Responsable Régional Alex NORD, franchisé Paul MULTI (aussi à Rennes Test, Coach Noé MODELE)
const AUTRE = '00000000-0000-0000-0000-0000000000aa'
const ilYa = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const msg = (id: number, store: string, auteur_nom: string, auteur_role: string, texte: string, mentions: string[] = [], minutes = 30): MessageSimule =>
  ({ id, store, auteur: AUTRE, auteur_nom, auteur_role, texte, mentions, cree_le: ilYa(minutes) })

const PAUL = { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] }
const HUGO = { role: 'coach', coach: 'Hugo FICTIF' }
const ALEX = { role: 'rr', rr: 'rr1' }

async function ouvrirCloche(page: Page) {
  await page.getByRole('button', { name: /^Notifications/ }).click()
  return page.getByRole('menu', { name: 'Notifications' })
}

test('le Directeur de réseau écrit sur un magasin et mentionne le franchisé', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  const options: OptionsSimulation = { ecritures, messagerie: { messages: [msg(1, 'Annecy Test', 'Hugo FICTIF', 'coach', 'Inventaire fait ce matin.', [], 120)] } }
  await seConnecter(page, options)
  await page.goto('./#/magasins/Annecy%20Test?vue=messages')
  const onglets = page.getByRole('tablist', { name: 'Rubriques de Annecy Test' })
  await expect(onglets.getByRole('tab', { name: 'Messages' })).toHaveAttribute('aria-selected', 'true')
  const fil = page.getByRole('list', { name: 'Messages de Annecy Test' })
  await expect(fil.getByRole('listitem', { name: 'Message de Hugo FICTIF' })).toContainText('Inventaire fait ce matin.')
  await expect(fil).toContainText('Coach')
  // Un message d'un autre, jamais lu : marqué lu à l'ouverture
  await expect.poll(() => ecritures.some((e) => e.table === 'rpc/marquer_lu' && (e.corps as { p_store: string }).p_store === 'Annecy Test')).toBe(true)

  // Mention : « @ » propose les personnes du magasin
  const champ = page.getByLabel('Message', { exact: true })
  await champ.fill('Bonjour @pau')
  const suggestions = page.getByRole('list', { name: 'Personnes à mentionner' })
  await expect(suggestions.getByRole('button')).toHaveCount(1)
  await suggestions.getByRole('button', { name: /Paul MULTI/ }).click()
  await expect(champ).toHaveValue('Bonjour @Paul MULTI ')
  await champ.pressSequentially('peux-tu envoyer le stock ?')
  await page.getByRole('button', { name: 'Mentionner quelqu’un' }).click()
  await expect(suggestions.getByRole('button')).toHaveText([/Hugo FICTIF/, /Alex NORD/, /Dominique DIRECTION/, /Paul MULTI/])
  await page.keyboard.type('Hugo')
  await suggestions.getByRole('button', { name: /Hugo FICTIF/ }).click()
  await page.getByRole('button', { name: 'Envoyer' }).click()
  await expect(champ).toHaveValue('')
  const envoi = ecritures.find((e) => e.table === 'rpc/envoyer_message')!.corps as { p_store: string; p_texte: string; p_mentions: string[] }
  expect(envoi).toEqual({ p_store: 'Annecy Test', p_texte: 'Bonjour @Paul MULTI peux-tu envoyer le stock ? @Hugo FICTIF', p_mentions: ['coach:Hugo FICTIF', 'franchise:Paul MULTI'] })
  const mien = fil.getByRole('listitem', { name: 'Message de Dominique DIRECTION' })
  await expect(mien).toContainText('Moi')
  await expect(mien.locator('strong')).toHaveText(['@Paul MULTI', '@Hugo FICTIF'])
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-messagerie-fil.png`, fullPage: true })

  // Son propre message se retire
  await mien.getByRole('button', { name: /^Supprimer mon message/ }).click()
  await expect(page.getByText('Message supprimé.')).toBeVisible()
  await expect(mien).toHaveCount(0)
})

test('le Coach est notifié des messages de ses magasins, pas des autres', async ({ page }, info) => {
  await seConnecter(page, {
    appMetadata: HUGO,
    messagerie: { messages: [
      msg(1, 'Annecy Test', 'Paul MULTI', 'franchise', 'La livraison est arrivée cassée.', [], 10),
      msg(2, 'Rennes Test', 'Paul MULTI', 'franchise', 'Question sur Rennes.', [], 5),
    ] },
  })
  const cloche = page.getByRole('button', { name: /^Notifications/ })
  await expect(cloche).toHaveAccessibleName('Notifications : 1 nouveauté')
  const menu = await ouvrirCloche(page)
  await expect(menu.getByRole('button')).toHaveCount(2) // la nouveauté et « Tout marquer comme lu »
  await expect(menu).toContainText('Annecy Test')
  await expect(menu).toContainText('Nouveau message')
  await expect(menu).toContainText('Paul MULTI : La livraison est arrivée cassée.')
  await expect(menu).not.toContainText('Rennes Test')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-messagerie-notifications.png` })
  await menu.getByRole('button', { name: /Annecy Test/ }).click()
  await expect(page).toHaveURL(/#\/magasins\/Annecy%20Test\?vue=messages$/)
  await expect(page.getByRole('list', { name: 'Messages de Annecy Test' })).toContainText('La livraison est arrivée cassée.')
  await expect(cloche).toHaveAccessibleName('Notifications')
})

test('un Responsable Régional n’est notifié que lorsqu’on le mentionne', async ({ page }) => {
  await seConnecter(page, {
    appMetadata: ALEX,
    messagerie: { messages: [
      msg(1, 'Annecy Test', 'Paul MULTI', 'franchise', 'Sans mention.', [], 10),
      msg(2, 'Lyon Test', 'Camille TESTARD', 'coach', '@Alex NORD peux-tu valider le devis ?', ['rr:rr1'], 5),
    ] },
  })
  const menu = await ouvrirCloche(page)
  await expect(menu).toContainText('Lyon Test')
  await expect(menu).toContainText('On te mentionne')
  await expect(menu).not.toContainText('Annecy Test')
  await menu.getByRole('button', { name: 'Tout marquer comme lu' }).click()
  await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveAccessibleName('Notifications')
})

test('le franchisé est notifié des messages et des nouveaux comptes rendus, et répond au Coach', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, {
    acces: PAUL, ecritures,
    messagerie: { reference: ilYa(60 * 24 * 30), messages: [msg(1, 'Annecy Test', 'Hugo FICTIF', 'coach', 'Pense au plan de Noël.', [], 15)] },
    espace: { visites: [{ id: 60, store: 'Rennes Test', visit_date: '2026-10-01', type: 'terrain', visitor: 'Noé MODELE', signed_required: false, docs: [], created_at: ilYa(60) },
      { id: 61, store: 'Rennes Test', visit_date: '2026-01-01', type: 'terrain', visitor: 'Noé MODELE', signed_required: false, docs: [], created_at: ilYa(60 * 24 * 90) }] },
  })
  const cloche = page.getByRole('button', { name: /^Notifications/ })
  await expect(cloche).toHaveAccessibleName('Notifications : 2 nouveautés')
  const menu = await ouvrirCloche(page)
  await expect(menu).toContainText('Nouveau message')
  await expect(menu).toContainText('Nouveau compte rendu de visite')
  await menu.getByRole('button', { name: /Rennes Test/ }).click()
  await expect(page).toHaveURL(/#\/magasins\/Rennes%20Test\?vue=visites$/)
  await expect.poll(() => ecritures.some((e) => e.table === 'rpc/marquer_lu' && (e.corps as { p_sujet: string }).p_sujet === 'visites')).toBe(true)
  await expect(cloche).toHaveAccessibleName('Notifications : 1 nouveauté')

  // Fil d'Annecy : onglet Messages avec sa pastille
  await page.goto('./#/magasins/Annecy%20Test')
  const onglets = page.getByRole('tablist', { name: 'Rubriques de Annecy Test' })
  await expect(onglets.getByRole('tab')).toHaveText(['Fiche', 'Messages1', 'Chiffres', 'Visites', 'Campagnes'])
  await onglets.getByRole('tab', { name: 'Messages' }).click()
  await expect(page.getByText('Nouveaux messages')).toBeVisible()
  await page.getByRole('button', { name: 'Mentionner quelqu’un' }).click()
  const suggestions = page.getByRole('list', { name: 'Personnes à mentionner' })
  await expect(suggestions.getByRole('button')).toHaveText([/Hugo FICTIF/, /Alex NORD/, /Dominique DIRECTION/, /Paul MULTI/])
  await suggestions.getByRole('button', { name: /Alex NORD/ }).click()
  await page.getByLabel('Message', { exact: true }).pressSequentially('c’est noté, merci.')
  await page.getByRole('button', { name: 'Envoyer' }).click()
  await expect(page.getByRole('list', { name: 'Messages de Annecy Test' }).getByRole('listitem', { name: 'Message de Paul MULTI' })).toContainText('@Alex NORD c’est noté, merci.')
  expect(ecritures.find((e) => e.table === 'rpc/envoyer_message')!.corps).toEqual({ p_store: 'Annecy Test', p_texte: '@Alex NORD c’est noté, merci.', p_mentions: ['rr:rr1'] })
  await expect(cloche).toHaveAccessibleName('Notifications')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-messagerie-franchise.png`, fullPage: true })
})

test('aperçu de l’espace d’un franchisé : fil en lecture seule, sans cloche', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, messagerie: { messages: [msg(1, 'Annecy Test', 'Paul MULTI', 'franchise', 'Bonjour à tous.', [], 15)] } })
  await page.evaluate(() => sessionStorage.setItem('apercu-franchise', JSON.stringify({ franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] })))
  await page.reload()
  await expect(page.getByRole('region', { name: 'Aperçu' })).toBeVisible()
  await page.goto('./#/magasins/Annecy%20Test?vue=messages')
  await expect(page.getByRole('list', { name: 'Messages de Annecy Test' })).toContainText('Bonjour à tous.')
  await expect(page.getByLabel('Message', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveCount(0)
  expect(ecritures.filter((e) => e.table === 'rpc/marquer_lu')).toEqual([])
})

test('messagerie pas encore activée : pas de cloche, un état clair dans la fiche', async ({ page }) => {
  await seConnecter(page, { messagerie: null })
  await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveCount(0)
  await page.goto('./#/magasins/Annecy%20Test?vue=messages')
  await expect(page.getByText('Messagerie pas encore activée')).toBeVisible()
})
