import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

// Sprint 24 (Joseph, 24/10/2026) : Préparer depuis Ma semaine sur téléphone (S1), fiche avant visite en tuiles (S2,
// sprint13.spec.ts), nine box en noms courts (S3, priorites-ecrans.spec.ts), années sans ouverture (S4), « Je suis
// au magasin » (F1), dictée partout (F2), fermetures et cessions (F3), revue du réseau (F4)

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

// Brest Test cédé hors réseau en 2025
const cession = [{ store_name: 'Brest Test', ferme_le: '2025-06-30', fermeture: 'cession', fermeture_motif: 'Départ en retraite', repreneur: 'Société Exemple' }]

test('S1 : chaque magasin de Ma semaine propose Préparer et Planifier', async ({ page, isMobile }, info) => {
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Inès EXEMPLE' } })
  await page.goto('./#/visites')
  const liste = page.getByRole('region', { name: 'Visites à planifier' })
  const preparer = liste.getByRole('link', { name: 'Préparer la visite de Nantes Test' })
  await expect(preparer).toBeVisible()
  await expect(liste.getByRole('button', { name: 'Planifier la visite de Nantes Test' })).toBeVisible()
  if (isMobile) {
    // En mots sur téléphone, plus de pictos seuls
    await expect(preparer).toHaveText('Préparer')
    await expect(page.getByRole('button', { name: 'Planifier la tournée' })).toHaveText('Tournée')
    for (const b of await liste.getByRole('group').first().locator('a, button').all()) {
      expect(Math.round((await b.boundingBox())!.height)).toBeGreaterThanOrEqual(48)
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-semaine-preparer.png` })
  await preparer.click()
  await expect(page).toHaveURL(/#\/magasins\/Nantes%20Test\/preparer$/)
})

test('S4 : Évolution du parc montre les années sans ouverture', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/parametres/evolution')
  await expect(page.getByRole('img', { name: /Ouvertures : / })).toHaveAttribute('aria-label', /2024 3 ; 2025 0 ; 2026 5/)
})

test('F3 : un magasin cédé sort des listes, garde sa fiche et compte dans Évolution du parc', async ({ page, isMobile }, info) => {
  await seConnecter(page, { surchargesMagasins: cession })
  await page.goto('./#/parametres/evolution')
  await expect(page.getByText('Ouvertures et sorties par année')).toBeVisible()
  if (isMobile) {
    const annee = page.getByRole('region', { name: 'Évolution par année' }).locator('> div').filter({ hasText: /^2025/ })
    await expect(annee).toContainText('Sorti : Brest Test')
    await expect(annee).toContainText('+0 −1')
  } else {
    await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Tableau' }).click()
    await expect(page.getByRole('row', { name: /^2025/ })).toContainText('Sortis : Brest Test')
  }
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-evolution-sorties.png`, fullPage: true })

  // Hors de la liste des magasins, fiche toujours ouverte avec son bandeau
  await page.goto('./#/magasins?forme=liste')
  await expect(page.getByText('Lyon Test').first()).toBeVisible()
  await expect(page.getByText('Brest Test')).toHaveCount(0)
  await page.goto('./#/magasins/Brest%20Test')
  await expect(page.getByRole('alert')).toContainText('Cession hors réseau le 30 juin 2025 · repris par Société Exemple · Départ en retraite')
  await expect(page.getByText('Cédé', { exact: true })).toBeVisible()
})

test('F3 : le Directeur enregistre une fermeture depuis la fiche', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('button', { name: 'Autres actions' }).click()
  await page.getByRole('menuitem', { name: 'Fermer ou céder le magasin' }).click()
  const d = page.getByRole('dialog', { name: 'Fermer ou céder Lyon Test' })
  await d.getByRole('button', { name: 'Fermeture', exact: true }).click()
  await d.getByLabel('Date de fermeture').fill('2026-12-31')
  await d.getByLabel('Motif').fill('Fin de bail')
  await expect(d.getByLabel('Repreneur')).toHaveCount(0)
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toHaveCount(0)
  await expect.poll(() => ecritures.find((e) => e.table === 'store_overrides' && JSON.stringify(e.corps).includes('ferme_le'))?.corps)
    .toMatchObject({ ferme_le: '2026-12-31', fermeture: 'fermeture', fermeture_motif: 'Fin de bail', repreneur: null })
})

test('F3 : un Coach ne peut pas fermer un magasin', async ({ page }) => {
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Noé MODELE' } })
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('button', { name: 'Autres actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Préparer la visite' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Fermer ou céder le magasin' })).toHaveCount(0)
})

test('F1 : au magasin, l’accueil propose de saisir la visite', async ({ page, context, isMobile }, info) => {
  await context.grantPermissions(['geolocation'])
  // Nantes Test, à quelques mètres
  await context.setGeolocation({ latitude: 44.6005, longitude: 0.8003 })
  await seConnecter(page)
  await expect(page.getByRole('heading', { name: 'Accueil' })).toBeVisible()
  if (!isMobile) {
    await expect(page.getByRole('region', { name: 'Au magasin' })).toHaveCount(0)
    return
  }
  const bandeau = page.getByRole('region', { name: 'Au magasin' })
  await expect(bandeau).toContainText('Nantes Test')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-au-magasin.png` })
  await bandeau.getByRole('button', { name: 'Saisir la visite' }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  await expect(d.getByRole('region', { name: 'Visite' })).toContainText('Nantes Test')
})

test('F1 : loin de tout magasin, rien ne s’affiche sans demande', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'téléphone seulement')
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 48.85, longitude: 2.35 })
  await seConnecter(page)
  await expect(page.getByRole('heading', { name: 'Accueil' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Au magasin' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Je suis au magasin' }).click()
  await expect(page.getByText('Aucun de tes magasins à moins de 300 m.')).toBeVisible()
})

test('F2 : le micro est proposé dans une tâche, un message et les notes de préparation', async ({ page }) => {
  await page.addInitScript(() => {
    // Dictée simulée : renvoie « vitrine à refaire » puis s'arrête
    class Fausse { lang = ''; continuous = false; interimResults = false; onresult: ((e: unknown) => void) | null = null; onend: (() => void) | null = null; onerror = null
      start() { setTimeout(() => { this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'vitrine à refaire' } }] }); this.onend?.() }, 50) }
      stop() { this.onend?.() } }
    for (const nom of ['SpeechRecognition', 'webkitSpeechRecognition']) Object.defineProperty(window, nom, { value: Fausse, configurable: true, writable: true })
  })
  await seConnecter(page)
  await page.goto('./#/taches')
  await page.getByRole('button', { name: /Nouvelle tâche/ }).first().click()
  await page.getByRole('button', { name: 'Dicter : Tâche' }).click()
  await expect(page.getByLabel('Tâche', { exact: true })).toHaveValue('vitrine à refaire')
  await page.getByRole('button', { name: 'Annuler' }).click()

  await page.goto('./#/messages/Lyon%20Test')
  await expect(page.getByRole('button', { name: 'Dicter : Message' })).toBeVisible()

  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('button', { name: 'Autres actions' }).click()
  await page.getByRole('menuitem', { name: 'Planifier la visite' }).click()
  await expect(page.getByRole('button', { name: 'Dicter : Notes de préparation' })).toBeVisible()
})

test('F4 : la revue du mois du réseau, une ligne par Responsable Régional', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe?vue=revue')
  await expect(page.getByRole('heading', { name: /^Revue de .* · réseau$/ })).toBeVisible()
  const parRR = page.getByRole('region', { name: 'Par Responsable Régional' })
  await expect(parRR).toBeVisible()
  const premier = parRR.getByRole('link').first()
  await expect(premier).toHaveAttribute('href', /vue=revue&mois=\d{4}-\d{2}/)
  await expect(page.getByRole('region', { name: 'Magasins qui décrochent' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Télécharger en PDF' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: `captures/${info.project.name}-revue-reseau.png`, fullPage: true })
  await premier.click()
  await expect(page).toHaveURL(/equipe\/rr\/.*vue=revue/)
})
