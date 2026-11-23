import { expect, test, type Locator } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'
import { zonesTropPetites } from './pilotage/supabase-simule'

// Mise en page rééquilibrée (Joseph, 23/11/2026) : plus de grand vide en bas à gauche de la Vue d'ensemble ni sous la
// Nine box de la fiche magasin ; Évolution du parc passe dans la rubrique Réseau du menu. Données fictives uniquement.

const boite = async (l: Locator) => (await l.boundingBox())!

test('Vue d’ensemble : budget, déploiements et dernier échange sous les objectifs sur PC, ordre d’avant sur téléphone', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  const aFaire = await boite(page.getByRole('region', { name: 'À faire' }))
  const va = await boite(page.getByRole('region', { name: 'Comment va le magasin' }))
  const echange = await boite(page.getByRole('region', { name: 'Dernier échange' }))
  const budget = await boite(page.getByRole('group', { name: 'Budget du magasin' }))
  if (isMobile) {
    // Une colonne : À faire, Comment va le magasin, le budget, puis le dernier échange
    expect(va.y).toBeGreaterThan(aFaire.y)
    expect(budget.y).toBeGreaterThan(va.y)
    expect(echange.y).toBeGreaterThan(budget.y)
  } else {
    // Colonne de gauche : À faire, puis le budget et le dernier échange ; à droite, Comment va le magasin seul
    expect(Math.abs(echange.x - aFaire.x)).toBeLessThan(2)
    expect(Math.abs(budget.x - aFaire.x)).toBeLessThan(2)
    expect(echange.y).toBeGreaterThan(budget.y)
    expect(va.x).toBeGreaterThan(aFaire.x + 200)
  }
  // Pas de contrôle des zones tactiles ici : le lien « visite du … » d'une tâche, dans une phrase, est connu (24A)
  expect(await textesTropPetits(page)).toEqual([])
})

test('Nine box : les déploiements sous la grille sur PC, à côté de la santé ; ordre d’avant sur téléphone', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test?vue=ninebox')
  const grille = await boite(page.getByRole('heading', { name: 'Nine box', exact: true }))
  const sante = await boite(page.getByRole('heading', { name: 'Santé', exact: true }))
  const deploiements = await boite(page.getByRole('heading', { name: 'Déploiements', exact: true }))
  if (isMobile) {
    expect(sante.y).toBeGreaterThan(grille.y)
    expect(deploiements.y).toBeGreaterThan(sante.y)
  } else {
    expect(Math.abs(deploiements.x - grille.x)).toBeLessThan(2)
    expect(deploiements.y).toBeGreaterThan(grille.y)
    expect(sante.x).toBeGreaterThan(grille.x + 200)
    expect(deploiements.y).toBeLessThan(sante.y + 900) // plus tout en bas, sous la santé
  }
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('Évolution du parc : une entrée de la rubrique Réseau, plus un onglet de Chiffres', async ({ page, isMobile }) => {
  await seConnecter(page)
  if (isMobile) {
    await page.goto('./#/evolution')
  } else {
    await page.goto('./#/magasins')
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Évolution du parc', exact: true }).click()
  }
  await expect(page).toHaveURL(/#\/evolution$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Évolution du parc' })).toBeVisible()
  await expect(page.getByRole('img', { name: /Ouvertures : / })).toBeVisible()
  await page.goto('./#/performance')
  await expect(page.getByRole('tablist', { name: 'Parties des chiffres' }).getByRole('tab', { name: /Évolution/ })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
})
