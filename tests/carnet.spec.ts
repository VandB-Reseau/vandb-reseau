import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, toutATraiter, type Ecriture } from './supabase-simule'
import { zonesTropPetites } from './pilotage/supabase-simule'

// Carnet du magasin (Joseph, 24/11/2026, proposition A) : notes en off de l'équipe avec ton, thèmes, collègues prévenus,
// réponses et clôture ; comptes rendus dans le même fil ; alertes ouvertes sur l'Accueil ; mentions dans la cloche ;
// messagerie retirée des menus. Données fictives uniquement (date des tests : 27/10/2026).

const notes = {
  'Lyon Test': [
    { id: 'n1', date: '2026-09-15', texte: 'Appel du franchisé : travaux de vitrine prévus.', par: 'Dominique DIRECTION' },
    { id: 'na', date: '2026-10-24', quand: '2026-10-24T17:12:00.000Z', texte: 'Visite tendue : il remet en cause la redevance devant son équipe.', par: 'Noé MODELE', ton: 'alerte', themes: ['posture'], mentions: ['Dominique DIRECTION'] },
  ],
}

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

async function lisible(page: Page, isMobile: boolean) {
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
}
const ecritDans = (ecritures: Ecriture[], texte: string) => ecritures.filter((e) => JSON.stringify(e.corps).includes(texte)).at(-1)
// Note telle qu'enregistrée (app_config ou suivi_magasins, valeur en texte ou en objet)
type NoteLue = { texte: string; ton?: string; themes?: string[]; mentions?: string[]; par?: string; reponses?: { texte: string }[]; close?: unknown }
function noteEcrite(ecritures: Ecriture[], texte: string): NoteLue | undefined {
  const corps = ecritDans(ecritures, texte)?.corps
  const lignes = ([] as Record<string, unknown>[]).concat(corps as Record<string, unknown>)
  for (const l of lignes) {
    const brut = l.value ?? l.valeur
    const v = typeof brut === 'string' ? JSON.parse(brut) : brut
    const listes = Array.isArray(v) ? [v] : Object.values(v as Record<string, unknown>)
    for (const liste of listes) for (const n of liste as NoteLue[]) if (n.texte?.includes(texte) || n.reponses?.some((r) => r.texte.includes(texte))) return n
  }
  return undefined
}

test('le carnet : notes en off et comptes rendus dans un même fil, une note avec ton, thème et collègue prévenu', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { config: { notes_magasins: notes }, persister: true, ecritures })
  await page.goto('./#/magasins/Lyon%20Test?vue=carnet')
  await expect(page.getByRole('tab', { name: /^Carnet/ })).toHaveAttribute('aria-selected', 'true')
  const fil = page.getByRole('list', { name: 'Carnet de Lyon Test' })
  const alerte = fil.getByRole('article', { name: /^Note alerte du 24 oct\. 2026 par Noé MODELE/ })
  await expect(alerte).toContainText('remet en cause la redevance')
  await expect(alerte).toContainText('Posture')
  await expect(alerte).toContainText('Prévenu : Dominique DIRECTION')
  await expect(fil.getByText(/^Compte rendu · .* du 2 oct\. 2026$/)).toBeVisible()
  await expect(page.getByText('Équipe seule', { exact: false })).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: 'En bref' })).toContainText('Alerte ouverte')
  await lisible(page, isMobile)
  await page.screenshot({ path: `captures/${info.project.name}-carnet.png`, fullPage: true })

  // Une note : ton, thème, un collègue prévenu
  const saisie = page.getByRole('region', { name: 'Nouvelle note' })
  await saisie.getByRole('textbox', { name: 'Note sur Lyon Test' }).fill('Super échange sur la vente additionnelle, il briefe ses vendeurs lui-même.')
  // Barre compacte (25/11/2026) : ton en pastille, thèmes et collègues dans des menus, « @ » ouvre les collègues
  expect((await saisie.boundingBox())!.height).toBeLessThan(200)
  await saisie.getByRole('button', { name: 'Ton : Info' }).click()
  await page.getByRole('menu', { name: 'Ton' }).getByRole('menuitem', { name: 'Positif' }).click()
  await saisie.getByRole('button', { name: 'Thèmes' }).click()
  await page.getByRole('menu', { name: 'Thèmes' }).getByRole('menuitemcheckbox', { name: 'Commercial' }).click()
  await page.keyboard.press('Escape')
  await saisie.getByRole('textbox', { name: 'Note sur Lyon Test' }).press('End')
  await saisie.getByRole('textbox', { name: 'Note sur Lyon Test' }).pressSequentially(' @')
  await page.getByRole('menu', { name: 'Prévenir' }).getByRole('menuitemcheckbox', { name: 'Noé MODELE' }).click()
  await expect(saisie).toContainText('Commercial · @Noé MODELE')
  await expect(saisie.getByRole('textbox', { name: 'Note sur Lyon Test' })).not.toHaveValue(/@$/)
  await lisible(page, isMobile)
  await saisie.getByRole('button', { name: 'Noter' }).click()
  await expect(page.getByText('Note enregistrée. Noé MODELE est prévenu.')).toBeVisible()
  expect(noteEcrite(ecritures, 'Super échange')).toMatchObject({ ton: 'positif', themes: ['commercial'], mentions: ['Noé MODELE'], par: 'Dominique DIRECTION' })
  await expect(fil.getByRole('article', { name: /^Note positif/ })).toContainText('Super échange')

  // Répondre sous l'alerte, puis la clore
  await alerte.getByRole('button', { name: 'Répondre' }).click()
  await alerte.getByRole('textbox', { name: 'Ta réponse' }).fill('Je l’appelle jeudi avec ses chiffres du bar.')
  await alerte.getByRole('button', { name: 'Répondre' }).click()
  await expect(alerte.getByRole('list', { name: 'Réponses' })).toContainText('Je l’appelle jeudi')
  expect(noteEcrite(ecritures, 'Je l’appelle jeudi')?.texte).toContain('redevance')
  await alerte.getByRole('button', { name: 'Clore l’alerte' }).click()
  await expect(alerte).toContainText('Close par Dominique DIRECTION')
  await expect(page.getByRole('complementary', { name: 'En bref' })).not.toContainText('Alerte ouverte')

  // Filtre : comptes rendus seuls
  await page.getByRole('group', { name: 'Filtrer le carnet' }).getByRole('button', { name: /^Comptes rendus/ }).click()
  await expect(fil.getByRole('article')).toHaveCount(0)
  await expect(fil.getByText(/^Compte rendu ·/).first()).toBeVisible()
  await lisible(page, isMobile)
})

test('une alerte ouverte par un collègue arrive dans À traiter et la mention dans la cloche', async ({ page, isMobile }) => {
  await page.addInitScript(() => { try { localStorage.setItem('vandb-notifications-lues', '[]') } catch { /* rien */ } })
  await seConnecter(page, { config: { notes_magasins: notes } })
  await toutATraiter(page)
  await expect(page.getByRole('region', { name: 'À traiter' }).first().getByText(/remet en cause la redevance/).first()).toBeVisible()
  // Sur téléphone, « Mon point du jour » s'ouvre en fenêtre : la cloche se prend depuis une autre page
  if (isMobile) await page.goto('./#/magasins?vue=liste')
  await page.getByRole('button', { name: /^Notifications/ }).click()
  const volet = page.getByRole('dialog', { name: 'Notifications' })
  await expect(volet.getByText('Noé MODELE te mentionne · Lyon Test')).toBeVisible()
  await lisible(page, isMobile)
  await volet.getByRole('listitem').filter({ hasText: 'Noé MODELE te mentionne' }).getByRole('button').first().click()
  await expect(page).toHaveURL(/vue=carnet&note=na/)
  await expect(page.getByRole('article', { name: /^Note alerte/ })).toBeVisible()
})

test('la messagerie quitte les menus ; le « + » propose une note avec son ton', async ({ page, isMobile }) => {
  await seConnecter(page, { config: { notes_magasins: notes } })
  if (isMobile) {
    await expect(page.getByRole('link', { name: 'Messages' })).toHaveCount(0)
  } else {
    await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: /^Messages/ })).toHaveCount(0)
  }
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).first().click()
  await expect(page.getByRole('menuitem', { name: 'Message' })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Note' }).click()
  const d = page.getByRole('dialog', { name: 'Nouvelle note' })
  await expect(d.getByText(/Équipe seule/)).toHaveCount(0)
  await expect(d.getByRole('button', { name: 'Ton : Info' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
})

// Carnet du réseau (Joseph, 25/11/2026) : toutes les notes du périmètre sur une page, ce qui reste à traiter en tête,
// « Je m'en occupe », répondre et clore sur place ; plus de mention « Équipe seule » dans le carnet
const notesReseau = {
  ...notes,
  'Annecy Test': [
    { id: 'ns', date: '2026-10-20', quand: '2026-10-20T09:00:00.000Z', texte: 'Équipe du magasin fatiguée avant les fêtes.', par: 'Hugo FICTIF', ton: 'surveiller', themes: ['equipe'] },
  ],
}

test('la page Carnet réunit les notes du réseau : à traiter en tête, « Je m’en occupe », filtre « Me concernent »', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { config: { notes_magasins: notesReseau }, persister: true, ecritures })
  if (!isMobile) await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Carnet' }).click()
  else await page.goto('./#/carnet')
  await expect(page.getByRole('heading', { name: 'Carnet', level: 1 })).toBeVisible()
  const aTraiter = page.getByRole('list', { name: 'Notes à traiter' })
  // L'alerte avant le point à surveiller
  await expect(aTraiter.getByRole('listitem')).toHaveCount(2)
  await expect(aTraiter.getByRole('listitem').first()).toContainText('Lyon Test')
  await expect(aTraiter.getByRole('listitem').nth(1)).toContainText('Annecy Test')
  await expect(aTraiter).toContainText('personne ne s’en occupe')
  const fil = page.getByRole('list', { name: 'Notes des magasins' })
  await expect(fil.getByRole('article')).toHaveCount(3)
  await expect(fil.getByRole('link', { name: 'Carnet de Annecy Test' })).toHaveAttribute('href', /Annecy%20Test\?vue=carnet&note=ns/)
  await lisible(page, isMobile)

  // Je m'en occupe, puis répondre sur place
  const alerte = fil.getByRole('article', { name: /^Note alerte/ })
  await alerte.getByRole('button', { name: 'Je m’en occupe' }).click()
  await expect(page.getByText('C’est noté : tu t’en occupes.')).toBeVisible()
  expect(noteEcrite(ecritures, 'remet en cause la redevance')).toMatchObject({ prise: { par: 'Dominique DIRECTION' } })
  await expect(alerte).toContainText('Tu t’en occupes')
  await expect(aTraiter.getByRole('listitem').first()).toContainText('tu t’en occupes')
  await alerte.getByRole('button', { name: 'Répondre' }).click()
  await alerte.getByRole('textbox', { name: 'Ta réponse' }).fill('Rendez-vous calé lundi.')
  await alerte.getByRole('button', { name: 'Répondre' }).click()
  await expect(alerte.getByRole('list', { name: 'Réponses' })).toContainText('Rendez-vous calé lundi.')

  // Me concernent : l'alerte (mentionné, pris en charge) et ma note de septembre, pas celle d'Annecy
  await page.getByRole('group', { name: 'Filtrer le carnet' }).getByRole('button', { name: /^Me concernent/ }).click()
  await expect(fil.getByRole('article')).toHaveCount(2)
  await expect(fil).not.toContainText('Annecy Test')
  await expect(page.getByText(/Équipe seule/)).toHaveCount(0)
  await lisible(page, isMobile)
})

test('un Coach ne lit dans le Carnet que les notes de ses magasins', async ({ page }) => {
  await seConnecter(page, { config: { notes_magasins: notesReseau }, appMetadata: { role: 'coach', coach: 'Noé MODELE' } })
  await page.goto('./#/carnet')
  const fil = page.getByRole('list', { name: 'Notes des magasins' })
  await expect(fil.getByRole('article')).toHaveCount(2)
  await expect(fil).toContainText('Lyon Test')
  await expect(fil).not.toContainText('Annecy Test')
})
