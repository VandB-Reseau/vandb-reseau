import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type MessageSimule } from './supabase-simule'

// Tâches sur la barre commune et rangées par échéance, « Nouveau message », notifications par période (Joseph, 21/10/2026)

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const DIRECTEUR = 'Dominique DIRECTION'
// Jour à midi (heure locale), décalé de n jours
const jour = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(12, 0, 0, 0); return d }
const iso = (n: number) => { const d = jour(n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

test('les tâches sont rangées par échéance, sous la barre de recherche commune', async ({ page, isMobile }, info) => {
  const t = (id: string, action: string, echeance: string) => ({ id, action, porteur: DIRECTEUR, echeance, creeLe: iso(-30) })
  const actions = {
    'Brest Test': [t('a', 'Commander la nouvelle PLV', iso(-3)), t('b', 'Appeler le franchisé', iso(2))],
    'Lyon Test': [t('c', 'Préparer la foire aux vins', iso(30)), t('d', 'Revoir la vitrine', 'novembre'), t('e', 'Partager le bilan', '')],
  }
  await seConnecter(page, { config: { actions } })
  await page.goto('./#/taches')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes tâches')
  const aFaire = page.getByRole('list', { name: 'Tâches à faire' })
  await expect(aFaire.getByRole('heading', { level: 2 })).toHaveText(['En retard', 'Cette semaine', 'Plus tard', 'Sans échéance'])
  await expect(aFaire.getByRole('listitem')).toHaveCount(5)
  await expect(aFaire.getByRole('listitem').first()).toContainText('Commander la nouvelle PLV')
  await expect(aFaire.getByRole('listitem').nth(2)).toContainText('Préparer la foire aux vins')
  await expect(aFaire.getByRole('listitem').nth(3)).toContainText('Revoir la vitrine')
  // Ajouter : libellé sur PC, bouton rond de 48 px sur téléphone
  const ajouter = page.getByRole('button', { name: 'Ajouter une tâche' })
  if (isMobile) {
    await expect(ajouter).toHaveText('')
    const b = (await ajouter.boundingBox())!
    expect(b.height).toBeGreaterThanOrEqual(48)
    // Recherche, Filtres et Ajouter sur une seule ligne
    const r = (await page.getByRole('textbox', { name: 'Rechercher une tâche' }).boundingBox())!
    expect(Math.abs(r.y + r.height / 2 - (b.y + b.height / 2))).toBeLessThanOrEqual(2)
  } else await expect(ajouter).toHaveText('Ajouter une tâche')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-taches-groupes.png`, fullPage: !isMobile })
  // La recherche porte sur la tâche, le magasin et le porteur
  await page.getByRole('textbox', { name: 'Rechercher une tâche' }).fill('lyon')
  await expect(aFaire.getByRole('listitem')).toHaveCount(3)
  await page.getByRole('textbox', { name: 'Rechercher une tâche' }).fill('plv')
  await expect(aFaire.getByRole('listitem')).toHaveCount(1)
  await page.getByRole('textbox', { name: 'Rechercher une tâche' }).fill('introuvable')
  await expect(page.getByText('Aucune tâche ne correspond à la recherche.')).toBeVisible()
})

const AUTRE = '00000000-0000-0000-0000-0000000000aa'
const message = (id: number, texte: string, quand: Date): MessageSimule =>
  ({ id, store: 'Annecy Test', auteur: AUTRE, auteur_nom: 'Paul MULTI', auteur_role: 'franchise', texte, mentions: [], cree_le: quand.toISOString() })

test('« Nouveau message » ouvre la liste des personnes, cherchées par nom ou magasin', async ({ page, isMobile }, info) => {
  await seConnecter(page, { messagerie: { messages: [] } })
  await page.goto('./#/messages')
  await page.getByRole('button', { name: 'Nouveau message' }).first().click()
  const d = page.getByRole('dialog', { name: 'Nouveau message' })
  await d.getByRole('textbox', { name: 'Personne ou magasin' }).fill('camille')
  await expect(d.getByRole('list', { name: 'Personnes' }).getByRole('button')).toHaveCount(1)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-nouveau-message.png` })
  await d.getByRole('list', { name: 'Personnes' }).getByRole('button').click()
  await expect(d).toHaveCount(0)
  await expect(page).toHaveURL(/#\/messages\/personne\/coach%3ACamille%20TESTARD$/)
  if (isMobile) await expect(page.getByRole('heading', { level: 1, name: 'Camille TESTARD' })).toBeVisible()
})

test('les notifications sont rangées par période', async ({ page, isMobile }, info) => {
  await seConnecter(page, {
    appMetadata: { role: 'coach', coach: 'Hugo FICTIF' },
    messagerie: { messages: [message(1, 'Question du jour', new Date(Date.now() - 60_000)), message(2, 'Question d’hier', jour(-1)), message(3, 'Question de lundi', jour(-4)), message(4, 'Vieille question', jour(-40))] },
  })
  await page.goto('./#/notifications')
  const nouvelles = page.getByRole('region', { name: 'Nouvelles' })
  const mois = jour(-40).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  await expect(nouvelles.locator('p.MuiTypography-caption')).toHaveText(['Aujourd’hui', 'Hier', 'Cette semaine', mois.charAt(0).toUpperCase() + mois.slice(1)])
  await expect(page.getByRole('group', { name: 'Notifications affichées' }).getByRole('button')).toHaveText(['Toutes', 'Nouvelles · 4'])
  const toutLire = page.getByRole('button', { name: 'Tout marquer comme lu' })
  if (isMobile) expect((await toutLire.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-notifications-periodes.png`, fullPage: !isMobile })
  await toutLire.click()
  await expect(nouvelles).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Déjà vues' }).getByRole('button')).toHaveCount(4)
})
