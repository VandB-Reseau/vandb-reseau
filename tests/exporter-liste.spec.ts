import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import lireExcel from 'read-excel-file/node'
import { seConnecter } from './supabase-simule'

// L6 (Joseph, 21/10/2026) : exporter en Excel la liste affichée (Magasins, Visites, Santé du parc), filtres compris ;
// Directeur et Responsables Régionaux seulement, sans coordonnées personnelles

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

async function exporter(page: Page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter' }).click()])
  const chemin = test.info().outputPath(dl.suggestedFilename())
  await dl.saveAs(chemin)
  const [feuille] = await lireExcel(readFileSync(chemin))
  return { nom: dl.suggestedFilename(), lignes: (feuille as unknown as { data: unknown[][] }).data }
}

test('Magasins : exactement les magasins filtrés, sans téléphone ni courriel', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins?vue=liste&type=integre')
  const n = Number((await page.getByText(/^\d+ sur \d+ magasins$/).textContent())!.split(' ')[0])
  const { nom, lignes } = await exporter(page)
  expect(nom).toMatch(/^Magasins \d{4}-\d{2}-\d{2}\.xlsx$/)
  expect(lignes[0]).toEqual(['Magasin', 'Code', 'Ville', 'Département', 'Statut', 'Type', 'Coach', 'Responsable Régional', 'Franchisé', 'Ouverture', 'Alertes'])
  expect(lignes).toHaveLength(n + 1)
  expect(lignes.slice(1).every((l) => l[5] === 'Intégré')).toBe(true)
  expect(JSON.stringify(lignes)).not.toMatch(/@|0[67]\d{8}/)
})

test('Visites : l’historique affiché part en Excel', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/visites?vue=historique')
  const { lignes } = await exporter(page)
  expect(lignes[0]).toEqual(['Date', 'Magasin', 'Type', 'Visité par', 'État', 'Tâches au plan', 'Notes'])
  expect(lignes.some((l) => l[1] === 'Lyon Test' && l[4] === 'Faite')).toBe(true)
})

test('Santé du parc : les magasins à évaluer partent avec leurs notes', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/plus/sante?vue=evaluer')
  await expect(page.getByRole('tab', { name: 'Évaluer', selected: true })).toBeVisible()
  const { nom, lignes } = await exporter(page)
  // Nom de fichier sans accent : certains navigateurs le remplacent sinon par « download »
  expect(nom).toMatch(/^Sante du parc \d{4}-\d{2}-\d{2}\.xlsx$/)
  expect(lignes[0][0]).toBe('Magasin')
  expect(lignes.length).toBeGreaterThan(1)
})

test('un Coach n’a pas d’export', async ({ page }) => {
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Inès EXEMPLE' } })
  await page.goto('./#/visites?vue=historique')
  await expect(page.getByRole('region', { name: 'Visites' }).or(page.getByText('Aucune visite'))).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exporter' })).toHaveCount(0)
})
