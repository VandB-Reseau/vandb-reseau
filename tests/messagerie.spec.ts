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

// Annecy Test : Coach Hugo FICTIF, Responsable Régional Alex NORD, franchisé Paul MULTI (aussi à Rennes Test, Coach Noé MODELE)
const AUTRE = '00000000-0000-0000-0000-0000000000aa'
const ilYa = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const msg = (id: number, store: string, auteur_nom: string, auteur_role: string, texte: string, mentions: string[] = [], minutes = 30): MessageSimule =>
  ({ id, store, auteur: AUTRE, auteur_nom, auteur_role, texte, mentions, cree_le: ilYa(minutes) })

// Échange à deux : de « cle » à « dest », magasins cités en option
const prive = (id: number, cle: string, auteur_nom: string, dest: string, texte: string, magasins: string[] = [], minutes = 30): MessageSimule =>
  ({ id, store: null, auteur: AUTRE, auteur_nom, auteur_role: cle.split(':')[0], auteur_cle: cle, destinataire: dest, texte, mentions: [dest], cree_le: ilYa(minutes), magasins })
const MOI = '00000000-0000-0000-0000-000000000001'

const PAUL = { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] }
const HUGO = { role: 'coach', coach: 'Hugo FICTIF' }
const ALEX = { role: 'rr', rr: 'rr1' }

async function ouvrirCloche(page: Page) {
  await page.getByRole('button', { name: /^Notifications/ }).click()
  return page.getByRole('menu', { name: 'Notifications' })
}

test('fiche magasin : le Directeur de réseau choisit à qui il écrit, le magasin est cité', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  const options: OptionsSimulation = { ecritures, messagerie: { messages: [
    msg(1, 'Annecy Test', 'Hugo FICTIF', 'coach', 'Inventaire fait ce matin.', [], 120),
    prive(2, 'franchise:Paul MULTI', 'Paul MULTI', 'directeur', 'Le devis de la vitrine est arrivé.', ['Annecy Test'], 60),
    prive(3, 'franchise:Paul MULTI', 'Paul MULTI', 'directeur', 'Et pour Rennes, rien de neuf.', ['Rennes Test'], 50),
  ] } }
  await seConnecter(page, options)
  await page.goto('./#/magasins/Annecy%20Test?vue=messages')
  const onglets = page.getByRole('tablist', { name: 'Rubriques de Annecy Test' })
  await expect(onglets.getByRole('tab', { name: 'Messages' })).toHaveAttribute('aria-selected', 'true')
  // L'ancien fil du magasin et les échanges qui le citent, pas les autres
  const fil = page.getByRole('list', { name: 'Messages de Annecy Test' })
  await expect(fil.getByRole('listitem')).toHaveText([/Hugo FICTIF · Coach.*Inventaire fait ce matin\./, /Paul MULTI · Franchisé.*Le devis de la vitrine/])
  await expect.poll(() => ecritures.some((e) => e.table === 'rpc/marquer_lu' && (e.corps as { p_store: string }).p_store === 'Annecy Test')).toBe(true)
  await expect.poll(() => ecritures.some((e) => e.table === 'rpc/marquer_lu_personne' && (e.corps as { p_cle: string }).p_cle === 'franchise:Paul MULTI')).toBe(true)

  // À qui : les personnes du magasin, sans soi-même ; par défaut celle du dernier échange
  const a = page.getByRole('radiogroup', { name: 'Écrire à' })
  await expect(a.getByRole('radio')).toHaveText([/Hugo FICTIF/, /Alex NORD/, /Paul MULTI/])
  await expect(a.getByRole('radio', { name: /Paul MULTI/ })).toHaveAttribute('aria-checked', 'true')
  if (info.project.name === 'telephone') for (const b of await a.getByRole('radio').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await a.getByRole('radio', { name: /Hugo FICTIF/ }).click()
  const champ = page.getByLabel('Message', { exact: true })
  await expect(champ).toHaveAttribute('placeholder', 'Message à Hugo FICTIF')
  await champ.fill('Merci Hugo, tu peux passer jeudi ?')
  await page.getByRole('button', { name: 'Envoyer' }).click()
  await expect(champ).toHaveValue('')
  expect(ecritures.find((e) => e.table === 'rpc/envoyer_a')!.corps).toEqual({ p_destinataire: 'coach:Hugo FICTIF', p_texte: 'Merci Hugo, tu peux passer jeudi ?', p_magasins: ['Annecy Test'] })
  const mien = fil.getByRole('listitem', { name: 'Message de Dominique DIRECTION' })
  await expect(mien).toContainText('À Hugo FICTIF')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-messagerie-fil.png`, fullPage: true })

  // Son propre message se retire : toucher la bulle fait apparaître « Supprimer »
  await expect(mien.getByRole('button', { name: /^Supprimer mon message/ })).toHaveCount(0)
  await mien.getByText(/Merci Hugo/).click()
  await mien.getByRole('button', { name: /^Supprimer mon message/ }).click()
  await expect(page.getByText('Message supprimé.')).toBeVisible()
  await expect(mien).toHaveCount(0)
})

test('le Coach est notifié de chaque message qu’on lui écrit', async ({ page }, info) => {
  await seConnecter(page, {
    appMetadata: HUGO,
    messagerie: { messages: [
      prive(1, 'franchise:Paul MULTI', 'Paul MULTI', 'coach:Hugo FICTIF', 'La livraison est arrivée cassée.', ['Annecy Test'], 10),
      prive(2, 'franchise:Paul MULTI', 'Paul MULTI', 'coach:Noé MODELE', 'Question pour Noé.', ['Rennes Test'], 5),
    ] },
  })
  const cloche = page.getByRole('button', { name: /^Notifications/ })
  await expect(cloche).toHaveAccessibleName('Notifications : 1 nouveauté')
  await expect(page.locator('button[aria-label^="Messages"]')).toHaveAccessibleName('Messages : 1 non lu')
  const menu = await ouvrirCloche(page)
  await expect(menu.getByRole('button')).toHaveCount(3) // la nouveauté, « Toutes les notifications » et « Tout marquer comme lu »
  await expect(menu).toContainText('Paul MULTI')
  await expect(menu).toContainText('Nouveau message')
  await expect(menu).toContainText('La livraison est arrivée cassée.')
  await expect(menu).not.toContainText('Question pour Noé')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-messagerie-notifications.png` })
  await menu.getByRole('button', { name: /Paul MULTI/ }).click()
  await expect(page).toHaveURL(/#\/messages\/personne\/franchise%3APaul%20MULTI$/)
  await expect(page.getByRole('list', { name: 'Messages de Paul MULTI' })).toContainText('La livraison est arrivée cassée.')
  await expect(cloche).toHaveAccessibleName('Notifications')
  await expect(page.locator('button[aria-label^="Messages"]')).toHaveAccessibleName('Messages')
})

test('un Responsable Régional n’est notifié que lorsqu’on le mentionne', async ({ page }) => {
  await seConnecter(page, {
    appMetadata: ALEX,
    messagerie: { messages: [
      msg(1, 'Annecy Test', 'Paul MULTI', 'franchise', 'Sans mention.', [], 10),
      msg(2, 'Lyon Test', 'Camille TESTARD', 'coach', '@Alex NORD peux-tu valider le devis ?', ['rr:rr1'], 5),
    ] },
  })
  const menu = await ouvrirCloche(page)
  await expect(menu).toContainText('Lyon Test')
  await expect(menu).toContainText('On te mentionne')
  await expect(menu).not.toContainText('Annecy Test')
  await menu.getByRole('button', { name: 'Tout marquer comme lu' }).click()
  await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveAccessibleName('Notifications')
})

test('le franchisé est notifié des messages et des nouveaux comptes rendus, et répond au Coach', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, {
    acces: PAUL, ecritures,
    messagerie: { reference: ilYa(60 * 24 * 30), messages: [prive(1, 'coach:Hugo FICTIF', 'Hugo FICTIF', 'franchise:Paul MULTI', 'Pense au plan de Noël.', ['Annecy Test'], 15)] },
    espace: { visites: [{ id: 60, store: 'Rennes Test', visit_date: '2026-10-01', type: 'terrain', visitor: 'Noé MODELE', signed_required: false, docs: [], created_at: ilYa(60) },
      { id: 61, store: 'Rennes Test', visit_date: '2026-01-01', type: 'terrain', visitor: 'Noé MODELE', signed_required: false, docs: [], created_at: ilYa(60 * 24 * 90) }] },
  })
  const cloche = page.getByRole('button', { name: /^Notifications/ })
  await expect(cloche).toHaveAccessibleName('Notifications : 2 nouveautés')
  const menu = await ouvrirCloche(page)
  await expect(menu).toContainText('Nouveau message')
  await expect(menu).toContainText('Nouveau compte rendu de visite')
  await menu.getByRole('button', { name: /Rennes Test/ }).click()
  await expect(page).toHaveURL(/#\/magasins\/Rennes%20Test\?vue=visites$/)
  await expect.poll(() => ecritures.some((e) => e.table === 'rpc/marquer_lu' && (e.corps as { p_sujet: string }).p_sujet === 'visites')).toBe(true)
  await expect(cloche).toHaveAccessibleName('Notifications : 1 nouveauté')

  // Annecy : onglet Messages avec sa pastille (le message du Coach cite le magasin)
  await page.goto('./#/magasins/Annecy%20Test')
  const onglets = page.getByRole('tablist', { name: 'Rubriques de Annecy Test' })
  await expect(onglets.getByRole('tab')).toHaveText(['Fil', 'Fiche', 'Messages1', 'Chiffres', 'Visites', 'Campagnes'])
  await onglets.getByRole('tab', { name: 'Messages' }).click()
  await expect(page.getByText('Nouveaux messages')).toBeVisible()
  // Le franchisé écrit à l'équipe du magasin, jamais à un autre franchisé
  const a = page.getByRole('radiogroup', { name: 'Écrire à' })
  await expect(a.getByRole('radio')).toHaveText([/Hugo FICTIF/, /Alex NORD/, /Dominique DIRECTION/])
  await expect(a.getByRole('radio', { name: /Hugo FICTIF/ })).toHaveAttribute('aria-checked', 'true')
  await page.getByLabel('Message', { exact: true }).fill('C’est noté, merci.')
  await page.getByRole('button', { name: 'Envoyer' }).click()
  await expect(page.getByRole('list', { name: 'Messages de Annecy Test' }).getByRole('listitem', { name: 'Message de Paul MULTI' })).toContainText('À Hugo FICTIF')
  expect(ecritures.find((e) => e.table === 'rpc/envoyer_a')!.corps).toEqual({ p_destinataire: 'coach:Hugo FICTIF', p_texte: 'C’est noté, merci.', p_magasins: ['Annecy Test'] })
  await expect(cloche).toHaveAccessibleName('Notifications')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-messagerie-franchise.png`, fullPage: true })
})

test('aperçu de l’espace d’un franchisé : ancien fil en lecture seule, sans échanges privés ni cloche', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, messagerie: { messages: [
    msg(1, 'Annecy Test', 'Paul MULTI', 'franchise', 'Bonjour à tous.', [], 15),
    prive(2, 'franchise:Paul MULTI', 'Paul MULTI', 'directeur', 'Entre nous deux.', ['Annecy Test'], 10),
  ] } })
  await page.evaluate(() => sessionStorage.setItem('apercu-franchise', JSON.stringify({ franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] })))
  await page.reload()
  await expect(page.getByRole('region', { name: 'Aperçu' })).toBeVisible()
  await page.goto('./#/magasins/Annecy%20Test?vue=messages')
  const fil = page.getByRole('list', { name: 'Messages de Annecy Test' })
  await expect(fil).toContainText('Bonjour à tous.')
  await expect(fil).not.toContainText('Entre nous deux.')
  await expect(page.getByLabel('Message', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveCount(0)
  expect(ecritures.filter((e) => e.table.startsWith('rpc/marquer_lu'))).toEqual([])
})

test('messagerie pas encore activée : pas de cloche, un état clair dans la fiche', async ({ page }) => {
  await seConnecter(page, { messagerie: null })
  await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveCount(0)
  await expect(page.locator('button[aria-label^="Messages"]')).toHaveCount(0)
  await page.goto('./#/magasins/Annecy%20Test?vue=messages')
  await expect(page.getByText('Messagerie pas encore activée')).toBeVisible()
})

test('conversations par personne : la plus récente d’abord, non lus, magasins cités avec #', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, {
    ecritures,
    messagerie: { messages: [
      prive(1, 'coach:Camille TESTARD', 'Camille TESTARD', 'directeur', 'Merci pour la visite.', [], 60 * 24 * 3),
      { ...prive(2, 'directeur', 'Dominique DIRECTION', 'franchise:Paul MULTI', 'Point stock demain ?', [], 40), auteur: MOI },
      prive(3, 'franchise:Paul MULTI', 'Paul MULTI', 'directeur', 'Oui, à 9 h.', ['Annecy Test'], 20),
    ], lus: { 'personne:coach:Camille TESTARD|messages': ilYa(60) } },
  })
  // Icône Messages à côté de la cloche, avec le nombre de messages non lus
  if (isMobile) await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button')).toHaveCount(5)
  await page.getByRole('button', { name: 'Messages : 1 non lu' }).click()
  await page.getByRole('button', { name: 'Tous les messages' }).click()
  const liste = page.getByRole('list', { name: 'Conversations' })
  await expect(liste.getByRole('button').nth(0)).toHaveText(/^PMPaul MULTI.*Oui, à 9 h\./)
  await expect(liste.getByRole('button').nth(1)).toHaveText(/^CTCamille TESTARD.*Merci pour la visite\./)

  if (isMobile) {
    await expect(liste.getByRole('button', { name: 'Paul MULTI : 1 message non lu' })).toBeVisible()
    await page.getByRole('button', { name: /^Non lus/ }).click()
    await expect(liste.getByRole('button')).toHaveCount(1)
    await page.getByRole('button', { name: /^Non lus/ }).click()
    expect(await textesTropPetits(page)).toEqual([])
    await page.screenshot({ path: `captures/${info.project.name}-messagerie-conversations.png` })
    await liste.getByRole('button', { name: /^Paul MULTI/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Paul MULTI' })).toBeVisible()
    // Dans une conversation, la barre du bas laisse la place à la saisie, collée en bas de l'écran
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(0)
    const champ = page.getByLabel('Message', { exact: true })
    await expect(champ).toBeInViewport()
    expect((await champ.boundingBox())!.y).toBeGreaterThan(page.viewportSize()!.height - 120)
  } else {
    // PC : la conversation la plus récente s'ouvre à côté de la liste
    await expect(liste.getByRole('button', { name: /^Paul MULTI/ })).toHaveAttribute('aria-current', 'true')
  }
  await expect(page).toHaveURL(/#\/messages\/personne\/franchise%3APaul%20MULTI$/)
  const fil = page.getByRole('list', { name: 'Messages de Paul MULTI' })
  await expect(fil.getByRole('listitem')).toHaveText([/Point stock demain \?/, /Paul MULTI · Franchisé.*Annecy Test.*Oui, à 9 h\./])
  await expect(page.getByText('Aujourd’hui')).toBeVisible()
  await expect.poll(() => ecritures.some((e) => e.table === 'rpc/marquer_lu_personne' && (e.corps as { p_cle: string }).p_cle === 'franchise:Paul MULTI')).toBe(true)
  await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveAccessibleName('Notifications')
  await expect(page.locator('button[aria-label^="Messages"]')).toHaveAccessibleName('Messages')

  // Sans magasin : PC, Entrée envoie
  const champ = page.getByLabel('Message', { exact: true })
  await champ.fill('Parfait')
  if (isMobile) await page.getByRole('button', { name: 'Envoyer' }).click()
  else await champ.press('Enter')
  await expect(champ).toHaveValue('')
  expect(ecritures.find((e) => e.table === 'rpc/envoyer_a')!.corps).toEqual({ p_destinataire: 'franchise:Paul MULTI', p_texte: 'Parfait', p_magasins: [] })

  // « # » propose les magasins partagés avec la personne, en puces au-dessus du champ
  await page.getByRole('button', { name: 'Citer un magasin' }).click()
  const suggestions = page.getByRole('list', { name: 'Magasins à citer' })
  await expect(suggestions.getByRole('button')).toHaveText(['Annecy Test', 'Rennes Test'])
  await expect(champ).toBeInViewport()
  const bandeau = (await suggestions.boundingBox())!, zone = (await champ.boundingBox())!
  expect(bandeau.y + bandeau.height).toBeLessThanOrEqual(zone.y)
  if (isMobile) for (const b of await suggestions.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await page.keyboard.type('ren')
  await expect(suggestions.getByRole('button')).toHaveText(['Rennes Test'])
  await suggestions.getByRole('button', { name: 'Rennes Test' }).click()
  await expect(champ).toHaveValue('#Rennes Test ')
  await champ.pressSequentially('travaux validés')
  await page.getByRole('button', { name: 'Envoyer' }).click()
  await expect(champ).toHaveValue('')
  expect(ecritures.filter((e) => e.table === 'rpc/envoyer_a')[1].corps).toEqual({ p_destinataire: 'franchise:Paul MULTI', p_texte: '#Rennes Test travaux validés', p_magasins: ['Rennes Test'] })
  await expect(fil.getByRole('listitem').last().locator('strong')).toHaveText(['#Rennes Test'])
  // Trier l'échange par magasin cité
  const tri = page.getByRole('group', { name: 'Magasins affichés' })
  await expect(tri.getByRole('button')).toHaveText(['Tous', 'Annecy Test', 'Rennes Test'])
  await tri.getByRole('button', { name: 'Rennes Test' }).click()
  await expect(fil.getByRole('listitem')).toHaveCount(1)
  await tri.getByRole('button', { name: 'Tous' }).click()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-messagerie-conversation.png` })

  // Démarrer une conversation : la recherche trouve les personnes d'un magasin
  if (isMobile) await page.getByRole('button', { name: 'Conversations' }).click()
  await page.getByLabel('Personne ou magasin').fill('renn')
  await liste.getByRole('button', { name: /^Noé MODELE/ }).click()
  await expect(page).toHaveURL(/#\/messages\/personne\/coach%3ANo%C3%A9%20MODELE$/)
  await expect(page.getByText('Aucun message.')).toBeVisible()
})

test('ancien lien vers les messages d’un magasin : la fiche du magasin', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/messages/Annecy%20Test')
  await expect(page).toHaveURL(/#\/magasins\/Annecy%20Test\?vue=messages$/)
  await expect(page.getByRole('list', { name: 'Messages de Annecy Test' }).or(page.getByText('Aucun message sur ce magasin.'))).toBeVisible()
})

test('le franchisé retrouve ses conversations depuis l’icône de l’en-tête', async ({ page }) => {
  await seConnecter(page, { acces: PAUL, messagerie: { messages: [prive(1, 'coach:Noé MODELE', 'Noé MODELE', 'franchise:Paul MULTI', 'Bonne semaine !', ['Rennes Test'], 15)] } })
  await page.locator('button[aria-label^="Messages"]').click()
  await page.getByRole('button', { name: 'Tous les messages' }).click()
  const liste = page.getByRole('list', { name: 'Conversations' })
  // Son Coach en tête (dernier message), puis les autres personnes de l'équipe de ses magasins, jamais un franchisé
  await expect(liste.getByRole('button').first()).toHaveText(/^NMNoé MODELE.*Bonne semaine !/)
  await expect(liste).toContainText('Hugo FICTIF')
  await expect(liste).not.toContainText('Paul MULTI')
  await liste.getByRole('button', { name: /^Noé MODELE/ }).click()
  await expect(page.getByRole('list', { name: 'Messages de Noé MODELE' })).toContainText('Bonne semaine !')
  await page.getByRole('button', { name: 'Citer un magasin' }).click()
  await expect(page.getByRole('list', { name: 'Magasins à citer' }).getByRole('button')).toHaveText(['Rennes Test'])
})

const confidentiels = () => [
  { ...msg(1, 'Annecy Test', 'Hugo FICTIF', 'coach', 'Entre nous : à surveiller.', [], 30), equipe: true },
  msg(2, 'Annecy Test', 'Hugo FICTIF', 'coach', 'Bonjour Paul !', [], 20),
]

test('anciens messages « Confidentiel » : visibles de l’équipe avec leur étiquette', async ({ page }) => {
  await seConnecter(page, { messagerie: { messages: confidentiels() } })
  await page.goto('./#/magasins/Annecy%20Test?vue=messages')
  await expect(page.getByRole('list', { name: 'Messages de Annecy Test' }).getByRole('listitem').first()).toContainText('Confidentiel')
})

test('anciens messages « Confidentiel » : jamais montrés au franchisé', async ({ page }) => {
  await seConnecter(page, { acces: PAUL, messagerie: { messages: confidentiels() } })
  await page.goto('./#/magasins/Annecy%20Test?vue=messages')
  const fil = page.getByRole('list', { name: 'Messages de Annecy Test' })
  await expect(fil).toContainText('Bonjour Paul !')
  await expect(fil).not.toContainText('Entre nous')
})

test('base pas encore mise à jour : le message part sur le magasin, la personne mentionnée', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, messagerie: { version: 2, messages: [] } })
  await page.goto('./#/messages/personne/franchise%3APaul%20MULTI')
  await page.getByLabel('Message', { exact: true }).fill('#Rennes Test bonjour')
  await page.getByRole('button', { name: 'Envoyer' }).click()
  await expect.poll(() => ecritures.find((e) => e.table === 'rpc/envoyer_message')?.corps).toEqual({ p_store: 'Rennes Test', p_texte: '#Rennes Test bonjour', p_mentions: ['franchise:Paul MULTI'] })
  expect(ecritures.some((e) => e.table === 'rpc/envoyer_a')).toBe(false)
})

test('page Notifications : les nouvelles avec un point, puis l’historique déjà vu', async ({ page, isMobile }, info) => {
  await seConnecter(page, {
    appMetadata: HUGO,
    messagerie: {
      messages: [
        msg(1, 'Annecy Test', 'Paul MULTI', 'franchise', 'Ancienne question réglée.', [], 60 * 24 * 2),
        msg(2, 'Lyon Test', 'Camille TESTARD', 'coach', '@Hugo FICTIF tu peux me remplacer ?', ['coach:Hugo FICTIF'], 60 * 24),
        prive(3, 'franchise:Paul MULTI', 'Paul MULTI', 'coach:Hugo FICTIF', 'Nouvelle demande de PLV.', ['Annecy Test'], 10),
      ],
      lus: { 'Annecy Test|messages': ilYa(60 * 24 * 2 - 5), 'Lyon Test|messages': ilYa(60 * 12) },
    },
  })
  const menu = await ouvrirCloche(page)
  await menu.getByRole('button', { name: 'Toutes les notifications' }).click()
  await expect(page).toHaveURL(/#\/notifications$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible()
  const nouvelles = page.getByRole('region', { name: 'Nouvelles' })
  const vues = page.getByRole('region', { name: 'Déjà vues' })
  await expect(nouvelles.getByRole('button')).toHaveText([/Message de Paul MULTI.*Annecy Test.*Nouvelle demande de PLV/])
  await expect(vues.getByRole('button')).toHaveText([/Camille TESTARD te mentionne.*Lyon Test/, /Message de Paul MULTI.*Ancienne question réglée/])
  await page.getByRole('group', { name: 'Notifications affichées' }).getByRole('button', { name: /^Nouvelles/ }).click()
  await expect(vues).toHaveCount(0)
  await page.getByRole('group', { name: 'Notifications affichées' }).getByRole('button', { name: 'Toutes' }).click()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-notifications.png`, fullPage: true })
  // Tout marquer comme lu : tout passe dans l'historique, rien n'est perdu
  await page.getByRole('button', { name: 'Tout marquer comme lu' }).click()
  await expect(nouvelles).toHaveCount(0)
  await expect(vues.getByRole('button')).toHaveCount(3)
  await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveAccessibleName('Notifications')
  // Une notification ouvre l'échange avec la personne
  await vues.getByRole('button', { name: /Nouvelle demande de PLV|Message de Paul MULTI · Annecy Test/ }).first().click()
  await expect(page).toHaveURL(/#\/messages\/personne\/franchise%3APaul%20MULTI$/)
  if (isMobile) await expect(page.getByRole('heading', { level: 1, name: 'Paul MULTI' })).toBeVisible()
})
