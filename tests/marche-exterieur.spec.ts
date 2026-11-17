import { expect, test, type Page, type Route } from '@playwright/test'
import { seConnecter, simulerSupabase, COMPTE, textesTropPetits, type Ecriture, type OptionsSimulation } from './supabase-simule'
import { zonesTropPetites } from './pilotage/supabase-simule'

// Plan d'action « Marché extérieur » en 6 étapes (Joseph, 16/11/2026), pour l'équipe et le franchisé.
// L'Annuaire des entreprises est simulé : entreprises et traiteur fictifs autour du magasin. Données fictives uniquement.
const NOM = 'Annecy Test'
const fiche = (etape?: number) => `./#/magasins/${encodeURIComponent(NOM)}?vue=exterieur${etape ? `&etape=${etape}` : ''}`

// Réponse de l'Annuaire pour les codes postaux du rayon : un grand site (groupe de 10 000 salariés, 500 sur place),
// une entreprise de 50 à 99 salariés, l'agence d'un groupe trop petite sur place (écartée), un site à l'effectif non
// publié, un V and B (jamais une cible), un site hors rayon ; un traiteur ; rien pour les autres types
const demandes: string[] = []
async function annuaire(page: Page) {
  demandes.length = 0
  const points: { lat: number; lon: number }[] = []
  const centre = () => ({ lat: points.reduce((s, p) => s + p.lat, 0) / points.length, lon: points.reduce((s, p) => s + p.lon, 0) / points.length })
  await page.route(/^https:\/\/geo\.api\.gouv\.fr\//, (r: Route) => {
    const u = new URL(r.request().url())
    if (u.pathname === '/communes' && !u.searchParams.get('lat')) return r.fallback()
    if (!/^\/(communes|departements\/\w+\/communes)$/.test(u.pathname)) return r.fallback()
    if (u.pathname === '/communes') { points.push({ lat: Number(u.searchParams.get('lat')), lon: Number(u.searchParams.get('lon')) }); return r.fulfill({ json: [{ codeDepartement: '74' }] }) }
    const c = centre()
    return r.fulfill({ json: [{ codesPostaux: ['74000'], centre: { type: 'Point', coordinates: [c.lon, c.lat] } }, { codesPostaux: ['74960'], centre: { type: 'Point', coordinates: [c.lon, c.lat + 0.05] } }, { codesPostaux: ['13001'], centre: { type: 'Point', coordinates: [5.37, 43.3] } }] })
  })
  await page.route(/^https:\/\/recherche-entreprises\.api\.gouv\.fr\//, (r: Route) => {
    const u = new URL(r.request().url())
    demandes.push(u.search)
    const { lat, lon } = centre()
    const etab = (siret: string, naf: string, tranche: string | null, dlat: number, enseigne?: string) => ({ siret, activite_principale: naf, tranche_effectif_salarie: tranche, latitude: String(lat + dlat), longitude: String(lon), adresse: '1 RUE DES ESSAIS 74000 ANNECY', etat_administratif: 'A', liste_enseignes: enseigne ? [enseigne] : null })
    const vide = { results: [], total_pages: 1 }
    if (u.searchParams.get('tranche_effectif_salarie')) {
      return r.fulfill({ json: { total_pages: 1, results: [
        { siren: '000000001', nom_complet: 'ATELIERS FICTIFS DU LAC', tranche_effectif_salarie: '21', matching_etablissements: [etab('00000000100011', '28.29B', '21', 0.01)] },
        { siren: '000000002', nom_complet: 'V AND B EXEMPLE', tranche_effectif_salarie: '12', matching_etablissements: [etab('00000000200011', '47.25Z', '12', 0.005)] },
        { siren: '000000004', nom_complet: 'GROUPE AERONAUTIQUE FICTIF', tranche_effectif_salarie: '53', matching_etablissements: [etab('00000000400011', '26.51A', '41', 0.04), etab('00000000400029', '26.51A', '32', 0.5)] },
        { siren: '000000005', nom_complet: 'BANQUE FICTIVE', tranche_effectif_salarie: '53', matching_etablissements: [etab('00000000500011', '64.19Z', '02', 0.001)] },
        { siren: '000000006', nom_complet: 'LOGISTIQUE DISCRETE', tranche_effectif_salarie: '22', matching_etablissements: [etab('00000000600011', '52.29A', null, 0.02)] },
      ] } })
    }
    if ((u.searchParams.get('activite_principale') ?? '').includes('56.21Z')) {
      return r.fulfill({ json: { total_pages: 1, results: [
        { siren: '000000003', nom_complet: 'SAVEURS SIMULEES', finances: { '2022': { ca: 900000 }, '2023': { ca: 1400000 } }, matching_etablissements: [etab('00000000300011', '56.21Z', '03', 0.02, 'TRAITEUR DU TEST')] },
      ] } })
    }
    return r.fulfill({ json: vide })
  })
}

const derniere = (ecritures: Ecriture[], cle: string) => {
  const e = ecritures.filter((x) => x.table === 'app_config' && (x.corps as { key?: string }).key === cle).at(-1)
  return e ? JSON.parse((e.corps as { value: string }).value) : null
}

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('Marché extérieur : repérage, cibles, diagnostic, matrice et plan d’action', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, persister: true })
  await annuaire(page)
  await page.goto(fiche())
  const etapes = page.getByRole('navigation', { name: 'Étapes du plan marché extérieur' })
  await expect(etapes.getByRole('button')).toHaveCount(6)
  await expect(etapes.getByRole('button', { name: 'Étape Magasin' })).toHaveAttribute('aria-current', 'step')
  await page.getByLabel('Objectif de CA extérieur sur un an (€ HT)').fill('40000')
  await expect(page.getByText('Enregistré')).toBeVisible()
  expect(derniere(ecritures, 'exterieur_magasins')[NOM].objectif).toBe(40000)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])

  // 2 · Repérage : entreprises de 20 salariés et plus, puis traiteur ; le V and B est écarté
  await page.getByRole('button', { name: 'Repérage', exact: true }).click()
  await page.getByRole('button', { name: 'Chercher dans un rayon de 10 km' }).click()
  await expect(page.getByLabel('Retenir Ateliers Fictifs Du Lac')).toBeVisible()
  await expect(page.getByLabel('Retenir Traiteur Du Test (Saveurs Simulees)')).toBeVisible()
  await expect(page.getByText(/V And B Exemple/)).toHaveCount(0)
  // L'agence du groupe (3 à 5 salariés sur place) et le site hors rayon sont écartés ; le grand site arrive en tête
  await expect(page.getByText(/Banque Fictive/)).toHaveCount(0)
  await expect(page.getByLabel(/^Retenir Groupe Aeronautique Fictif/)).toHaveCount(1)
  await expect(page.getByLabel(/^Retenir /).first()).toHaveAttribute('aria-label', 'Retenir Groupe Aeronautique Fictif')
  expect(demandes.some((d) => d.includes('code_postal=74000,74960') && !d.includes('13001') && d.includes('tranche_effectif_salarie=12,21'))).toBe(true)
  // Cibles conseillées : cœur et raison ; chiffre d'affaires du traiteur (dernière année publiée) ; toutes restent listées
  await expect(page.getByRole('img', { name: /^Conseillée : / })).toHaveCount(3)
  await expect(page.getByRole('img', { name: 'Conseillée : Grand prescripteur : volume d’événements' })).toBeVisible()
  await expect(page.getByText('1,4 M€ (2023)').first()).toBeVisible()
  await expect(page.getByLabel(/^Retenir /).last()).toHaveAttribute('aria-label', 'Retenir Logistique Discrete')
  await page.getByRole('button', { name: 'Conseillées · 3' }).click()
  await expect(page.getByLabel('Retenir Logistique Discrete')).toHaveCount(0)
  await page.getByRole('button', { name: 'Conseillées · 3' }).click()
  await expect(page.getByLabel('Retenir Logistique Discrete')).toHaveCount(1)
  // Filtres de la liste : effectif du site, puis nom
  await page.getByLabel('Effectif du site').selectOption('100')
  await expect(page.getByRole('button', { name: 'Tous · 1' })).toBeVisible()
  await page.getByLabel('Effectif du site').selectOption('0')
  await expect(page.getByRole('button', { name: 'Tous · 4' })).toBeVisible()
  await page.getByLabel('Chercher un nom ou une activité').fill('traiteur')
  await expect(page.getByRole('button', { name: 'Tous · 1' })).toBeVisible()
  await page.getByLabel('Chercher un nom ou une activité').fill('')
  await page.getByRole('button', { name: 'Prescripteurs · 1' }).click()
  await expect(page.getByLabel('Retenir Ateliers Fictifs Du Lac')).toHaveCount(0)
  await page.getByRole('button', { name: 'Tous · 4' }).click()
  await page.getByLabel('Retenir Ateliers Fictifs Du Lac').check()
  await page.getByLabel('Retenir Traiteur Du Test (Saveurs Simulees)').check()
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])

  // 3 · Cibles : un business club ajouté à la main
  await page.getByRole('button', { name: 'Cibles', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mes cibles · 2' })).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter une cible' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une cible' })
  await d.getByRole('textbox', { name: 'Nom', exact: true }).fill('Club des entrepreneurs fictifs')
  await d.getByLabel('Salariés, licenciés ou adhérents').fill('120')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('heading', { name: 'Mes cibles · 3' })).toBeVisible()
  await expect(page.getByText(isMobile ? /120 membres ou salariés/ : '120', { exact: !isMobile })).toBeVisible()
  // Joseph (17/11/2026) : une cible déjà sous contrat avant l'app, CA annuel facultatif, contrat souvent non écrit
  await page.getByRole('button', { name: 'Modifier Club des entrepreneurs fictifs' }).click()
  const k = page.getByRole('dialog', { name: 'Modifier Club des entrepreneurs fictifs' })
  await k.getByLabel('Contrat en cours').check()
  await k.getByLabel('CA annuel du contrat (€ HT)').fill('12000')
  await k.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/^Contrat en cours · 12\s000 € HT par an · non écrit$/)).toBeVisible()
  await expect.poll(() => derniere(ecritures, 'exterieur_magasins')?.[NOM]?.cibles?.find((c: { nom: string }) => c.nom === 'Club des entrepreneurs fictifs')?.contrat).toEqual({ ca: 12000, ecrit: false })
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])

  // 4 · Diagnostic : l'atelier rapporte (5/5 en direct) sans relais (1/5) → client à signer ; le traiteur partout à 4 → priorité
  await page.getByRole('button', { name: 'Diagnostic', exact: true }).click()
  // Joseph (17/11/2026) : la liste des cibles, on choisit celle à noter ; le panneau garde les notes, on peut y revenir
  await expect(page.getByRole('heading', { name: 'Diagnostic · 3 cibles à noter' })).toBeVisible()
  const noter = async (nom: string, notes: number[]) => {
    await page.getByRole('button', { name: new RegExp(`^(Noter|Modifier le diagnostic de) ${nom}`) }).click()
    const f = page.getByRole('dialog', { name: new RegExp(`^Diagnostic de ${nom}`) })
    for (const [i, c] of ['Potentiel commercial', 'Visibilité', 'Prescription', 'Bénéfice concret attendu', 'Intérêt pour la cause'].entries()) await f.getByRole('button', { name: `${c} : ${notes[i]} sur 5` }).click()
    return f
  }
  const f = await noter('Ateliers Fictifs Du Lac', [5, 1, 1, 5, 1])
  await expect(f.getByText('Valeur directe 5,0 / 5')).toBeVisible()
  await expect(f.getByText('Valeur relais 1,0 / 5')).toBeVisible()
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await f.getByRole('button', { name: 'Enregistrer' }).click()
  await (await noter('Traiteur Du Test', [4, 4, 4, 4, 4])).getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('heading', { name: 'Diagnostic · 1 cible à noter' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Modifier le diagnostic de Ateliers Fictifs Du Lac' })).toBeVisible()
  // Retirer une cible depuis le diagnostic, puis « Annuler »
  if (!isMobile) {
    await page.getByRole('button', { name: 'Retirer Club des entrepreneurs fictifs' }).click()
    await expect(page.getByRole('heading', { name: 'Diagnostic · toutes les cibles sont notées' })).toBeVisible()
    await page.getByRole('button', { name: 'Annuler' }).click()
    await expect(page.getByRole('heading', { name: 'Diagnostic · 1 cible à noter' })).toBeVisible()
  }
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])

  // 5 · Matrice : une cible par case notée, le club hors matrice
  await page.getByRole('button', { name: 'Matrice', exact: true }).click()
  await expect(page.getByText('1 cible pas encore notée, hors matrice.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Priorité' })).toContainText('Traiteur Du Test')
  await expect(page.getByRole('region', { name: 'Client à signer' })).toContainText('Ateliers Fictifs Du Lac')
  await expect(page.getByRole('img', { name: /Matrice des opportunités/ })).toBeVisible()

  // 6 · Plan : la priorité en tête ; CA visé et simulateur sur la cible ; plusieurs actions, chacune une tâche du magasin
  await page.getByRole('button', { name: 'Plan d’action', exact: true }).click()
  await expect(page.getByRole('region', { name: /^Actions pour / }).first()).toHaveAttribute('aria-label', 'Actions pour Traiteur Du Test (Saveurs Simulees)')
  await page.getByRole('button', { name: 'CA visé pour Traiteur Du Test (Saveurs Simulees)' }).click()
  const o = page.getByRole('dialog', { name: /^CA visé pour Traiteur/ })
  await o.getByLabel('CA visé sur un an (€ HT)').fill('8000')
  await o.getByRole('button', { name: 'Enregistrer' }).click()
  await page.getByRole('button', { name: 'Ajouter une action pour Traiteur Du Test (Saveurs Simulees)' }).click()
  const a = page.getByRole('dialog', { name: /^Action pour Traiteur/ })
  await expect(a.getByLabel('Action')).toHaveValue('Dégustation et grille tarifaire réservée aux prescripteurs')
  await a.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('list', { name: 'Tâches pour Traiteur Du Test (Saveurs Simulees)' }).getByText('Dégustation et grille tarifaire réservée aux prescripteurs')).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter une action pour Traiteur Du Test (Saveurs Simulees)' }).click()
  const a2 = page.getByRole('dialog', { name: /^Action pour Traiteur/ })
  await expect(a2.getByLabel('Action')).toHaveValue('')
  await a2.getByLabel('Action').fill('Relancer en janvier pour les mariages')
  await a2.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('list', { name: 'Tâches pour Traiteur Du Test (Saveurs Simulees)' }).getByRole('listitem')).toHaveCount(2)
  // Les deux actions sont des tâches du magasin, rattachées à la cible
  const taches = () => { const e = ecritures.filter((x) => x.table === 'app_config' && (x.corps as { key?: string }).key === 'actions').at(-1); return e ? JSON.parse((e.corps as { value: string }).value)[NOM] ?? [] : [] }
  await expect.poll(() => taches().filter((t: { exterieur?: { nom: string } }) => t.exterieur?.nom === 'Traiteur Du Test (Saveurs Simulees)').length).toBe(2)
  await expect(page.getByRole('link', { name: 'Chiffrer Traiteur Du Test (Saveurs Simulees) : Contrat extérieur' })).toHaveAttribute('href', /vue=simulateurs&partie=simulateurs&sim=exterieur$/)
  await expect(page.getByText('20 %')).toBeVisible() // 8 000 € sur un objectif de 40 000 €
  // L'action se garde juste après les notes : on attend la dernière écriture, celle qui porte le CA visé
  const traiteurEcrit = () => derniere(ecritures, 'exterieur_magasins')?.[NOM]?.cibles?.find((c: { nom: string }) => c.nom.startsWith('Traiteur'))
  await expect.poll(() => traiteurEcrit()?.caVise).toBe(8000)
  expect(derniere(ecritures, 'exterieur_magasins')[NOM].cibles).toHaveLength(3)
  const traiteur = derniere(ecritures, 'exterieur_magasins')[NOM].cibles.find((c: { nom: string }) => c.nom.startsWith('Traiteur'))
  expect(derniere(ecritures, 'exterieur_magasins')[NOM].cibles.find((c: { nom: string }) => c.nom.startsWith('Club')).membres).toBe(120)
  expect(traiteur).toMatchObject({ categorie: 'prescripteur', source: 'annuaire', caVise: 8000, offre: 'exterieur', notes: { potentiel: 4, cause: 4 } })
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('Marché extérieur : le franchisé bâtit le plan de son magasin', async ({ page, isMobile }) => {
  const franchise: OptionsSimulation = { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: [NOM] }, persister: true }
  await simulerSupabase(page, franchise)
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  await page.goto(fiche(3))
  await page.getByRole('button', { name: 'Ajouter une cible' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une cible' })
  await d.getByRole('textbox', { name: 'Nom', exact: true }).fill('Comité des fêtes fictif')
  await d.getByLabel('Type').click()
  await page.getByRole('option', { name: 'Association ou club' }).click()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Enregistré')).toBeVisible()
  // Relu depuis la base après rechargement : le plan est bien gardé pour son magasin
  await page.reload()
  // Téléphone : l'onglet n'est pas dans la barre (Budget et Simuler y restent), le bouton du haut l'ouvre
  if (isMobile) {
    await page.goto(`./#/magasins/${encodeURIComponent(NOM)}`)
    await page.getByRole('button', { name: 'Marché extérieur' }).click()
  }
  await page.getByRole('button', { name: /^Étape Cibles/ }).click()
  await expect(page.getByRole('heading', { name: 'Mes cibles · 1' })).toBeVisible()
  await expect(page.getByText('Comité des fêtes fictif').first()).toBeVisible()
  // Il ajoute une action : elle devient une tâche de son magasin, gardée après rechargement
  await page.getByRole('button', { name: /^Étape Plan d’action/ }).click()
  await page.getByRole('button', { name: 'Ajouter une action pour Comité des fêtes fictif' }).click()
  const t = page.getByRole('dialog', { name: 'Action pour Comité des fêtes fictif' })
  await t.getByLabel('Action').fill('Proposer la buvette du vide-greniers')
  await t.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('list', { name: 'Tâches pour Comité des fêtes fictif' }).getByText('Proposer la buvette du vide-greniers')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('list', { name: 'Tâches pour Comité des fêtes fictif' }).getByText('Proposer la buvette du vide-greniers')).toBeVisible()
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('Marché extérieur : annuaire injoignable, un message humain et l’ajout à la main reste possible', async ({ page }) => {
  await seConnecter(page)
  await page.route(/^https:\/\/recherche-entreprises\.api\.gouv\.fr\//, (r) => r.fulfill({ status: 503, body: '' }))
  await page.goto(fiche(2))
  await page.getByRole('button', { name: 'Chercher dans un rayon de 10 km' }).click()
  await expect(page.getByText('L’Annuaire des entreprises ne répond pas pour le moment. Réessaie dans quelques minutes, ou ajoute tes cibles à la main à l’étape suivante.')).toBeVisible()
})

test('Marché extérieur depuis le menu : on choisit le magasin, puis son plan', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./')
  if (isMobile) {
    await page.getByRole('button', { name: 'Mon compte' }).click()
    await page.getByRole('menu').getByRole('menuitem', { name: 'Marché extérieur' }).click()
  } else {
    await page.getByRole('navigation').getByRole('button', { name: 'Marché extérieur' }).click()
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Marché extérieur' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Magasin' }).fill(NOM)
  await page.getByRole('option', { name: NOM }).click()
  await expect(page.getByRole('link', { name: 'Fiche du magasin' })).toHaveAttribute('href', new RegExp(encodeURIComponent(NOM)))
  await expect(page.getByRole('navigation', { name: 'Étapes du plan marché extérieur' }).getByRole('button')).toHaveCount(6)
  await page.getByLabel('Objectif de CA extérieur sur un an (€ HT)').fill('25000')
  await expect(page.getByText('Enregistré')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('Marché extérieur depuis le menu du franchisé : ouvre le plan de son magasin', async ({ page }) => {
  await simulerSupabase(page, { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: [NOM] } })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  await page.goto('./#/marche-exterieur')
  await expect(page).toHaveURL(/vue=exterieur/)
  await expect(page.getByRole('navigation', { name: 'Étapes du plan marché extérieur' }).getByRole('button')).toHaveCount(6)
})
