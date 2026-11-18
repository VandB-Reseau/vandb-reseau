import { expect, test } from '@playwright/test'
import { seConnecter, simulerSupabase, COMPTE, textesTropPetits, type Ecriture } from './supabase-simule'
import { zonesTropPetites } from './pilotage/supabase-simule'

// Joseph (18/11/2026) : les points d'une campagne deviennent des tâches du magasin, comme le plan Marché extérieur
const NOM = 'Annecy Test'
const campagnes = () => ({
  liste: [
    { id: 'c1', nom: 'Noël 2026', debut: '2026-10-01', fin: '2026-11-30', points: [{ id: 'p1', libelle: 'Vitrine posée' }, { id: 'p2', libelle: 'PLV en place' }], perimetre: 'choix', magasins: [NOM] },
    // Terminée depuis plus de 30 jours : plus de tâche
    { id: 'c0', nom: 'Rentrée 2026', debut: '2026-08-15', fin: '2026-09-15', points: [{ id: 'p1', libelle: 'Offre rentrée affichée' }], perimetre: 'choix', magasins: [NOM] },
  ],
  constats: { c1: { [NOM]: { p2: { fait: true, date: '2026-10-20', par: 'Camille TESTARD' } } } },
})
const derniereValeur = (ecritures: Ecriture[]) => {
  const e = ecritures.filter((x) => x.table === 'app_config' && ((x.corps as { key?: string }).key === 'campagnes' || x.filtre.includes('key=eq.campagnes'))).at(-1)
  return e ? JSON.parse((e.corps as { value: string }).value) : null
}

test('équipe : les points d’une campagne sont des tâches du magasin, « Fait » constate le point', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { config: { campagnes: campagnes() }, ecritures, persister: true })
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=actions`)
  const ligne = page.getByRole('listitem').filter({ hasText: 'Vitrine posée' }).first()
  await expect(ligne).toBeVisible()
  await expect(ligne.getByText('Campagne : Noël 2026')).toBeVisible()
  await expect(ligne.getByText(/campagne du 1 oct\. 2026 au 30 nov\. 2026/)).toBeVisible()
  await expect(page.getByText('Offre rentrée affichée')).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.getByRole('button', { name: 'Marquer faite : Vitrine posée' }).click()
  await expect.poll(() => derniereValeur(ecritures)?.constats?.c1?.[NOM]?.p1?.fait).toBe(true)
  expect(derniereValeur(ecritures).constats.c1[NOM].p2).toMatchObject({ fait: true, par: 'Camille TESTARD' })
  // Rouvrir : le point redevient à constater dans la campagne
  await page.getByRole('button', { name: 'Faites' }).first().click().catch(() => {})
  await page.getByRole('button', { name: 'Remettre en cours : Vitrine posée' }).click()
  await expect.poll(() => derniereValeur(ecritures)?.constats?.c1?.[NOM]?.p1).toBeUndefined()
})

test('franchisé : il voit les tâches de campagne de son magasin et marque un point fait', async ({ page }) => {
  await simulerSupabase(page, { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: [NOM] }, espace: { campagnes: campagnes() }, persister: true })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}`)
  await page.getByRole('tab', { name: 'Tâches' }).click()
  await expect(page.getByRole('region', { name: 'Mes tâches' }).getByText(/Campagne : Noël 2026/)).toBeVisible()
  // Sa liste Tâches : la puce et le bouton « Fait »
  await page.goto('./#/taches')
  const ligne = page.getByRole('listitem').filter({ hasText: 'Vitrine posée' }).first()
  await expect(ligne.getByText('Campagne : Noël 2026')).toBeVisible()
  await page.getByRole('button', { name: 'Marquer faite : Vitrine posée' }).click()
  await expect(page.getByRole('button', { name: 'Marquer faite : Vitrine posée' })).toHaveCount(0)
  await page.reload()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  await expect(page.getByRole('button', { name: 'Marquer faite : PLV en place' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Marquer faite : Vitrine posée' })).toHaveCount(0)
  await expect(page.getByText(/faite le .* par Paul MULTI/).first()).toBeAttached()
  expect(await textesTropPetits(page)).toEqual([])
})
