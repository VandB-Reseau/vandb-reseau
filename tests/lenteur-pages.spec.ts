import { expect, test } from '@playwright/test'
import { COMPTE, seConnecter, simulerSupabase, type RapportSimule } from './supabase-simule'
import { magasinsFictifs } from './donnees-fictives'

// Lenteur de chaque page (Joseph, 24/11/2026) : l'ouverture lisait les chiffres de la caisse page après page, et les
// courbes des rapports de Pilotage parcouraient toutes les visites pour chaque magasin et chaque mois.

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

// 2 500 lignes de caisse fictives : trois pages de 1 000 lignes
const mois = Array.from({ length: 84 }, (_x, i) => `${2020 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`)
const caisse = magasinsFictifs.flatMap((m) => mois.map((x) => ({ store_name: m.n, month: `${x}-01`, ca_ext: 0, pm_cave: 40, flux_cave: 1750, pm_bar: 12, flux_bar: 2500, ca_cave: 70000, ca_bar: 30000, freq: 4250, panier: 23.5, marge: 42, updated_at: '2026-10-05T08:00:00Z' })))

test('ouverture : les pages des chiffres de la caisse partent ensemble, toutes lues', async ({ page }) => {
  expect(caisse.length).toBeGreaterThan(2000)
  await simulerSupabase(page, { chiffresCaisse: caisse })
  // La base répond en 300 ms : lues l'une après l'autre, les pages suivantes partiraient à 300 ms d'écart
  const envois: { offset: number; le: number; compte: boolean }[] = []
  await page.route('https://supabase.test/rest/v1/rpc/chiffres_mensuels**', async (route) => {
    const u = new URL(route.request().url())
    envois.push({ offset: Number(u.searchParams.get('offset') ?? 0), le: Date.now(), compte: /count=exact/.test(route.request().headers()['prefer'] ?? '') })
    await new Promise((f) => setTimeout(f, 300))
    await route.fallback()
  })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1, name: /^Accueil$|Bonjour|Bonsoir/ }).waitFor()
  await expect.poll(() => envois.length).toBe(3)
  expect(envois.map((e) => e.offset).sort((a, b) => a - b)).toEqual([0, 1000, 2000])
  // La première page demande le nombre de lignes, les deux suivantes partent ensemble
  expect(envois.find((e) => e.offset === 0)?.compte).toBe(true)
  const suites = envois.filter((e) => e.offset > 0)
  expect(Math.abs(suites[0].le - suites[1].le)).toBeLessThan(200)
  // Les chiffres de la dernière page sont bien lus : CA d'octobre 2026 de Lyon (dernier mois, dernière page)
  await page.goto(`./#/magasins/${encodeURIComponent('Lyon Test')}`)
  await expect(page.getByRole('heading', { level: 1, name: /Lyon Test/ })).toBeVisible()
  await page.goto('./#/performance')
  await expect(page.getByRole('main')).toContainText('Lyon Test')
})

test('Pilotage : visites faites et jours depuis la dernière visite, magasin par magasin', async ({ page, isMobile }) => {
  const rapports: RapportSimule[] = [{ id: 9, titre: 'Visites du réseau', definition: { indicateurs: ['visites', 'joursSansVisite'], lignes: 'magasin', periode: { type: 'cumul' } }, modele: false, partage: false, auteur: 'Joseph', role: 'directeur', moi: true }]
  await seConnecter(page, { rapports })
  await page.goto('./#/pilotage')
  await expect(page.getByRole('heading', { level: 1, name: 'Pilotage' })).toBeVisible()
  if (isMobile) {
    await page.getByRole('combobox', { name: 'Rapport' }).click()
    await page.getByRole('option', { name: 'Visites du réseau', exact: true }).click()
  } else await page.getByText('Visites du réseau').first().click()
  await expect(page.getByRole('heading', { level: 2, name: 'Visites du réseau' })).toBeVisible()
  // Depuis janvier, jusqu'au dernier mois clos (septembre) : Brest et Nantes vus une fois, un appel ne compte pas (Agen) ;
  // Lyon vu le 2 octobre (25 jours avant le 27/10), Brest le 20 septembre (37 jours)
  await expect(page.getByText('Visites faites : 2.')).toBeVisible()
  const ligne = (nom: string) => page.getByRole('table', { name: 'Tableau du rapport' }).getByRole('row').filter({ hasText: nom })
  await expect(ligne('Brest Test')).toContainText('37 j')
  await expect(ligne('Lyon Test')).toContainText('25 j')
  await expect(ligne('Nantes Test')).toContainText('231 j')
  await expect(ligne('Agen Test').getByRole('cell').nth(1)).toHaveText('0')
})
