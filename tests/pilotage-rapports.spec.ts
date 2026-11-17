import { expect, test, type Page } from '@playwright/test'
import { seConnecter, simulerSupabase, COMPTE, textesTropPetits, type Ecriture, type RapportSimule } from './supabase-simule'
import { zonesTropPetites } from './pilotage/supabase-simule'
import { seConnecter as seConnecterAvecBudgets } from './pilotage/ecrans/outils'

// Onglet « Pilotage » (Joseph, 17/11/2026) : rapports proposés par le siège, rapports de chacun, indicateurs en parallèle,
// glisser-déposer, typologies et périodes, partage, export. Données fictives uniquement.

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

const tableau = (page: Page) => page.getByRole('table', { name: 'Tableau du rapport' })
async function choisirRapport(page: Page, titre: string, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('combobox', { name: 'Rapport' }).click()
    await page.getByRole('option', { name: titre, exact: true }).click()
  } else {
    await page.getByRole('list', { name: 'Proposés par le siège' }).getByRole('button', { name: titre, exact: true }).click()
  }
  await expect(page.getByRole('heading', { level: 2, name: titre })).toBeVisible()
}
async function ouvrirConstructeur(page: Page) {
  const b = page.getByRole('button', { name: 'Modifier le rapport' })
  if ((await b.getAttribute('aria-expanded')) === 'false') await b.click()
}

test('Pilotage : rapport du siège, indicateurs en parallèle, typologie, mois en colonnes, enregistrement', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  const rapports: RapportSimule[] = [{ id: 7, titre: 'Point du RR Sud', definition: { indicateurs: ['ca', 'tachesRetard'], lignes: 'coach' }, modele: false, partage: true, auteur: 'Responsable Sud', role: 'rr' }]
  await seConnecter(page, { ecritures, rapports })
  // Entrée du menu (PC : menu latéral ; téléphone : menu du compte), comme les autres pages du réseau
  await page.goto('./#/pilotage')
  await expect(page.getByRole('heading', { level: 1, name: 'Pilotage' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Budget contre réel par magasin' })).toBeVisible()
  await expect(tableau(page).getByRole('row', { name: /Nantes Test/ })).toContainText('879 000 €')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  // Construction repliée à l'ouverture : le rapport d'abord, « Modifier le rapport » pour l'ouvrir
  await expect(page.getByRole('button', { name: 'Modifier le rapport' })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('group', { name: 'Lignes' })).toHaveCount(0)

  // Rapport partagé par un membre de l'équipe
  if (!isMobile) await expect(page.getByRole('list', { name: 'Partagés avec moi' })).toContainText('Point du RR Sud')

  // Ventes sur l'an dernier, regroupées par typologie, avec les tâches en retard en parallèle
  await choisirRapport(page, 'Ventes sur l’an dernier', isMobile)
  await ouvrirConstructeur(page)
  await page.getByRole('group', { name: 'Lignes' }).getByRole('combobox').click()
  await page.getByRole('option', { name: 'Typologie', exact: true }).click()
  await page.getByRole('group', { name: /^Indicateurs/ }).getByRole('button', { name: 'Ajouter' }).click()
  await page.getByRole('menuitem', { name: 'Tâches en retard', exact: true }).click()
  await expect(tableau(page).getByRole('columnheader', { name: 'Tâches en retard' })).toBeVisible()
  await expect(tableau(page).getByRole('columnheader', { name: 'Typologie' })).toBeVisible()
  await expect(page.getByLabel('Graphe Tâches en retard')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Ventes sur l’an dernier' }).locator('..')).toContainText('modifié')

  // Mois en colonnes sur 12 mois : une colonne par mois
  await page.getByLabel('Période').click()
  await page.getByRole('option', { name: '12 derniers mois' }).click()
  await page.getByRole('group', { name: 'Colonnes' }).getByRole('button', { name: 'Mois', exact: true }).click()
  await expect(tableau(page).getByRole('columnheader', { name: 'sept. 26' }).first()).toBeVisible()
  await expect(tableau(page).getByRole('columnheader', { name: 'oct. 25' }).first()).toBeVisible()

  // Filtre sur une typologie inexistante dans la sélection : message clair
  await page.getByRole('group', { name: 'Filtres' }).getByRole('button', { name: 'Filtrer' }).click()
  await page.getByRole('menuitem', { name: 'Franchisé ou intégré' }).click()
  await page.getByRole('dialog').getByLabel('Franchisé', { exact: true }).check()
  await page.getByRole('dialog').getByRole('button', { name: 'Appliquer' }).click()
  await expect(page.getByRole('group', { name: 'Filtres' })).toContainText('Franchisé ou intégré : Franchisé')

  // Enregistrer, partagé à l'équipe
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Titre').fill('Mes typologies')
  await page.getByRole('dialog').getByLabel('Partager avec l’équipe').check()
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Mes typologies' })).toBeVisible()
  const e = ecritures.filter((x) => x.table === 'rpc/enregistrer_rapport').at(-1)!.corps as { p_titre: string; p_partage: boolean; p_modele: boolean; p_definition: { lignes: string; indicateurs: string[]; colonnes: string; periode: { type: string }; filtres: Record<string, string[]> } }
  expect(e.p_titre).toBe('Mes typologies')
  expect(e.p_partage).toBe(true)
  expect(e.p_modele).toBe(false)
  expect(e.p_definition).toMatchObject({ lignes: 'typologie', colonnes: 'mois', periode: { type: 'douze' }, filtres: { contrat: ['Franchisé'] } })
  expect(e.p_definition.indicateurs).toContain('tachesRetard')
  if (!isMobile) await expect(page.getByRole('list', { name: 'Mes rapports' })).toContainText('Mes typologies')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])

  // Supprimer son rapport
  await page.getByRole('button', { name: 'Supprimer ce rapport' }).click()
  await expect(page.getByText('Rapport supprimé')).toBeVisible()
  expect(ecritures.some((x) => x.table === 'rpc/supprimer_rapport')).toBe(true)
})

test('Pilotage : glisser un indicateur et un axe sur PC', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Le glisser-déposer est réservé au PC')
  await seConnecter(page, { rapports: [] })
  await page.goto('./#/pilotage')
  await expect(page.getByRole('heading', { level: 2, name: 'Budget contre réel par magasin' })).toBeVisible()
  await ouvrirConstructeur(page)
  const champs = page.getByRole('complementary', { name: 'Champs du rapport' })
  await champs.getByRole('button', { name: 'Panier moyen HT Cave', exact: true }).dragTo(page.getByRole('group', { name: /^Indicateurs/ }))
  await expect(tableau(page).getByRole('columnheader', { name: 'Panier moyen HT Cave' })).toBeVisible()
  await champs.getByRole('button', { name: 'Zone de chalandise', exact: true }).dragTo(page.getByRole('group', { name: 'Lignes' }))
  await expect(tableau(page).getByRole('columnheader', { name: 'Zone de chalandise' })).toBeVisible()
  // Thème Nine box présent pour l'équipe
  await champs.getByRole('button', { name: 'Nine box et santé' }).click()
  await expect(champs.getByRole('button', { name: 'Note Résultats (sur 3)', exact: true })).toBeVisible()
})

test('Pilotage : le Directeur propose un rapport à tout le réseau', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Même enregistrement que sur PC')
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, rapports: [] })
  await page.goto('./#/pilotage')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Titre').fill('Budget du réseau')
  await page.getByRole('dialog').getByLabel('Proposer comme rapport du siège').check()
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('list', { name: 'Proposés par le siège' })).toContainText('Budget du réseau')
  const e = ecritures.filter((x) => x.table === 'rpc/enregistrer_rapport').at(-1)!.corps as { p_modele: boolean; p_publics: string[] }
  expect(e.p_modele).toBe(true)
  expect(e.p_publics).toEqual(['rr', 'coach', 'franchise'])

  // Un rapport pour les Coachs seulement : rangé avec les rapports des Coachs
  await page.getByRole('button', { name: 'Nouveau rapport' }).click()
  // Un nouveau rapport est à construire : la construction s'ouvre d'office
  await expect(page.getByRole('button', { name: 'Modifier le rapport' })).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Titre').fill('Visites de la semaine')
  await page.getByRole('dialog').getByLabel('Proposer comme rapport du siège').check()
  await page.getByRole('dialog').getByLabel('Pour les Responsables Régionaux').uncheck()
  await page.getByRole('dialog').getByLabel('Pour les franchisés').uncheck()
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('list', { name: 'Pour les Coachs' })).toContainText('Visites de la semaine')
  await expect(page.getByRole('list', { name: 'Proposés par le siège' })).not.toContainText('Visites de la semaine')
  await expect(page.getByText('proposé par le siège · pour les coachs')).toBeVisible()
  const e2 = ecritures.filter((x) => x.table === 'rpc/enregistrer_rapport').at(-1)!.corps as { p_publics: string[] }
  expect(e2.p_publics).toEqual(['coach'])
})

test('Pilotage : écart au budget calculé depuis les budgets du pilotage', async ({ page }) => {
  await seConnecterAvecBudgets(page, {}, { rapports: [] })
  await page.goto('./#/pilotage')
  await expect(page.getByRole('heading', { level: 2, name: 'Budget contre réel par magasin' })).toBeVisible()
  await expect(tableau(page).getByRole('columnheader', { name: 'Écart du CA au budget' })).toBeVisible()
  // Budget validé, budget en discussion, magasin sans budget : statut et CA budgété lus du schéma pilotage
  await expect(tableau(page).getByRole('row', { name: /^Brionne-sur-Lac/ })).toContainText('Validé')
  await expect(tableau(page).getByRole('row', { name: /^Brionne-sur-Lac/ }).getByRole('cell').nth(2)).toHaveText(/\d €$/)
  await expect(tableau(page).getByRole('row', { name: /^Valcourt/ })).toContainText('En discussion')
  await expect(tableau(page).getByRole('row', { name: /^Saint-Aubin-des-Prés/ })).toContainText('Sans budget')
})

test('Pilotage du franchisé : son magasin seul, sans nine box ni axes de l’équipe', async ({ page, isMobile }) => {
  const rapports: RapportSimule[] = [
    { id: 1, titre: 'Modèle du siège', definition: { indicateurs: ['ca', 'caseNineBox'], lignes: 'coach' }, modele: true, partage: false, auteur: 'Directeur', role: 'directeur' },
    { id: 2, titre: 'Rapport du Coach', definition: { indicateurs: ['ca'] }, modele: false, partage: true, auteur: 'Coach', role: 'coach' },
  ]
  await simulerSupabase(page, { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] }, rapports })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  await page.goto('./#/pilotage')
  await expect(page.getByRole('heading', { level: 1, name: 'Pilotage' })).toBeVisible()
  await expect(page.getByText('1 magasin', { exact: false }).first()).toBeVisible()
  // Ses rapports de départ, jamais ceux de l'équipe
  await expect(page.getByRole('heading', { level: 2, name: 'Mon CA mois par mois face à l’an dernier' })).toBeVisible()
  await expect(page.getByText('Franchisés à remobiliser')).toHaveCount(0)
  // Les rapports de l'équipe et ceux réservés à l'équipe n'apparaissent pas
  if (isMobile) {
    await page.getByRole('combobox', { name: 'Rapport' }).click()
    await expect(page.getByRole('option', { name: 'Modèle du siège' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Rapport du Coach' })).toHaveCount(0)
    await expect(page.getByRole('option', { name: 'Nine box et résultats' })).toHaveCount(0)
    await page.getByRole('option', { name: 'Modèle du siège' }).click()
  } else {
    const siege = page.getByRole('list', { name: 'Proposés par le siège' })
    await expect(siege).toContainText('Modèle du siège')
    await expect(siege).not.toContainText('Nine box et résultats')
    await expect(page.getByText('Rapport du Coach')).toHaveCount(0)
    await siege.getByRole('button', { name: 'Modèle du siège', exact: true }).click()
  }
  // Le modèle lui arrive sans la nine box et regroupé par magasin
  await expect(tableau(page).getByRole('columnheader', { name: 'Case de la nine box' })).toHaveCount(0)
  await expect(tableau(page).getByRole('columnheader', { name: 'Magasin' })).toBeVisible()
  await expect(tableau(page).getByRole('row')).toHaveCount(2)
  await ouvrirConstructeur(page)
  await page.getByRole('group', { name: /^Indicateurs/ }).getByRole('button', { name: 'Ajouter' }).click()
  await expect(page.getByRole('menuitem', { name: 'Case de la nine box' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Tâches en retard' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('group', { name: 'Lignes' }).getByRole('combobox').click()
  await expect(page.getByRole('option', { name: 'Coach', exact: true })).toHaveCount(0)
  await expect(page.getByRole('option', { name: 'Typologie', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

// Rapports de départ par public et engagement du franchisé (Joseph, 17/11/2026 au soir)
const jourTest = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const donneesEngagement = () => ({
  communications: [1, 2].map((id) => ({
    id, titre: `Annonce ${id}`, texte: 'Texte.', magasins: null, auteur: 'autre', auteur_nom: 'Dominique DIRECTION', auteur_role: 'directeur',
    cree_le: `${jourTest(-5)}T09:00:00Z`, lus: ['Franchisé 4'], non_lus: ['Franchisé 2'],
  })),
  config: { actions: {
    'Nantes Test': [{ id: 'l1', action: 'Refaire la vitrine', porteur: 'Franchisé 2', echeance: jourTest(-10), creeLe: jourTest(-30) }],
    'Bordeaux Test': [{ id: 'l2', action: 'Commander les coffrets', porteur: 'Franchisé 4', echeance: jourTest(-10), creeLe: jourTest(-30), faite: jourTest(-12) }],
  } },
  messagerie: { messages: [{ id: 1, store: 'Bordeaux Test', auteur: 'f4', auteur_nom: 'Franchisé 4', auteur_role: 'franchise', auteur_cle: 'franchise:Franchisé 4', texte: 'Bien reçu', mentions: [], cree_le: `${jourTest(-1)}T10:00:00Z` }] },
})

test('Pilotage : rapports de départ par public et engagement du franchisé', async ({ page, isMobile }) => {
  await seConnecter(page, { ...donneesEngagement(), rapports: [] })
  await page.goto('./#/pilotage')
  await expect(page.getByRole('heading', { level: 2, name: 'Budget contre réel par magasin' })).toBeVisible()
  const titre = 'Franchisés à remobiliser'
  if (isMobile) {
    await page.getByRole('combobox', { name: 'Rapport' }).click()
    await page.getByRole('option', { name: titre, exact: true }).first().click()
  } else {
    // Le Directeur voit les rapports de départ des trois publics
    await expect(page.getByRole('list', { name: 'Pour les Coachs' })).toContainText('Mes magasins : qui voir en priorité')
    await expect(page.getByRole('list', { name: 'Pour les franchisés' })).toContainText('Mon budget : où j’en suis')
    await page.getByRole('list', { name: 'Pour les Responsables Régionaux' }).getByRole('button', { name: titre, exact: true }).click()
  }
  await expect(page.getByRole('heading', { level: 2, name: titre })).toBeVisible()
  await expect(tableau(page).getByRole('columnheader', { name: 'Tâches tenues dans les délais (90 jours)' })).toBeVisible()
  await expect(tableau(page).getByRole('row', { name: /^Nantes Test/ }).getByRole('cell').nth(1)).toHaveText(/^0(,0)?\s%$/)
  await expect(tableau(page).getByRole('row', { name: /^Bordeaux Test/ }).getByRole('cell').nth(1)).toHaveText(/^100(,0)?\s%$/)
  await expect(tableau(page).getByRole('row', { name: /^Nantes Test/ }).getByRole('cell').nth(3)).toHaveText(/^0(,0)?\s%$/)
  // Regroupement par engagement
  await ouvrirConstructeur(page)
  await page.getByRole('group', { name: 'Lignes' }).getByRole('combobox').click()
  await page.getByRole('option', { name: 'Engagement du franchisé', exact: true }).click()
  await expect(tableau(page).getByRole('row', { name: /^Peu engagé/ })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('Pilotage du Coach : ses rapports de départ d’abord', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Même liste sur téléphone')
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Noé MODELE' }, rapports: [
    { id: 3, titre: 'Visites de la semaine', definition: { indicateurs: ['visites'] }, modele: true, partage: false, publics: ['coach'], auteur: 'Directeur', role: 'directeur' },
    { id: 4, titre: 'Mon mois en caisse', definition: { indicateurs: ['ca'] }, modele: true, partage: false, publics: ['franchise'], auteur: 'Directeur', role: 'directeur' },
  ] })
  await page.goto('./#/pilotage')
  await expect(page.getByRole('heading', { level: 2, name: 'Mes magasins : qui voir en priorité' })).toBeVisible()
  const depart = page.getByRole('list', { name: 'Pour bien démarrer' })
  await expect(depart).toContainText('Franchisés à remobiliser')
  await expect(depart).not.toContainText('Ma région')
  await expect(depart).not.toContainText('Mon budget')
  // Modèles du siège : celui des Coachs avec ses rapports de départ, celui des franchisés jamais
  await expect(depart).toContainText('Visites de la semaine')
  await expect(page.getByText('Mon mois en caisse')).toHaveCount(0)
})

test('Pilotage : déploiements par thématique, en indicateur et en regroupement', async ({ page, isMobile }) => {
  await seConnecter(page, { rapports: [], config: { deploiements: { valeurs: { 'Nantes Test': { terrasse: 'Oui' }, 'Bordeaux Test': { terrasse: 'Non' } } } } })
  await page.goto('./#/pilotage')
  await choisirRapport(page, 'Déploiements par Responsable Régional', isMobile)
  await ouvrirConstructeur(page)
  await page.getByRole('group', { name: 'Lignes' }).getByRole('combobox').click()
  await page.getByRole('option', { name: 'Déploiement : Terrasse', exact: true }).click()
  await page.getByRole('group', { name: /^Indicateurs/ }).getByRole('button', { name: 'Ajouter' }).click()
  await page.getByRole('menuitem', { name: 'Terrasse : part déployée', exact: true }).click()
  await expect(tableau(page).getByRole('columnheader', { name: 'Terrasse : part déployée' })).toBeVisible()
  await expect(tableau(page).getByRole('row', { name: /^Oui/ })).toContainText('100')
  await expect(tableau(page).getByRole('row', { name: /^Non(?! renseigné)/ })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('Pilotage : favoris en tête et rapports masqués', async ({ page, isMobile }) => {
  await seConnecter(page, { rapports: [] })
  await page.goto('./#/pilotage')
  await choisirRapport(page, 'Paniers et tickets Cave et Bar', isMobile)
  await page.getByRole('button', { name: 'Ajouter à mes favoris' }).click()
  await expect(page.getByRole('button', { name: 'Retirer de mes favoris' })).toHaveAttribute('aria-pressed', 'true')
  await choisirRapport(page, 'Marché extérieur', isMobile)
  await page.getByRole('button', { name: 'Masquer de ma liste' }).click()
  await expect(page.getByText('Rapport masqué de ta liste')).toBeVisible()
  if (isMobile) {
    await page.getByRole('combobox', { name: 'Rapport' }).click()
    const options = page.getByRole('listbox')
    await expect(options).toContainText(/^Mes favoris\s*Paniers et tickets Cave et Bar/)
    await expect(options.getByText('Masqués', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
  } else {
    await expect(page.getByRole('list', { name: 'Mes favoris' })).toContainText('Paniers et tickets Cave et Bar')
    await expect(page.getByRole('list', { name: 'Proposés par le siège' })).not.toContainText('Paniers et tickets Cave et Bar')
    await expect(page.getByRole('list', { name: 'Proposés par le siège' })).not.toContainText('Marché extérieur')
    await page.getByRole('button', { name: 'Rapports masqués (1)' }).click()
    await page.getByRole('button', { name: 'Réafficher Marché extérieur' }).click()
    await expect(page.getByRole('list', { name: 'Proposés par le siège' })).toContainText('Marché extérieur')
    // Étoile directement dans la liste
    await page.getByRole('button', { name: 'Ajouter Ventes sur l’an dernier à mes favoris' }).click()
    await expect(page.getByRole('list', { name: 'Mes favoris' })).toContainText('Ventes sur l’an dernier')
  }
  // Le premier favori s'ouvre par défaut au retour sur l'onglet
  await page.goto('./#/accueil')
  await page.goto('./#/pilotage')
  await expect(page.getByRole('heading', { level: 2, name: 'Paniers et tickets Cave et Bar' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})
