import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture, ouvrirInfos } from './supabase-simule'

// « Vu par » des bonnes pratiques (Joseph, 22/10/2026) : comme pour les communications, le Directeur et les
// Responsables Régionaux voient quels franchisés ont vu chaque pratique ; un franchisé qui les affiche les a vues

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const pratiques = [
  { id: 'bp_1', magasin: 'Annecy Test', date: '2026-10-12', titre: 'Dégustation du samedi', theme: 'Animation et événements', texte: 'Trois vins ouverts.', par: 'Hugo FICTIF', photos: [], reprises: [] },
  { id: 'bp_2', magasin: 'Nice Test', date: '2026-10-02', titre: 'Accord mets et vins', theme: 'Vente additionnelle', texte: 'Une fiche par plat.', par: 'Sam SUD', photos: [], reprises: [] },
]

test('le Directeur voit quels franchisés ont vu une bonne pratique', async ({ page }, info) => {
  await seConnecter(page, { config: { bonnes_pratiques: pratiques }, lecturesPratiques: { bp_1: { lus: ['Paul MULTI'], non_lus: ['Nina NICE', 'Léa SUD'] } } })
  await ouvrirInfos(page, 'Bonnes pratiques')
  const carte = page.getByRole('article', { name: 'Dégustation du samedi' })
  const ligne = carte.getByRole('button', { name: /^Vue par 1 franchisé sur 3/ })
  await expect(ligne).toBeVisible()
  expect((await ligne.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await ligne.click()
  await expect(carte.getByText('Nina NICE, Léa SUD')).toBeVisible()
  await expect(page.getByRole('article', { name: 'Accord mets et vins' }).getByRole('button', { name: /^Vue par/ })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-pratique-vue-par.png` })
})

test('un Coach ne voit pas qui a vu les bonnes pratiques', async ({ page }) => {
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Noé MODELE' }, config: { bonnes_pratiques: pratiques }, lecturesPratiques: { bp_1: { lus: ['Paul MULTI'], non_lus: [] } } })
  await ouvrirInfos(page, 'Bonnes pratiques')
  await expect(page.getByRole('article', { name: 'Dégustation du samedi' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Vue par/ })).toHaveCount(0)
})

test('un franchisé qui affiche les bonnes pratiques les a vues', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] }, espace: { pratiques } })
  await page.goto('./#/bonnes-pratiques')
  await expect(page.getByRole('article', { name: 'Dégustation du samedi' })).toBeVisible()
  await expect.poll(() => ecritures.filter((e) => e.table === 'rpc/lire_pratiques').map((e) => e.corps)).toEqual([{ p_ids: ['bp_1', 'bp_2'] }])
  await expect(page.getByRole('button', { name: /^Vue par/ })).toHaveCount(0)
})

test('tant que le script n’est pas passé, rien ne change à l’écran', async ({ page }) => {
  await seConnecter(page, { config: { bonnes_pratiques: pratiques }, lecturesPratiques: null })
  await ouvrirInfos(page, 'Bonnes pratiques')
  await expect(page.getByRole('article', { name: 'Dégustation du samedi' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Vue par/ })).toHaveCount(0)
})
