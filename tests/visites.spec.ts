import { expect, test } from '@playwright/test'
import { COMPTE, seConnecter, simulerSupabase, textesTropPetits, type Ecriture } from './supabase-simule'
import { COACHS, magasinsFictifs } from './donnees-fictives'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('le rythme de visite est indicatif et signale les magasins pas vus depuis longtemps', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/visites')
  await expect(page.getByRole('tab', { name: 'Rythme de visite', selected: true })).toBeVisible()
  // Lyon : Cœur de réseau (3 par an) jusqu'au 1er octobre puis Redressement (8 par an) → référence 4 au prorata ; vu le 2 octobre.
  // Nantes (Cœur de réseau) vu en mars : au-delà des 150 jours de sa case
  const parMagasin = page.getByRole('region', { name: 'Rythme de visite par magasin' })
  const lyon = parMagasin.getByRole('link', { name: /^Lyon Test/ })
  const nantes = parMagasin.getByRole('link', { name: /^Nantes Test/ })
  await expect(lyon).toContainText('1 visite · référence 4')
  await expect(lyon.getByText(/Pas vu depuis/)).toHaveCount(0)
  await expect(nantes.getByText(/^Pas vu depuis \d+ j$/)).toBeVisible()
  await expect(page.getByRole('main')).not.toContainText(/en retard|j de retard|visites? dues?\b/i)
  // Filtres : seulement les magasins pas vus depuis longtemps, puis une case de la nine box
  if (isMobile) await page.getByRole('button', { name: 'Filtres' }).click()
  await page.getByRole('button', { name: 'Filtre Dernière visite' }).click()
  await page.getByRole('menuitem', { name: /Pas vus depuis longtemps/ }).click()
  await page.keyboard.press('Escape')
  await expect(lyon).toHaveCount(0)
  await expect(nantes).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-visites-rythme.png`, fullPage: !isMobile })
  await page.getByRole('button', { name: 'Filtre Nine box' }).click()
  await page.getByRole('menuitem', { name: /Locomotive/ }).click()
  await page.keyboard.press('Escape')
  await expect(nantes).toHaveCount(0)
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
  await expect(page.getByText('4 visites', { exact: true })).toBeVisible()
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
  await page.goto('./#/magasins/Lyon%20Test?vue=visites')
  await expect(page.getByText(/^1 visite en 2026 · référence nine box 4$/)).toBeVisible()
  await page.getByRole('button', { name: /Modifier la visite du/ }).click()
  const d = page.getByRole('dialog', { name: 'Modifier la visite de Lyon Test' })
  await d.getByLabel('Lien du compte rendu signé (Drive)').fill('https://exemple.test/cr')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Visite mise à jour.')).toBeVisible()
  expect(ecritures.filter((e) => e.table === 'visits').at(-1)).toMatchObject({ methode: 'PATCH', table: 'visits', filtre: '?id=eq.1', corps: { signed_url: 'https://exemple.test/cr', store: 'Lyon Test' } })
  await page.getByRole('button', { name: /Modifier la visite du/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await page.getByRole('alert').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByText('Visite supprimée.')).toBeVisible()
  expect(ecritures.filter((e) => e.table === 'visits').at(-1)).toMatchObject({ methode: 'DELETE', table: 'visits', filtre: '?id=eq.1' })
  // Ses photos sont effacées de l'espace photos
  expect(ecritures.at(-1)).toMatchObject({ methode: 'DELETE', table: 'storage', corps: { prefixes: ['visites/2026-10/lyon.jpg'] } })
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

test('un grand réseau s’affiche par tranches sans bloquer les onglets', async ({ page }) => {
  // 280 magasins et 3 000 visites fictifs, lus par pages de 1 000 comme sur Supabase
  const magasins = Array.from({ length: 280 }, (_, i) => ({ ...magasinsFictifs[i % 24], n: `Grand${i} Test`, code: `G${i}` }))
  const visites = Array.from({ length: 3000 }, (_, i) => ({ id: 5000 + i, store: `Grand${i % 280} Test`, visit_date: `202${4 + (i % 3)}-0${1 + (i % 9)}-${String(1 + (i % 27)).padStart(2, '0')}`, type: 'terrain', visitor: COACHS[i % 4], signed_required: false, docs: [], notes: `Visite fictive ${i}` }))
  await simulerSupabase(page, { config: { store_adds: magasins } })
  await page.route(/supabase\.test\/rest\/v1\/visits/, (r) => {
    const u = new URL(r.request().url())
    const debut = Number(u.searchParams.get('offset') ?? 0)
    return r.fulfill({ json: visites.slice(debut, debut + Number(u.searchParams.get('limit') ?? 1000)) })
  })
  await page.route(/supabase\.test\/rest\/v1\/reassigns/, (r) => r.fulfill({ json: magasins.map((m, i) => ({ id: i + 1, store: m.n, cs: COACHS[i % 4], date: '2018-01-01', note: '', type: 'pre' })) }))
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1, name: 'Accueil' }).waitFor({ state: 'attached' })
  await page.goto('./#/visites')
  await expect(page.getByRole('heading', { name: 'Par magasin' })).toBeVisible()
  const parMagasin = page.getByRole('region', { name: 'Rythme de visite par magasin' }).getByRole('link', { name: /^Grand\d+ Test/ })
  await expect(parMagasin).toHaveCount(50)
  await page.getByRole('button', { name: 'Voir plus (230)' }).click()
  await expect(parMagasin).toHaveCount(100)
  // Seules les 50 visites les plus récentes sont dessinées à l'ouverture de l'onglet
  await page.getByRole('tab', { name: /Historique/ }).click()
  await expect(page.getByText('3000 visites')).toBeVisible()
  const historique = page.getByRole('region', { name: 'Visites' }).getByRole('link', { name: /^Grand\d+ Test/ })
  await expect(historique).toHaveCount(50)
  await page.getByRole('button', { name: 'Voir plus (2950)' }).click()
  await expect(historique).toHaveCount(100)
  // Un filtre repart de la première tranche
  await page.getByRole('textbox', { name: /Rechercher/ }).or(page.getByPlaceholder('Rechercher un magasin ou une note')).first().fill('Grand7 Test')
  await expect(page.getByText(/^\d+ visites?$/)).toHaveText(/^1\d visites$/)
  expect(await textesTropPetits(page)).toEqual([])
})

test('les délais d’alerte de visite se règlent par case de la nine box', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/parametres/reglages?rubrique=visite')
  await expect(page.getByRole('heading', { name: 'Alerte de visite' })).toBeVisible()
  const redressement = page.getByLabel('Redressement urgent (jours sans visite)')
  await expect(redressement).toHaveValue('60')
  await expect(page.getByLabel('Locomotive (jours sans visite)')).toHaveValue('240')
  await expect(page.getByLabel('Non classé (jours sans visite)')).toHaveValue('180')
  // Lyon (Redressement urgent) vu le 2 octobre : signalé dès que le délai passe sous l'ancienneté de sa visite
  await redressement.fill('7')
  await expect(page.getByText(/^Avec ces délais, \d+ magasins? serai(en)?t signalés? \(contre \d+ actuellement\)\.$/)).toBeVisible()
  await page.getByRole('heading', { name: 'Alerte de visite' }).scrollIntoViewIfNeeded()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-parametres-alerte-visite.png`, fullPage: !isMobile })
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Alerte de visite enregistrée.')).toBeVisible()
  const params = ecritures.filter((e) => e.table === 'app_config').at(-1)!
  expect(JSON.parse((params.corps as { value: string }).value)).toEqual(expect.objectContaining({ alerteVisite_redressement: 7, alerteVisite_locomotive: 240, prepDuration: 2 }))
})
