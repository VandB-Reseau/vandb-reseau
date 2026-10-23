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

const onglet = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: /^Messages/ }).first()

test('fiche magasin : le Directeur de réseau écrit dans le groupe du magasin', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  const options: OptionsSimulation = { ecritures, messagerie: { messages: [
    msg(1, 'Annecy Test', 'Hugo FICTIF', 'coach', 'Inventaire fait ce matin.', [], 120),
    prive(2, 'franchise:Paul MULTI', 'Paul MULTI', 'directeur', 'Le devis de la vitrine est arrivé.', ['Annecy Test'], 60),
  ] } }
  await seConnecter(page, options)
  // L'ancien onglet Messages de la fiche mène au groupe du magasin dans Messages (sprint 22, S2)
  await page.goto('./#/magasins/Annecy%20Test?vue=messages')
  await expect(page).toHaveURL(/#\/echanges\/magasin\/Annecy%20Test$/)
  // Le groupe du magasin ; les échanges à deux restent dans leur conversation
  const fil = page.getByRole('list', { name: /^Messages de / })
  await expect(fil).toContainText('Inventaire fait ce matin.')
  await expect(fil).not.toContainText('Le devis de la vitrine')
  await expect.poll(() => ecritures.some((e) => e.table === 'rpc/marquer_lu_fil' && (e.corps as { p_fil: string }).p_fil === 'magasin:Annecy Test')).toBe(true)

  const champ = page.getByLabel('Message', { exact: true })
  await expect(champ).toHaveAttribute('placeholder', 'Message au groupe')
  await champ.fill('Merci Hugo, tu peux passer jeudi ?')
  await page.getByRole('button', { name: 'Envoyer' }).click()
  await expect(champ).toHaveValue('')
  expect(ecritures.find((e) => e.table === 'rpc/envoyer_fil')!.corps).toEqual({ p_fil: 'magasin:Annecy Test', p_texte: 'Merci Hugo, tu peux passer jeudi ?', p_mentions: [] })
  const mien = fil.getByRole('listitem', { name: 'Message de Dominique DIRECTION' })
  await expect(mien).toContainText('Merci Hugo')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-messagerie-fil.png`, fullPage: true })

  // Son propre message se retire : toucher la bulle fait apparaître « Supprimer »
  await expect(mien.getByRole('button', { name: /^Supprimer mon message/ })).toHaveCount(0)
  await mien.getByText(/Merci Hugo/).click()
  await mien.getByRole('button', { name: /^Supprimer mon message/ }).click()
  await expect(page.getByText('Message supprimé.')).toBeVisible()
  await expect(mien).toHaveCount(0)
})

test('le Coach est prévenu de ce qu’on lui écrit et de tout ce qui se dit sur ses magasins', async ({ page }) => {
  await seConnecter(page, {
    appMetadata: HUGO,
    messagerie: { messages: [
      prive(1, 'franchise:Paul MULTI', 'Paul MULTI', 'coach:Hugo FICTIF', 'La livraison est arrivée cassée.', ['Annecy Test'], 10),
      prive(2, 'franchise:Paul MULTI', 'Paul MULTI', 'coach:Noé MODELE', 'Question pour Noé.', ['Rennes Test'], 5),
      msg(3, 'Annecy Test', 'Paul MULTI', 'franchise', 'Vitrine posée.', [], 8),
    ] },
  })
  await page.goto('./#/')
  await expect(onglet(page)).toHaveAccessibleName('Messages : 2 nouveautés')
  await page.goto('./#/echanges/personne/franchise%3APaul%20MULTI')
  await expect(page.getByRole('list', { name: 'Messages de Paul MULTI' })).toContainText('La livraison est arrivée cassée.')
  await expect(page.getByRole('list', { name: 'Messages de Paul MULTI' })).not.toContainText('Question pour Noé')
  // Téléphone : la barre du bas laisse la place à la saisie dans une conversation
  await page.goto('./#/')
  await expect(onglet(page)).toHaveAccessibleName('Messages : 1 nouveauté')
})

test('un Responsable Régional n’est prévenu que s’il est cité ou a déjà écrit dans le fil', async ({ page, isMobile }) => {
  await seConnecter(page, {
    appMetadata: ALEX,
    messagerie: { messages: [
      msg(1, 'Annecy Test', 'Paul MULTI', 'franchise', 'Sans mention.', [], 10),
      msg(2, 'Bordeaux Test', 'Camille TESTARD', 'coach', '@Alex NORD peux-tu valider le devis ?', ['rr:rr1'], 5),
    ] },
  })
  await page.goto('./#/')
  await expect(onglet(page)).toHaveAccessibleName('Messages : 1 nouveauté')
  await page.goto('./#/echanges')
  const liste = page.getByRole('list', { name: 'Conversations' })
  // Annecy reste en gras (non lu) sans compter dans le total
  await expect(liste.getByRole('button', { name: 'Annecy Test : 1 message non lu' })).toBeVisible()
  // PC : la conversation la plus récente s'ouvre à côté et se lit ; téléphone : la liste d'abord
  if (isMobile) await expect(liste.getByRole('button', { name: 'Bordeaux Test : 1 message non lu, on te cite' })).toBeVisible()
  else await expect(liste.getByRole('button', { name: /^Bordeaux Test/ })).toHaveAttribute('aria-current', 'true')
})

test('le franchisé est prévenu des messages et des nouveaux comptes rendus, et répond dans le groupe', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, {
    acces: PAUL, ecritures,
    messagerie: { reference: ilYa(60 * 24 * 30), messages: [msg(1, 'Annecy Test', 'Hugo FICTIF', 'coach', 'Pense au plan de Noël.', [], 15)] },
    espace: { visites: [{ id: 60, store: 'Rennes Test', visit_date: '2026-10-01', type: 'terrain', visitor: 'Noé MODELE', signed_required: false, docs: [], created_at: ilYa(60) },
      { id: 61, store: 'Rennes Test', visit_date: '2026-01-01', type: 'terrain', visitor: 'Noé MODELE', signed_required: false, docs: [], created_at: ilYa(60 * 24 * 90) }] },
  })
  await page.goto('./#/')
  await expect(onglet(page)).toHaveAccessibleName('Messages : 2 nouveautés')
  await page.goto('./#/echanges/magasin/Annecy%20Test')
  const fil = page.getByRole('list', { name: /^Messages de / })
  await expect(fil).toContainText('Pense au plan de Noël.')
  // Le franchisé n'a qu'un fil : pas de choix « Équipe seule »
  await expect(page.getByRole('button', { name: 'Équipe seule', exact: true })).toHaveCount(0)
  await page.getByLabel('Message', { exact: true }).fill('C’est noté, merci.')
  await page.getByRole('button', { name: 'Envoyer' }).click()
  await expect(fil.getByRole('listitem', { name: 'Message de Paul MULTI' })).toContainText('C’est noté, merci.')
  expect(ecritures.find((e) => e.table === 'rpc/envoyer_fil')!.corps).toEqual({ p_fil: 'magasin:Annecy Test', p_texte: 'C’est noté, merci.', p_mentions: [] })
  await page.goto('./#/')
  await expect(onglet(page)).toHaveAccessibleName('Messages : 1 nouveauté')
  // Les comptes rendus ne sont plus dans les groupes : ils vont dans le fil d'actualité (Joseph, 22/10/2026)
  await page.goto('./#/echanges/magasin/Rennes%20Test')
  await expect(page.getByRole('heading', { name: 'Rennes Test' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /^Compte rendu : / })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-messagerie-franchise.png`, fullPage: true })
})

test('aperçu de l’espace d’un franchisé : groupe en lecture seule, sans échanges privés ni compteur', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, messagerie: { messages: [
    msg(1, 'Annecy Test', 'Paul MULTI', 'franchise', 'Bonjour à tous.', [], 15),
    prive(2, 'franchise:Paul MULTI', 'Paul MULTI', 'directeur', 'Entre nous deux.', ['Annecy Test'], 10),
  ] } })
  await page.evaluate(() => sessionStorage.setItem('apercu-franchise', JSON.stringify({ franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] })))
  await page.reload()
  await expect(page.getByRole('region', { name: 'Aperçu' })).toBeVisible()
  await page.goto('./#/magasins/Annecy%20Test?vue=messages')
  const fil = page.getByRole('list', { name: /^Messages de / })
  await expect(fil).toContainText('Bonjour à tous.')
  await expect(fil).not.toContainText('Entre nous deux.')
  await expect(page.getByLabel('Message', { exact: true })).toHaveCount(0)
  expect(ecritures.filter((e) => e.table.startsWith('rpc/marquer_lu'))).toEqual([])
})

test('messagerie pas encore activée : un état clair dans l’onglet', async ({ page }) => {
  await seConnecter(page, { messagerie: null })
  await page.goto('./#/echanges')
  await expect(page.getByText('Messagerie pas encore activée')).toBeVisible()
})

test('échanges à deux : non lus, magasins cités avec #, saisie en bas sur téléphone', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, {
    ecritures,
    messagerie: { messages: [
      prive(1, 'coach:Camille TESTARD', 'Camille TESTARD', 'directeur', 'Merci pour la visite.', [], 60 * 24 * 3),
      { ...prive(2, 'directeur', 'Dominique DIRECTION', 'franchise:Paul MULTI', 'Point stock demain ?', [], 40), auteur: MOI },
      prive(3, 'franchise:Paul MULTI', 'Paul MULTI', 'directeur', 'Oui, à 9 h.', ['Annecy Test'], 20),
    ], lus: { 'personne:coach:Camille TESTARD|messages': ilYa(60) } },
  })
  await page.goto('./#/echanges')
  const liste = page.getByRole('list', { name: 'Conversations' })
  // Les canaux Réseau et Bonnes pratiques épinglés, puis la conversation la plus récente
  await expect(liste.getByRole('button').nth(0)).toHaveAccessibleName(/^Réseau V and B/)
  await expect(liste.getByRole('button').nth(1)).toHaveAccessibleName('Bonnes pratiques')
  await expect(liste.getByRole('button').nth(2)).toHaveText(/Paul MULTI.*Oui, à 9 h\./)

  if (isMobile) {
    await expect(liste.getByRole('button', { name: 'Paul MULTI : 1 message non lu' })).toBeVisible()
    await page.getByRole('button', { name: /^Non lus/ }).click()
    await expect(liste.getByRole('button', { name: /Paul MULTI/ })).toBeVisible()
    await expect(liste.getByRole('button', { name: /Camille TESTARD/ })).toHaveCount(0)
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
    await liste.getByRole('button', { name: /^Paul MULTI/ }).click()
    await expect(liste.getByRole('button', { name: /^Paul MULTI/ })).toHaveAttribute('aria-current', 'true')
  }
  await expect(page).toHaveURL(/#\/echanges\/personne\/franchise%3APaul%20MULTI$/)
  const fil = page.getByRole('list', { name: 'Messages de Paul MULTI' })
  await expect(fil).toContainText('Point stock demain ?')
  await expect(fil).toContainText('Oui, à 9 h.')
  await expect.poll(() => ecritures.some((e) => e.table === 'rpc/marquer_lu_personne' && (e.corps as { p_cle: string }).p_cle === 'franchise:Paul MULTI')).toBe(true)

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
  if (isMobile) for (const b of await suggestions.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await page.keyboard.type('ren')
  await expect(suggestions.getByRole('button')).toHaveText(['Rennes Test'])
  await suggestions.getByRole('button', { name: 'Rennes Test' }).click()
  await expect(champ).toHaveValue('#Rennes Test ')
  await expect.poll(() => champ.evaluate((e) => document.activeElement === e && (e as HTMLTextAreaElement).selectionStart)).toBe('#Rennes Test '.length)
  await champ.pressSequentially('travaux validés')
  await page.getByRole('button', { name: 'Envoyer' }).click()
  await expect(champ).toHaveValue('')
  expect(ecritures.filter((e) => e.table === 'rpc/envoyer_a')[1].corps).toEqual({ p_destinataire: 'franchise:Paul MULTI', p_texte: '#Rennes Test travaux validés', p_magasins: ['Rennes Test'] })
  await page.screenshot({ path: `captures/${info.project.name}-messagerie-conversation.png` })
})

test('ancien lien vers les messages d’un magasin : son groupe dans les Échanges', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/messages/Annecy%20Test')
  await expect(page).toHaveURL(/#\/echanges\/magasin\/Annecy%20Test$/)
  await page.goto('./#/messages/personne/franchise%3APaul%20MULTI')
  await expect(page).toHaveURL(/#\/echanges\/personne\/franchise%3APaul%20MULTI$/)
})

test('le franchisé écrit à une personne de l’équipe, jamais à un autre franchisé', async ({ page }) => {
  await seConnecter(page, { acces: PAUL, messagerie: { messages: [prive(1, 'coach:Noé MODELE', 'Noé MODELE', 'franchise:Paul MULTI', 'Bonne semaine !', ['Rennes Test'], 15)] } })
  await page.goto('./#/echanges')
  const liste = page.getByRole('list', { name: 'Conversations' })
  await expect(liste).toContainText('Hugo FICTIF')
  await expect(liste.getByRole('button', { name: /^Paul MULTI/ })).toHaveCount(0)
  await liste.getByRole('button', { name: /^Noé MODELE/ }).click()
  await expect(page.getByRole('list', { name: 'Messages de Noé MODELE' })).toContainText('Bonne semaine !')
  await page.getByRole('button', { name: 'Citer un magasin' }).click()
  await expect(page.getByRole('list', { name: 'Magasins à citer' }).getByRole('button')).toHaveText(['Rennes Test'])
})

const entreEquipe = () => [
  { ...msg(1, 'Annecy Test', 'Hugo FICTIF', 'coach', 'Entre nous : à surveiller.', [], 30), equipe: true },
  msg(2, 'Annecy Test', 'Hugo FICTIF', 'coach', 'Bonjour Paul !', [], 20),
]

test('anciens messages « Confidentiel » : rangés dans « Équipe seule »', async ({ page }) => {
  await seConnecter(page, { messagerie: { messages: entreEquipe() } })
  await page.goto('./#/magasins/Annecy%20Test?vue=messages')
  const fil = page.getByRole('list', { name: /^Messages de / })
  await expect(fil).toContainText('Bonjour Paul !')
  await expect(fil).not.toContainText('Entre nous')
  await page.getByRole('button', { name: 'Équipe seule', exact: true }).click()
  await expect(fil).toContainText('Entre nous : à surveiller.')
})

test('anciens messages « Confidentiel » : jamais montrés au franchisé', async ({ page }) => {
  await seConnecter(page, { acces: PAUL, messagerie: { messages: entreEquipe() } })
  await page.goto('./#/magasins/Annecy%20Test?vue=messages')
  const fil = page.getByRole('list', { name: /^Messages de / })
  await expect(fil).toContainText('Bonjour Paul !')
  await expect(fil).not.toContainText('Entre nous')
})

test('base pas encore mise à jour : le groupe du magasin passe par l’ancien envoi', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, messagerie: { version: 3, messages: [] } })
  await page.goto('./#/echanges/magasin/Annecy%20Test?fil=equipe')
  await page.getByLabel('Message', { exact: true }).fill('Point jeudi')
  await page.getByRole('button', { name: 'Envoyer' }).click()
  await expect.poll(() => ecritures.find((e) => e.table === 'rpc/envoyer_message')?.corps).toEqual({ p_store: 'Annecy Test', p_texte: 'Point jeudi', p_mentions: [], p_equipe: true })
  expect(ecritures.some((e) => e.table === 'rpc/envoyer_fil')).toBe(false)
})

test('base d’avant les échanges à deux : le message part sur le magasin, la personne mentionnée', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, messagerie: { version: 2, messages: [] } })
  await page.goto('./#/echanges/personne/franchise%3APaul%20MULTI')
  await page.getByLabel('Message', { exact: true }).fill('#Rennes Test bonjour')
  await page.getByRole('button', { name: 'Envoyer' }).click()
  await expect.poll(() => ecritures.find((e) => e.table === 'rpc/envoyer_message')?.corps).toEqual({ p_store: 'Rennes Test', p_texte: '#Rennes Test bonjour', p_mentions: ['franchise:Paul MULTI'] })
  expect(ecritures.some((e) => e.table === 'rpc/envoyer_a')).toBe(false)
})
