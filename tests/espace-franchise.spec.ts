import { expect, test, type Page } from '@playwright/test'
import { seConnecter, simulerSupabase, textesTropPetits, COMPTE, type Ecriture, type OptionsSimulation } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

// Paul MULTI, franchisé fictif d'Annecy Test et de Rennes Test
const PAUL = { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] }
const espace = {
  visites: [
    { id: 50, store: 'Annecy Test', visit_date: '2026-09-15', type: 'terrain', visitor: 'Hugo FICTIF', signed_required: false, docs: [], notes: '', sections: ['', '', 'Vitrine propre.', '', '', 'Bon mois.'],
      action_plan: [{ id: 'b1', action: 'Lancer une dégustation', porteur: 'Paul MULTI', echeance: '2026-09-30' }, { id: 'b2', action: 'Former au conseil', porteur: 'Hugo FICTIF', echeance: '2099-01-31' }] },
    { id: 51, store: 'Annecy Test', visit_date: '2099-01-10', type: 'terrain', visitor: 'Hugo FICTIF', signed_required: false, docs: [] },
  ],
  campagnes: { liste: [{ id: 'noel', nom: 'Noël', debut: '2020-01-01', fin: '2099-12-31', points: [{ id: 'p1', libelle: 'Vitrine de Noël' }, { id: 'p2', libelle: 'Coffrets en tête de gondole' }], perimetre: 'tous', magasins: [] }],
    constats: { noel: { 'Annecy Test': { p1: { fait: true, date: '2026-10-01', par: 'Hugo FICTIF' } } } } },
  pratiques: [{ id: 'bp1', magasin: 'Lyon Test', date: '2026-09-01', titre: 'Dégustation du vendredi', theme: 'Animation et événements', texte: 'Une dégustation chaque vendredi soir.', par: 'Noé MODELE', photos: [], reprises: [] }],
}

async function seConnecterFranchise(page: Page, options: OptionsSimulation = {}) {
  await seConnecter(page, { acces: PAUL, espace, ...options })
}

test('un franchisé arrive sur son accueil, limité à ses magasins', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecterFranchise(page, { ecritures })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Accueil')
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(nav.getByRole('button')).toHaveText(['Accueil', 'Mes magasins', 'Bonnes pratiques'])
  await expect(page.getByText('Paramètres')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Rechercher' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Magasins affichés' }).getByRole('button')).toHaveText(['Tous mes magasins', 'Annecy Test', 'Rennes Test'])
  for (const t of ['Mes chiffres', 'Repères réseau · septembre 2026', 'Mon plan d’action', 'Visites et audits', 'Campagnes en cours', 'Mon équipe V and B']) {
    await expect(page.getByRole('heading', { name: t, exact: true })).toBeVisible()
  }
  // Plan d'action : l'action en retard d'abord ; rien de Lyon ni de Brest
  const actions = page.getByRole('list', { name: 'Actions en cours' }).getByRole('listitem')
  await expect(actions).toHaveCount(2)
  await expect(actions.first()).toContainText('Lancer une dégustation')
  await expect(actions.first()).toContainText('En retard')
  await expect(page.getByText('Refaire la vitrine')).toHaveCount(0)
  await expect(page.getByText(/Lyon Test|Brest Test/)).toHaveCount(0)
  // Aucun libellé de pilotage interne
  await expect(page.getByText(/Décroche|À surveiller|nine box/i)).toHaveCount(0)
  await expect(page.getByText('Hugo FICTIF').first()).toBeVisible()
  await expect(page.getByText('Alex NORD')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-franchise-dashboard.png`, fullPage: true })
  // Un seul magasin choisi : chiffres détaillés et repères
  await page.getByRole('button', { name: 'Annecy Test' }).click()
  await expect(page.getByRole('heading', { name: 'Mes chiffres · septembre 2026' })).toBeVisible()
  const panier = page.getByRole('group', { name: 'Panier moyen HT cave' })
  await expect(panier).toContainText('Médiane du réseau 38,00 €')
  await expect(panier).toContainText('Au-dessus de la médiane')
  await expect(page.getByRole('group', { name: 'Évolution du CA vs N-1' })).toContainText('Au-dessus de la médiane')
  if (isMobile) {
    const boutons = nav.getByRole('button')
    for (const b of await boutons.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  }
  await page.screenshot({ path: `captures/${info.project.name}-franchise-magasin-choisi.png`, fullPage: true })
  // Le franchisé n'écrit rien et ne lit aucune table directement
  expect(ecritures.filter((e) => e.table !== 'rpc/espace_franchise')).toEqual([])
  expect(ecritures.filter((e) => e.table === 'rpc/espace_franchise').map((e) => e.corps)).toEqual([{}])
})

test('la fiche magasin du franchisé est en lecture seule, avec le compte rendu complet', async ({ page }, info) => {
  await seConnecterFranchise(page)
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Mes magasins' }).click()
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Annecy Test', 'Rennes Test'])
  await page.getByRole('link', { name: /Annecy Test/ }).click()
  const onglets = page.getByRole('tablist', { name: 'Rubriques de Annecy Test' })
  await expect(onglets.getByRole('tab')).toHaveText(['Fiche', 'Messages', 'Chiffres', 'Visites', 'Campagnes'])
  await expect(page.getByRole('button', { name: /Modifier|Réaffecter|Saisir/ })).toHaveCount(0)
  await expect(page.getByText('Paul MULTI')).toBeVisible()
  await onglets.getByRole('tab', { name: 'Visites' }).click()
  await expect(page.getByText('Prévue')).toBeVisible()
  await expect(page.getByText('2 actions au plan · 0 faite')).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-franchise-fiche-visites.png`, fullPage: true })
  await page.getByRole('link', { name: /^Compte rendu du 15 sept/ }).click()
  await expect(page.getByText('Vitrine propre.')).toBeVisible()
  await expect(page.getByText('Bon mois.')).toBeVisible()
  await page.goBack()
  await page.getByRole('tablist', { name: 'Rubriques de Annecy Test' }).getByRole('tab', { name: 'Campagnes' }).click()
  await expect(page.getByRole('heading', { name: 'Noël' })).toBeVisible()
  await expect(page.getByText('Vitrine de Noël')).toBeVisible()
  await expect(page.getByText('En partie')).toBeVisible()
  await page.getByRole('tablist', { name: 'Rubriques de Annecy Test' }).getByRole('tab', { name: 'Chiffres' }).click()
  await expect(page.getByRole('heading', { name: 'Mois enregistrés' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
})

test('un franchisé ne peut ouvrir ni un autre magasin ni les écrans de l’équipe', async ({ page }) => {
  await seConnecterFranchise(page)
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByText('Magasin introuvable')).toBeVisible()
  for (const ecran of ['/equipe', '/parametres/reglages', '/visites', '/plus/sante', '/parametres/franchises']) {
    await page.goto(`./#${ecran}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Accueil')
  }
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Bonnes pratiques' }).click()
  await expect(page.getByRole('heading', { name: 'Dégustation du vendredi' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Modifier|Ajouter/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Lyon Test' })).toHaveCount(0)
})

test('un compte sans accès ouvert ne voit rien', async ({ page }) => {
  await simulerSupabase(page, { acces: { role: 'sans_acces' } })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByText('Ton accès n’est pas encore ouvert')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
})

test('le Directeur ouvre l’accès d’un franchisé et voit son espace', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  const options: OptionsSimulation = { ecritures, accesFranchises: [], espace }
  await seConnecter(page, options)
  await page.goto('./#/equipe/franchise/Paul%20MULTI')
  const acces = page.getByRole('heading', { name: 'Accès à l’app' }).locator('xpath=ancestor::div[contains(@class,"MuiCard-root")]')
  await acces.getByLabel('Email du compte').fill('inconnu@exemple.test')
  await acces.getByRole('button', { name: 'Ouvrir l’accès' }).click()
  await expect(acces.getByText('Aucun compte n’existe avec cet email. Crée-le d’abord dans Supabase.')).toBeVisible()
  await acces.getByLabel('Email du compte').fill('paul@exemple.test')
  await acces.getByRole('button', { name: 'Ouvrir l’accès' }).click()
  await expect(page.getByText('Accès ouvert pour Paul MULTI.')).toBeVisible()
  const ouverture = ecritures.filter((e) => e.table === 'rpc/ouvrir_acces_franchise').at(-1)!
  expect(ouverture.corps).toEqual({ p_email: 'paul@exemple.test', p_franchise: 'Paul MULTI', p_magasins: ['Annecy Test', 'Rennes Test'] })
  await expect(acces.getByText('paul@exemple.test')).toBeVisible()
  await expect(acces.getByText('Jamais connecté')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-franchise-acces.png`, fullPage: true })
  // Aperçu : la même fonction de la base, pour ce franchisé
  await acces.getByRole('button', { name: 'Voir son espace' }).click()
  await expect(page.getByRole('region', { name: 'Aperçu' })).toContainText('Espace de Paul MULTI')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Accueil')
  expect(ecritures.filter((e) => e.table === 'rpc/espace_franchise').at(-1)!.corps).toEqual({ p_franchise: 'Paul MULTI', p_magasins: ['Annecy Test', 'Rennes Test'] })
  await page.screenshot({ path: `captures/${info.project.name}-franchise-apercu.png`, fullPage: true })
  // Rechargement : l'aperçu reste ouvert ; le quitter ramène à la fiche du franchisé
  await page.reload()
  await expect(page.getByRole('region', { name: 'Aperçu' })).toBeVisible()
  await page.getByRole('button', { name: 'Quitter l’aperçu' }).click()
  await expect(page.getByRole('heading', { name: 'Paul MULTI', level: 1 })).toBeVisible()
  // Couper l'accès
  await acces.getByRole('button', { name: 'Couper l’accès' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Couper l’accès' }).click()
  await expect(page.getByText('Accès de Paul MULTI coupé.')).toBeVisible()
  expect(ecritures.filter((e) => e.table === 'rpc/couper_acces_franchise').at(-1)!.corps).toEqual({ p_user: 'u-nouveau' })
  await expect(acces.getByLabel('Email du compte')).toBeVisible()
})

test('les accès suivent les magasins du franchisé à chaque chargement', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, accesFranchises: [
    { user_id: 'u1', email: 'paul@exemple.test', franchise: 'Paul MULTI', magasins: ['Annecy Test'] },
    { user_id: 'u2', email: 'ancien@exemple.test', franchise: 'Nom inconnu', magasins: ['Gap Test'] },
  ] })
  await expect.poll(() => ecritures.filter((e) => e.table === 'rpc/maj_acces_franchise').map((e) => e.corps)).toEqual([
    { p_user: 'u1', p_franchise: 'Paul MULTI', p_magasins: ['Annecy Test', 'Rennes Test'] },
  ])
})

test('sans le script de la base, l’équipe garde son app et les accès sont signalés inactifs', async ({ page }) => {
  await seConnecter(page, { acces: null })
  await page.goto('./#/equipe/franchise/Paul%20MULTI')
  await expect(page.getByText('Les accès franchisés ne sont pas encore activés dans la base.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Paul MULTI', level: 1 })).toBeVisible()
})

test('chacun peut changer son mot de passe', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecterFranchise(page, { ecritures })
  await page.getByRole('button', { name: 'Mon compte' }).click()
  await page.getByRole('menuitem', { name: 'Changer mon mot de passe' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Nouveau mot de passe').fill('court')
  await expect(d.getByText('8 caractères au moins')).toBeVisible()
  await d.getByLabel('Nouveau mot de passe').fill('nouveau-mot-de-passe')
  await d.getByLabel('Confirmer le mot de passe').fill('nouveau-mot-de-passe')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Mot de passe changé.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'auth/user')?.corps).toMatchObject({ password: 'nouveau-mot-de-passe' })
})

test('la connexion d’un franchisé n’affiche jamais l’app de l’équipe, même un instant', async ({ page }) => {
  await simulerSupabase(page, { acces: PAUL, espace })
  const vus: string[] = []
  page.on('request', (r) => { if (r.url().includes('/rest/v1/') && !r.url().includes('/rpc/')) vus.push(r.url()) })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Accueil')
  expect(vus).toEqual([])
})
