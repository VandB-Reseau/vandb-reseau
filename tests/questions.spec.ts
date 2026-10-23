import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture, type QuestionsSimulees } from './supabase-simule'

// Sprint 22, A3 : questions éclair aux franchisés, posées dans Infos réseau, répondues depuis l'accueil
test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const jour = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const questions = (): QuestionsSimulees => ({
  resultats: [
    { id: 1, titre: 'Êtes-vous satisfait de l’accompagnement ?', genre: 'note', choix: [], anonyme: true, magasins: null, jusqu_au: jour(5), auteur: 'autre', auteur_nom: 'Dominique DIRECTION', cree_le: `${jour(-2)}T09:00:00Z`,
      reponses: [{ valeur: '4', franchise: null, regions: ['rr1'] }, { valeur: '5', franchise: null, regions: ['rr1'] }, { valeur: '2', franchise: null, regions: ['rr2'] }],
      sans_reponse: ['Franchisé 2', 'Franchisé 4'], concernes: 5 },
    { id: 2, titre: 'Quelle date pour la réunion ?', genre: 'choix', choix: ['Lundi', 'Mardi'], anonyme: false, magasins: ['Lyon Test'], jusqu_au: jour(-1), auteur: 'autre', auteur_nom: 'Alex NORD', cree_le: `${jour(-9)}T09:00:00Z`,
      reponses: [{ valeur: 'Mardi', franchise: 'Paul MULTI', regions: ['rr1'] }], sans_reponse: [], concernes: 1 },
  ],
  franchise: [
    { id: 1, titre: 'Êtes-vous satisfait de l’accompagnement ?', genre: 'note', choix: [], anonyme: true, jusqu_au: jour(5), auteur_nom: 'Dominique DIRECTION', repondu: false },
    { id: 3, titre: 'Avez-vous reçu la PLV ?', genre: 'oui_non', choix: [], anonyme: false, jusqu_au: jour(3), auteur_nom: 'Alex NORD', repondu: true },
  ],
})

async function ouvrirQuestions(page: import('@playwright/test').Page, isMobile: boolean) {
  await page.goto('./#/infos')
  if (isMobile) await page.getByRole('tab', { name: 'Questions' }).click()
  return page.getByRole('region', { name: 'Questions éclair' })
}

test('le Directeur lit les résultats, par région et sans nom pour une question anonyme', async ({ page, isMobile }, info) => {
  await seConnecter(page, { questions: questions() })
  const section = await ouvrirQuestions(page, isMobile)
  const note = section.getByRole('article', { name: 'Êtes-vous satisfait de l’accompagnement ?' })
  await expect(note).toContainText('3 réponses sur 5')
  await expect(note).toContainText('anonyme')
  await expect(note).toContainText('Moyenne 3,7 sur 5')
  await expect(note).toContainText('Région Alex NORD : moyenne 4,5 (2 réponses)')
  await expect(note.getByRole('button', { name: 'Qui a répondu quoi' })).toHaveCount(0)
  await note.getByRole('button', { name: 'Sans réponse (2)' }).click()
  await expect(note).toContainText('Franchisé 2, Franchisé 4')
  const choix = section.getByRole('article', { name: 'Quelle date pour la réunion ?' })
  await expect(choix).toContainText('close')
  await choix.getByRole('button', { name: 'Qui a répondu quoi' }).click()
  await expect(choix).toContainText('Paul MULTI : Mardi')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-questions-resultats.png`, fullPage: !isMobile })
})

test('le Directeur pose une question à choix, anonyme, à une région', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { questions: questions(), ecritures })
  const section = await ouvrirQuestions(page, isMobile)
  await section.getByRole('button', { name: 'Poser une question' }).click()
  const d = page.getByRole('dialog', { name: 'Poser une question' })
  await d.getByLabel('Question').fill('Quel thème pour la prochaine formation ?')
  await d.getByRole('group', { name: 'Type de réponse' }).getByRole('button', { name: 'Choix' }).click()
  await d.getByLabel('Réponses possibles, une par ligne').fill('Vente additionnelle\nDégustation\nBar')
  await d.getByRole('group', { name: 'Réponses' }).getByRole('button', { name: 'Anonymes' }).click()
  await d.getByRole('group', { name: 'Franchisés interrogés' }).getByRole('button', { name: 'Région Alex NORD' }).click()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const corps = ecritures.find((e) => e.table === 'rpc/publier_question')!.corps as Record<string, unknown>
  expect(corps).toMatchObject({ p_titre: 'Quel thème pour la prochaine formation ?', p_genre: 'choix', p_choix: ['Vente additionnelle', 'Dégustation', 'Bar'], p_anonyme: true, p_jusqu_au: jour(7) })
  expect((corps.p_magasins as string[]).length).toBeGreaterThan(0)
  await expect(section.getByRole('article', { name: 'Quel thème pour la prochaine formation ?' })).toBeVisible()
})

test('le Coach ne voit pas les questions', async ({ page }) => {
  await seConnecter(page, { questions: questions(), appMetadata: { role: 'coach', coach: 'Noé MODELE' } })
  await page.goto('./#/infos')
  await expect(page.getByRole('heading', { name: 'Infos réseau', level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Questions éclair' })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Questions' })).toHaveCount(0)
})

test('le franchisé répond d’un geste depuis son accueil', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { questions: questions(), ecritures, acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] } })
  const section = page.getByRole('region', { name: 'Questions du réseau' })
  await expect(section).toContainText('Réponse envoyée, merci.')
  const notes = section.getByRole('group', { name: 'Répondre : Êtes-vous satisfait de l’accompagnement ?' })
  await expect(notes.getByRole('button')).toHaveText(['1', '2', '3', '4', '5'])
  expect((await notes.getByRole('button', { name: '4' }).boundingBox())!.height).toBeGreaterThanOrEqual(48)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-franchise-questions.png`, fullPage: !isMobile })
  await notes.getByRole('button', { name: '4' }).click()
  await expect(notes).toHaveCount(0)
  expect(ecritures.filter((e) => e.table === 'rpc/repondre_question').map((e) => e.corps)).toEqual([{ p_id: 1, p_valeur: '4' }])
})
