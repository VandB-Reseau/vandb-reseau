import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

// Fil d'actualité de l'accueil (Joseph, 22/10/2026) : communications, comptes rendus de visite et bonnes pratiques,
// plus de messages, tâches ni chiffres ; « J'aime » et commentaires sur les comptes rendus, pour l'équipe et le franchisé

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const PAUL = { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] }
const espace = {
  visites: [
    { id: 50, store: 'Annecy Test', visit_date: '2026-09-15', type: 'terrain', visitor: 'Hugo FICTIF', signed_required: false, docs: [], notes: 'Vitrine propre, bon mois.', sections: [], action_plan: [] },
    { id: 52, store: 'Annecy Test', visit_date: '2026-09-20', type: 'appel', visitor: 'Hugo FICTIF', signed_required: false, docs: [], notes: 'Appel de suivi.', sections: [], action_plan: [] },
  ],
}

test('l’équipe : le fil ne garde que les comptes rendus, les bonnes pratiques et les communications', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, reactionsVisites: { pouces: {}, commentaires: {} } })
  const fil = page.getByRole('region', { name: 'Actualités' })
  const compteRendu = fil.getByRole('article', { name: /^Compte rendu de / }).first()
  await expect(compteRendu).toBeVisible()
  // Plus de messages, tâches ni chiffres
  await expect(fil.getByRole('group', { name: 'Filtrer le fil' }).getByRole('button', { name: /^(Messages|Tâches|Chiffres)$/ })).toHaveCount(0)
  await expect(fil.getByText(/^chiffres de /i)).toHaveCount(0)
  await expect(fil.getByText(/tâche faite|nouvelle tâche/)).toHaveCount(0)
  // J'aime et commentaire sur le compte rendu
  await compteRendu.getByRole('button', { name: 'J’aime' }).click()
  await expect(compteRendu.getByRole('button', { name: 'J’aime · 1' })).toHaveAttribute('aria-pressed', 'true')
  expect(ecritures.some((e) => e.table === 'rpc/basculer_pouce_visite' && typeof (e.corps as { p_id: unknown }).p_id === 'number')).toBe(true)
  await compteRendu.getByRole('button', { name: 'Commenter' }).click()
  await compteRendu.getByRole('textbox', { name: /^Commentaire sur le compte rendu de / }).fill('Belle visite, merci.')
  await compteRendu.getByRole('button', { name: 'Envoyer le commentaire' }).click()
  await expect(compteRendu.getByRole('list', { name: 'Commentaires' })).toContainText('Belle visite, merci.')
  expect(ecritures.find((e) => e.table === 'rpc/commenter_visite')!.corps).toMatchObject({ p_texte: 'Belle visite, merci.' })
  expect(await textesTropPetits(page)).toEqual([])
  await compteRendu.screenshot({ path: `captures/${info.project.name}-fil-compte-rendu.png` })
})

test('le franchisé aime et commente le compte rendu de son Coach ; pas les appels', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { acces: PAUL, espace, ecritures, reactionsVisites: { pouces: { 50: [{ user_id: 'autre', nom: 'Hugo FICTIF' }] }, commentaires: {} } })
  const fil = page.getByRole('region', { name: 'Actualités' })
  const compteRendu = fil.getByRole('article', { name: 'Compte rendu de Annecy Test' })
  await expect(compteRendu).toHaveCount(1)
  await expect(compteRendu).toContainText('Vitrine propre, bon mois.')
  await expect(fil.getByText('Appel de suivi.')).toHaveCount(0)
  await compteRendu.getByRole('button', { name: 'J’aime · 1' }).click()
  await expect(compteRendu.getByRole('button', { name: 'J’aime · 2' })).toBeVisible()
  expect(ecritures.find((e) => e.table === 'rpc/basculer_pouce_visite')!.corps).toEqual({ p_id: 50 })
  await compteRendu.getByRole('button', { name: 'Commenter' }).click()
  await compteRendu.getByRole('textbox', { name: 'Commentaire sur le compte rendu de Annecy Test' }).fill('Merci Hugo, on lance la dégustation.')
  await compteRendu.getByRole('button', { name: 'Envoyer le commentaire' }).click()
  await expect(compteRendu.getByRole('list', { name: 'Commentaires' })).toContainText('Merci Hugo')
  expect(ecritures.find((e) => e.table === 'rpc/commenter_visite')!.corps).toEqual({ p_id: 50, p_texte: 'Merci Hugo, on lance la dégustation.' })
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fil-franchise-compte-rendu.png` })
})

test('migration pas encore passée : le compte rendu s’affiche sans J’aime ni erreur', async ({ page }) => {
  await seConnecter(page)
  const compteRendu = page.getByRole('region', { name: 'Actualités' }).getByText(/visite terrain/).first()
  await expect(compteRendu).toBeVisible()
  await expect(page.getByRole('article', { name: /^Compte rendu de / })).toHaveCount(0)
})
