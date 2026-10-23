import { expect, test } from '@playwright/test'
import { choisirMois, seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('Équipe s’ouvre sur l’organigramme par Responsable Régional', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe')
  await expect(page.getByRole('tab', { name: 'Organisation', selected: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Alex NORD' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Léa INTEGRES' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Camille TESTARD' })).toBeVisible()
  await expect(page.getByText('Tom TECHNICIEN')).toBeVisible()
  await expect(page.getByRole('link', { name: /poste.* à pourvoir/ })).toBeVisible()
  await expect(page.getByText('Dominique DIRECTION').first()).toBeVisible()
  // Pyramide par défaut sur PC, liste sur téléphone
  await expect(page.getByRole('button', { name: isMobile ? 'Liste' : 'Pyramide', pressed: true })).toBeVisible()
  if (!isMobile) {
    await page.screenshot({ path: `captures/${info.project.name}-equipe-pyramide.png`, fullPage: true })
    await page.getByRole('button', { name: 'Liste' }).click()
  }
  // Liste groupée par Responsable Régional : ses Coachs en lignes, sans arbre à déplier
  await expect(page.getByRole('button', { name: 'Tout déplier' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Coachs de Alex NORD' }).getByRole('link').first()).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-equipe.png`, fullPage: !isMobile })
})

test('Paramètres > Charge des Coachs : route par an par la route, simulation d’un changement puis validation', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/plus/charge')
  await expect(page.getByRole('heading', { name: 'Charge des Coachs', level: 1 })).toBeVisible()
  await expect(page.getByRole('tab', { name: isMobile ? 'Charge' : 'Charge et simulation', selected: true })).toBeVisible()
  const lignes = page.getByRole('region', { name: 'Charge par Coach' })
  await expect(lignes.getByRole('link', { name: /Noé MODELE/ })).toBeVisible()
  await expect(lignes.getByText(/[\d\s]+ km · \d+ h de route par an/).first()).toBeVisible()
  // Déplier un Coach : ses magasins du plus loin au plus près, aller-retour par la route et visites du rythme
  await page.getByRole('button', { name: 'Déplier Noé MODELE' }).click()
  const lyon = page.getByRole('list', { name: 'Magasins de Noé MODELE' }).getByRole('listitem', { name: 'Lyon Test' })
  await expect(lyon).toContainText(/aller-retour \([\d\s]+ km\) · \d visites? par an/)
  await expect(page.getByText('Changements dans les douze prochains mois')).toBeVisible()
  // Simuler : Lyon Test passe à Camille TESTARD, l’effet sur les deux Coachs s’affiche avant de valider
  const choix = lyon.getByLabel('Confier à')
  const option = await choix.locator('option', { hasText: 'Camille TESTARD' }).getAttribute('value')
  await choix.selectOption(option!)
  const simulation = page.getByRole('region', { name: 'Simulation' })
  await expect(simulation).toContainText('Lyon Test : Noé MODELE → Camille TESTARD')
  await expect(simulation.getByRole('listitem', { name: 'Noé MODELE' })).toContainText(/h → \d+ h de route par an/)
  await expect(simulation.getByRole('listitem', { name: 'Camille TESTARD' })).toContainText(/Charge \d+ → \d+/)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-charge-simulation.png`, fullPage: true })
  await choisirMois(page, 'À partir de', 'Novembre 2026')
  await simulation.getByRole('button', { name: 'Valider 1 changement' }).click()
  await expect(page.getByText('1 magasin change de Coach à partir de novembre 2026.')).toBeVisible()
  expect(ecritures.filter((e) => e.methode === 'POST')).toEqual([expect.objectContaining({ table: 'reassigns', corps: expect.objectContaining({ store: 'Lyon Test', cs: 'Camille TESTARD', date: '2026-11-01', note: 'Simulation de charge' }) })])
  // Sur PC, le tableau reste au choix
  if (!isMobile) {
    await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Tableau' }).click()
    await expect(page.getByRole('table', { name: 'Charge par Coach' })).toContainText('Noé MODELE')
    await expect(page.getByRole('table', { name: 'Charge par Coach' }).getByText(/[\d\s]+ km · \d+ h/).first()).toBeVisible()
  }
  await page.getByRole('tab', { name: isMobile ? 'Répartition' : 'Répartition proposée' }).click()
  await expect(page.getByLabel('À partir de')).toBeVisible()
})

test('les anciennes adresses de la charge mènent à Paramètres, la fiche Coach n’a plus d’onglet Charge', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/equipe?vue=charge')
  await expect(page.getByRole('heading', { name: 'Charge des Coachs', level: 1 })).toBeVisible()
  await page.goto('./#/equipe?vue=plan')
  await expect(page).toHaveURL(/parametres\/charge\?vue=repartition/)
  await page.goto('./#/equipe/coach/No%C3%A9%20MODELE')
  await expect(page.getByRole('heading', { name: 'Noé MODELE', level: 1 })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Charge' })).toHaveCount(0)
})

test('l’onglet Postes à pourvoir liste Coachs à recruter, arrivées et responsables', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe?vue=postes')
  await expect(page.getByRole('heading', { name: /Coachs à recruter \(1\)/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Poste NORD' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Zoé ARRIVEE' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Franchisés à trouver/ })).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-equipe-postes.png`, fullPage: !isMobile })
})

test('la fiche Coach montre portefeuille et magasins', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe')
  await page.getByRole('link', { name: 'Noé MODELE' }).click()
  await expect(page.getByRole('heading', { name: 'Noé MODELE', level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Portefeuille' })).toBeVisible()
  await page.getByRole('tab', { name: 'Magasins' }).click()
  await expect(page.getByRole('region', { name: 'Liste des magasins' }).getByRole('link', { name: /^Lyon Test/ })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-coach.png`, fullPage: true })
})

test('réaffecter un magasin propose le Coach le plus proche et enregistre', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Nantes%20Test?vue=fiche')
  await page.getByRole('button', { name: 'Réaffecter' }).click()
  const dialogue = page.getByRole('dialog', { name: 'Réaffecter Nantes Test' })
  await expect(dialogue).toBeVisible()
  const liste = dialogue.getByRole('list', { name: 'Coachs proposés' }).getByRole('button')
  // Seul le poste à pourvoir resterait sous le maximum ; parmi les autres, le plus proche vient en premier
  await expect(liste.nth(0)).toContainText('Poste NORD')
  await expect(liste.nth(1)).toContainText('Noé MODELE')
  await expect(liste.nth(1)).toContainText(/de route \([\d\s]+ km\)/)
  await expect(liste.nth(1)).toContainText(/\+\d+ h de route par an/)
  await choisirMois(page, 'À partir de', 'Novembre 2026')
  await page.screenshot({ path: `captures/${info.project.name}-reaffecter.png` })
  await liste.nth(1).click()
  await dialogue.getByRole('button', { name: 'Confier à Noé MODELE' }).click()
  await expect(page.getByText('Nantes Test est confié à Noé MODELE.')).toBeVisible()
  // Au mois : un seul changement par mois, celui du même mois est d'abord retiré
  expect(ecritures[0]).toMatchObject({ methode: 'DELETE', table: 'reassigns' })
  expect(ecritures[0].filtre).toContain('store=eq.Nantes')
  expect(ecritures[0].filtre).toContain('date=gte.2026-11-01')
  expect(ecritures[0].filtre).toContain('date=lt.2026-12-01')
  expect(ecritures.slice(1)).toEqual([expect.objectContaining({ methode: 'POST', table: 'reassigns', corps: expect.objectContaining({ store: 'Nantes Test', cs: 'Noé MODELE', date: '2026-11-01', type: 'manual', note: 'Réaffectation' }) })])
})

test('Direction règle la charge sans perdre les autres paramètres', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/parametres/reglages?rubrique=charge')
  await page.getByLabel('Charge maximale d’un Coach').fill('10')
  await expect(page.getByText(/Avec ces réglages, 0 Coach serait en dépassement/)).toBeVisible()
  await page.getByLabel('Charge maximale d’un Coach').fill('0')
  await expect(page.getByRole('button', { name: 'Enregistrer' }).first()).toBeDisabled()
  await page.getByLabel('Charge maximale d’un Coach').fill('10')
  await page.screenshot({ path: `captures/${info.project.name}-direction.png`, fullPage: !isMobile })
  await page.getByRole('button', { name: 'Enregistrer' }).first().click()
  await expect(page.getByText('Règle de charge enregistrée.')).toBeVisible()
  const ecrite = ecritures.find((e) => e.table === 'app_config')!
  const valeur = JSON.parse((ecrite.corps as { value: string }).value)
  expect(valeur).toMatchObject({ maxUnits: 10, alertThreshold: 7, poidsOuvert: 1, poidsRenforce: 2, prepDuration: 2, postDuration: 4, directionHorizon: 6 })
})

const dernier = (ecritures: Ecriture[], table: string) => ecritures.filter((e) => e.table === table).at(-1)
const configEcrite = (e: Ecriture | undefined) => JSON.parse((e!.corps as { value: string }).value)
// Dernière écriture d'une clé de app_config (mise à jour filtrée sur la clé, ou création qui la porte)
const cle = (ecritures: Ecriture[], k: string) => configEcrite(ecritures.filter((e) => e.table === 'app_config' && (e.filtre.includes(`key=eq.${k}`) || (e.corps as { key?: string }).key === k)).at(-1))

test('ajouter un Coach l’enregistre et le rattache à son Responsable Régional', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/parametres/collaborateurs')
  await page.getByRole('button', { name: 'Ajouter un collaborateur' }).click()
  await page.getByRole('menuitem', { name: 'Un Coach' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter un Coach' })
  await d.getByLabel('Prénom').fill('Hugo')
  await d.getByLabel(/^Nom/).fill('FICTIF')
  await expect(d.getByText('Cette personne existe déjà')).toBeVisible()
  await d.getByLabel('Prénom').fill('Lou')
  await d.getByLabel(/^Nom/).fill('NOUVEAU')
  await d.getByLabel('Code postal').fill('69002')
  await expect(d.getByLabel('Département')).toHaveValue('69')
  await d.getByLabel('Téléphone').fill('+33 6 99 99 99 99')
  await d.getByLabel('Responsable Régional').click()
  await expect(page.getByRole('option', { name: 'Léa INTEGRES' })).toHaveCount(0)
  await page.getByRole('option', { name: 'Sam SUD' }).click()
  await page.screenshot({ path: `captures/${info.project.name}-ajouter-coach.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page).toHaveURL(/coach\/Lou%20NOUVEAU/) // la base simulée ne garde pas l’ajout : on vérifie l’ouverture de sa fiche
  expect(dernier(ecritures, 'cs_overrides')).toMatchObject({ methode: 'POST', corps: { cs_name: 'Lou NOUVEAU', tel: '+33 6 99 99 99 99', fictif: false } })
  const config = cle(ecritures, 'drs_data')
  expect(config.dr_assigns.at(-1)).toMatchObject({ cs: 'Lou NOUVEAU', dr: 'rr2' })
  expect(config.drs).toHaveLength(3) // le reste de la configuration est conservé
  expect(cle(ecritures, 'fiches_personnes')['coach:Lou NOUVEAU']).toMatchObject({ prenom: 'Lou', nom: 'NOUVEAU', codePostal: '69002', departement: '69', pays: 'France' })
  expect(cle(ecritures, 'fiches_personnes')['rr:rr1']).toMatchObject({ ville: 'Lille' }) // les autres fiches sont conservées
})

test('modifier un Responsable Régional et le Directeur', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/equipe?forme=pyramide')
  await page.getByRole('link', { name: /Sam SUD/ }).click()
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Modifier Sam SUD' })
  await d.getByLabel('Email').fill('sam@exemple')
  await expect(d.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await d.getByLabel('Email').fill('sam@exemple.test')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Sam SUD est mis à jour.')).toBeVisible()
  expect(cle(ecritures, 'drs_data').drs.find((r: { id: string }) => r.id === 'rr2')).toMatchObject({ name: 'Sam SUD', email: 'sam@exemple.test', color: '#ea6029' })

  await page.goto('./#/equipe?forme=pyramide')
  await page.getByRole('link', { name: /Dominique DIRECTION/ }).click()
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  const dd = page.getByRole('dialog', { name: 'Modifier le Directeur de réseau' })
  await dd.getByLabel('Téléphone').fill('+33 1 00 00 00 00')
  await dd.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Fiche du Directeur enregistrée.')).toBeVisible()
  expect(cle(ecritures, 'drs_data').directeur).toMatchObject({ name: 'Dominique DIRECTION', tel: '+33 1 00 00 00 00' })
})

test('supprimer : bloqué tant qu’il reste des Coachs ou des magasins, possible sinon', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/equipe/rr/rr1')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await expect(page.getByText(/Rattache d’abord ses 3 Coachs/)).toBeVisible()
  await page.getByRole('button', { name: 'Annuler' }).click()

  await page.goto('./#/equipe/rr/rr3')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await page.getByRole('alert').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByRole('heading', { name: 'Équipe', level: 1 })).toBeVisible()
  expect(cle(ecritures, 'drs_data').drs.map((r: { id: string }) => r.id)).toEqual(['rr1', 'rr2'])

  await page.goto('./#/equipe/coach/Camille%20TESTARD')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await expect(page.getByText(/Réaffecte d’abord ses 7 magasins/)).toBeVisible()
  await page.getByRole('button', { name: 'Annuler' }).click()

  await page.goto('./#/equipe/coach/Poste%20NORD')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await page.getByRole('alert').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByRole('heading', { name: 'Équipe', level: 1 })).toBeVisible()
  expect(ecritures).toContainEqual(expect.objectContaining({ methode: 'DELETE', table: 'cs_overrides', filtre: expect.stringContaining('Poste') }))
  expect(cle(ecritures, 'cs_deletes')).toEqual(['Poste NORD'])
})
