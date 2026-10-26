import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

// Sprint 26 (Joseph, 26/10/2026) : recherche dans tout le compte rendu (S1), « La dernière fois » dans la fiche avant
// visite (S2), étape d'ouverture suivante lisible (S3), bilan de l'année d'un magasin (F1)

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const decale = (j: number) => { const d = new Date(); d.setDate(d.getDate() + j); return d.toLocaleDateString('sv-SE') }

test('S1 : la recherche de l’historique lit tout le compte rendu, sans tenir compte des accents', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/visites?vue=historique')
  const champ = page.getByPlaceholder('Magasin, mot du compte rendu…')
  await champ.fill('GONDOLE')
  const visites = page.getByRole('region', { name: 'Visites', exact: true })
  await expect(visites.getByRole('link', { name: /^Lyon Test/ })).toContainText('Magasin et offre : « Tête de gondole à reprendre. »')
  await expect(page.getByText('1 visite', { exact: true })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-recherche-compte-rendu.png` })
  // Plan d'action, et sans accents : « equipe » trouve « l’équipe »
  await champ.fill('equipe a la vente')
  await expect(visites.getByRole('link', { name: /^Brest Test/ })).toContainText('Plan d’action : « Former l’équipe à la vente additionnelle »')
  // Le magasin et la note restent cherchés comme avant, la ligne garde sa note
  await champ.fill('vitrine refaite')
  await expect(visites.getByRole('link', { name: /^Lyon Test/ })).toContainText('Vitrine refaite, stock à revoir.')
  await champ.fill('introuvable')
  await expect(page.getByText('Aucune visite ne correspond à ces filtres.')).toBeVisible()
})

test('S2 : la fiche avant visite reprend ce qui s’est dit la dernière fois', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test/preparer')
  const bloc = page.getByRole('region', { name: 'La dernière fois' })
  await expect(bloc).toContainText('2 oct. 2026 · Visite terrain · Noé MODELE')
  await expect(bloc).toContainText('Vitrine refaite, stock à revoir.')
  await expect(bloc).toContainText('Magasin et offre')
  await expect(bloc).toContainText('Tête de gondole à reprendre.')
  await expect(bloc).toContainText('Refaire la tête de gondole Beaujolais · Franchisé · novembre · en cours')
  await expect(bloc.getByRole('link', { name: 'Ouvrir le compte rendu' })).toHaveAttribute('href', /compte-rendu\/1/)
  expect(await textesTropPetits(page)).toEqual([])
  await bloc.screenshot({ path: `captures/${info.project.name}-derniere-fois.png` })
  // Un magasin jamais visité n'a pas ce bloc
  await page.goto('./#/magasins/Caen%20Test/preparer')
  await expect(page.getByRole('region', { name: 'En bref' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'La dernière fois' })).toHaveCount(0)
})

test('S3 : l’étape qui vient est dite « prochaine », et une ouverture proche sans étape passe en alerte', async ({ page }, info) => {
  const ouvertures = { 'Rodez Test': { etapes: { contrat: { prevu: '2026-03-01', fait: '2026-03-02' }, local: { prevu: decale(20), fait: '' } }, par: 'Dominique DIRECTION', maj: '2026-10-01' } }
  await seConnecter(page, { config: { ouvertures_magasins: ouvertures }, surchargesMagasins: [{ store_name: 'Dax Test', open_date: decale(30) }] })
  await page.goto('./#/parametres/evolution')
  const liste = page.getByRole('region', { name: 'À venir sur 12 mois' })
  const dax = liste.getByRole('link', { name: /Dax Test/ })
  await expect(dax).toContainText('0 étape sur 7 · prochaine : contrat')
  await expect(dax.getByText('0 étape sur 7 · prochaine : contrat')).toHaveCSS('font-weight', '600')
  await expect(liste.getByRole('link', { name: /Rodez Test/ })).toContainText(/1 étape sur 7 · prochaine : local le \d/)
  await expect(liste.getByRole('link', { name: /Vichy Test/ })).toContainText('0 étape sur 7 · prochaine : contrat')
  await expect(liste.getByRole('link', { name: /Vichy Test/ }).getByText('0 étape sur 7 · prochaine : contrat')).toHaveCSS('font-weight', '400')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-ouverture-prochaine.png` })
})

test('F1 : le bilan de l’année d’un magasin, de la fiche au franchisé', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Nantes%20Test')
  await page.getByRole('button', { name: 'Autres actions' }).click()
  await page.getByRole('menu').getByRole('menuitem', { name: 'Bilan de l’année' }).click()
  await expect(page).toHaveURL(/#\/magasins\/Nantes%20Test\/bilan$/)
  await expect(page.getByText('Objet : bilan de l’année 2026')).toBeVisible()
  const bref = page.getByRole('group', { name: 'Repères de l’année' })
  // Janvier à juin à 100 000 €, juillet à septembre à 93 000 € : 879 000 € face à 900 000 € en 2025
  await expect(bref).toContainText(/879\s000\s€/)
  await expect(bref).toContainText('−2,3 % vs 2025')
  await expect(page.getByRole('table', { name: 'Chiffres 2026' }).getByRole('row')).toHaveCount(10)
  await expect(page.getByRole('region', { name: 'Santé du magasin' })).toContainText('Audit hygiène · 10 mars 2026')
  await expect(page.getByRole('region', { name: 'Thématiques' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-bilan-annee.png`, fullPage: !isMobile })
  // L'année précédente
  await page.getByRole('group', { name: 'Année du bilan' }).getByRole('button', { name: '2025' }).click()
  await expect(page.getByText('Objet : bilan de l’année 2025')).toBeVisible()
  await expect(page.getByText('du 1er janvier au 31 décembre 2025')).toBeVisible()
  await page.getByRole('group', { name: 'Année du bilan' }).getByRole('button', { name: '2026' }).click()
  // Envoi au franchisé, avec le bilan en texte
  await page.getByRole('button', { name: 'Envoyer au franchisé' }).click()
  const d = page.getByRole('dialog', { name: 'Envoyer le bilan de l’année' })
  await expect(d.getByLabel('Message')).toHaveValue(/Voici le bilan de l'année 2026 de Nantes Test/)
  await d.getByRole('button', { name: 'Dans l’app' }).click()
  await expect(page.getByText('Bilan de l’année envoyé à Franchisé 2 dans la messagerie.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'rpc/envoyer_a')?.corps).toMatchObject({ p_destinataire: 'franchise:Franchisé 2', p_magasins: ['Nantes Test'] })
})

test('F1 : tâches tenues et priorités de l’an prochain', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Brest%20Test/bilan')
  const taches = page.getByRole('region', { name: 'Tâches' })
  // « Changer l’enseigne » faite la veille de son échéance ; « Refaire la vitrine » pas faite
  await expect(taches).toContainText('Tenues à l’échéance1 sur 2')
  await expect(page.getByRole('region', { name: 'Priorités pour 2027' })).toContainText('Former l’équipe à la vente additionnelle')
  await expect(page.getByRole('region', { name: 'Visites (1)' })).toContainText('20 sept. 2026')
  await page.getByRole('button', { name: 'Ajouter une priorité' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une tâche' })
  await expect(d.getByLabel('Échéance', { exact: true })).toHaveValue('2027-06-30')
  await d.getByRole('textbox', { name: 'Tâche' }).fill('Lancer le corner épicerie')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  expect(JSON.stringify(ecritures)).toContain('Lancer le corner épicerie')
  await page.screenshot({ path: `captures/${info.project.name}-bilan-priorites.png` })
})

// F3 : historique des modifications, Directeur seul (script 0036_historique_modifications.sql)
const historique = () => [
  { id: 4, le: '2026-10-25T16:20:00Z', role: 'directeur', auteur: '', table_nom: 'suivi_magasins', operation: 'changement', magasin: 'Lyon Test', rubrique: 'sante',
    avant: { store_name: 'Lyon Test', cle: 'sante', valeur: { notes: {}, date: '2026-09-01', par: '' } }, apres: { store_name: 'Lyon Test', cle: 'sante', valeur: { notes: {}, date: '2026-10-25', par: '' } }, remis_le: null },
  { id: 3, le: '2026-10-25T09:05:00Z', role: 'rr', auteur: 'rr1', table_nom: 'store_finance', operation: 'changement', magasin: 'Metz Test', rubrique: '2026-09',
    avant: { store_name: 'Metz Test', month: '2026-09-01', pm_bar: 12, marge: 40 }, apres: { store_name: 'Metz Test', month: '2026-09-01', pm_bar: 14, marge: 40 }, remis_le: null },
  { id: 2, le: '2026-10-24T14:00:00Z', role: 'coach', auteur: 'Noé MODELE', table_nom: 'suivi_magasins', operation: 'changement', magasin: 'Nantes Test', rubrique: 'actions',
    avant: { store_name: 'Nantes Test', cle: 'actions', valeur: [{ id: 'l9', action: 'Changer les étiquettes', porteur: 'Franchisé 2', echeance: '2026-11-15', creeLe: '2026-10-01' }, { id: 'l8', action: 'Refaire la vitrine', porteur: 'Franchisé 2', echeance: '2026-10-30', creeLe: '2026-10-01' }] },
    apres: { store_name: 'Nantes Test', cle: 'actions', valeur: [{ id: 'l8', action: 'Refaire la vitrine', porteur: 'Franchisé 2', echeance: '2026-10-30', creeLe: '2026-10-01', faite: '2026-10-24' }] }, remis_le: null },
  { id: 1, le: '2026-10-23T08:30:00Z', role: 'coach', auteur: 'Noé MODELE', table_nom: 'visits', operation: 'suppression', magasin: 'Lyon Test', rubrique: '',
    avant: { id: 999, store: 'Lyon Test', visit_date: '2026-09-15', type: 'terrain', visitor: 'Noé MODELE' }, apres: null, remis_le: null },
]

test('F3 : le Directeur voit qui a changé quoi et remet une suppression', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, historique: historique() })
  await page.goto('./#/parametres/reglages?rubrique=historique')
  const liste = page.getByRole('list', { name: 'Modifications' })
  await expect(liste.getByRole('listitem')).toHaveCount(5)
  await expect(liste).toContainText('Metz Test · Chiffres de septembre 2026 modifiés (panier moyen HT bar)')
  await expect(liste).toContainText('Alex NORD ·')
  await expect(liste).toContainText('Nantes Test · Tâche supprimée : « Changer les étiquettes »')
  await expect(liste).toContainText('Nantes Test · Tâche faite : « Refaire la vitrine »')
  await expect(liste).toContainText('Lyon Test · Visite terrain du 15 sept. 2026 supprimée')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-historique-modifications.png` })
  // Suppressions seules, puis recherche sans accents
  await page.getByRole('group', { name: 'Modifications affichées' }).getByRole('button', { name: 'Suppressions' }).click()
  await expect(liste.getByRole('listitem')).toHaveCount(2)
  await page.getByRole('textbox', { name: 'Chercher dans l’historique' }).fill('etiquettes')
  await expect(liste.getByRole('listitem')).toHaveCount(1)
  // Une tâche retirée revient dans la liste du magasin
  await liste.getByRole('button', { name: /^Remettre : Tâche supprimée/ }).click()
  await expect(page.getByText('Remis en place.')).toBeVisible()
  expect(JSON.stringify(ecritures)).toContain('Changer les étiquettes')
  // Une visite supprimée est remise par la base
  await page.getByRole('textbox', { name: 'Chercher dans l’historique' }).fill('')
  await liste.getByRole('button', { name: /^Remettre : Visite terrain/ }).click()
  await expect(liste.getByRole('listitem').filter({ hasText: 'Visite terrain du 15 sept. 2026' })).toContainText('Remis')
  expect(ecritures.find((e) => e.table === 'rpc/remettre_modification')?.corps).toEqual({ p_id: 1 })
})

test('F3 : sans le script de l’historique, la rubrique le dit simplement', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/parametres/reglages?rubrique=historique')
  await expect(page.getByText('L’historique n’est pas encore activé dans la base')).toBeVisible()
})
