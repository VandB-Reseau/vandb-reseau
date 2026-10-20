import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('le compte rendu part au franchisé en un geste depuis la fiche du magasin', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Brest%20Test?vue=visites')
  await page.getByRole('button', { name: /Envoyer au franchisé le compte rendu du/ }).first().click()
  const d = page.getByRole('dialog', { name: 'Envoyer le compte rendu' })
  await expect(d.getByRole('group', { name: 'Destinataires' })).toContainText('Franchisé 11')
  // Message prérempli avec les actions encore à faire, pas celles déjà faites
  const texte = d.getByLabel('Message')
  await expect(texte).toHaveValue(/Bonjour Franchisé,\n\nVoici le compte rendu de notre visite du 20 septembre 2026 à Brest Test\./)
  await expect(texte).toHaveValue(/- Refaire la vitrine/)
  await expect(texte).not.toHaveValue(/Changer l’enseigne/)
  // Pas d'e-mail connu pour ce franchisé : l'envoi par e-mail attend son adresse
  await expect(d.getByRole('button', { name: 'Par e-mail' })).toBeDisabled()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-envoyer-compte-rendu.png`, fullPage: !isMobile })
  await d.getByRole('button', { name: 'Dans l’app' }).click()
  await expect(page.getByText('Compte rendu envoyé à Franchisé 11 dans la messagerie.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'rpc/envoyer_a')!.corps as Record<string, unknown>
  expect(envoi).toMatchObject({ p_destinataire: 'franchise:Franchisé 11', p_magasins: ['Brest Test'] })
  expect(String(envoi.p_texte)).toContain('Refaire la vitrine')
})

test('depuis le compte rendu, un magasin sans franchisé rattaché le dit sans bloquer', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/visites/compte-rendu/1')
  await expect(page.getByRole('heading', { name: 'Lyon Test', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Envoyer au franchisé' }).click()
  const d = page.getByRole('dialog', { name: 'Envoyer le compte rendu' })
  // Lyon Test est un magasin intégré sans franchisé rattaché : l'écran le dit et propose où l'ajouter
  await expect(d.getByText('Aucun franchisé n’est rattaché à Lyon Test.', { exact: false })).toBeVisible()
  await expect(d.getByRole('button', { name: 'Dans l’app' })).toBeDisabled()
})
