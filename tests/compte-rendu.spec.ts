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

test('dicter, faire rédiger les parties et le plan d’action, puis enregistrer', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  const demandesRedaction: unknown[] = []
  await seConnecter(page, { ecritures, demandesRedaction })
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('button', { name: 'Saisir', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  // Le plan d'action de la visite précédente est repris
  await expect(d.getByText('Refaire la tête de gondole Beaujolais · Franchisé · novembre')).toBeVisible()
  await expect(d.getByRole('button', { name: 'Rédiger le compte rendu' })).toBeDisabled()
  await d.getByRole('button', { name: 'Dicter' }).click()
  await expect(d.getByLabel('Notes de visite')).toHaveValue('Magasin propre, ruptures sur les bières de garde.')
  await d.getByRole('button', { name: 'Arrêter la dictée' }).click()
  await expect(d.getByRole('button', { name: 'Dicter' })).toBeVisible()
  await d.getByRole('button', { name: 'Rédiger le compte rendu' }).click()
  await expect(d.getByLabel('3. Respect du concept : PPM')).toHaveValue(/Ruptures sur les bières de garde/)
  await expect(d.getByLabel('10. Synthèse')).toBeVisible()
  // Les parties non abordées restent repliées
  await expect(d.getByLabel('1. Chiffres clés et gestion')).toHaveCount(0)
  await expect(d.getByLabel('Action', { exact: true })).toHaveValue('Recommander les bières de garde')
  expect(demandesRedaction[0]).toMatchObject({ magasin: 'Lyon Test', planPrecedent: [{ action: 'Refaire la tête de gondole Beaujolais' }] })
  // Ajouter une partie à la main
  await d.getByRole('button', { name: 'Équipe et management' }).click()
  await d.getByLabel('9. Équipe et management').fill('Équipe stable.')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-compte-rendu-saisie.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Visite enregistrée.')).toBeVisible()
  const ligne = (ecritures.find((e) => e.table === 'visits' && e.methode === 'POST')!.corps as Record<string, unknown>[])[0]
  const sections = ligne.sections as string[]
  expect(sections).toHaveLength(10)
  expect(sections[0]).toBe('')
  expect(sections[8]).toBe('Équipe stable.')
  expect(ligne.action_plan).toEqual([{ action: 'Recommander les bières de garde', porteur: 'Franchisé', echeance: 'fin octobre' }])
})

test('si la rédaction échoue, les notes restent et un message humain s’affiche', async ({ page }) => {
  await seConnecter(page, { redaction: 'panne' })
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('button', { name: 'Saisir', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  await d.getByLabel('Notes de visite').fill('Bonne visite.')
  await d.getByRole('button', { name: 'Rédiger le compte rendu' }).click()
  await expect(d.getByText(/La rédaction automatique n’a pas abouti/)).toBeVisible()
  await expect(d.getByLabel('Notes de visite')).toHaveValue('Bonne visite.')
})

test('le compte rendu n’affiche que les parties abordées, le plan d’action et les signatures si contractuelle', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/visites/compte-rendu/1')
  await expect(page.getByRole('heading', { name: 'Lyon Test', level: 1 })).toBeVisible()
  await expect(page.getByText('Compte rendu de visite contractuelle')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Refaire la tête de gondole Beaujolais' })).toBeVisible()
  await expect(page.getByText(/^Signature/)).toHaveCount(2)
  await page.screenshot({ path: `captures/${info.project.name}-compte-rendu-plan.png`, fullPage: !isMobile })
  // Visite non contractuelle : pas de cadre de signature
  await page.goto('./#/visites/compte-rendu/2')
  await expect(page.getByRole('heading', { name: 'Nantes Test', level: 1 })).toBeVisible()
  await expect(page.getByText(/^Signature/)).toHaveCount(0)
})
