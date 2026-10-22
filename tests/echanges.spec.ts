import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture, type MessageSimule, type OptionsSimulation } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

// Annecy Test : Coach Hugo FICTIF, Responsable Régional Alex NORD, franchisé Paul MULTI
const AUTRE = '00000000-0000-0000-0000-0000000000aa'
const ilYa = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const msg = (id: number, store: string, auteur_nom: string, auteur_role: string, texte: string, extra: Partial<MessageSimule> = {}, minutes = 30): MessageSimule =>
  ({ id, store, auteur: AUTRE, auteur_nom, auteur_role, auteur_cle: `${auteur_role}:${auteur_nom}`, texte, mentions: [], cree_le: ilYa(minutes), ...extra })
const HUGO = { role: 'coach', coach: 'Hugo FICTIF' }
const PAUL = { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] }

const barreBasse = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' })

test('onglet Échanges : groupe du magasin à deux fils, réponse du Coach', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  const options: OptionsSimulation = { appMetadata: HUGO, ecritures, messagerie: { messages: [
    msg(1, 'Annecy Test', 'Paul MULTI', 'franchise', 'La vitrine est installée.', {}, 60),
    msg(2, 'Annecy Test', 'Alex NORD', 'rr', 'On en parle avant jeudi ?', { equipe: true, auteur_cle: 'rr:rr1' }, 20),
  ] } }
  await seConnecter(page, options)
  await page.goto('./#/echanges')
  await expect(page.getByRole('heading', { name: 'Échanges', level: 1 })).toBeVisible()
  const liste = page.getByRole('list', { name: 'Conversations' })
  await expect(liste.getByRole('button', { name: 'Réseau V and B' })).toBeVisible()
  // Téléphone : la liste d'abord ; PC : la conversation la plus récente s'ouvre à côté
  if (info.project.name === 'telephone') await liste.getByRole('button', { name: /^Annecy Test : 2 messages non lus/ }).click()
  await expect(page).toHaveURL(/#\/echanges\/magasin\/Annecy%20Test/)

  // Fil « Avec le franchisé » : le message du franchisé, pas celui de l'équipe
  const choix = page.getByRole('radiogroup', { name: 'Fil de Annecy Test' })
  await expect(choix.getByRole('radio', { name: /Avec le franchisé/ })).toHaveAttribute('aria-checked', 'true')
  const fil = page.getByRole('list', { name: /^Messages de / })
  await expect(fil).toContainText('La vitrine est installée.')
  await expect(fil).not.toContainText('On en parle avant jeudi ?')
  await expect.poll(() => ecritures.some((e) => e.table === 'rpc/marquer_lu_fil' && (e.corps as { p_fil: string }).p_fil === 'magasin:Annecy Test')).toBe(true)

  // « Équipe seule » : le message du RR ; une réponse part dans ce fil
  await choix.getByRole('radio', { name: /Équipe seule/ }).click()
  await expect(fil).toContainText('On en parle avant jeudi ?')
  await expect(fil).not.toContainText('La vitrine est installée.')
  const champ = page.getByLabel('Message', { exact: true })
  await expect(champ).toHaveAttribute('placeholder', 'Message à l’équipe')
  await champ.fill('Oui, mercredi 10 h.')
  await page.getByRole('button', { name: 'Envoyer' }).click()
  await expect(champ).toHaveValue('')
  expect(ecritures.find((e) => e.table === 'rpc/envoyer_fil')!.corps).toEqual({ p_fil: 'equipe:Annecy Test', p_texte: 'Oui, mercredi 10 h.', p_mentions: [] })
  await expect(fil).toContainText('Oui, mercredi 10 h.')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-echanges-groupe.png`, fullPage: true })
})

test('un message devient une tâche, affichée dans le fil', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { appMetadata: HUGO, ecritures, persister: true, messagerie: { messages: [
    msg(1, 'Annecy Test', 'Paul MULTI', 'franchise', 'Il manque les affiches de la campagne.', {}, 30),
  ] } })
  await page.goto('./#/echanges/magasin/Annecy%20Test')
  const bulle = page.getByRole('listitem', { name: 'Message de Paul MULTI' })
  await bulle.getByText('Il manque les affiches').click()
  await bulle.getByRole('button', { name: 'En faire une tâche' }).click()
  const fenetre = page.getByRole('dialog', { name: 'Ajouter une tâche' })
  await expect(fenetre.getByLabel('Tâche')).toHaveValue('Il manque les affiches de la campagne.')
  await fenetre.getByRole('button', { name: 'Demain' }).click()
  await fenetre.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(fenetre).toHaveCount(0)
  const ecrite = ecritures.find((e) => e.table === 'suivi_magasins' && JSON.stringify(e.corps).includes('affiches'))
  expect(JSON.stringify(ecrite!.corps)).toContain('"message":1')
  await expect(page.getByRole('listitem', { name: 'Tâche : Il manque les affiches de la campagne.' })).toBeVisible()
})

test('le Directeur crée un groupe libre et y écrit', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, messagerie: {} })
  await page.goto('./#/echanges')
  await page.getByRole('button', { name: 'Nouvelle conversation' }).click()
  await page.getByRole('menuitem', { name: 'Nouveau groupe' }).click()
  const fenetre = page.getByRole('dialog', { name: 'Nouveau groupe' })
  await fenetre.getByLabel('Nom du groupe').fill('Coachs du Nord')
  await fenetre.getByLabel('Membres').click()
  await page.getByRole('option', { name: /Hugo FICTIF/ }).click()
  await page.keyboard.press('Escape')
  await fenetre.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(fenetre).toHaveCount(0)
  expect(ecritures.find((e) => e.table === 'rpc/creer_groupe')!.corps).toEqual({ p_nom: 'Coachs du Nord', p_membres: ['coach:Hugo FICTIF'] })
  await expect(page).toHaveURL(/#\/echanges\/groupe\/1/)
  const champ = page.getByLabel('Message', { exact: true })
  await expect(champ).toHaveAttribute('placeholder', 'Message au groupe')
  await champ.fill('Point visio lundi.')
  await page.getByRole('button', { name: 'Envoyer' }).click()
  await expect(champ).toHaveValue('')
  expect(ecritures.find((e) => e.table === 'rpc/envoyer_fil')!.corps).toMatchObject({ p_fil: 'groupe:1', p_texte: 'Point visio lundi.' })
})

test('téléphone : barre du bas à cinq onglets, « + » dans l’en-tête', async ({ page }, info) => {
  test.skip(info.project.name !== 'telephone', 'barre du bas : téléphone seulement')
  await seConnecter(page, { messagerie: {} })
  await page.goto('./#/')
  const barre = barreBasse(page)
  await expect(barre.getByRole('button')).toHaveText(['Accueil', 'Magasins', /Échanges/, 'Visites', /^Santé/])
  for (const l of await barre.getByRole('button').all()) expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  const plus = page.getByRole('banner').getByRole('button', { name: 'Créer' })
  expect((await plus.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await plus.click()
  await expect(page.getByRole('dialog', { name: 'Créer' })).toBeVisible()
})

test('franchisé : le groupe de son magasin sans « Équipe seule », ni groupe libre', async ({ page }) => {
  await seConnecter(page, { appMetadata: { role: 'franchise' }, acces: PAUL, espace: {}, messagerie: {
    messages: [
      msg(1, 'Annecy Test', 'Hugo FICTIF', 'coach', 'Bonne semaine !', {}, 30),
      msg(2, 'Annecy Test', 'Alex NORD', 'rr', 'Entre nous.', { equipe: true }, 20),
      { ...msg(3, '', 'Dominique DIRECTION', 'directeur', 'Groupe privé'), store: null, destinataire: 'groupe:1', groupe: 1 },
    ],
    groupes: [{ id: 1, nom: 'Coachs du Nord', membres: ['directeur', 'coach:Hugo FICTIF'], cree_par: 'directeur' }],
  } })
  await page.goto('./#/echanges')
  const liste = page.getByRole('list', { name: 'Conversations' })
  await expect(liste.getByRole('button', { name: /^Annecy Test/ })).toBeVisible()
  await expect(liste.getByRole('button', { name: /Coachs du Nord/ })).toHaveCount(0)
  await liste.getByRole('button', { name: /^Annecy Test/ }).click()
  await expect(page.getByRole('radiogroup', { name: /^Fil de / })).toHaveCount(0)
  const fil = page.getByRole('list', { name: /^Messages de / })
  await expect(fil).toContainText('Bonne semaine !')
  await expect(fil).not.toContainText('Entre nous.')
})

test('anciennes adresses redirigées vers les Échanges', async ({ page }) => {
  await seConnecter(page, { messagerie: {} })
  await page.goto('./#/messages')
  await expect(page).toHaveURL(/#\/echanges/)
  await page.goto('./#/communications')
  await expect(page).toHaveURL(/#\/echanges\/reseau/)
  await page.goto('./#/taches')
  await expect(page).toHaveURL(/#\/echanges\?vue=taches/)
})

test('téléphone : dans une conversation longue, le nom reste en haut et la saisie tout en bas', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'Conversation plein écran du téléphone')
  const messages = Array.from({ length: 30 }, (_, i) => msg(100 + i, 'Annecy Test', 'Paul MULTI', 'franchise', `Message numéro ${i + 1} sur la vitrine et les ventes de la semaine.`, {}, 300 - i * 5))
  await seConnecter(page, { appMetadata: HUGO, messagerie: { messages } })
  await page.goto('./#/echanges/magasin/Annecy%20Test')
  const titre = page.getByRole('heading', { level: 1, name: 'Annecy Test' })
  const champ = page.getByLabel('Message', { exact: true })
  await expect(page.getByText('Message numéro 30 sur la vitrine')).toBeVisible()
  const hauteur = page.viewportSize()!.height
  const verifier = async () => {
    const t = (await titre.boundingBox())!
    expect(t.y).toBeGreaterThanOrEqual(60)
    expect(t.y).toBeLessThan(140)
    const c = (await champ.boundingBox())!
    expect(c.y + c.height).toBeGreaterThan(hauteur - 80)
    expect(c.y + c.height).toBeLessThanOrEqual(hauteur)
  }
  await verifier()
  // On remonte dans les messages à la molette, puis on touche le champ : rien ne bouge
  await page.mouse.move(200, hauteur / 2)
  await page.mouse.wheel(0, -2000)
  await expect(page.getByText('Message numéro 1 sur la vitrine')).toBeInViewport()
  await verifier()
  await champ.click()
  await verifier()
  await page.screenshot({ path: `captures/${info.project.name}-echanges-conversation-longue.png` })
})

test('« Mes tâches » s’ouvre depuis une conversation, puis « Discussions » y ramène', async ({ page }) => {
  await seConnecter(page, { appMetadata: HUGO, messagerie: { messages: [msg(1, 'Annecy Test', 'Paul MULTI', 'franchise', 'La vitrine est installée.')] } })
  await page.goto('./#/echanges/magasin/Annecy%20Test')
  await expect(page.getByRole('list', { name: /^Messages de / })).toContainText('La vitrine est installée.')
  const onglets = page.getByRole('tablist', { name: 'Échanges' })
  // Téléphone : le choix est dans la liste des échanges, hors conversation
  if (await onglets.count() === 0) await page.goto('./#/echanges')
  await onglets.getByRole('tab', { name: /^Mes tâches/ }).click()
  await expect(page).toHaveURL(/#\/echanges\?vue=taches$/)
  await expect(onglets.getByRole('tab', { name: /^Mes tâches/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('list', { name: /^Messages de / })).toHaveCount(0)
  await onglets.getByRole('tab', { name: /^Discussions/ }).click()
  await expect(page.getByRole('list', { name: 'Conversations' })).toBeVisible()
})
