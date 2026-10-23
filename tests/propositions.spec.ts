import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture, type PropositionsSimulees } from './supabase-simule'

// Sprint 22, A4 : le franchisé propose une bonne pratique, l'équipe la relit et la publie avec le nom du magasin
test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const propositions = (): PropositionsSimulees => ({
  equipe: [{ id: 7, franchise: 'Paul MULTI', magasin: 'Annecy Test', titre: 'Dégustation du samedi', texte: 'Trois vins ouverts chaque samedi, servis par l’équipe.', propose_le: '2026-10-20T09:00:00Z' }],
  miennes: [
    { id: 2, magasin: 'Annecy Test', titre: 'Vitrine des fêtes', texte: '', propose_le: '2026-10-01T09:00:00Z', statut: 'publiee' },
    { id: 1, magasin: 'Annecy Test', titre: 'Carte fidélité', texte: '', propose_le: '2026-09-01T09:00:00Z', statut: 'refusee' },
  ],
})

async function ouvrirPratiques(page: import('@playwright/test').Page, isMobile: boolean) {
  await page.goto('./#/infos')
  if (isMobile) await page.getByRole('tab', { name: 'Bonnes pratiques' }).click()
  return page.getByRole('region', { name: 'Propositions des franchisés' })
}

test('le Coach relit une proposition et la publie au nom du franchisé', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, propositions: propositions() })
  const section = await ouvrirPratiques(page, isMobile)
  await expect(section).toContainText('Annecy Test · Paul MULTI')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-propositions-a-relire.png`, fullPage: !isMobile })
  await section.getByRole('button', { name: 'Relire et publier : Dégustation du samedi' }).click()
  const d = page.getByRole('dialog', { name: 'Relire et publier' })
  await expect(d.getByLabel('Titre')).toHaveValue('Dégustation du samedi')
  await expect(d.getByRole('combobox', { name: 'Magasin' })).toHaveValue('Annecy Test')
  await expect(d.getByRole('combobox', { name: 'Remontée par' })).toHaveValue('Paul MULTI')
  await d.getByLabel('Titre').fill('Dégustation du samedi matin')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const traite = ecritures.find((e) => e.table === 'rpc/traiter_proposition')!.corps as Record<string, unknown>
  expect(traite).toMatchObject({ p_id: 7, p_statut: 'publiee' })
  expect(String(traite.p_pratique)).toMatch(/^bp/)
  await expect(page.getByRole('region', { name: 'Propositions des franchisés' })).toHaveCount(0)
})

test('le Coach ne retient pas une proposition', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, propositions: propositions(), appMetadata: { role: 'coach', coach: 'Noé MODELE' } })
  const section = await ouvrirPratiques(page, isMobile)
  await section.getByRole('button', { name: 'Ne pas retenir : Dégustation du samedi' }).click()
  await expect(page.getByText('Proposition non retenue.')).toBeVisible()
  expect(ecritures.filter((e) => e.table === 'rpc/traiter_proposition').map((e) => e.corps)).toEqual([{ p_id: 7, p_statut: 'refusee' }])
})

test('le franchisé propose une bonne pratique et suit ses propositions', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, propositions: propositions(), acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] } })
  await page.goto('./#/bonnes-pratiques')
  const section = page.getByRole('region', { name: 'Mes propositions' })
  await expect(section.getByRole('listitem').filter({ hasText: 'Vitrine des fêtes' })).toContainText('Publiée')
  await expect(section.getByRole('listitem').filter({ hasText: 'Carte fidélité' })).toContainText('Non retenue')
  await section.getByRole('button', { name: 'Proposer une bonne pratique' }).click()
  const d = page.getByRole('dialog', { name: 'Proposer une bonne pratique' })
  await d.getByLabel('Titre').fill('Accords mets et vins le vendredi')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  await expect(page.getByText('Proposition envoyée à ton Coach.')).toBeVisible()
  expect(ecritures.filter((e) => e.table === 'rpc/proposer_pratique').map((e) => e.corps)).toEqual([{ p_magasin: 'Annecy Test', p_titre: 'Accords mets et vins le vendredi', p_texte: '' }])
  await expect(section.getByRole('listitem').filter({ hasText: 'Accords mets et vins le vendredi' })).toContainText('En relecture')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-franchise-propositions.png`, fullPage: !isMobile })
})
