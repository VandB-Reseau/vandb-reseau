import { expect, test, type Locator } from '@playwright/test'
import { seConnecter } from './pilotage/ecrans/outils'
import { seConnecter as connecterReseau } from './supabase-simule'
import type { VenteSimulee } from './pilotage/supabase-simule'

// En-tête des tableaux sur téléphone (Joseph, 11/11/2026 : « les titres défilent sur la gauche », Budget > Tous les
// magasins). Au défilement, dans les deux sens, le titre « Magasin » reste au-dessus des autres titres et aligné sur sa
// colonne. Données fictives uniquement.

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const noms = Array.from({ length: 24 }, (_, i) => `Magasin fictif ${String(i + 1).padStart(2, '0')}`)
const reel: VenteSimulee[] = noms.flatMap((m) => [1, 2, 3].map((mo) =>
  ({ store_name: m, mois: `2026-0${mo}-01`, univers: 'cave', famille: 'Vin', ca_ht: 30_000, ca_ttc: 36_000, marge_ht: 12_000 })))

test('Budget, tous les magasins : le titre Magasin reste en place au défilement', async ({ page }, info) => {
  await seConnecter(page, { magasins: noms.map((magasin) => ({ magasin, statut: null, hypotheses: null, maj_le: null })), reel })
  await page.goto('./#/performance?vue=budget')
  const tableau = page.getByRole('table', { name: /^Réel \d{4} par magasin$/ })
  await expect(tableau.locator('tbody tr').nth(5)).toBeVisible()
  await tableau.scrollIntoViewIfNeeded()

  // Le titre « Magasin » passe devant les autres titres (ordre d'empilement plus haut que la colonne figée)
  const z = await tableau.locator('thead th').evaluateAll((ths) => ths.map((th) => Number(getComputedStyle(th).zIndex)))
  expect(z[0]).toBeGreaterThan(Math.max(...z.slice(1)))

  // Défilement vers le bas puis vers la droite, dans la carte du tableau
  await tableau.evaluate((t) => { const c = t.parentElement!; c.scrollTop = 400; c.scrollLeft = 200 })
  await page.waitForTimeout(100)
  const mesure = await tableau.evaluate((t) => {
    const c = t.parentElement!.getBoundingClientRect()
    const titre = t.querySelector('thead th')!.getBoundingClientRect()
    const cellule = [...t.querySelectorAll('tbody tr')].map((tr) => tr.firstElementChild!.getBoundingClientRect()).find((r) => r.top > titre.bottom)!
    const dessus = document.elementFromPoint(titre.left + 20, titre.top + titre.height / 2)
    return { haut: titre.top - c.top, gauche: titre.left - c.left, largeur: titre.width, celluleGauche: cellule.left, celluleLargeur: cellule.width, titreGauche: titre.left,
      auDessus: !!dessus?.closest('thead th:first-of-type') }
  })
  expect(Math.abs(mesure.haut)).toBeLessThan(2)
  expect(Math.abs(mesure.gauche)).toBeLessThan(2)
  expect(Math.abs(mesure.titreGauche - mesure.celluleGauche)).toBeLessThan(1)
  expect(Math.abs(mesure.largeur - mesure.celluleLargeur)).toBeLessThan(1)
  expect(mesure.auDessus, 'aucun autre titre ne passe sur « Magasin »').toBe(true)
  await page.screenshot({ path: `captures/${info.project.name}-entete-tableau-collant.png` })
})

// Titres figés (collés à gauche) : tous au-dessus des titres qui défilent
const ordreTitres = (tableau: Locator) => tableau.locator('thead th').evaluateAll((ths) => {
  const z = ths.map((th) => ({ fige: getComputedStyle(th).position === 'sticky', z: Number(getComputedStyle(th).zIndex) }))
  return { figes: Math.min(...z.filter((x) => x.fige).map((x) => x.z)), autres: Math.max(...z.filter((x) => !x.fige).map((x) => x.z)) }
})

test('Magasins et Visites : les titres figés passent devant les autres titres', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Tableaux du PC')
  await connecterReseau(page)
  await page.goto('./#/magasins?vue=liste')
  const magasins = page.getByRole('table', { name: 'Tableau des magasins' })
  await expect(magasins.locator('tbody tr').first()).toBeVisible()
  const a = await ordreTitres(magasins)
  expect(a.figes).toBeGreaterThan(a.autres)
  await page.goto('./#/visites')
  await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Tableau' }).last().click()
  const rythme = page.getByRole('table', { name: 'Rythme de visite par magasin' })
  await expect(rythme).toBeVisible()
  const b = await ordreTitres(rythme)
  expect(b.figes).toBeGreaterThan(b.autres)
})
