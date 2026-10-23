import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Compte rendu dans le fil d'actualité (Joseph, 22/10/2026) : une vignette carrée, comme une photo ; le toucher ouvre
// le compte rendu dans une fenêtre ; la fermer ou revenir en arrière laisse le fil à la même place, pour aimer ou commenter

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
    { id: 50, store: 'Annecy Test', visit_date: '2026-09-15', type: 'terrain', visitor: 'Hugo FICTIF', signed_required: false, docs: [{ label: 'Photo', url: '', chemin: 'visites/2026-09/a.jpg', taille: 1 }], notes: 'Vitrine propre, bon mois.', sections: [], action_plan: [] },
    { id: 51, store: 'Rennes Test', visit_date: '2026-09-10', type: 'terrain', visitor: 'Hugo FICTIF', signed_required: false, docs: [], notes: 'Stock à revoir.', sections: [], action_plan: [] },
  ],
}

test('la vignette ouvre le compte rendu dans une fenêtre ; la fermer garde la place dans le fil', async ({ page, isMobile }, info) => {
  await seConnecter(page, { acces: PAUL, espace, reactionsVisites: { pouces: {}, commentaires: {} } })
  const carte = page.getByRole('region', { name: 'Actualités' }).getByRole('article', { name: 'Compte rendu de Rennes Test' })
  const vignette = carte.getByRole('button', { name: 'Ouvrir le compte rendu de Rennes Test' })
  await vignette.scrollIntoViewIfNeeded()
  // Carrée, de la taille d'une photo
  const b = (await vignette.boundingBox())!
  expect(Math.abs(b.width - b.height)).toBeLessThanOrEqual(2)
  expect(b.width).toBeLessThanOrEqual(170)
  expect(b.height).toBeGreaterThanOrEqual(48)
  // Avec les photos de la visite, la vignette prend la première case
  const annecy = page.getByRole('article', { name: 'Compte rendu de Annecy Test' })
  await expect(annecy.getByRole('button', { name: 'Ouvrir le compte rendu de Annecy Test' })).toBeVisible()
  await expect(annecy.getByRole('button', { name: 'Agrandir la photo 1' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fil-vignette-compte-rendu.png` })

  const y = await page.evaluate(() => window.scrollY)
  await vignette.click()
  const fenetre = page.getByRole('dialog', { name: 'Compte rendu' })
  await expect(fenetre.getByRole('heading', { name: 'Rennes Test' })).toBeVisible()
  await expect(fenetre).toContainText('Stock à revoir.')
  expect((await fenetre.getByRole('button', { name: 'Fermer' }).boundingBox())!.height).toBeGreaterThanOrEqual(48)
  if (isMobile) {
    const f = (await fenetre.boundingBox())!
    expect(f.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1)
  }
  await page.screenshot({ path: `captures/${info.project.name}-fenetre-compte-rendu.png` })
  await fenetre.getByRole('button', { name: 'Fermer' }).click()
  await expect(fenetre).toHaveCount(0)
  await expect(page).not.toHaveURL(/cr=/)
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThanOrEqual(2)
  await expect(carte.getByRole('button', { name: /^J’aime/ })).toBeVisible()

  // Le retour arrière ferme aussi la fenêtre, sans quitter le fil
  await carte.getByText('Stock à revoir.').click()
  await expect(fenetre).toBeVisible()
  await page.goBack()
  await expect(fenetre).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Actualités' })).toBeVisible()
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThanOrEqual(2)
})

test('le bouton PDF de la fenêtre mène à la page imprimable du compte rendu', async ({ page }) => {
  await seConnecter(page, { acces: PAUL, espace, reactionsVisites: { pouces: {}, commentaires: {} } })
  await page.getByRole('button', { name: 'Ouvrir le compte rendu de Rennes Test' }).click()
  await page.getByRole('dialog', { name: 'Compte rendu' }).getByRole('button', { name: 'PDF' }).click()
  await expect(page).toHaveURL(/#\/visites\/compte-rendu\/51$/)
  await expect(page.getByRole('button', { name: 'Télécharger en PDF' })).toBeVisible()
})
