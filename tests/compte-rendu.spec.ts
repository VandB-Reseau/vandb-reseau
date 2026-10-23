import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
  // Dictée simulée : le navigateur « entend » une phrase puis s'arrête
  await page.addInitScript(() => {
    class DicteeSimulee {
      lang = ''; continuous = false; interimResults = false
      onresult: ((e: unknown) => void) | null = null
      onend: (() => void) | null = null
      onerror: ((e: unknown) => void) | null = null
      start() {
        setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: 'Magasin propre, ruptures sur les bières de garde.' }], { isFinal: true })] })
        }, 50)
      }
      stop() { setTimeout(() => this.onend?.(), 10) }
    }
    for (const nom of ['SpeechRecognition', 'webkitSpeechRecognition']) Object.defineProperty(window, nom, { value: DicteeSimulee, configurable: true, writable: true })
  })
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('dicter chaque partie, reprendre les actions en cours, puis enregistrer', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Lyon%20Test?vue=visites')
  await page.getByRole('button', { name: 'Saisir', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  // Les actions en cours des visites précédentes sont rappelées
  const enCours = d.getByRole('group', { name: 'Tâches en cours' })
  await expect(enCours.getByText('Refaire la tête de gondole Beaujolais')).toBeVisible()
  await expect(enCours.getByText(/^Franchisé · échéance novembre · depuis le/)).toBeVisible()
  // Une partie dictée, une partie tapée, les autres laissées vides
  await d.getByRole('button', { name: 'Dicter : 3. Magasin et offre' }).click()
  await expect(d.getByLabel('3. Magasin et offre', { exact: true })).toHaveValue('Magasin propre, ruptures sur les bières de garde.')
  await d.getByRole('button', { name: 'Arrêter la dictée : 3. Magasin et offre' }).click()
  await expect(d.getByRole('button', { name: 'Dicter : 3. Magasin et offre' })).toBeVisible()
  await d.getByLabel('5. Équipe', { exact: true }).fill('Équipe stable.')
  await d.getByRole('button', { name: 'Ajouter une tâche' }).click()
  await d.getByLabel('Tâche', { exact: true }).fill('Recommander les bières de garde')
  await d.getByLabel('Porteurs', { exact: true }).click()
  await page.getByRole('option', { name: 'Noé MODELE' }).click()
  await page.keyboard.press('Tab')
  await d.getByLabel('Échéance', { exact: true }).fill('2026-10-31')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-compte-rendu-saisie.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Visite enregistrée.')).toBeVisible()
  const ligne = (ecritures.find((e) => e.table === 'visits' && e.methode === 'POST')!.corps as Record<string, unknown>[])[0]
  expect(ligne.sections).toEqual(['', '', 'Magasin propre, ruptures sur les bières de garde.', '', 'Équipe stable.', ''])
  expect(ligne.action_plan).toEqual([expect.objectContaining({ action: 'Recommander les bières de garde', porteur: 'Noé MODELE', echeance: '2026-10-31' })])
})

test('une tournée garde des notes communes dictées, sans parties', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/visites')
  await page.getByRole('button', { name: 'Saisir une visite pour Nantes Test' }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  await expect(d.getByLabel('1. Chiffres et gestion', { exact: true })).toBeVisible()
  await d.getByRole('region', { name: 'Visite' }).getByRole('button', { name: 'Modifier' }).click()
  await d.getByLabel('Magasins visités').fill('Rennes')
  await page.getByRole('option', { name: 'Rennes Test' }).click()
  await page.keyboard.press('Escape')
  await expect(d.getByLabel('1. Chiffres et gestion', { exact: true })).toHaveCount(0)
  await d.getByRole('button', { name: 'Dicter : Notes de visite' }).click()
  await expect(d.getByLabel('Notes de visite', { exact: true })).toHaveValue('Magasin propre, ruptures sur les bières de garde.')
})

test('le compte rendu n’affiche que les parties abordées, le plan d’action et les signatures si contractuelle', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/visites/compte-rendu/1')
  await expect(page.getByRole('heading', { name: 'Lyon Test', level: 1 })).toBeVisible()
  await expect(page.getByText('Compte rendu de visite contractuelle')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Refaire la tête de gondole Beaujolais' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '3. Magasin et offre' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '1. Chiffres et gestion' })).toHaveCount(0)
  await expect(page.getByText('Vitrine refaite, stock à revoir.')).toBeVisible()
  await expect(page.getByText(/^Signature/)).toHaveCount(2)
  await page.screenshot({ path: `captures/${info.project.name}-compte-rendu-plan.png`, fullPage: !isMobile })
  // Visite non contractuelle : pas de cadre de signature
  await page.goto('./#/visites/compte-rendu/2')
  await expect(page.getByRole('heading', { name: 'Nantes Test', level: 1 })).toBeVisible()
  await expect(page.getByText(/^Signature/)).toHaveCount(0)
})
