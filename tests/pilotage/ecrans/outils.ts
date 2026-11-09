import { expect, type Page } from '@playwright/test'
import { COMPTE, ouvrirOnglet, simulerSupabase, type AccesSimule, type OptionsSimulation as OptionsReseau } from '../../supabase-simule'
import { MAGASINS } from '../donnees-fictives'
import { magasinsParDefaut, ouvrir as ouvrirDansFiche, simulerPilotage, type Ecriture, type OptionsSimulation } from '../supabase-simule'

// Tests d'écran venus de l'app « V and B Pilotage » (fusion du 03/11/2026) : mêmes scénarios, rejoués dans l'app réseau.
// La connexion passe par la base simulée de l'app réseau, le budget par celle du schéma « pilotage » ; on arrive sur
// la page « Budgets », l'ancien accueil du pilotage. Données fictives uniquement : dépôt public.
export * from '../supabase-simule'
export { simulerSupabase } from '../../supabase-simule'

// Les magasins fictifs du pilotage, ajoutés au réseau fictif (même fiche, mêmes onglets), suivis par le Coach Camille TESTARD
const magasinReseau = (n: string, i: number) => ({
  n, dept: '73', open: '2019-03-15', code: `P0${i + 1}`, tel: '+33 4 00 00 00 00', email_mag: `pilotage${i}@exemple.test`, resp: `Franchisé ${n}`,
  tel_resp: '+33 6 00 00 00 00', adj: '', addr: `${i + 1} place de l’Exemple, 73000 ${n}`, cp: '73000', ville: n, franchise: true, lat: 45.5, lon: 6 + i * 0.1, rr: '',
})
const nomsDuTest = (o: OptionsSimulation) => [...new Set([...MAGASINS, ...(o.magasins ?? []).map((m) => m.magasin)])]

export function accesDuRole(options: OptionsSimulation): AccesSimule | null {
  const role = options.role ?? 'directeur'
  if (role === 'franchise') return { role, franchise: 'Franchisé Test', magasins: (options.magasins ?? magasinsParDefaut).map((m) => m.magasin) }
  if (role === 'coach') return { role, coach: 'Camille TESTARD' }
  if (role === 'rr') return { role, rr: 'rr1' }
  if (role === 'aucun') return { role: 'aucun' }
  return { role }
}

export async function seConnecter(page: Page, options: OptionsSimulation = {}, reseau: OptionsReseau = {}): Promise<Ecriture[]> {
  await simulerSupabase(page, { acces: accesDuRole(options), magasinsEnPlus: nomsDuTest(options).map(magasinReseau),
    affectationsEnPlus: nomsDuTest(options).map((store) => ({ store, cs: 'Camille TESTARD', date: '2018-01-01', note: 'Affectation initiale', type: 'pre' })), ...reseau })
  const ecritures = await simulerPilotage(page, options)
  // Le compte de résultat est en k€ d'office depuis le 09/11/2026 ; ces tests lisent les montants en euros
  await page.addInitScript(() => { try { if (!localStorage.getItem('pilotage.compte.unite')) localStorage.setItem('pilotage.compte.unite', 'euros') } catch { /* rien */ } })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  // Compte sans rôle : accès fermé ou contrôle de gestion, chacun vérifié par son test
  if (options.role === 'aucun') return ecritures
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  await page.goto('./#/budgets')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  return ecritures
}

// Fiche du magasin : l'onglet Chiffres ou Budget de l'app réseau, puis la page
export async function ouvrir(page: Page, partie: string) {
  await page.waitForURL(/#\/magasins\//)
  await fermerCommentairesSurTelephone(page)
  await ouvrirDansFiche(page, partie)
}

// Ancien menu du pilotage : les onglets de la page « Budgets » de l'app réseau
export async function allerVers(page: Page, nom: string) {
  if (!/#\/budgets/.test(page.url())) {
    await page.goto('./#/budgets')
    await page.getByRole('heading', { level: 1 }).first().waitFor()
  }
  const echappe = nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await page.getByRole('navigation', { name: 'Pages des budgets' }).getByRole('tab', { name: new RegExp(`^${echappe}`) }).click()
}

// Commentaires du budget (09/11/2026) : dans un volet ouvert à la demande par le bouton de l'en-tête
export async function ouvrirCommentaires(page: Page) {
  const bouton = page.getByRole('button', { name: /^Commentaires( \(\d+ ouverts?\))?$/ })
  if ((await bouton.getAttribute('aria-expanded')) !== 'true') await bouton.click()
  return page.getByRole('complementary', { name: 'Volet des commentaires' }).getByRole('region', { name: 'Commentaires', exact: true })
}

// Sur téléphone, le volet des commentaires couvre l'écran : on le ferme avant de toucher la page dessous
export async function fermerCommentairesSurTelephone(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) >= 600) return
  const fermer = page.getByRole('complementary', { name: 'Volet des commentaires' }).getByRole('button', { name: 'Fermer les commentaires' })
  if (await fermer.isVisible()) await fermer.click()
}

// Adresse d'une fiche de magasin dans l'app réseau, sur l'onglet du budget
export const ficheBudget = (magasin: string) => `./#/magasins/${encodeURIComponent(magasin)}?vue=budget`
