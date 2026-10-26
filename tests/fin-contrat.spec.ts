import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'
import { dateCourte, dateLongue } from '../src/lib/format'

// Fin de contrat (Joseph, 26/10/2026) : contrat de 5 ans, renouvelé par 5 ans ; départ à la reprise, sinon à l'ouverture

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const jour = new Date().toISOString().slice(0, 10)
const plusAns = (iso: string, n: number) => { const [a, m, j] = iso.split('-').map(Number); return new Date(Date.UTC(a + n, m - 1, j)).toISOString().slice(0, 10) }
const plusMois = (iso: string, n: number) => { const [a, m, j] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1 + n, j)).toISOString().slice(0, 10) }
function attendu(depart: string) {
  let n = 1
  while (plusAns(depart, 5 * n) <= jour) n++
  return { fin: plusAns(depart, 5 * n), numero: n }
}
const ligne = (page: import('@playwright/test').Page) => page.getByText('Fin de contrat', { exact: true }).locator('..')

test('la fiche donne la fin de contrat calculée depuis l’ouverture', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  const a = attendu('2018-01-15')
  await expect(ligne(page)).toContainText(dateLongue(a.fin))
  await expect(ligne(page)).toContainText(`${a.numero === 1 ? '1er' : `${a.numero}e`} contrat · depuis l’ouverture du ${dateCourte('2018-01-15')}`)
  expect(await textesTropPetits(page)).toEqual([])
  await ligne(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `captures/${info.project.name}-fin-contrat.png` })
})

test('une reprise redémarre le contrat, l’échéance proche s’affiche à l’accueil', async ({ page }) => {
  // Franchisé arrivé il y a 4 ans et 10 mois : fin du 1er contrat dans 2 mois
  const entree = plusMois(plusAns(jour, -5), 2)
  const associes = { 'Nantes Test': [{ id: 'x1', nom: 'Franchisé 2', entree, sortie: '', mandats: [] }] }
  await seConnecter(page, { config: { associes } })
  await page.goto('./#/magasins/Nantes%20Test')
  await expect(ligne(page)).toContainText(dateLongue(plusAns(entree, 5)))
  await expect(ligne(page)).toContainText(`1er contrat · depuis la reprise du ${dateCourte(entree)}`)
  await expect(ligne(page).getByText('Fin dans moins d’un an')).toBeVisible()
  await page.goto('./#/')
  const bloc = page.getByRole('region', { name: 'À traiter' })
  const voir = bloc.getByRole('button', { name: /^Voir les \d+$/ })
  await bloc.waitFor()
  if (await voir.count()) await voir.click()
  await expect(bloc.getByRole('link', { name: /^Nantes Test/ }).filter({ hasText: 'Fin de contrat' })).toContainText(`Fin de contrat le ${dateCourte(plusAns(entree, 5))}`)
})

test('un mandat saisi l’emporte sur le calcul', async ({ page }) => {
  const associes = { 'Brest Test': [{ id: 'x1', nom: 'Franchisé 11', entree: '', sortie: '', mandats: [{ debut: '2022-01-01', fin: '2030-03-31' }] }] }
  await seConnecter(page, { config: { associes } })
  await page.goto('./#/magasins/Brest%20Test')
  await expect(ligne(page)).toContainText(dateLongue('2030-03-31'))
  await expect(ligne(page)).not.toContainText('contrat ·')
})
