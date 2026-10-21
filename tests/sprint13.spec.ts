import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture, type OptionsSimulation, actionFiche } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

// Noé MODELE suit Lyon, Rennes, Metz, Brest… ; Alex NORD (rr1) est un Responsable Régional
const NOE = { appMetadata: { role: 'coach', coach: 'Noé MODELE' } }
const campagnes = { liste: [{ id: 'noel', nom: 'Noël', debut: '2020-01-01', fin: '2099-12-31', points: [{ id: 'p1', libelle: 'Vitrine de Noël' }, { id: 'p2', libelle: 'Coffrets en tête de gondole' }], perimetre: 'tous', magasins: [] }], constats: {} }
const messagerie = { messages: [{ id: 1, store: 'Lyon Test', auteur: 'u-autre', auteur_nom: 'Paul MULTI', auteur_role: 'franchise', texte: 'La livraison de coffrets est arrivée.', mentions: [], cree_le: '2026-10-18T09:00:00Z' }] }
const tablesReferentiels = ['app_config', 'store_overrides', 'reassigns', 'cs_overrides', 'recruits']

test('un Coach ne voit pas les boutons des référentiels et ne les écrit pas', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ...NOE, ecritures, config: { campagnes } })
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByRole('heading', { level: 1, name: 'Lyon Test' })).toBeVisible()
  await page.getByRole('button', { name: 'Autres actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Préparer la visite' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Modifier la fiche' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Réaffecter' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ajouter un associé' })).toHaveCount(0)
  await page.screenshot({ path: `captures/${info.project.name}-coach-fiche-sans-modifier.png` })
  // Ce qui reste à lui : santé de ses magasins, actions
  await page.goto('./#/magasins/Lyon%20Test?vue=sante')
  await expect(page.getByRole('button', { name: 'Modifier la santé' })).toBeVisible()
  await page.goto('./#/visites?vue=campagnes')
  await expect(page.getByText('Noël').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nouvelle campagne' })).toHaveCount(0)
  await page.goto('./#/plus/sante?vue=deploiements')
  await expect(page.getByRole('heading', { name: 'Santé du parc' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gérer les thématiques' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Importer Excel' })).toHaveCount(0)
  await page.goto('./#/equipe/coach/No%C3%A9%20MODELE?vue=fiche')
  await expect(page.getByRole('heading', { level: 1, name: 'Noé MODELE' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Modifier', exact: true })).toHaveCount(0)
  await expect(page.getByText('Accès à l’app')).toHaveCount(0)
  // Aucune écriture d'arrière-plan sur les référentiels (géolocalisation, périmètre)
  expect(ecritures.filter((e) => tablesReferentiels.includes(e.table) && e.methode !== 'SUIVI')).toEqual([])
  expect(ecritures.filter((e) => e.table === 'rpc/maj_perimetre_equipe')).toEqual([])
  if (isMobile) expect(await textesTropPetits(page)).toEqual([])
})

test('le Directeur ouvre l’accès d’un Coach puis voit l’app comme lui', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  const options: OptionsSimulation = { ecritures, accesEquipe: [] }
  await seConnecter(page, options)
  await page.goto('./#/equipe/coach/No%C3%A9%20MODELE?vue=fiche')
  await expect(page.getByText('Accès à l’app', { exact: true })).toBeVisible()
  await page.getByLabel('Email du compte').fill('noe.modele@vandb.test')
  await page.getByRole('button', { name: 'Ouvrir l’accès' }).click()
  await expect(page.getByText('Accès ouvert pour Noé MODELE.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'rpc/ouvrir_acces_equipe')?.corps).toEqual({ p_email: 'noe.modele@vandb.test', p_role: 'coach', p_nom: 'Noé MODELE' })
  await expect(page.getByText('noe.modele@vandb.test')).toBeVisible()
  await expect(page.getByText('Jamais connecté')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-coach-acces.png`, fullPage: !isMobile })

  // Voir comme Noé : son périmètre, sans Paramètres ni boutons des référentiels
  await page.getByRole('button', { name: 'Voir comme Noé' }).click()
  await expect(page.getByRole('region', { name: 'Aperçu' })).toContainText('L’app vue par Noé MODELE')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Accueil')
  await expect(page.getByText('Paramètres', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: `captures/${info.project.name}-voir-comme-coach.png` })
  await page.goto('./#/magasins?vue=liste')
  await expect(page.getByText(/^8 magasins$/)).toBeVisible()
  await expect(page.getByText('Nantes Test')).toHaveCount(0)
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByRole('button', { name: 'Réaffecter' })).toHaveCount(0)
  await page.goto('./#/parametres/reglages')
  await expect(page).toHaveURL(/#\/$/)
  // L'aperçu n'écrit pas le périmètre de toute l'équipe à partir d'un seul Coach
  const perimetres = ecritures.filter((e) => e.table === 'rpc/maj_perimetre_equipe').length
  await page.reload()
  await expect(page.getByRole('region', { name: 'Aperçu' })).toBeVisible()
  await page.getByRole('button', { name: 'Quitter l’aperçu' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Noé MODELE' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Aperçu' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Modifier', exact: true })).toBeVisible()
  expect(perimetres).toBeLessThanOrEqual(1)
})

test('le Directeur rattache un compte à un Responsable Régional et le coupe', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, accesEquipe: [{ user_id: 'u-alex', email: 'alex.nord@vandb.test', role: 'rr', nom: 'rr1', derniere_connexion: '2026-10-18T08:00:00Z' }] })
  await page.goto('./#/equipe/rr/rr1?vue=fiche')
  await expect(page.getByText('alex.nord@vandb.test')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Voir comme / })).toBeVisible()
  await page.getByRole('button', { name: 'Couper l’accès' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Couper l’accès' }).click()
  await expect(page.getByText(/^Accès de .+ coupé\.$/)).toBeVisible()
  expect(ecritures.find((e) => e.table === 'rpc/couper_acces_equipe')?.corps).toEqual({ p_user: 'u-alex' })
  await expect(page.getByLabel('Email du compte')).toBeVisible()
})

test('un email inconnu donne un message clair', async ({ page }) => {
  await seConnecter(page, { accesEquipe: [] })
  await page.goto('./#/equipe/coach/No%C3%A9%20MODELE?vue=fiche')
  await page.getByLabel('Email du compte').fill('inconnu@exemple.test')
  await page.getByRole('button', { name: 'Ouvrir l’accès' }).click()
  await expect(page.getByText('Aucun compte n’existe avec cet email. Crée-le d’abord dans Supabase.')).toBeVisible()
})

test('fiche avant visite : tout le magasin sur une page, téléchargeable en PDF', async ({ page, isMobile }, info) => {
  await seConnecter(page, { config: { campagnes }, messagerie })
  await page.goto('./#/magasins/Lyon%20Test')
  await actionFiche(page, 'Préparer la visite')
  await expect(page).toHaveURL(/#\/magasins\/Lyon%20Test\/preparer$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Lyon Test' })).toBeVisible()
  for (const t of ['En bref', 'Chiffres', 'Repères réseau', 'Tâches en cours (1)', 'Audits', 'Campagnes à constater', 'Derniers messages']) {
    await expect(page.getByRole('heading', { name: t, exact: true })).toBeVisible()
  }
  // Septembre 2026 à 70 000 € contre 100 000 € un an plus tôt
  await expect(page.getByText(/^Décroche · CA de septembre 2026/)).toBeVisible()
  await expect(page.getByRole('table', { name: 'Chiffres de Lyon Test' })).toContainText('septembre 2026')
  await expect(page.getByRole('table', { name: 'Repères réseau' })).toContainText('Évolution du CA vs N-1')
  await expect(page.getByText('Vitrine de Noël')).toBeVisible()
  await expect(page.getByText('La livraison de coffrets est arrivée.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Télécharger en PDF' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  // Rien ne déborde sur la largeur d'un téléphone
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: `captures/${info.project.name}-fiche-avant-visite.png`, fullPage: true })
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('button', { name: 'Télécharger en PDF' })).toBeHidden()
  await page.emulateMedia({ media: 'screen' })
  if (!isMobile) {
    await page.goto('./#/visites')
    await expect(page.getByRole('link', { name: 'Préparer la visite de Lyon Test' })).toBeVisible()
  }
})

test('un Coach prépare la visite d’un de ses magasins', async ({ page, isMobile }) => {
  await seConnecter(page, NOE)
  // Sur PC depuis le rythme de visite, sur téléphone depuis la fiche du magasin
  if (isMobile) {
    await page.goto('./#/magasins/Lyon%20Test')
    await actionFiche(page, 'Préparer la visite')
  } else {
    await page.goto('./#/visites?vue=rythme')
    await page.getByRole('link', { name: 'Préparer la visite de Lyon Test' }).first().click()
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Lyon Test' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Repères réseau' })).toBeVisible()
  // Hors de son périmètre : introuvable
  await page.goto('./#/magasins/Nantes%20Test/preparer')
  await expect(page.getByText('Magasin introuvable')).toBeVisible()
})
