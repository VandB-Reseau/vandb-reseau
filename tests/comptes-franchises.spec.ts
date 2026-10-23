import { expect, test } from '@playwright/test'
import { seConnecter, simulerSupabase, textesTropPetits, COMPTE, type Ecriture } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const carteAcces = (page: import('@playwright/test').Page) => page.getByRole('heading', { name: 'Accès à l’app' }).locator('xpath=ancestor::div[contains(@class,"MuiCard-root")]')

test('le Directeur crée le compte d’un franchisé depuis sa fiche et lui transmet ses identifiants', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, accesFranchises: [], comptes: { equipe: ['coach@exemple.test'] } })
  await page.goto('./#/equipe/franchise/Paul%20MULTI')
  const acces = carteAcces(page)
  // Un compte de l'équipe ne devient pas un franchisé
  await acces.getByLabel('Email du compte').fill('coach@exemple.test')
  await acces.getByRole('button', { name: 'Ouvrir l’accès' }).click()
  await expect(acces.getByText('Ce compte appartient à l’équipe V and B')).toBeVisible()
  await acces.getByLabel('Email du compte').fill('paul@exemple.test')
  await acces.getByRole('button', { name: 'Ouvrir l’accès' }).click()
  const fenetre = page.getByRole('dialog', { name: 'Identifiants de Paul MULTI' })
  await expect(fenetre).toContainText('paul@exemple.test')
  await expect(fenetre).toContainText('Abcd-Efgh-Jk23')
  const envoi = fenetre.getByRole('link', { name: 'Envoyer par email' })
  const lien = decodeURIComponent((await envoi.getAttribute('href'))!)
  expect(lien).toContain('mailto:paul@exemple.test')
  expect(lien).toContain('Mot de passe provisoire : Abcd-Efgh-Jk23')
  expect(ecritures.filter((e) => e.table === 'functions/comptes').map((e) => e.corps)).toEqual([
    { action: 'creer', email: 'coach@exemple.test' }, { action: 'creer', email: 'paul@exemple.test' },
  ])
  expect(ecritures.filter((e) => e.table === 'rpc/ouvrir_acces_franchise').at(-1)!.corps).toEqual({ p_email: 'paul@exemple.test', p_franchise: 'Paul MULTI', p_magasins: ['Annecy Test', 'Rennes Test'] })
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-franchise-identifiants.png`, fullPage: true })
  await fenetre.getByRole('button', { name: 'Fermer' }).click()
  await expect(acces.getByText('Jamais connecté')).toBeVisible()
  // Mot de passe oublié : un nouveau mot de passe provisoire
  await acces.getByRole('button', { name: 'Nouveau mot de passe' }).click()
  await expect(page.getByRole('dialog', { name: 'Identifiants de Paul MULTI' })).toContainText('Mnop-Qrst-Uv45')
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click()
  // Suppression du compte : son accès part avec lui
  await acces.getByRole('button', { name: 'Couper l’accès' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer le compte' }).click()
  await expect(page.getByText('Compte de Paul MULTI supprimé.')).toBeVisible()
  expect(ecritures.filter((e) => e.table === 'functions/comptes').at(-1)!.corps).toEqual({ action: 'supprimer', user: 'u-nouveau' })
  await expect(acces.getByLabel('Email du compte')).toBeVisible()
})

test('retirer un franchisé supprime son compte', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, comptes: {}, accesFranchises: [{ user_id: 'u1', email: 'paul@exemple.test', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] }] })
  await page.goto('./#/equipe/franchise/Paul%20MULTI')
  await page.getByRole('button', { name: 'Modifier' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await page.getByRole('alert').getByRole('button', { name: 'Supprimer' }).click()
  await expect.poll(() => ecritures.filter((e) => e.table === 'functions/comptes').map((e) => e.corps)).toEqual([{ action: 'supprimer', user: 'u1' }])
  expect(ecritures.filter((e) => e.table === 'rpc/couper_acces_franchise')).toEqual([])
})

test('sans la fonction de création des comptes, retirer un franchisé coupe son accès', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, accesFranchises: [{ user_id: 'u1', email: 'paul@exemple.test', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] }] })
  await page.goto('./#/equipe/franchise/Paul%20MULTI')
  await page.getByRole('button', { name: 'Modifier' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await page.getByRole('alert').getByRole('button', { name: 'Supprimer' }).click()
  await expect.poll(() => ecritures.filter((e) => e.table === 'rpc/couper_acces_franchise').map((e) => e.corps)).toEqual([{ p_user: 'u1' }])
})

test('à la première connexion, le franchisé choisit son mot de passe', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await simulerSupabase(page, { ecritures, userMetadata: { mot_de_passe_provisoire: true }, acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] } })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  const fenetre = page.getByRole('dialog', { name: 'Choisis ton mot de passe' })
  await expect(fenetre).toBeVisible()
  await expect(fenetre.getByRole('button', { name: 'Annuler' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(fenetre).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-premier-mot-de-passe.png` })
  await fenetre.getByLabel('Nouveau mot de passe').fill('mon-nouveau-mot')
  await fenetre.getByLabel('Confirmer le mot de passe').fill('mon-nouveau-mot')
  await fenetre.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(fenetre).toHaveCount(0)
  expect(ecritures.filter((e) => e.table === 'auth/user').at(-1)!.corps).toMatchObject({ password: 'mon-nouveau-mot', data: { mot_de_passe_provisoire: false } })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Accueil')
})
