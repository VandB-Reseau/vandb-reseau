import { expect, test } from '@playwright/test'
import { seConnecter, type Ecriture } from './supabase-simule'

// L7 (Joseph, 21/10/2026) : fiches des personnes dans leur propre table (0015), seules les fiches modifiées réécrites ;
// tant que 0015 n'est pas passée, l'app lit et écrit encore la clé d'app_config

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

async function modifierEmailRR(page: import('@playwright/test').Page) {
  await page.goto('./#/equipe/rr/rr1')
  await expect(page.getByRole('heading', { level: 1, name: 'Alex NORD' })).toBeVisible()
  await page.getByRole('tab', { name: 'Fiche' }).click()
  await expect(page.getByText(/12 avril 1980 · \d+ ans/)).toBeVisible()
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Modifier Alex NORD' })
  await d.getByLabel('Email').fill('alex.nord@exemple.test')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Alex NORD est mis à jour.')).toBeVisible()
}

test('la fiche est lue et réécrite dans la table des fiches, sans toucher aux autres', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await modifierEmailRR(page)
  const fiches = ecritures.filter((e) => e.table === 'fiches_personnes')
  expect(fiches.length).toBeGreaterThan(0)
  const lignes = fiches.flatMap((e) => [e.corps].flat()) as { cle: string; fiche: { email: string } }[]
  expect(lignes.map((l) => l.cle)).toEqual(['rr:rr1'])
  expect(lignes[0].fiche.email).toBe('alex.nord@exemple.test')
  expect(ecritures.filter((e) => e.table === 'app_config' && e.methode !== 'FICHES' && (e.corps as { key?: string }).key === 'fiches_personnes')).toEqual([])
})

test('base pas encore passée en 0015 : les fiches restent dans app_config', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, fichesEnConfig: true })
  await modifierEmailRR(page)
  expect(ecritures.filter((e) => e.table === 'fiches_personnes' && e.methode !== 'GET')).toEqual([])
  const config = ecritures.filter((e) => e.table === 'app_config' && e.filtre.includes('key=eq.fiches_personnes') && e.methode === 'PATCH').at(-1)
  expect(JSON.parse((config!.corps as { value: string }).value)['rr:rr1']).toMatchObject({ email: 'alex.nord@exemple.test' })
})
