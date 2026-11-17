import { expect, test } from '@playwright/test'
import { ouvrirInfosMagasin, seConnecter, textesTropPetits } from './supabase-simule'

// Fiche magasin repensée (choix 196 à 203, Joseph 15/11/2026) : aperçu resserré, objectifs repliés, activité en deux
// colonnes, une tâche à un seul endroit, quatre filtres, colonne d'identité repliée, dernier onglet retenu
// (202, magasin précédent / suivant, retiré le 15/11/2026).
const objectifs = { 'Brest Test': [{ id: 'o1', indicateur: 'pmCave', mode: 'valeur', depart: 37.14, moisDepart: '2026-09', cible: 40, echeance: '2026-12', taches: [], par: 'Joseph', creeLe: '2026-10-01' }] }
const plans = { 'Brest Test': [{ id: 'p1', titre: 'Améliorer le mix produit', objectif: 'o1', statut: 'active', bilan: '', creeLe: '2026-10-01', par: 'Joseph', closLe: '', revueLe: '' }] }
const actions = { 'Brest Test': [
  { id: 'l1', action: 'Mettre en avant les vins à 15 €', porteur: '', echeance: '2026-11-20', priorite: 'p1', creeLe: '2026-10-02' },
  { id: 'l2', action: 'Changer l’ampoule de la vitrine', porteur: '', echeance: '2026-10-30', creeLe: '2026-10-02' },
] }
const config = { objectifs_magasins: objectifs, plans_magasins: plans, actions }

test('196, 197 et 200 : aperçu resserré, objectifs repliés, colonne d’identité allégée', async ({ page }) => {
  await seConnecter(page, { config })
  await page.goto('./#/magasins/Brest%20Test')
  // Maquette 264 (17/11/2026) : la visite et les tâches dans la liste « À faire »
  const bande = page.getByRole('region', { name: 'À faire' })
  await expect(bande.getByText('Changer l’ampoule de la vitrine')).toBeVisible()
  await expect(page.getByRole('link', { name: /^Clôture du mois/ })).toHaveCount(0)
  // L'objectif tient sur une ligne ; ses priorités et leurs tâches se déplient
  const objectif = page.getByRole('region', { name: /^Objectif : Panier moyen HT Cave/ })
  await expect(objectif.getByText('Améliorer le mix produit')).toHaveCount(0)
  await objectif.getByRole('button', { name: /^Déplier/ }).click()
  await expect(objectif.getByText('Mettre en avant les vins à 15 €')).toBeVisible()
  // 201 : la tâche hors priorité n'est plus dans le bloc des objectifs
  await expect(page.getByText('Tâches hors plan', { exact: false })).toHaveCount(0)
  // Panneau « Infos du magasin » (maquette 264) : Équipe et Magasin ouverts, le reste replié
  expect(await textesTropPetits(page)).toEqual([])
  await ouvrirInfosMagasin(page)
  await expect(page.getByRole('heading', { name: 'Équipe', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Équipements/ })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('button', { name: 'Concurrents à 2 km' })).toHaveAttribute('aria-expanded', 'false')
  // 254 : la pastille « Fin dans moins de 6 mois » passe sous le nom, le mandat se lit sur une ou deux lignes
  const mandat = page.getByText(/^Mandat du /).first()
  await expect(page.getByText('Fin dans moins de 6 mois').first()).toBeVisible()
  expect((await mandat.boundingBox())!.height).toBeLessThan(60)
  expect(await textesTropPetits(page)).toEqual([])
})

test('198, 199, 201 et 265 : l’activité, À faire en tête puis l’historique en tableau, une tâche à un seul endroit, quatre filtres', async ({ page, isMobile }) => {
  await seConnecter(page, { config })
  await page.goto('./#/magasins/Brest%20Test?vue=activite')
  const aFaire = page.locator('.MuiCard-root', { has: page.getByRole('heading', { name: 'À faire', exact: true }) })
  await expect(aFaire.getByText('Changer l’ampoule de la vitrine')).toBeVisible()
  await expect(aFaire.getByText('Mettre en avant les vins à 15 €')).toHaveCount(0)
  await expect(aFaire.getByText('1 tâche rattachée aux priorités')).toBeVisible()
  await expect(aFaire.getByRole('button', { name: /^Campagnes/ })).toHaveAttribute('aria-expanded', 'false')
  const filtres = page.getByRole('group', { name: 'Filtrer l’activité' })
  await expect(filtres.getByRole('button')).toHaveText(['Tout', 'Visites', 'Tâches', 'Notes et journal'])
  // Maquette 265 (17/11/2026) : l'historique sous « À faire », en tableau sur PC, en liste sur téléphone
  const a = (await aFaire.boundingBox())!
  const f = (await filtres.boundingBox())!
  expect(f.y).toBeGreaterThan(a.y + a.height - 1)
  const historique = page.getByRole('region', { name: 'Historique' })
  if (isMobile) await expect(historique.getByRole('list', { name: 'Historique du magasin' })).toBeVisible()
  else await expect(historique.getByRole('table', { name: 'Historique du magasin' }).getByRole('columnheader')).toHaveText(['Date', 'Type', 'Quoi', 'Par', ''])
  // « Voir les priorités » ramène à la vue d'ensemble
  await aFaire.getByRole('link', { name: 'Voir les priorités' }).click()
  await expect(page.getByRole('region', { name: 'Comment va le magasin' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
})

// Joseph (15/11/2026) : magasin précédent / suivant retiré, ni au bout du fil d'Ariane ni dans le menu « ⋯ »
test('202 retiré : plus de magasin précédent ni suivant', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Brest%20Test')
  await expect(page.getByRole('heading', { level: 1, name: 'Brest Test' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Passer à un autre magasin' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Autres actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Bilan de l’année' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /^(Précédent|Suivant) : / })).toHaveCount(0)
})

test('203 : la fiche rouvre le dernier onglet et le dernier filtre', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test?vue=activite')
  await page.getByRole('group', { name: 'Filtrer l’activité' }).getByRole('button', { name: 'Tâches', exact: true }).click()
  await expect(page).toHaveURL(/fil=taches/)
  await page.goto('./#/magasins/Brest%20Test')
  await expect(page).toHaveURL(/vue=activite/)
  await expect(page).toHaveURL(/fil=taches/)
  await expect(page.getByRole('group', { name: 'Filtrer l’activité' }).getByRole('button', { name: 'Tâches', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

// Joseph (15/11/2026, iPhone) : rouverte sur Simuler, la fiche y restait bloquée ; chaque onglet doit rester cliquable
test('203 : après réouverture sur le dernier onglet, les autres onglets restent accessibles', async ({ page }) => {
  await seConnecter(page)
  const onglets = page.getByRole('tablist', { name: /^Rubriques de/ })
  await page.goto('./#/magasins/Lyon%20Test?vue=simulateurs')
  await expect(onglets.getByRole('tab', { name: 'Simulateurs', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.goto('./#/magasins/Brest%20Test')
  await expect(page).toHaveURL(/vue=simulateurs/)
  for (const [nom, vue] of [['Vue d’ensemble', null], ['Activité', 'activite'], ['Chiffres', 'chiffres'], ['Budget', 'budget']] as const) {
    await onglets.getByRole('tab', { name: nom, exact: true }).click()
    await expect(onglets.getByRole('tab', { name: nom, exact: true })).toHaveAttribute('aria-selected', 'true')
    if (vue) await expect(page).toHaveURL(new RegExp(`vue=${vue}`))
    else await expect(page).not.toHaveURL(/vue=/)
    await expect(onglets.getByRole('tab', { name: 'Simulateurs', exact: true })).toHaveAttribute('aria-selected', 'false')
  }
})
