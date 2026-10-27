import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'
import { visitesFictives } from './donnees-fictives'

// Sprint 27 (Joseph, 26/10/2026) : S1 listes de tâches en puces, S3 même nombre de magasins partout,
// F3 concurrents à 2 km (OpenStreetMap + ajouts de l'équipe), F4 le mot du franchisé avant une visite

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const jour = (decalage = 0) => { const d = new Date(); d.setDate(d.getDate() + decalage); return d.toLocaleDateString('sv-SE') }
const NOE = { appMetadata: { role: 'coach', coach: 'Noé MODELE' } }

async function avecVisites(page: Page, ajout: Record<string, unknown>[]) {
  const visites = [...visitesFictives, ...ajout]
  await page.route('https://supabase.test/rest/v1/visits**', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: visites }) : r.fallback()))
}

const suiviEcrit = (ecritures: Ecriture[], cle: string) => {
  const e = ecritures.filter((x) => x.methode === 'SUIVI' && (x.corps as { key: string }).key === cle).at(-1)
  return e ? JSON.parse((e.corps as { value: string }).value) : undefined
}

test('S1 : les listes de tâches sont des puces avec leur nombre, ouverture sur une liste qui a du contenu', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/taches')
  const puces = page.getByRole('group', { name: 'Liste de tâches' })
  await expect(puces.getByRole('button')).toHaveText([/^Mes tâches · \d+$/, /^Franchisés · \d+$/, 'Équipe'])
  for (const b of await puces.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  // Le Directeur n'a rien à faire à son nom : la liste des franchisés s'ouvre
  await expect(puces.getByRole('button', { name: /^Mes tâches · 0$/ })).toBeVisible()
  await expect(puces.getByRole('button', { name: /^Franchisés/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('list', { name: 'Tâches à faire' })).toContainText('Refaire la vitrine')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-s27-taches-puces.png` })
  // Liste d'un membre de l'équipe
  await puces.getByRole('button', { name: 'Équipe' }).click()
  await page.getByRole('menuitem', { name: /^Noé MODELE · \d+$/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tâches de Noé MODELE')
  await expect(puces.getByRole('button', { name: 'Équipe · Noé MODELE' })).toHaveAttribute('aria-pressed', 'true')
  // Retour à sa liste, même vide
  await puces.getByRole('button', { name: /^Mes tâches/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tâches')
})

test('S1 : une liste demandée par lien reste ouverte', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/taches?de=No%C3%A9%20MODELE')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tâches de Noé MODELE')
})

test('S3 : le même nombre de magasins ouverts sur la liste et la santé du parc', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins')
  const sousTitre = page.getByText(/^\d+ ouverts · \d+ à venir$/)
  await expect(sousTitre).toBeVisible()
  const ouverts = /^(\d+) ouverts/.exec((await sousTitre.textContent())!)![1]
  await page.goto('./#/plus/sante')
  await expect(page.getByText(new RegExp(`classés? sur ${ouverts} ouverts$`))).toBeVisible()
})

test('F3 : les concurrents à 2 km de la fiche magasin, complétés par l’équipe', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ...NOE, ecritures, persister: true })
  await page.goto('./#/magasins/Lyon%20Test')
  const liste = page.getByRole('list', { name: 'Concurrents de Lyon Test' })
  await expect(liste.getByRole('listitem')).toHaveCount(2)
  await expect(liste.getByRole('listitem').nth(0)).toContainText('Cave Fictive du Centre')
  await expect(liste.getByRole('listitem').nth(0)).toContainText('Caviste · 4 rue des Essais')
  await expect(liste.getByRole('listitem').nth(0)).toContainText('330 m')
  await expect(liste.getByRole('listitem').nth(1)).toContainText('1,6 km')
  // Le magasin V and B voisin et le commerce au-delà de 2 km n'y sont pas
  await expect(liste).not.toContainText('V and B')
  await expect(liste).not.toContainText('Trop Loin')

  // Une note sur un commerce de la carte
  await liste.getByRole('button', { name: 'Modifier Cave Fictive du Centre' }).click()
  let d = page.getByRole('dialog')
  await d.getByLabel('Note').fill('Prix agressifs sur le champagne')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Concurrent enregistré.')).toBeVisible()
  expect(suiviEcrit(ecritures, 'concurrents_magasins')['Lyon Test'].notes).toEqual({ 'node/11': 'Prix agressifs sur le champagne' })
  await expect(liste.getByRole('listitem').nth(0)).toContainText('« Prix agressifs sur le champagne »')

  // Un concurrent absent de la carte
  await page.getByRole('button', { name: 'Ajouter un concurrent' }).click()
  d = page.getByRole('dialog')
  await d.getByLabel('Nom').fill('Rayon cave du supermarché')
  await d.getByLabel('Adresse ou précision').fill('Centre commercial')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Concurrent ajouté.')).toBeVisible()
  expect(suiviEcrit(ecritures, 'concurrents_magasins')['Lyon Test'].ajoutes[0]).toMatchObject({ nom: 'Rayon cave du supermarché', detail: 'Centre commercial' })
  await expect(liste.getByRole('listitem').nth(2)).toContainText(/ajouté par \S+/)

  // Un commerce qui n'est pas un concurrent est retiré, puis remis
  await liste.getByRole('button', { name: 'Modifier Spiritueux Simulés' }).click()
  d = page.getByRole('dialog')
  await d.getByRole('button', { name: 'Supprimer' }).click()
  await d.getByRole('alert').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByText('Spiritueux Simulés retiré de la liste.')).toBeVisible()
  await expect(liste).not.toContainText('Spiritueux Simulés')
  expect(suiviEcrit(ecritures, 'concurrents_magasins')['Lyon Test'].masques).toEqual(['way/12'])
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-s27-concurrents.png` })
  await page.getByRole('button', { name: 'Remettre le commerce retiré' }).click()
  await expect(liste).toContainText('Spiritueux Simulés')

  // Repris sur la fiche avant visite
  await page.goto('./#/magasins/Lyon%20Test/preparer')
  const tableau = page.getByRole('table', { name: 'Concurrents à 2 km' })
  await expect(tableau).toContainText('Cave Fictive du Centre')
  await expect(tableau).toContainText('Prix agressifs sur le champagne')
  await expect(tableau).toContainText('Rayon cave du supermarché')
})

test('F3 : la carte des commerces ne répond pas', async ({ page }) => {
  await seConnecter(page, { overpass: 'panne' })
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByText('La carte des commerces ne répond pas pour le moment.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible()
})

test('F4 : le franchisé écrit son mot avant la visite prévue', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  const visite = { id: 51, store: 'Annecy Test', visit_date: jour(5), type: 'terrain', visitor: 'Hugo FICTIF', signed_required: false, docs: [], prevue: true }
  await seConnecter(page, { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] }, espace: { visites: [visite] }, ecritures })
  const bloc = page.getByRole('region', { name: 'Avant la visite' })
  await expect(bloc).toContainText('Hugo FICTIF')
  await bloc.getByRole('button', { name: 'Écrire mon mot' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Ce qui marche', { exact: true }).fill('Les dégustations du samedi')
  await d.getByLabel('Ce qui bloque', { exact: true }).fill('Livraisons en retard')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Ton mot est envoyé à l’équipe.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'rpc/ecrire_mot_franchise')!.corps).toEqual({ p_store: 'Annecy Test', p_visite: 51, p_marche: 'Les dégustations du samedi', p_bloque: 'Livraisons en retard', p_besoin: '' })
  await expect(bloc).toContainText('Livraisons en retard')
  await expect(bloc.getByRole('button', { name: 'Modifier mon mot' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-s27-mot-franchise.png` })
})

test('F4 : pas de mot pour une visite passée', async ({ page }) => {
  await seConnecter(page, { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] }, espace: { visites: [{ id: 52, store: 'Annecy Test', visit_date: jour(-5), type: 'terrain', visitor: 'Hugo FICTIF', docs: [] }] } })
  await expect(page.getByRole('heading', { name: 'Mes tâches' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Avant la visite' })).toHaveCount(0)
})

test('F4 : l’équipe lit le mot du franchisé avant la visite', async ({ page }, info) => {
  const mot = { visite: 99, date: jour(3), marche: 'Le corner épicerie démarre bien', bloque: '', besoin: 'Un point sur les commandes de Noël', par: 'Franchisé Lyon', le: `${jour()}T09:00:00Z` }
  await seConnecter(page, { ...NOE, config: { mots_franchise: { 'Lyon Test': [mot] } } })
  await avecVisites(page, [{ id: 99, store: 'Lyon Test', visit_date: jour(3), type: 'terrain', visitor: 'Noé MODELE', docs: [], prevue: true }])
  await page.goto('./#/magasins/Lyon%20Test/preparer')
  await page.reload()
  const bloc = page.getByRole('region', { name: 'Le mot du franchisé' })
  await expect(bloc).toContainText('Le corner épicerie démarre bien')
  await expect(bloc).toContainText('Un point sur les commandes de Noël')
  await expect(bloc).toContainText('Franchisé Lyon')
  await expect(bloc).not.toContainText('Ce qui bloque')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-s27-mot-fiche-avant-visite.png` })
  // Signalé dans la semaine du Coach
  await page.goto('./#/visites?vue=semaine')
  await expect(page.getByText(/mot du franchisé reçu/).first()).toBeVisible()
})
