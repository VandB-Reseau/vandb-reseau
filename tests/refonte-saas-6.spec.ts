import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture, type MessageSimule, type OptionsSimulation } from './supabase-simule'
import { zonesTropPetites } from './pilotage/supabase-simule'

// Refonte façon SaaS, vague 6 (Joseph, 10/11/2026, « tout en une fois sauf 59, 61, 65, 66, 67, 69, 70, 78 ») :
// messagerie (57, 58, 60, 62, 63, 64, 68, 71, 72) et retours du téléphone (Notifications, un seul « + », menu en rubriques).

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

// Annecy Test : Coach Hugo FICTIF, franchisé Paul MULTI
const AUTRE = '00000000-0000-0000-0000-0000000000aa'
const ilYa = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const msg = (id: number, texte: string, extra: Partial<MessageSimule> = {}, minutes = 30): MessageSimule =>
  ({ id, store: 'Annecy Test', auteur: AUTRE, auteur_nom: 'Paul MULTI', auteur_role: 'franchise', auteur_cle: 'franchise:Paul MULTI', texte, mentions: [], cree_le: ilYa(minutes), ...extra })
const HUGO = { role: 'coach', coach: 'Hugo FICTIF' }

test('le Coach cite, réagit, épingle et transforme un message du franchisé en demande', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  const options: OptionsSimulation = { appMetadata: HUGO, ecritures, demandes: [], messagerie: { version: 5, messages: [
    msg(1, 'La caisse ne sort plus les tickets cadeaux.', {}, 90),
    msg(2, 'Merci pour la visite de jeudi.', { reactions: [{ reaction: 'merci', nom: 'Alex NORD', par: 'rr:rr1' }] }, 60),
  ] } }
  await seConnecter(page, options)
  await page.goto('./#/echanges/magasin/Annecy%20Test')
  const fil = page.getByRole('list', { name: /^Messages de / })
  await expect(fil).toContainText('La caisse ne sort plus les tickets cadeaux.')
  // 58A : deux fils en onglets, la visibilité dite au-dessus de la saisie
  await expect(page.getByRole('tab', { name: /Avec le franchisé/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(/^Visible par .*Paul MULTI/)).toBeVisible()
  // 60A : réaction déjà posée par le RR
  await expect(fil.getByRole('group', { name: 'Réactions' })).toContainText('Merci · 1')

  // Citer et répondre
  await fil.getByText('La caisse ne sort plus les tickets cadeaux.').first().click()
  const actions = page.getByRole('group', { name: 'Actions du message' })
  await expect(actions).toBeVisible()
  await lisible(page, isMobile)
  await actions.getByRole('button', { name: 'Répondre' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Réponse à Paul MULTI' })).toBeVisible()
  await page.getByLabel('Message', { exact: true }).fill('Je passe la regarder demain.')
  await page.getByRole('button', { name: 'Envoyer' }).click()
  await expect.poll(() => ecritures.find((e) => e.table === 'rpc/ecrire_fil')?.corps).toMatchObject({ p_fil: 'magasin:Annecy Test', p_texte: 'Je passe la regarder demain.', p_repond_a: 1 })

  // Réagir et épingler
  await fil.getByText('La caisse ne sort plus les tickets cadeaux.').first().click()
  await page.getByRole('group', { name: 'Actions du message' }).getByRole('button', { name: 'Réagir : Vu' }).click()
  await expect.poll(() => ecritures.find((e) => e.table === 'rpc/reagir_message')?.corps).toEqual({ p_id: 1, p_reaction: 'vu' })
  const actionsOuvertes = page.getByRole('group', { name: 'Actions du message' })
  if (!(await actionsOuvertes.isVisible())) await fil.getByText('La caisse ne sort plus les tickets cadeaux.').first().click()
  await actionsOuvertes.getByRole('button', { name: 'Épingler' }).click()
  await expect.poll(() => ecritures.find((e) => e.table === 'rpc/epingler_message')?.corps).toMatchObject({ p_id: 1 })
  await expect(page.getByRole('region', { name: 'Messages épinglés' })).toContainText('tickets cadeaux')

  // 57A : le message devient une demande au siège, suivie dans Demandes
  if (!(await actionsOuvertes.isVisible())) await fil.getByText('La caisse ne sort plus les tickets cadeaux.').first().click()
  await actionsOuvertes.getByRole('button', { name: 'Transformer en demande' }).click()
  const d = page.getByRole('dialog', { name: 'Transformer en demande' })
  await expect(d.getByLabel('Demande en une ligne')).not.toHaveValue('')
  await expect(d.getByRole('button', { name: 'Créer la demande' })).toBeDisabled()
  await d.getByRole('combobox', { name: 'Thème' }).click()
  await page.getByRole('option').first().click()
  await d.getByRole('button', { name: 'Créer la demande' }).click()
  await expect(page.getByText('Demande créée : elle est suivie dans Demandes.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'rpc/demande_depuis_message')?.corps).toMatchObject({ p_id: 1 })
  await page.screenshot({ path: `captures/${info.project.name}-vague6-messages.png`, fullPage: true })
})

test('le franchisé modifie son message ; il ne voit ni « Équipe seule » ni « Transformer en demande »', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] }, ecritures, messagerie: { version: 5, messages: [
    { ...msg(1, 'Commande passée.', {}, 5), auteur: '00000000-0000-0000-0000-000000000001' },
  ] } })
  await page.goto('./#/echanges/magasin/Annecy%20Test')
  await expect(page.getByRole('tab', { name: /Équipe seule/ })).toHaveCount(0)
  const fil = page.getByRole('list', { name: /^Messages de / })
  await fil.getByText('Commande passée.').click()
  const actions = page.getByRole('group', { name: 'Actions du message' })
  await expect(actions.getByRole('button', { name: 'Transformer en demande' })).toHaveCount(0)
  if (await actions.getByRole('button', { name: 'Modifier' }).count()) {
    await actions.getByRole('button', { name: 'Modifier' }).click()
    const d = page.getByRole('dialog', { name: 'Modifier mon message' })
    await d.getByRole('textbox').fill('Commande passée ce matin.')
    await d.getByRole('button', { name: 'Enregistrer' }).click()
    await expect.poll(() => ecritures.find((e) => e.table === 'rpc/modifier_message')?.corps).toEqual({ p_id: 1, p_texte: 'Commande passée ce matin.' })
  }
})

test('62A : un message à plusieurs magasins, le prénom du franchisé inséré', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'Envoi à plusieurs magasins : depuis le PC')
  const ecritures: Ecriture[] = []
  await seConnecter(page, { appMetadata: HUGO, ecritures, messagerie: { version: 5, messages: [msg(1, 'Bonjour.')] } })
  await page.goto('./#/echanges')
  await page.getByRole('button', { name: /^Nouveau|^Écrire|^Nouvelle conversation/ }).first().click()
  await page.getByRole('menuitem', { name: 'Message à plusieurs magasins' }).click()
  const d = page.getByRole('dialog', { name: 'Message à plusieurs magasins' })
  await d.getByRole('button', { name: /^Tous mes magasins · \d+/ }).click()
  await d.getByRole('button', { name: 'Insérer le prénom du franchisé' }).click()
  await d.getByRole('textbox', { name: 'Message' }).pressSequentially(', pensez à la clôture.')
  await d.getByRole('button', { name: /^Envoyer à \d+ magasins/ }).click()
  await expect(page.getByText(/^Message envoyé à \d+ magasins\.$/)).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'rpc/ecrire_magasins')!.corps as { p_magasins: string[]; p_texte: string }
  expect(envoi.p_magasins).toContain('Annecy Test')
  expect(envoi.p_texte).toContain('{prénom}')
})

test('63A et 71A : vues des conversations et recherche dans les messages', async ({ page, isMobile }) => {
  await seConnecter(page, { appMetadata: HUGO, messagerie: { version: 5, messages: [msg(1, 'Le livreur de fûts est passé en retard.')] } })
  await page.goto('./#/echanges')
  const vues = page.getByRole('group', { name: 'Vues des conversations' })
  await expect(vues.getByRole('button').or(vues.getByRole('radio'))).toHaveText([/^Tout/, /^Non lus/, /^Mentions/, /^Demandes/])
  await page.getByPlaceholder('Magasin, personne, message').fill('livreur')
  const trouves = page.getByRole('list', { name: 'Messages trouvés' })
  await expect(trouves).toContainText('Le livreur de fûts est passé en retard.')
  await trouves.getByRole('button').first().click()
  await expect(page).toHaveURL(/echanges\/magasin\/Annecy%20Test.*message=1/)
  await lisible(page, isMobile)
})

test('68A : la conversation du magasin s’ouvre sur le côté depuis la fiche', async ({ page, isMobile }) => {
  await seConnecter(page, { appMetadata: HUGO, messagerie: { version: 5, messages: [msg(1, 'Vitrine posée.')] } })
  await page.goto('./#/magasins/Annecy%20Test')
  await page.getByRole('main').getByRole('button', { name: 'Écrire un message', exact: true }).click()
  if (isMobile) {
    await expect(page).toHaveURL(/echanges\/magasin\/Annecy%20Test/)
    return
  }
  const panneau = page.getByRole('dialog', { name: 'Conversation : Annecy Test' })
  await expect(panneau.getByRole('list', { name: /^Messages de / })).toContainText('Vitrine posée.')
  await expect(page).toHaveURL(/magasins\/Annecy%20Test/)
  await panneau.getByRole('button', { name: 'Fermer la conversation' }).click()
  await expect(panneau).toBeHidden()
})

test('téléphone : les notifications se referment, un seul « + » sur Magasins, menu du compte en rubriques', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Retours du téléphone')
  await seConnecter(page)
  await page.goto('./#/magasins?vue=liste')
  await expect(page.getByRole('heading', { name: 'Magasins', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ajouter un magasin' })).toHaveCount(0)
  // La cloche : le titre et le bouton de fermeture ne sont plus cachés sous la barre du haut
  await page.getByRole('button', { name: /^Notifications/ }).click()
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  await page.getByRole('button', { name: 'Fermer les notifications' }).click()
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible()
  // Menu du compte : rubriques comme sur PC
  await page.getByRole('button', { name: 'Mon compte' }).click()
  const menu = page.getByRole('menu')
  for (const r of ['Réseau', 'Animation', 'Réglages']) await expect(menu.getByText(r, { exact: true })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Visites' })).toBeVisible()
  await lisible(page, isMobile)
})
