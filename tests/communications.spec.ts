import { expect, test } from '@playwright/test'
import { MOI, PNG, seConnecter, textesTropPetits, type CommunicationSimulee, type Ecriture } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const PAUL = { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] }
const AUTRE = '00000000-0000-0000-0000-000000000009'
const communications = (): CommunicationSimulee[] => [
  { id: 1, titre: 'Lancement des coffrets de Noël', texte: 'Les coffrets arrivent en magasin le 2 novembre.\nMise en avant en tête de gondole.', magasins: null, auteur: AUTRE, auteur_nom: 'Joseph PERREAU', auteur_role: 'directeur', cree_le: '2026-10-19T09:00:00Z',
    pouces: [{ user_id: AUTRE, nom: 'Noé MODELE' }], commentaires: [{ id: 1, auteur: AUTRE, auteur_nom: 'Noé MODELE', auteur_role: 'coach', texte: 'Bien reçu, je relaie en visite.', cree_le: '2026-10-19T10:00:00Z' }] },
  { id: 2, titre: 'Réunion des franchisés du Sud', texte: 'Rendez-vous à Marseille.', magasins: ['Nice Test'], auteur: AUTRE, auteur_nom: 'Sam SUD', auteur_role: 'rr', cree_le: '2026-10-18T09:00:00Z' },
]

test('le Directeur publie une communication pour tout le réseau', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, communications: [] })
  await page.goto('./#/communications')
  await expect(page.getByRole('heading', { level: 1, name: 'Communications' })).toBeVisible()
  await expect(page.getByText('Aucune communication')).toBeVisible()
  await page.getByRole('button', { name: 'Publier' }).click()
  const d = page.getByRole('dialog', { name: 'Nouvelle communication' })
  await d.getByLabel('Titre').fill('Nouvelle carte des cocktails')
  await d.getByRole('textbox', { name: 'Message' }).fill('La carte d’hiver est disponible.')
  expect(await textesTropPetits(page)).toEqual([])
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const carte = page.getByRole('article', { name: 'Nouvelle carte des cocktails' })
  await expect(carte).toContainText('Tout le réseau')
  await expect(carte).toContainText('La carte d’hiver est disponible.')
  expect(ecritures.find((e) => e.table === 'rpc/publier_communication')?.corps).toMatchObject({ p_id: null, p_titre: 'Nouvelle carte des cocktails' })
  // L'auteur la modifie
  await carte.getByRole('button', { name: 'Modifier la communication Nouvelle carte des cocktails' }).click()
  await expect(page.getByRole('dialog', { name: 'Modifier la communication' })).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-communication-publier.png`, fullPage: !isMobile })
})

test('un franchisé lit les communications de ses magasins, met un pouce et commente', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { acces: PAUL, ecritures, communications: communications() })
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await nav.getByRole('button', { name: isMobile ? 'Infos' : 'Communications' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Communications' })).toBeVisible()
  // Celle du Sud ne concerne pas ses magasins
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Publier' })).toHaveCount(0)
  const carte = page.getByRole('article', { name: 'Lancement des coffrets de Noël' })
  await expect(carte.getByText('Bien reçu, je relaie en visite.')).toBeVisible()
  const pouce = carte.getByRole('button', { name: /^J’aime/ })
  await expect(pouce).toHaveText('J’aime · 1')
  await pouce.click()
  await expect(pouce).toHaveAttribute('aria-pressed', 'true')
  await expect(pouce).toHaveText('J’aime · 2')
  expect(ecritures.some((e) => e.table === 'rpc/basculer_pouce_communication')).toBe(true)
  await carte.getByRole('button', { name: /^Commenter/ }).click()
  await carte.getByRole('textbox', { name: 'Commentaire sur Lancement des coffrets de Noël' }).fill('Merci, on s’organise.')
  await carte.getByRole('button', { name: 'Envoyer le commentaire' }).click()
  await expect(carte.getByText('Merci, on s’organise.')).toBeVisible()
  await expect(carte.getByRole('button', { name: /^Commenter · 2$/ })).toBeVisible()
  expect(ecritures.find((e) => e.table === 'rpc/commenter_communication')?.corps).toEqual({ p_id: 1, p_texte: 'Merci, on s’organise.' })
  // Son commentaire se retire
  await expect(carte.getByRole('button', { name: /^Retirer mon commentaire/ })).toHaveCount(1)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-communication-franchise.png`, fullPage: !isMobile })
})

test('un Coach lit et commente, sans publier', async ({ page }) => {
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Noé MODELE' }, communications: communications() })
  await page.goto('./#/communications')
  await expect(page.getByRole('article', { name: 'Lancement des coffrets de Noël' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publier' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Modifier la communication/ })).toHaveCount(0)
})

test('la recherche filtre les communications et un Responsable Régional publie pour ses magasins', async ({ page }) => {
  const liste = communications()
  await seConnecter(page, { appMetadata: { role: 'rr', rr: 'rr1' }, communications: liste })
  await page.goto('./#/communications')
  await page.getByPlaceholder('Rechercher une communication').fill('Marseille')
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('article', { name: 'Réunion des franchisés du Sud' })).toBeVisible()
  await page.getByPlaceholder('Rechercher une communication').fill('')
  await page.getByRole('button', { name: 'Publier' }).click()
  const d = page.getByRole('dialog', { name: 'Nouvelle communication' })
  await d.getByLabel('Titre').fill('Point rentrée')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('article', { name: 'Point rentrée' })).toContainText('2 magasins')
  expect(liste.at(-1)).toMatchObject({ auteur: MOI, magasins: ['Lyon Test', 'Metz Test'] })
})

test('tant que le script n’est pas passé, la page le dit sans erreur technique', async ({ page }) => {
  await seConnecter(page, { communications: null })
  await page.goto('./#/communications')
  await expect(page.getByText('Communications pas encore activées')).toBeVisible()
  await expect(page.getByText(/PGRST|function/)).toHaveCount(0)
})

// ── Communications mises en forme et fil d'activité ──
const ilYa = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString()
const PIEGE = `<table width="600"><tr><td align="center"><h1 style="color:#1b1b1f;font-size:28px">V AND B DAY : J-7 FIN DES INSCRIPTIONS !</h1>
<p onclick="window.pirate=1" style="font-size:8px;background:url(https://exemple.test/x.png)"><strong>Description :</strong> Ne tardez plus à confirmer votre présence !</p>
<script>window.pirate=1</script><img src="x" onerror="window.pirate=1"><iframe src="https://exemple.test"></iframe>
<a href="javascript:window.pirate=1">Piège</a> <a href="https://exemple.test/inscription">S’inscrire</a></td></tr></table>`

test('le Directeur publie une communication mise en forme, nettoyée, avec une photo d’en-tête', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, communications: [] })
  await page.goto('./#/communications')
  await page.getByRole('button', { name: 'Publier' }).click()
  const d = page.getByRole('dialog', { name: 'Nouvelle communication' })
  await d.getByLabel('Titre').fill('V and B Day')
  await d.getByLabel('Photo d’en-tête').setInputFiles({ name: 'bandeau.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') })
  await expect(d.getByRole('button', { name: 'Retirer la photo d’en-tête' })).toBeVisible()
  await d.getByRole('group', { name: 'Format du message' }).getByRole('button', { name: 'Code HTML' }).click()
  await d.getByLabel('Code HTML').fill(PIEGE)
  // Retour à la mise en forme : le contenu est déjà nettoyé dans l'éditeur
  await d.getByRole('group', { name: 'Format du message' }).getByRole('button', { name: 'Mise en forme' }).click()
  const editeur = d.getByRole('textbox', { name: 'Message mis en forme' })
  await expect(editeur.getByRole('heading', { name: /V AND B DAY/ })).toBeVisible()
  await expect(editeur.locator('script, iframe, img')).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()

  const corps = ecritures.find((e) => e.table === 'rpc/publier_communication')?.corps as Record<string, unknown>
  expect(String(corps.p_html)).toContain('<h1')
  expect(String(corps.p_html)).not.toMatch(/<script|onclick|onerror|<iframe|javascript:|url\(| 8px/)
  expect(String(corps.p_texte)).toContain('Ne tardez plus à confirmer votre présence')
  expect(corps.p_entete).toBe((corps.p_pieces as { chemin: string }[])[0].chemin)

  const carte = page.getByRole('article', { name: 'V and B Day' })
  await expect(carte.getByRole('heading', { name: /V AND B DAY/ })).toBeVisible()
  await expect(carte.getByRole('img', { name: 'bandeau.jpg' })).toBeVisible()
  // La photo d'en-tête n'est pas répétée dans les pièces jointes
  await expect(carte.getByRole('list', { name: 'Photos jointes' })).toHaveCount(0)
  await expect(carte.getByRole('link', { name: 'S’inscrire' })).toHaveAttribute('href', 'https://exemple.test/inscription')
  await expect(carte.getByRole('link', { name: 'S’inscrire' })).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(carte.getByText('Piège')).not.toHaveAttribute('href')
  expect(await page.evaluate(() => (window as unknown as { pirate?: number }).pirate)).toBeUndefined()
  expect(await textesTropPetits(page)).toEqual([])
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(largeur).toBeLessThanOrEqual(0)
  await page.screenshot({ path: `captures/${info.project.name}-communication-mise-en-forme.png`, fullPage: !isMobile })

  // Modifier : la mise en forme et la photo d'en-tête reviennent
  await carte.getByRole('button', { name: 'Modifier la communication V and B Day' }).click()
  const m = page.getByRole('dialog', { name: 'Modifier la communication' })
  await expect(m.getByRole('textbox', { name: 'Message mis en forme' }).getByRole('heading', { name: /V AND B DAY/ })).toBeVisible()
  await expect(m.getByRole('button', { name: 'Retirer la photo d’en-tête' })).toBeVisible()
})

test('un courriel collé dans la zone mise en forme garde sa mise en forme, sans script', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, communications: [] })
  await page.goto('./#/communications')
  await page.getByRole('button', { name: 'Publier' }).click()
  const d = page.getByRole('dialog', { name: 'Nouvelle communication' })
  await d.getByLabel('Titre').fill('Actualité')
  await d.getByRole('group', { name: 'Format du message' }).getByRole('button', { name: 'Mise en forme' }).click()
  const editeur = d.getByRole('textbox', { name: 'Message mis en forme' })
  await editeur.click()
  await editeur.evaluate((el, html) => {
    const dt = new DataTransfer()
    dt.setData('text/html', html)
    dt.setData('text/plain', 'V AND B DAY')
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, PIEGE)
  await expect(editeur.locator('strong')).toHaveText('Description :')
  await expect(editeur.locator('script, iframe, img, [onclick]')).toHaveCount(0)
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const corps = ecritures.find((e) => e.table === 'rpc/publier_communication')?.corps as Record<string, unknown>
  expect(String(corps.p_html)).toContain('<strong>Description :</strong>')
  expect(String(corps.p_html)).not.toMatch(/<script|onclick|onerror/)
  expect(await page.evaluate(() => (window as unknown as { pirate?: number }).pirate)).toBeUndefined()
})

test('une communication stockée piégée est nettoyée à l’affichage', async ({ page }) => {
  await seConnecter(page, { communications: [{ id: 7, titre: 'Ancienne', texte: 'Ne tardez plus', html: PIEGE, magasins: null, auteur: AUTRE, auteur_nom: 'Joseph PERREAU', auteur_role: 'directeur', cree_le: ilYa(1) }] })
  await page.goto('./#/communications')
  const carte = page.getByRole('article', { name: 'Ancienne' })
  await expect(carte.getByRole('heading', { name: /V AND B DAY/ })).toBeVisible()
  await expect(carte.locator('script, iframe, img, [onclick], [onerror]')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { pirate?: number }).pirate)).toBeUndefined()
})

test('les dernières communications apparaissent dans le fil de l’accueil', async ({ page, isMobile }, info) => {
  const liste: CommunicationSimulee[] = [
    { id: 1, titre: 'V and B Day : J-7', texte: 'Ne tardez plus à confirmer votre présence !', magasins: null, auteur: AUTRE, auteur_nom: 'Joseph PERREAU', auteur_role: 'directeur', cree_le: ilYa(1) },
    { id: 2, titre: 'Réunion des franchisés du Sud', texte: 'Rendez-vous à Marseille.', magasins: ['Nice Test'], auteur: AUTRE, auteur_nom: 'Sam SUD', auteur_role: 'rr', cree_le: ilYa(2) },
    { id: 3, titre: 'Vieille annonce', texte: 'Hors du fil.', magasins: null, auteur: AUTRE, auteur_nom: 'Joseph PERREAU', auteur_role: 'directeur', cree_le: ilYa(200) },
  ]
  await seConnecter(page, { communications: liste })
  const fil = page.getByRole('region', { name: 'Fil de mes magasins' })
  await expect(fil.getByText('V and B Day : J-7')).toBeVisible()
  await expect(fil.getByText('Réunion des franchisés du Sud')).toBeVisible()
  await expect(fil.getByText('Vieille annonce')).toHaveCount(0)
  await fil.getByRole('group', { name: 'Filtrer le fil' }).getByRole('button', { name: 'Communications' }).click()
  await expect(fil.getByRole('link')).toHaveCount(2)
  await expect(fil.getByRole('link').first()).toContainText('Tout le réseau')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fil-communications.png`, fullPage: !isMobile })
  await fil.getByRole('link', { name: /Réunion des franchisés du Sud/ }).click()
  await expect(page).toHaveURL(/#\/communications\?c=2$/)
  await expect(page.getByRole('article', { name: 'Réunion des franchisés du Sud' })).toBeInViewport()
})

test('le franchisé voit dans son fil les communications qui le concernent seulement', async ({ page }) => {
  await seConnecter(page, { acces: PAUL, communications: [
    { id: 1, titre: 'V and B Day : J-7', texte: 'Ne tardez plus.', magasins: null, auteur: AUTRE, auteur_nom: 'Joseph PERREAU', auteur_role: 'directeur', cree_le: ilYa(1) },
    { id: 2, titre: 'Réunion des franchisés du Sud', texte: 'Rendez-vous à Marseille.', magasins: ['Nice Test'], auteur: AUTRE, auteur_nom: 'Sam SUD', auteur_role: 'rr', cree_le: ilYa(2) },
  ] })
  const fil = page.getByRole('region', { name: 'Fil de mes magasins' })
  await expect(fil.getByText('V and B Day : J-7')).toBeVisible()
  await expect(fil.getByText('Réunion des franchisés du Sud')).toHaveCount(0)
  await fil.getByRole('link', { name: /V and B Day/ }).click()
  await expect(page.getByRole('article', { name: 'V and B Day : J-7' })).toBeVisible()
})

test('dans le fil, la photo de la communication s’affiche en grand, on aime et on commente sans quitter l’accueil', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await page.route('https://exemple.test/**', (r) => r.fulfill({ contentType: 'image/png', body: Buffer.from(PNG, 'base64') }))
  const photo = { chemin: `${AUTRE}/2026-10/vandb-day.jpg`, nom: 'vandb-day.jpg', taille: 1000, type: 'image/jpeg' }
  await seConnecter(page, { ecritures, communications: [
    { id: 1, titre: 'V and B Day : J-7', texte: 'Ne tardez plus à confirmer votre présence !', pieces: [photo], entete: photo.chemin, magasins: null, auteur: AUTRE, auteur_nom: 'Joseph PERREAU', auteur_role: 'directeur', cree_le: ilYa(1),
      pouces: [{ user_id: AUTRE, nom: 'Noé MODELE' }], commentaires: [{ id: 1, auteur: AUTRE, auteur_nom: 'Noé MODELE', auteur_role: 'coach', texte: 'Inscrit !', cree_le: ilYa(1) }] },
    { id: 2, titre: 'Carte d’hiver', texte: '', html: '<p>La carte arrive.</p><img src="https://exemple.test/carte.png" alt="Carte">', magasins: null, auteur: AUTRE, auteur_nom: 'Joseph PERREAU', auteur_role: 'directeur', cree_le: ilYa(2) },
  ] })
  const fil = page.getByRole('region', { name: 'Fil de mes magasins' })
  const carte = fil.getByRole('article', { name: 'V and B Day : J-7' })
  const image = carte.getByRole('img', { name: 'V and B Day : J-7' })
  await expect(image).toBeVisible()
  // Pleine largeur de la carte
  const [li, lc] = await Promise.all([image.boundingBox(), carte.boundingBox()])
  expect(Math.round(li!.width)).toBe(Math.round(lc!.width))
  // Sans photo jointe : la première image de la communication mise en forme
  await expect(fil.getByRole('article', { name: 'Carte d’hiver' }).getByRole('img')).toHaveAttribute('src', 'https://exemple.test/carte.png')
  await expect(carte.getByText('Inscrit !')).toBeVisible()
  const pouce = carte.getByRole('button', { name: /^J’aime/ })
  await pouce.click()
  await expect(pouce).toHaveText('J’aime · 2')
  expect(ecritures.find((e) => e.table === 'rpc/basculer_pouce_communication')?.corps).toEqual({ p_id: 1 })
  await carte.getByRole('button', { name: /^Commenter/ }).click()
  await carte.getByRole('textbox', { name: 'Commentaire sur V and B Day : J-7' }).fill('On y sera.')
  await carte.getByRole('button', { name: 'Envoyer le commentaire' }).click()
  await expect(carte.getByText('On y sera.')).toBeVisible()
  await expect(page).not.toHaveURL(/communications/)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fil-communication-photo.png`, fullPage: !isMobile })
})

test('le franchisé aime et commente une communication depuis son fil', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { acces: PAUL, ecritures, communications: [
    { id: 1, titre: 'V and B Day : J-7', texte: 'Ne tardez plus.', magasins: null, auteur: AUTRE, auteur_nom: 'Joseph PERREAU', auteur_role: 'directeur', cree_le: ilYa(1) },
  ] })
  const carte = page.getByRole('region', { name: 'Fil de mes magasins' }).getByRole('article', { name: 'V and B Day : J-7' })
  await carte.getByRole('button', { name: /^J’aime/ }).click()
  await expect(carte.getByRole('button', { name: /^J’aime/ })).toHaveAttribute('aria-pressed', 'true')
  await carte.getByRole('button', { name: /^Commenter/ }).click()
  await carte.getByRole('textbox', { name: 'Commentaire sur V and B Day : J-7' }).fill('Merci !')
  await carte.getByRole('button', { name: 'Envoyer le commentaire' }).click()
  await expect(carte.getByText('Merci !')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'rpc/commenter_communication')?.corps).toEqual({ p_id: 1, p_texte: 'Merci !' })
})
