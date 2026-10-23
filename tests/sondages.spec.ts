import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture, type QuestionsSimulees } from './supabase-simule'

// Sondages (sprint 22, A3, puis 23/10/2026) : 1 à 5 questions posées dans Infos réseau aux franchisés, à l'équipe ou aux deux
test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const jour = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const sondages = (): QuestionsSimulees => ({
  resultats: [
    { id: 1, titre: 'Êtes-vous satisfait de l’accompagnement ?', genre: 'note', choix: [], anonyme: true, magasins: null, jusqu_au: jour(5), auteur: 'autre', auteur_nom: 'Dominique DIRECTION', cree_le: `${jour(-2)}T09:00:00Z`,
      reponses: [{ valeur: '4', franchise: null, regions: ['rr1'] }, { valeur: '5', franchise: null, regions: ['rr1'] }, { valeur: '2', franchise: null, regions: ['rr2'] }],
      sans_reponse: ['Franchisé 2', 'Franchisé 4'], concernes: 5 },
    { id: 2, titre: 'Point formation', cible: 'tous', anonyme: false, magasins: ['Lyon Test'], jusqu_au: jour(-1), auteur: 'autre', auteur_nom: 'Alex NORD', cree_le: `${jour(-9)}T09:00:00Z`,
      questions: [{ titre: 'Quelle date ?', genre: 'choix', choix: ['Lundi', 'Mardi'] }, { titre: 'Utile ?', genre: 'oui_non', choix: [] }],
      reponses: [{ valeurs: ['Mardi', 'oui'], role: 'franchise', franchise: 'Paul MULTI', regions: ['rr1'] }, { valeurs: ['Lundi', 'oui'], role: 'coach', franchise: 'Noé MODELE', regions: ['rr1'] }],
      sans_reponse: [], concernes: 2 },
  ],
  franchise: [
    { id: 1, titre: 'Êtes-vous satisfait de l’accompagnement ?', genre: 'note', choix: [], anonyme: true, jusqu_au: jour(5), auteur_nom: 'Dominique DIRECTION', repondu: false },
    { id: 3, titre: 'Avez-vous reçu la PLV ?', genre: 'oui_non', choix: [], anonyme: false, jusqu_au: jour(3), auteur_nom: 'Alex NORD', repondu: true },
  ],
  equipe: [
    { id: 4, titre: 'Point Coachs', anonyme: false, jusqu_au: jour(4), auteur_nom: 'Dominique DIRECTION', repondu: false,
      questions: [{ titre: 'Charge de travail', genre: 'note', choix: [] }, { titre: 'Format de la réunion', genre: 'choix', choix: ['Salle', 'Visio'] }, { titre: 'Besoin d’aide ?', genre: 'oui_non', choix: [] }] },
  ],
})

async function ouvrirSondages(page: import('@playwright/test').Page, isMobile: boolean) {
  await page.goto('./#/infos')
  if (isMobile) await page.getByRole('tab', { name: 'Sondages' }).click()
  return page.getByRole('region', { name: 'Sondages posés' })
}

test('le Directeur lit les résultats question par question, par région et sans nom pour un sondage anonyme', async ({ page, isMobile }, info) => {
  await seConnecter(page, { questions: sondages() })
  const section = await ouvrirSondages(page, isMobile)
  const note = section.getByRole('article', { name: 'Êtes-vous satisfait de l’accompagnement ?' })
  await expect(note).toContainText('3 réponses sur 5')
  await expect(note).toContainText('anonyme')
  await expect(note).toContainText('Moyenne 3,7 sur 5')
  await expect(note).toContainText('Région Alex NORD : moyenne 4,5 (2 réponses)')
  await expect(note.getByRole('button', { name: 'Qui a répondu quoi' })).toHaveCount(0)
  await note.getByRole('button', { name: 'Sans réponse (2)' }).click()
  await expect(note).toContainText('Franchisé 2, Franchisé 4')
  const point = section.getByRole('article', { name: 'Point formation' })
  await expect(point).toContainText('clos')
  await expect(point).toContainText('dont 1 de l’équipe')
  await expect(point).toContainText('1. Quelle date ?')
  await expect(point).toContainText('2. Utile ?')
  await point.getByRole('button', { name: 'Qui a répondu quoi' }).click()
  await expect(point).toContainText('Paul MULTI : Mardi, Oui · Noé MODELE : Lundi, Oui')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-sondages-resultats.png`, fullPage: !isMobile })
})

test('le Directeur pose un sondage de trois questions à l’équipe, anonyme, sur une région', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { questions: sondages(), ecritures })
  const section = await ouvrirSondages(page, isMobile)
  await section.getByRole('button', { name: 'Nouveau sondage' }).click()
  const d = page.getByRole('dialog', { name: 'Nouveau sondage' })
  await d.getByLabel('Question', { exact: true }).fill('Charge de travail')
  await d.getByRole('group', { name: 'Type de réponse, question' }).getByRole('button', { name: 'Note de 1 à 5' }).click()
  await d.getByRole('button', { name: 'Ajouter une question' }).click()
  await d.getByLabel('Question 2', { exact: true }).fill('Format de la réunion')
  await d.getByRole('group', { name: 'Type de réponse, question 2' }).getByRole('button', { name: 'Choix' }).click()
  await d.getByLabel('Réponses possibles, une par ligne (question 2)').fill('Salle\nVisio')
  await d.getByRole('button', { name: 'Ajouter une question' }).click()
  await d.getByLabel('Question 3', { exact: true }).fill('Besoin d’aide ?')
  await expect(d.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await d.getByLabel('Titre du sondage').fill('Point Coachs')
  await d.getByRole('group', { name: 'Destinataires' }).getByRole('button', { name: 'Coachs et RR' }).click()
  await d.getByRole('group', { name: 'Réponses' }).getByRole('button', { name: 'Anonymes' }).click()
  await d.getByRole('group', { name: 'Magasins concernés' }).getByRole('button', { name: 'Région Alex NORD' }).click()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-sondage-nouveau.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const corps = ecritures.find((e) => e.table === 'rpc/publier_sondage')!.corps as Record<string, unknown>
  expect(corps).toMatchObject({ p_titre: 'Point Coachs', p_cible: 'equipe', p_anonyme: true, p_jusqu_au: jour(7), p_questions: [
    { titre: 'Charge de travail', genre: 'note', choix: [] }, { titre: 'Format de la réunion', genre: 'choix', choix: ['Salle', 'Visio'] }, { titre: 'Besoin d’aide ?', genre: 'oui_non', choix: [] },
  ] })
  expect((corps.p_magasins as string[]).length).toBeGreaterThan(0)
  await expect(section.getByRole('article', { name: 'Point Coachs' })).toBeVisible()
})

test('un sondage d’une question garde son intitulé pour titre et part aux franchisés', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { questions: sondages(), ecritures })
  const section = await ouvrirSondages(page, isMobile)
  await section.getByRole('button', { name: 'Nouveau sondage' }).click()
  const d = page.getByRole('dialog', { name: 'Nouveau sondage' })
  await expect(d.getByLabel('Titre du sondage')).toHaveCount(0)
  await d.getByLabel('Question', { exact: true }).fill('Avez-vous reçu la PLV ?')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  expect(ecritures.find((e) => e.table === 'rpc/publier_sondage')!.corps).toMatchObject({ p_titre: 'Avez-vous reçu la PLV ?', p_cible: 'franchises', p_magasins: null, p_questions: [{ titre: 'Avez-vous reçu la PLV ?', genre: 'oui_non', choix: [] }] })
})

test('le Coach remplit un sondage depuis son accueil, sans voir les résultats', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { questions: sondages(), ecritures, appMetadata: { role: 'coach', coach: 'Noé MODELE' } })
  const section = page.getByRole('region', { name: 'Sondages à remplir' })
  const sondage = section.getByRole('listitem', { name: 'Point Coachs' })
  await expect(sondage).toContainText('1. Charge de travail')
  const envoyer = sondage.getByRole('button', { name: 'Envoyer mes réponses' })
  await expect(envoyer).toBeDisabled()
  await sondage.getByRole('group', { name: 'Répondre : Charge de travail' }).getByRole('button', { name: '4' }).click()
  await sondage.getByRole('group', { name: 'Répondre : Format de la réunion' }).getByRole('button', { name: 'Visio' }).click()
  await expect(sondage.getByRole('group', { name: 'Répondre : Format de la réunion' }).getByRole('button', { name: 'Visio' })).toHaveAttribute('aria-pressed', 'true')
  await sondage.getByRole('group', { name: 'Répondre : Besoin d’aide ?' }).getByRole('button', { name: 'Non' }).click()
  await expect(sondage.getByRole('group', { name: 'Répondre : Charge de travail' }).getByRole('button', { name: '4' })).toHaveAttribute('aria-pressed', 'true')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-sondage-coach.png`, fullPage: !isMobile })
  await envoyer.click()
  await expect(sondage).toContainText('Réponse envoyée, merci.')
  expect(ecritures.filter((e) => e.table === 'rpc/repondre_sondage').map((e) => e.corps)).toEqual([{ p_id: 4, p_valeurs: ['4', 'Visio', 'non'] }])
  await page.goto('./#/infos')
  if (isMobile) await page.getByRole('tab', { name: 'Sondages' }).click()
  await expect(page.getByRole('region', { name: 'Sondages à remplir' })).toContainText('Réponse envoyée, merci.')
  await expect(page.getByRole('region', { name: 'Sondages posés' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Nouveau sondage' })).toHaveCount(0)
})

test('l’accueil de l’équipe ne montre que les sondages pas encore remplis', async ({ page }) => {
  const q = sondages()
  q.equipe![0].repondu = true
  await seConnecter(page, { questions: q, appMetadata: { role: 'coach', coach: 'Noé MODELE' } })
  await expect(page.getByRole('heading', { name: 'Accueil', level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Sondages à remplir' })).toHaveCount(0)
})

test('le franchisé répond d’un geste depuis son accueil', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { questions: sondages(), ecritures, acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] } })
  const section = page.getByRole('region', { name: 'Sondages du réseau' })
  await expect(section).toContainText('Réponse envoyée, merci.')
  const notes = section.getByRole('group', { name: 'Répondre : Êtes-vous satisfait de l’accompagnement ?' })
  await expect(notes.getByRole('button')).toHaveText(['1', '2', '3', '4', '5'])
  expect((await notes.getByRole('button', { name: '4' }).boundingBox())!.height).toBeGreaterThanOrEqual(48)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-franchise-sondages.png`, fullPage: !isMobile })
  await notes.getByRole('button', { name: '4' }).click()
  await expect(notes).toHaveCount(0)
  expect(ecritures.filter((e) => e.table === 'rpc/repondre_sondage').map((e) => e.corps)).toEqual([{ p_id: 1, p_valeurs: ['4'] }])
})
