import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Fiche magasin repensée (choix 196 à 203, Joseph 15/11/2026) : aperçu resserré, objectifs repliés, activité en deux
// colonnes, une tâche à un seul endroit, quatre filtres, colonne d'identité repliée, magasin précédent / suivant,
// dernier onglet retenu.
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
  const bande = page.getByRole('region', { name: 'À faire maintenant' })
  await expect(bande.getByRole('link')).toHaveCount(3)
  await expect(bande.getByRole('link', { name: /^Prochaine échéance : Changer l’ampoule de la vitrine/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Clôture du mois/ })).toHaveCount(0)
  // L'objectif tient sur une ligne ; ses priorités et leurs tâches se déplient
  const objectif = page.getByRole('region', { name: /^Objectif : Panier moyen HT Cave/ })
  await expect(objectif.getByText('Améliorer le mix produit')).toHaveCount(0)
  await objectif.getByRole('button', { name: /^Déplier/ }).click()
  await expect(objectif.getByText('Mettre en avant les vins à 15 €')).toBeVisible()
  // 201 : la tâche hors priorité n'est plus dans le bloc des objectifs
  await expect(page.getByText('Tâches hors plan', { exact: false })).toHaveCount(0)
  // Colonne d'identité : Équipe et Magasin ouverts, le reste replié
  await expect(page.getByRole('heading', { name: 'Équipe', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Équipements/ })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('button', { name: 'Concurrents à 2 km' })).toHaveAttribute('aria-expanded', 'false')
  expect(await textesTropPetits(page)).toEqual([])
})

test('198, 199 et 201 : l’activité en deux colonnes, une tâche à un seul endroit, quatre filtres', async ({ page, isMobile }) => {
  await seConnecter(page, { config })
  await page.goto('./#/magasins/Brest%20Test?vue=activite')
  const aFaire = page.locator('.MuiCard-root', { has: page.getByRole('heading', { name: 'À faire', exact: true }) })
  await expect(aFaire.getByText('Changer l’ampoule de la vitrine')).toBeVisible()
  await expect(aFaire.getByText('Mettre en avant les vins à 15 €')).toHaveCount(0)
  await expect(aFaire.getByText('1 tâche rattachée aux priorités')).toBeVisible()
  await expect(aFaire.getByRole('button', { name: /^Campagnes/ })).toHaveAttribute('aria-expanded', 'false')
  const filtres = page.getByRole('group', { name: 'Filtrer l’activité' })
  await expect(filtres.getByRole('button')).toHaveText(['Tout', 'Visites', 'Tâches', 'Notes et journal'])
  // Sur PC, le fil est à droite de « À faire », sur la même hauteur
  const a = (await aFaire.boundingBox())!
  const f = (await filtres.boundingBox())!
  if (isMobile) expect(f.y).toBeGreaterThan(a.y + a.height - 1)
  else { expect(f.x).toBeGreaterThan(a.x + a.width - 1); expect(f.y).toBeLessThan(a.y + a.height) }
  // « Voir les priorités » ramène à la vue d'ensemble
  await aFaire.getByRole('link', { name: 'Voir les priorités' }).click()
  await expect(page.getByRole('region', { name: 'À faire maintenant' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
})

test('202 : passer au magasin suivant sans revenir à la liste', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Brest%20Test')
  await expect(page.getByRole('heading', { level: 1, name: 'Brest Test' })).toBeVisible()
  let suivant: string
  if (isMobile) {
    await page.getByRole('button', { name: 'Autres actions' }).click()
    const item = page.getByRole('menuitem', { name: /^Suivant : / })
    suivant = (await item.textContent())!.replace(/^Suivant : /, '')
    await item.click()
  } else {
    const bouton = page.getByRole('link', { name: /^Magasin suivant : / })
    suivant = (await bouton.getAttribute('aria-label'))!.replace(/^Magasin suivant : /, '')
    await bouton.click()
  }
  expect(suivant).not.toBe('Brest Test')
  await expect(page.getByRole('heading', { level: 1, name: suivant })).toBeVisible()
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
