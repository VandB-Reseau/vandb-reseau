import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'
import { zonesTropPetites } from './pilotage/supabase-simule'

// Refonte façon SaaS, vague 4 (Joseph, 10/11/2026, « tout en même temps sauf 35 ») : plan d'action du magasin (31A),
// statut des tâches (32A), rituels (33A), entretien RR–Coach (34A), Envoyer au réseau et remontée (36A), demandes des
// franchisés (37A), cloche / À traiter (38B), gabarit (39A), vocabulaire (40A), composants (41A), téléphone (42A) ;
// et les remarques internes de visite (Joseph, 10/11/2026 6h32).

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
const SAM = { appMetadata: { role: 'rr', rr: 'rr2' } }
const NOE = { appMetadata: { role: 'coach', coach: 'Noé MODELE' } }

test('31A et 32A : une priorité du plan d’action, une tâche bloquée avec sa raison', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, persister: true })
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('button', { name: 'Ajouter une priorité' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Priorité', { exact: true }).fill('Relancer la vente additionnelle au bar')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toHaveCount(0)
  await expect(page.getByText('Relancer la vente additionnelle au bar')).toBeVisible()
  expect(ecritures.some((e) => JSON.stringify(e.corps).includes('Relancer la vente additionnelle'))).toBe(true)
  // Statut d'une tâche : la puce propose À faire, En cours, Bloquée (avec la raison)
  await page.goto('./#/taches?de=%40franchises')
  await expect(page.getByRole('tab', { name: /^Franchisés · \d+$/ })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: /^Statut : À faire\. Changer le statut de/ }).first().click()
  await page.getByRole('menuitem', { name: 'Bloquée…' }).click()
  const b = page.getByRole('dialog', { name: 'Tâche bloquée' })
  await b.getByLabel('Ce qui bloque').fill('Attend la livraison du présentoir')
  await b.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(b).toHaveCount(0)
  expect(ecritures.some((e) => JSON.stringify(e.corps).includes('Attend la livraison du présentoir'))).toBe(true)
  await lisible(page, isMobile, false)
})

test('32A : la page Tâches se lit en vues soulignées', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/taches')
  await expect(page.getByRole('heading', { level: 1, name: 'Tâches' })).toBeVisible()
  const vues = page.getByRole('tablist', { name: 'Liste de tâches' })
  // Sur téléphone, les dernières vues passent derrière « Plus »
  for (const v of [/^Mes tâches · \d+$/, /^Franchisés · \d+$/, /^En retard · \d+$/, ...(isMobile ? [] : [/^Bloquées · \d+$/])]) await expect(vues.getByRole('tab', { name: v })).toBeVisible()
  await vues.getByRole('tab', { name: /^En retard/ }).click()
  await expect(page).toHaveURL(/de=%40retard/)
  await lisible(page, isMobile, false)
})

test('remarques internes d’une visite : jamais montrées au franchisé', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Lyon%20Test/visite?id=1&etape=surplace')
  await expect(page.getByRole('heading', { name: 'Remarques internes' })).toBeVisible()
  await expect(page.getByText('Visibles de l’équipe seulement, jamais du franchisé ni dans le compte rendu.')).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter une remarque' }).click()
  const d = page.getByRole('dialog', { name: 'Remarque interne' })
  await d.getByRole('button', { name: 'Préoccupante' }).click()
  await d.getByRole('textbox', { name: 'Remarque' }).fill('Équipe fatiguée, le franchisé ne délègue pas.')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toHaveCount(0)
  const note = ecritures.find((e) => JSON.stringify(e.corps).includes('Équipe fatiguée'))
  expect(JSON.stringify(note?.corps)).toContain('preoccupante')
  await lisible(page, isMobile, false)
})

test('34A : le RR prépare et note l’entretien du mois, le Coach ajoute ses remarques', async ({ page, isMobile }) => {
  const entretiens: Record<string, unknown>[] = [
    { id: 1, coach: 'Noé MODELE', mois: '2026-09', notes: 'Point sur Lyon.', engagements: [{ id: 'e1', texte: 'Appeler Lyon chaque semaine', echeance: '2026-10-15' }], remarques: '', fait_le: '2026-09-28', par: 'Sam SUD' },
  ]
  await seConnecter(page, { ...SAM, entretiens })
  await page.goto(`./#/equipe/coach/${encodeURIComponent('Noé MODELE')}?vue=entretiens`)
  await expect(page.getByRole('heading', { name: 'À aborder' })).toBeVisible()
  await expect(page.getByText('Appeler Lyon chaque semaine').first()).toBeVisible()
  await page.getByRole('button', { name: 'Tenu', exact: true }).click()
  await page.getByRole('textbox', { name: 'Notes de l’entretien' }).fill('Bon mois, Lyon remonte.')
  await page.getByRole('button', { name: 'Ajouter un engagement' }).click()
  await page.getByLabel('Engagement 1').fill('Préparer la réunion régionale')
  await page.getByRole('button', { name: 'Entretien fait' }).click()
  await expect(page.getByText('Entretien noté comme fait.')).toBeVisible()
  expect(entretiens.find((e) => e.mois === '2026-10')).toMatchObject({ coach: 'Noé MODELE', notes: 'Bon mois, Lyon remonte.', fait_le: '2026-10-27' })
  expect((entretiens[0].engagements as { tenu?: boolean }[])[0].tenu).toBe(true)
  await lisible(page, isMobile, false)

  // Le Coach lit l'entretien et écrit ses remarques
  await page.context().clearCookies()
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await seConnecter(page, { ...NOE, entretiens })
  await page.goto(`./#/equipe/coach/${encodeURIComponent('Noé MODELE')}?vue=entretiens`)
  await expect(page.getByText('Bon mois, Lyon remonte.')).toBeVisible()
  await page.getByRole('textbox', { name: 'Mes remarques' }).fill('D’accord, je m’en occupe.')
  await page.getByRole('button', { name: 'Enregistrer mes remarques' }).click()
  await expect(page.getByText('Remarques enregistrées.')).toBeVisible()
  expect(entretiens.find((e) => e.mois === '2026-10')?.remarques).toBe('D’accord, je m’en occupe.')
})

test('34A et 38B : le RR retrouve les entretiens du mois à faire dans À traiter', async ({ page }) => {
  await seConnecter(page, { ...SAM, entretiens: [] })
  const aTraiter = page.getByRole('region', { name: 'À traiter' }).first()
  await aTraiter.getByRole('button', { name: /^Voir les \d+$/ }).click()
  await expect(aTraiter.getByText('Entretien avec Noé MODELE').first()).toBeVisible()
  await expect(aTraiter.getByText('Entretien avec Inès EXEMPLE').first()).toBeVisible()
})

test('33A : le Directeur règle les rituels et lit leur taux de tenue', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, entretiens: [{ id: 1, coach: 'Noé MODELE', mois: '2026-10', notes: '', engagements: [], fait_le: '2026-10-20', par: 'Sam SUD' }] })
  await page.goto('./#/parametres/reglages?rubrique=rituels')
  await expect(page.getByRole('heading', { name: 'Rituels d’animation' })).toBeVisible()
  await page.getByRole('switch', { name: /^Suivre : Réunion régionale/ }).or(page.getByRole('checkbox', { name: /^Suivre : Réunion régionale/ })).click()
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect.poll(() => ecritures.some((e) => e.table === 'app_config' && JSON.stringify(e.corps).includes('rituels'))).toBe(true)
  await page.goto('./#/equipe?vue=rituels')
  const taux = page.getByRole('list', { name: 'Taux de tenue des rituels' })
  await expect(taux.getByRole('listitem')).toHaveCount(3)
  await expect(taux).toContainText('Entretien mensuel du Responsable Régional avec chaque Coach')
  await expect(page.getByRole('heading', { name: 'Entretien mensuel du Responsable Régional avec chaque Coach' })).toBeVisible()
  await expect(page.getByText('1 entretien fait sur 2 Coachs')).toBeVisible()
  await lisible(page, isMobile, false)
})

test('37A : le franchisé envoie une demande, le siège la traite', async ({ page, isMobile }) => {
  const demandes: Record<string, unknown>[] = []
  await seConnecter(page, { acces: PAUL, demandes })
  await page.goto('./#/demandes')
  await expect(page.getByRole('heading', { level: 1, name: 'Mes demandes' })).toBeVisible()
  await page.getByRole('button', { name: 'Nouvelle demande' }).first().click()
  const d = page.getByRole('dialog', { name: 'Nouvelle demande' })
  await d.getByLabel('Thème').click()
  await page.getByRole('option', { name: 'Informatique et caisse' }).click()
  await d.getByLabel('Ma demande en une ligne').fill('La caisse ne sort plus les tickets cadeaux')
  await d.getByLabel('Détails').fill('Depuis lundi, message d’erreur à l’impression.')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Demande envoyée au siège.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Mes demandes' })).toContainText('La caisse ne sort plus les tickets cadeaux')
  expect(demandes[0]).toMatchObject({ theme: 'caisse', magasin: 'Annecy Test', statut: 'nouvelle' })
  await lisible(page, isMobile)

  // Le siège : la demande est à traiter, on répond et on la résout
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await seConnecter(page, { demandes, config: { demandes_themes: { caisse: 'Tom TECHNICIEN' } } })
  const aTraiter = page.getByRole('region', { name: 'À traiter' }).first()
  await aTraiter.getByRole('button', { name: /^Voir les \d+$/ }).click()
  await expect(aTraiter.getByText('La caisse ne sort plus les tickets cadeaux').first()).toBeVisible()
  await page.goto('./#/demandes')
  await expect(page.getByRole('heading', { level: 1, name: 'Demandes' })).toBeVisible()
  if (isMobile) await page.getByRole('button', { name: 'Filtres' }).click()
  await expect(page.getByRole('button', { name: /^À traiter · 1$/ })).toBeVisible()
  await page.getByText('La caisse ne sort plus les tickets cadeaux').first().click()
  const r = page.getByRole('dialog')
  await expect(r).toContainText('Interlocuteur : Tom TECHNICIEN')
  await r.getByLabel('Réponse au franchisé').fill('Le prestataire passe demain matin.')
  await r.getByLabel('Statut').click()
  await page.getByRole('option', { name: 'Résolue' }).click()
  await r.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Demande résolue.')).toBeVisible()
  expect(demandes[0].statut).toBe('resolue')
  expect(demandes[0].premiere_reponse_le).toBeTruthy()
  await lisible(page, isMobile, false)
})

test('36A : Envoyer au réseau, un seul panneau, et la remontée chiffrée', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, questions: { resultats: [], franchise: [] } })
  await page.goto('./#/campagnes?vue=suivi')
  await page.getByRole('button', { name: 'Envoyer au réseau' }).first().click()
  const menu = page.getByRole('menu', { name: 'Envoyer au réseau' })
  await expect(menu.getByRole('menuitem')).toHaveText(['Information', 'Campagne', 'Sondage', 'Remontée', 'Réunion', 'Formation', 'Bonne pratique'])
  await menu.getByRole('menuitem', { name: 'Remontée' }).click()
  const d = page.getByRole('dialog', { name: 'Nouvelle remontée' })
  await expect(d.getByRole('group', { name: 'Réponses' })).toHaveCount(0)
  await d.getByRole('textbox', { name: 'Question' }).fill('Combien de cartes fidélité créées en octobre ?')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toHaveCount(0)
  const envoi = ecritures.find((e) => e.table === 'rpc/publier_sondage')
  expect(envoi?.corps).toMatchObject({ p_anonyme: false, p_questions: [{ genre: 'chiffre' }] })
  await lisible(page, isMobile, false)
})

test('40A : le vocabulaire de l’app s’ouvre à la demande depuis le compte', async ({ page }) => {
  await seConnecter(page)
  await page.getByRole('button', { name: 'Mon compte' }).first().click()
  await page.getByRole('menuitem', { name: 'Vocabulaire de l’app' }).click()
  const d = page.getByRole('dialog', { name: 'Vocabulaire de l’app' })
  for (const t of ['Dans la norme', 'Prioritaires', 'À voir', 'Presque pleine', 'Bloquée']) await expect(d.getByText(t, { exact: true })).toBeVisible()
})

test('42A : barre du téléphone et journée du Coach', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Spécifique au téléphone')
  await seConnecter(page, NOE)
  const barre = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(barre.getByRole('button')).toHaveCount(5)
  for (const n of [/^Accueil/, /^Agenda/, /^Magasins/, /^Tâches/, /^Messages/]) await expect(barre.getByRole('button', { name: n })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Ma journée' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mes indicateurs' })).toHaveAttribute('aria-expanded', 'false')
  // Le « + » : les gestes du terrain d'abord
  await page.getByRole('button', { name: 'Créer' }).click()
  await expect(page.getByRole('menu', { name: 'Créer' }).getByRole('menuitem').first()).toHaveText('Visite')
  await expect(page.getByRole('menu', { name: 'Créer' }).getByRole('menuitem').nth(1)).toHaveText('Appel')
  await expect(page.getByRole('menu', { name: 'Créer' }).getByRole('menuitem').nth(2)).toHaveText('Note')
  await lisible(page, isMobile, false)
})

test('39A : l’action principale à droite du titre', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Sur téléphone, l’action principale est le « + »')
  await seConnecter(page)
  await page.goto('./#/visites')
  const titre = page.getByRole('heading', { level: 1, name: 'Visites' })
  const bouton = page.getByRole('main').getByRole('button', { name: 'Saisir une visite', exact: true }).first()
  const t = (await titre.boundingBox())!, b = (await bouton.boundingBox())!
  expect(Math.abs((t.y + t.height / 2) - (b.y + b.height / 2))).toBeLessThan(24)
  expect(b.x).toBeGreaterThan(t.x + t.width)
})
