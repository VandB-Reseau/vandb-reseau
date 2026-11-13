import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type CommunicationSimulee, type Ecriture } from './supabase-simule'
import { zonesTropPetites } from './pilotage/supabase-simule'

// Refonte façon SaaS, vague 5 (Joseph, 10/11/2026, « tout d'un coup sauf 47 ») : l'actualité au cœur des accueils (43A,
// 44A), Actualités (45A), À la une et « J'ai pris connaissance » (46A), temps forts et dates clés des campagnes (48A),
// effet en caisse (49A), parcours d'intégration réglable (50A), menu à dix entrées (51A), grammaire sobre (52A),
// carte d'indicateur commune (53A), « Plus tard » dans À traiter (54A), carte Plan (55A), barre du franchisé (56A).

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

async function lisible(page: Page, isMobile: boolean, zones = true) {
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile && zones) expect(await zonesTropPetites(page)).toEqual([])
}

const PAUL = { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] }
const DIRECTION = '00000000-0000-0000-0000-0000000000dd'
const communications = (): CommunicationSimulee[] => [
  { id: 1, titre: 'Nouvelle charte des vitrines', texte: 'À mettre en place avant le 15 novembre.', magasins: null, auteur: DIRECTION, auteur_nom: 'Dominique DIRECTION', auteur_role: 'directeur',
    cree_le: '2026-10-19T09:00:00Z', a_la_une: '2026-11-15', connaissance: true, pris: [{ franchise: 'Franchisé 2', le: '2026-10-20T08:00:00Z' }], attendus: ['Franchisé 2', 'Paul MULTI', 'Franchisé 4'] },
  { id: 2, titre: 'Résultats du challenge de septembre', texte: 'Bravo aux trois magasins en tête.', magasins: null, auteur: DIRECTION, auteur_nom: 'Dominique DIRECTION', auteur_role: 'directeur', cree_le: '2026-10-25T09:00:00Z' },
]

test('43A et 46A : l’accueil de l’équipe met À la une en tête, le fil au centre, Aujourd’hui à côté', async ({ page, isMobile }) => {
  await seConnecter(page, { communications: communications() })
  await page.goto('./#/')
  const une = page.getByRole('article', { name: 'À la une : Nouvelle charte des vitrines' })
  await expect(une).toBeVisible()
  await expect(une.getByText('Pris connaissance : 1 sur 3')).toBeVisible()
  // Le fil ne répète pas la communication à la une
  const fil = page.getByRole('region', { name: 'Actualités' })
  await expect(fil.getByText('Résultats du challenge de septembre')).toBeVisible()
  await expect(fil.getByText('Nouvelle charte des vitrines')).toHaveCount(0)
  if (!isMobile) {
    const aujourdhui = page.getByRole('complementary', { name: 'Aujourd’hui' })
    await expect(aujourdhui.getByRole('region', { name: 'À traiter' })).toBeVisible()
  }
  // 52A : plus de cartouche en capitales sur l'accueil
  await expect(page.locator('.marque')).toHaveCount(0)
  await lisible(page, isMobile, false)
})

test('46A : au bout de 7 jours, la prise de connaissance qui manque arrive dans À traiter', async ({ page, isMobile }) => {
  await seConnecter(page, { communications: communications() })
  await page.goto('./#/')
  if (isMobile) await page.getByRole('button', { name: /^Voir les \d+$/ }).first().click()
  else await page.getByRole('region', { name: 'À traiter' }).getByRole('button', { name: /^Voir les \d+$/ }).click()
  await expect(page.getByText('2 franchisés sans prise de connaissance : Paul MULTI, Franchisé 4')).toBeVisible()
})

test('44A et 46A : le franchisé lit À la une, donne sa prise de connaissance, retrouve le fil au centre', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { acces: PAUL, ecritures, communications: communications() })
  await page.goto('./#/')
  const une = page.getByRole('article', { name: 'À la une : Nouvelle charte des vitrines' })
  await expect(une).toBeVisible()
  // Publiée il y a 8 jours, pas encore confirmée : rappel
  await expect(une.getByText('À relancer')).toBeVisible()
  await une.getByRole('button', { name: 'J’ai pris connaissance' }).click()
  await expect(une.getByText('Pris connaissance')).toBeVisible()
  expect(ecritures.some((e) => e.table === 'rpc/prendre_connaissance' && JSON.stringify(e.corps).includes('"p_id":1'))).toBe(true)
  await expect(page.getByRole('region', { name: 'Actualités' }).getByText('Résultats du challenge de septembre')).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Mon magasin' }).getByRole('region', { name: 'À faire' })).toBeVisible()
  await lisible(page, isMobile, false)
})

test('45A : Actualités réunit le fil, les communications, les bonnes pratiques et les sondages', async ({ page, isMobile }) => {
  await seConnecter(page, { communications: communications() })
  await page.goto('./#/infos')
  await expect(page.getByRole('heading', { level: 1, name: 'Actualités' })).toBeVisible()
  const onglets = page.getByRole('tablist', { name: 'Actualités' })
  await expect(onglets.getByRole('tab', { name: 'Fil' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'Fil du réseau' })).toBeVisible()
  await onglets.getByRole('tab', { name: 'Communications' }).click()
  await expect(page.getByRole('article', { name: 'Nouvelle charte des vitrines' }).getByText(/^Prise de connaissance :/)).toBeVisible()
  // L'ancienne adresse des communications ouvre l'onglet Communications
  await page.goto('./#/communications?c=2')
  await expect(onglets.getByRole('tab', { name: 'Communications' })).toHaveAttribute('aria-selected', 'true')
  await lisible(page, isMobile, false)
})

test('46A : le Directeur demande la prise de connaissance en publiant', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, communications: [] })
  await page.goto('./#/infos?vue=communications')
  await page.getByRole('button', { name: 'Publier' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Titre').fill('Rappel loi Évin : affichage en vitrine')
  await d.getByLabel('Message', { exact: true }).fill('Merci de vérifier l’affichage cette semaine.')
  await d.getByLabel('Demander « J’ai pris connaissance »').check()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toHaveCount(0)
  await expect.poll(() => ecritures.some((e) => e.table === 'rpc/demander_connaissance' && JSON.stringify(e.corps).includes('"p_oui":true'))).toBe(true)
  await lisible(page, isMobile, false)
})

test('48A : le Directeur règle les temps forts ; une campagne porte ses dates clés ; la frise montre les douze mois', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, persister: true, config: { temps_forts: [{ id: 'noel', nom: 'Noël', debut: '2026-12-01', fin: '2026-12-31', annonce: 45, detail: 'Coffrets et personnel' }] } })
  await page.goto('./#/parametres/reglages?rubrique=tempsforts')
  const champs = page.getByRole('textbox', { name: 'Temps fort', exact: true })
  await expect(champs.first()).toHaveValue('Noël')
  await page.getByRole('button', { name: 'Ajouter un temps fort' }).click()
  await champs.nth(1).fill('Beaujolais nouveau')
  await page.getByLabel('Début').nth(1).fill('2026-11-19')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect.poll(() => ecritures.some((e) => JSON.stringify(e.corps).includes('Beaujolais nouveau'))).toBe(true)
  // Une campagne rattachée à Noël, avec sa date limite de commande
  await page.goto('./#/campagnes?vue=campagnes')
  await page.getByRole('button', { name: 'Ajouter une campagne' }).first().click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Temps fort').click()
  await page.getByRole('option', { name: /^Noël/ }).click()
  await expect(d.getByLabel('Nom de la campagne')).toHaveValue('Noël')
  await d.getByLabel('Point 1', { exact: true }).fill('Coffrets en tête de gondole')
  await d.getByRole('button', { name: 'Ajouter une date clé' }).click()
  await d.getByLabel('Le', { exact: true }).fill('2026-11-10')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toHaveCount(0)
  expect(ecritures.some((e) => JSON.stringify(e.corps).includes('commande_debut') && JSON.stringify(e.corps).includes('"tempsFort\\":\\"noel'))).toBe(true)
  await expect(page.getByRole('region', { name: 'Dates clés' }).getByText('Commande à partir du')).toBeVisible()
  // 49A : l'effet en caisse attend le premier mois complet
  await expect(page.getByRole('region', { name: 'Effet en caisse' })).toBeVisible()
  await page.getByRole('button', { name: 'Retour aux campagnes' }).click()
  await expect(page.getByRole('region', { name: 'Les douze mois' })).toBeVisible()
  await lisible(page, isMobile, false)
})

test('50A et 55A : le parcours d’intégration se règle dans Paramètres et se coche dans la carte Plan', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, persister: true })
  await page.goto('./#/parametres/reglages?rubrique=parcours')
  await expect(page.getByLabel('Étape').first()).toHaveValue('Visite de la première semaine')
  // Arles Test a ouvert le 20/08/2026 : jour 68 de son intégration
  await page.goto('./#/magasins/Arles%20Test')
  // Vague 7 : la carte Plan est défaite, l'intégration a sa propre carte
  const plan = page.getByRole('main')
  await expect(plan.getByRole('heading', { name: /^Intégration · jour 68 · 0 sur 9$/ })).toBeVisible()
  await expect(plan.getByRole('region', { name: 'Prochaines étapes' })).toBeVisible()
  await plan.getByRole('checkbox', { name: 'Visite du premier mois faite' }).click()
  await expect.poll(() => ecritures.some((e) => e.table === 'suivi_magasins' && JSON.stringify(e.corps).includes('v30'))).toBe(true)
  await expect(plan.getByRole('heading', { name: /^Intégration · jour 68 · 1 sur 9$/ })).toBeVisible()
  await lisible(page, isMobile, false)
})

test('51A : dix entrées dans le menu, Équipe et Paramètres au menu du compte, Chiffres réunit Budgets', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Menu latéral : PC')
  await seConnecter(page)
  await page.goto('./#/')
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(nav.getByRole('button')).toHaveText(['Accueil', 'Tâches', 'Messages', 'Agenda', 'Magasins', 'Visites', 'Chiffres', 'Budget prévisionnel', 'Actualités', 'Campagnes', 'Demandes'].map((t) => new RegExp(`^${t}`)))
  await page.getByRole('button', { name: 'Mon compte' }).click()
  await page.getByRole('menuitem', { name: 'Paramètres' }).click()
  await expect(page).toHaveURL(/#\/parametres\/reglages/)
  await page.goto('./#/performance')
  await expect(page.getByRole('heading', { level: 1, name: 'Chiffres' })).toBeVisible()
  // Joseph (10/11/2026) : les budgets ont quitté Chiffres pour leur entrée « Budget prévisionnel »
  await nav.getByRole('button', { name: /^Budget prévisionnel/ }).click()
  await expect(page).toHaveURL(/#\/budgets/)
  await expect(nav.getByRole('button', { name: /^Budget prévisionnel/ })).toHaveAttribute('aria-current', 'page')
  // La santé du parc est une vue des Magasins
  await page.goto('./#/magasins')
  await page.getByRole('button', { name: 'Santé du parc' }).click()
  await expect(page).toHaveURL(/#\/plus\/sante/)
  await expect(nav.getByRole('button', { name: /^Magasins/ })).toHaveAttribute('aria-current', 'page')
})

test('54A : « Plus tard » met une ligne de À traiter de côté, « Tout revoir » la remet', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Colonne Aujourd’hui : PC')
  await seConnecter(page)
  await page.goto('./#/')
  const bloc = page.getByRole('region', { name: 'À traiter' })
  const bouton = bloc.getByRole('button', { name: /^Plus tard : / }).first()
  const nom = (await bouton.getAttribute('aria-label'))!.replace('Plus tard : ', '')
  const avant = await bloc.getByRole('button', { name: `Plus tard : ${nom}` }).count()
  await bouton.click()
  await expect(page.getByText(`« ${nom} » revient dans 7 jours.`)).toBeVisible()
  await expect(bloc.getByRole('button', { name: `Plus tard : ${nom}` })).toHaveCount(avant - 1)
  await bloc.getByRole('button', { name: '1 mis de côté · Tout revoir' }).click()
  await expect(bloc.getByRole('button', { name: /^Plus tard : / }).first()).toBeVisible()
})

test('53A : une seule carte d’indicateur, cliquable, sur l’accueil et dans Chiffres', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/')
  // Vague 8 : sur téléphone, les indicateurs se déplient sous l'actualité
  if (isMobile) await page.getByRole('button', { name: 'Mes indicateurs' }).click()
  await page.getByRole('region', { name: 'Pilotage' }).getByRole('link', { name: /^Décrochent :/ }).click()
  await expect(page).toHaveURL(/#\/performance/)
  // Dans Chiffres, la carte filtre la liste
  const carte = page.getByRole('button', { name: /^Dans la norme :/ })
  await carte.click()
  await expect(carte).toHaveAttribute('aria-pressed', 'true')
  await lisible(page, isMobile, false)
})

test('56A : la barre du franchisé sur téléphone, Accueil, Magasin, Messages, Tâches et Plus', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Barre du bas : téléphone')
  await seConnecter(page, { acces: PAUL })
  await page.goto('./#/')
  const barre = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(barre.getByRole('button')).toHaveCount(5)
  await barre.getByRole('button', { name: 'Plus' }).click()
  for (const m of ['Mon budget', 'Simulateurs', 'Mes demandes', 'Actualités']) await expect(page.getByRole('menuitem', { name: m })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Actualités' }).click()
  await expect(page).toHaveURL(/#\/infos/)
  await lisible(page, isMobile)
})
