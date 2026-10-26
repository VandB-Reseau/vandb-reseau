import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import lireExcel from 'read-excel-file/node'
import { seConnecter, textesTropPetits } from './supabase-simule'
import { dateCourte } from '../src/lib/format'

// Mandats (Joseph, 26/10/2026) : 5 ans renouvelés par 5 ans, calculés sur chaque associé (entrée, sinon ouverture) quand
// aucun mandat n'est saisi ; fins de mandat à 6 mois dans le bloc Contrats de l'accueil

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
  return { debut: plusAns(depart, 5 * (n - 1)), fin: plusAns(depart, 5 * n), numero: n === 1 ? '1er mandat' : `${n}e mandat` }
}
const associe = (page: Page, nom: string) => page.getByText(nom, { exact: true }).locator('..')

test('sans mandat saisi, le mandat du franchisé est calculé depuis l’ouverture', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Nantes%20Test')
  const a = attendu('2020-03-15')
  await expect(associe(page, 'Franchisé 2')).toContainText(`Mandat du ${dateCourte(a.debut)} au ${dateCourte(a.fin)} · ${a.numero}`)
  await expect(page.getByText('Fin de contrat', { exact: true })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-mandat-calcule.png` })
})

test('un associé d’un intégré a aussi son mandat', async ({ page }) => {
  const associes = { 'Lyon Test': [{ id: 'x1', nom: 'Associé UN', entree: '', sortie: '', mandats: [] }] }
  await seConnecter(page, { config: { associes } })
  await page.goto('./#/magasins/Lyon%20Test')
  const a = attendu('2018-01-15')
  await expect(associe(page, 'Associé UN')).toContainText(`Mandat du ${dateCourte(a.debut)} au ${dateCourte(a.fin)} · ${a.numero}`)
})

test('une entrée récente redémarre le mandat ; la fin à 6 mois apparaît dans Contrats', async ({ page, isMobile }, info) => {
  // Franchisé entré il y a 4 ans et 10 mois : fin du 1er mandat dans 2 mois
  const entree = plusMois(plusAns(jour, -5), 2)
  const associes = { 'Nantes Test': [{ id: 'x1', nom: 'Franchisé 2', entree, sortie: '', mandats: [] }] }
  await seConnecter(page, { config: { associes } })
  await page.goto('./#/magasins/Nantes%20Test')
  await expect(associe(page, 'Franchisé 2')).toContainText(`au ${dateCourte(plusAns(entree, 5))} · 1er mandat`)
  await expect(page.getByText('Fin dans moins de 6 mois')).toBeVisible()
  await page.goto('./#/')
  if (isMobile) await page.getByRole('tab', { name: /^Contrats/ }).click()
  const bloc = page.getByRole('region', { name: 'Contrats' })
  await expect(bloc.getByRole('link', { name: /Franchisé 2 · Nantes Test/ })).toContainText(`Fin le ${dateCourte(plusAns(entree, 5))} · 1er mandat`)
  await expect(page.getByRole('region', { name: 'À traiter' }).getByText(/1er mandat/)).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-accueil-contrats.png` })
})

test('un mandat saisi l’emporte sur le calcul', async ({ page }) => {
  const associes = { 'Brest Test': [{ id: 'x1', nom: 'Franchisé 11', entree: '', sortie: '', mandats: [{ debut: '2022-01-01', fin: '2030-03-31' }] }] }
  await seConnecter(page, { config: { associes } })
  await page.goto('./#/magasins/Brest%20Test')
  await expect(associe(page, 'Franchisé 11')).toContainText(`Mandat du ${dateCourte('2022-01-01')} au ${dateCourte('2030-03-31')}`)
  await expect(associe(page, 'Franchisé 11')).not.toContainText('1er mandat')
})

test('l’export des mandats donne le mandat en cours de chaque associé, plus de fin de contrat par magasin', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/parametres/donnees')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter Associés et mandats' }).click()])
  const chemin = test.info().outputPath(dl.suggestedFilename())
  await dl.saveAs(chemin)
  const [feuille] = await lireExcel(readFileSync(chemin))
  const [entetes, ...lignes] = feuille.data as unknown[][]
  const col = (nom: string) => entetes.findIndex((e) => String(e).replace(' (clé)', '') === nom)
  const ligne = lignes.find((l) => l[col('Magasin')] === 'Nantes Test' && l[col('Franchisé ou associé')] === 'Franchisé 2')!
  const a = attendu('2020-03-15')
  const iso = (v: unknown) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '')
  expect(iso(ligne[col('Début du mandat')])).toBe('')
  expect(iso(ligne[col('Mandat en cours : début')])).toBe(a.debut)
  expect(iso(ligne[col('Mandat en cours : fin')])).toBe(a.fin)
  expect(String(ligne[col('N° du mandat en cours')])).toBe(a.numero.replace(/\D/g, ''))

  const [dm] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter Magasins' }).click()])
  const cm = test.info().outputPath(dm.suggestedFilename())
  await dm.saveAs(cm)
  const [fm] = await lireExcel(readFileSync(cm))
  expect((fm.data as unknown[][])[0]).not.toContain('Fin de contrat')
})
