import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type ChallengesSimules, type Ecriture } from './supabase-simule'

// Sprint 22, A6 : challenge du mois, classement par la base ; l'équipe voit ses chiffres, le franchisé son rang et le podium
test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const challenges = (): ChallengesSimules => ({
  equipe: [{ id: 1, titre: 'Challenge du panier bar', indicateur: 'pm_bar', mois: '2026-09-01', magasins: ['Lyon Test', 'Annecy Test', 'Nantes Test', 'Rennes Test'], franchises: true, auteur: 'autre', auteur_nom: 'Dominique DIRECTION',
    classement: [{ magasin: 'Annecy Test', rang: 1, valeur: 12.4 }, { magasin: 'Lyon Test', rang: 2, valeur: null }, { magasin: 'Nantes Test', rang: 3, valeur: -2.5 }] }],
  franchise: [{ id: 1, titre: 'Challenge du panier bar', indicateur: 'pm_bar', mois: '2026-09-01', participants: 4, classes: 3,
    podium: [{ magasin: 'Annecy Test', rang: 1 }, { magasin: 'Lyon Test', rang: 2 }, { magasin: 'Nantes Test', rang: 3 }], mes_rangs: [{ magasin: 'Nantes Test', rang: 3 }] }],
})

test('l’équipe lit le classement, sans le chiffre d’un magasin qu’elle ne suit pas', async ({ page, isMobile }, info) => {
  await seConnecter(page, { challenges: challenges() })
  await page.goto('./#/plus/sante?vue=challenges')
  const carte = page.getByRole('article', { name: 'Challenge du panier bar' })
  await expect(carte).toContainText('Progression du panier moyen bar · septembre 2026 · 3 classés sur 4')
  const lignes = carte.getByRole('list', { name: 'Classement : Challenge du panier bar' }).getByRole('listitem')
  await expect(lignes).toHaveText(['1erAnnecy Test+12,4 %', '2eLyon Test—', '3eNantes Test-2,5 %'])
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-challenges.png`, fullPage: !isMobile })
})

test('le Directeur lance un challenge sur une région, rang caché aux franchisés', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { challenges: challenges(), ecritures })
  await page.goto('./#/plus/sante?vue=challenges')
  await page.getByRole('button', { name: 'Lancer un challenge' }).first().click()
  const d = page.getByRole('dialog', { name: 'Lancer un challenge' })
  await d.getByLabel('Titre').fill('Challenge CA de novembre')
  await d.getByRole('group', { name: 'Indicateur' }).getByRole('button', { name: 'Progression du CA' }).click()
  await d.getByRole('group', { name: 'Magasins en compétition' }).getByRole('button', { name: 'Région Alex NORD' }).click()
  await d.getByRole('group', { name: 'Rang montré aux franchisés' }).getByRole('button', { name: 'Équipe seulement' }).click()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const corps = ecritures.find((e) => e.table === 'rpc/creer_challenge')!.corps as Record<string, unknown>
  expect(corps).toMatchObject({ p_titre: 'Challenge CA de novembre', p_indicateur: 'ca', p_franchises: false })
  expect(String(corps.p_mois)).toMatch(/^\d{4}-\d{2}-01$/)
  expect((corps.p_magasins as string[]).length).toBeGreaterThan(1)
  await expect(page.getByRole('article', { name: 'Challenge CA de novembre' })).toContainText('Classement dès que les chiffres du mois sont importés.')
})

test('le Coach lit les challenges sans pouvoir en lancer', async ({ page }) => {
  await seConnecter(page, { challenges: challenges(), appMetadata: { role: 'coach', coach: 'Noé MODELE' } })
  await page.goto('./#/plus/sante?vue=challenges')
  await expect(page.getByRole('article', { name: 'Challenge du panier bar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lancer un challenge' })).toHaveCount(0)
})

test('le franchisé voit son rang et le podium, sans chiffre', async ({ page, isMobile }, info) => {
  await seConnecter(page, { challenges: challenges(), acces: { role: 'franchise', franchise: 'Franchisé 2', magasins: ['Nantes Test'] } })
  const section = page.getByRole('region', { name: 'Challenges du réseau' })
  await expect(section).toContainText('3e sur 3')
  await expect(section).toContainText('Podium : 1er Annecy Test · 2e Lyon Test · 3e Nantes Test')
  await expect(section).not.toContainText('%')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-franchise-challenge.png`, fullPage: !isMobile })
})
