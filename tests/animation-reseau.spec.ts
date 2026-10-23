import { expect, test, type Page } from '@playwright/test'
import { MOI, seConnecter, textesTropPetits, type CommunicationSimulee, type Ecriture, type QuestionsSimulees, type ReunionsSimulees } from './supabase-simule'

// Animation du réseau (Joseph, 23/10/2026) : un onglet pour créer et suivre communications, bonnes pratiques, sondages,
// formations, réunions et campagnes ; un type « Formation » dans l'agenda avec un contenu mis en forme ;
// chaque nouveau contenu part en notification vers les personnes concernées (fonction « notifier » simulée).
test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const jour = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const communications = (): CommunicationSimulee[] => [
  { id: 1, titre: 'Nouvelle gamme de Noël', texte: 'Arrivée en magasin.', magasins: null, auteur: MOI, auteur_nom: 'Dominique DIRECTION', auteur_role: 'directeur', cree_le: `${jour(-3)}T09:00:00Z`,
    pouces: [{ user_id: 'u2', nom: 'Paul MULTI' }], lus: ['Paul MULTI', 'Franchisé 2', 'Franchisé 4'], non_lus: ['Franchisé 6'] },
]
const pratiques = [
  { id: 'bp_1', magasin: 'Annecy Test', date: jour(-5), titre: 'Dégustation du samedi', theme: 'Animation et événements', texte: 'Trois vins ouverts.', par: 'Hugo FICTIF', photos: [], reprises: [] },
]
const questions = (): QuestionsSimulees => ({
  resultats: [{ id: 7, titre: 'Besoin de formation ?', genre: 'oui_non', choix: [], cible: 'franchises', anonyme: false, magasins: null, jusqu_au: jour(5), auteur: MOI, auteur_nom: 'Dominique DIRECTION', cree_le: `${jour(-1)}T09:00:00Z`,
    reponses: [{ valeurs: ['oui'], role: 'franchise', franchise: 'Paul MULTI', regions: ['rr1'] }], sans_reponse: ['Franchisé 2', 'Franchisé 4', 'Franchisé 6'], concernes: 4 }],
  franchise: [], equipe: [],
})
const reunions = (): ReunionsSimulees => ({
  evenements: [
    { id: 5, title: 'Formation accords mets et vins', type: 'formation', start_date: jour(4), end_date: jour(4), heure: '14:30', color: '#2e7d32', notes: 'Siège',
      html: '<h2>Programme</h2><p>Trois accords à tester.</p><script>alert(1)</script>', invites: ['Lyon Test', 'Annecy Test'] },
    { id: 6, title: 'Séminaire des Coachs', start_date: jour(10), end_date: jour(10) },
  ],
  presences: [{ event: 5, magasin: 'Annecy Test', reponse: 'present', present: null }],
})
const campagnes = {
  liste: [{ id: 'c1', nom: 'Noël 2026', debut: jour(-10), fin: jour(30), points: [{ id: 'p1', libelle: 'Vitrine posée' }], perimetre: 'franchises', magasins: [] }],
  constats: { c1: { 'Annecy Test': { p1: { fait: true, date: jour(-2), par: 'Noé MODELE' } } } },
}
const tout = () => ({ communications: communications(), questions: questions(), reunions: reunions(), config: { bonnes_pratiques: pratiques, campagnes },
  lecturesPratiques: { bp_1: { lus: ['Paul MULTI'], non_lus: ['Franchisé 2', 'Franchisé 4', 'Franchisé 6'] } } })

async function fonctionSimulee(page: Page) {
  const appels: Record<string, unknown>[] = []
  await page.route('https://supabase.test/functions/v1/notifier', (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, body: 'ok' })
    appels.push(r.request().postDataJSON())
    return r.fulfill({ json: { envoyees: 1 } })
  })
  return appels
}

async function ouvrirAnimation(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('button', { name: 'Mon compte' }).click()
    await page.getByRole('menuitem', { name: 'Animation réseau' }).click()
  } else {
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Animation réseau' }).click()
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Animation réseau' })).toBeVisible()
}

test('le Directeur suit lectures, réponses, présences et exécution au même endroit', async ({ page, isMobile }, info) => {
  await seConnecter(page, tout())
  await ouvrirAnimation(page, isMobile)
  const contenus = page.getByRole('region', { name: 'Contenus' })
  await expect(contenus.getByRole('button', { name: 'Communication Nouvelle gamme de Noël : 3 lues sur 4' })).toBeVisible()
  await expect(contenus.getByRole('button', { name: 'Bonne pratique Dégustation du samedi : 1 vue sur 4' })).toBeVisible()
  await expect(contenus.getByRole('button', { name: 'Sondage Besoin de formation ? : 1 réponse sur 4' })).toBeVisible()
  await expect(contenus.getByRole('button', { name: 'Formation Formation accords mets et vins : 1 réponse sur 2' })).toBeVisible()
  await expect(contenus.getByRole('button', { name: /^Campagne Noël 2026 : 1 exécutée sur \d+$/ })).toBeVisible()
  // Un événement sans invités n'est ni une réunion ni une formation
  await expect(contenus).not.toContainText('Séminaire des Coachs')
  await expect(page.getByRole('region', { name: 'Repères' }).getByRole('button', { name: 'Communications lues : 75 %, 90 derniers jours' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-animation-reseau.png`, fullPage: !isMobile })

  // Filtre par type, puis le détail : qui n'a pas lu, qui a répondu
  await page.getByRole('group', { name: 'Type de contenu' }).getByRole('button', { name: 'Communications (1)' }).click()
  await expect(contenus.getByRole('button')).toHaveCount(1)
  await contenus.getByRole('button', { name: /^Communication Nouvelle gamme/ }).click()
  const d = page.getByRole('dialog', { name: 'Nouvelle gamme de Noël' })
  await expect(d).toContainText('Lue par 3 franchisés sur 4')
  await expect(d).toContainText('Pas encore lue (1)')
  await expect(d).toContainText('Franchisé 6')
  await d.getByRole('button', { name: 'Fermer' }).click()

  await page.getByRole('group', { name: 'Type de contenu' }).getByRole('button', { name: 'Formations (1)' }).click()
  await contenus.getByRole('button', { name: /^Formation Formation accords/ }).click()
  const f = page.getByRole('dialog', { name: 'Formation accords mets et vins' })
  await expect(f).toContainText('à 14 h 30')
  await expect(f.getByRole('region', { name: 'Présences' })).toContainText('1 réponse sur 2')
  await f.getByRole('button', { name: 'Voir le contenu' }).click()
  const c = page.getByRole('dialog', { name: 'Formation accords mets et vins' }).last()
  await expect(c.getByRole('heading', { name: 'Programme' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-animation-formation.png` })
})

test('le Directeur crée une formation avec un contenu en HTML : les invités sont prévenus', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ...tout(), ecritures })
  const appels = await fonctionSimulee(page)
  await page.goto('./#/animation')
  await expect(page.getByRole('heading', { level: 1, name: 'Animation réseau' })).toBeVisible()
  await page.getByRole('button', { name: 'Créer' }).last().click()
  await page.getByRole('menu', { name: 'Créer un contenu' }).getByRole('menuitem', { name: 'Formation' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une formation' })
  await expect(d.getByRole('group', { name: 'Type' }).getByRole('button', { name: 'Formation' })).toHaveAttribute('aria-pressed', 'true')
  await d.getByLabel('Titre').fill('Vente additionnelle au bar')
  await d.getByLabel('Du').fill(jour(6))
  await d.getByLabel('Au').fill(jour(6))
  await d.getByLabel('Heure (facultatif)').fill('09:30')
  await d.getByRole('group', { name: 'Contenu de la formation' }).getByRole('button', { name: 'Code HTML' }).click()
  await d.getByRole('textbox', { name: /HTML/ }).fill('<h2>Objectif</h2><p>Proposer un accord à chaque verre.</p><img src=x onerror="alert(1)">')
  await d.getByRole('group', { name: 'Magasins invités' }).getByRole('button', { name: 'Région Alex NORD' }).click()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-formation-nouvelle.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const corps = ecritures.filter((e) => e.table === 'events' && e.methode === 'POST').at(-1)!.corps as Record<string, unknown>
  expect(corps).toMatchObject({ title: 'Vente additionnelle au bar', type: 'formation', heure: '09:30', start_date: jour(6) })
  // Le contenu est nettoyé avant d'être enregistré
  expect(String(corps.html)).toContain('<h2>Objectif</h2>')
  expect(String(corps.html)).not.toContain('onerror')
  expect((corps.invites as string[]).length).toBeGreaterThan(0)
  await expect.poll(() => appels).toEqual([{ type: 'contenu', genre: 'evenement', id: '901' }])
})

test('l’agenda range les formations à part et en ajoute une depuis un jour', async ({ page, isMobile }) => {
  await seConnecter(page, { reunions: reunions() })
  await page.goto(`./#/plus/agenda?mois=${jour(4).slice(0, 7)}`)
  await expect(page.getByRole('group', { name: 'Catégories affichées' }).getByRole('button', { name: 'Formations' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Formation accords mets et vins' }).first()).toBeVisible()
  await page.getByRole('group', { name: 'Catégories affichées' }).getByRole('button', { name: 'Formations' }).click()
  await expect(page.getByRole('button', { name: 'Formation accords mets et vins' })).toHaveCount(0)
  await page.getByRole('button', { name: /^Ajouter le / }).first().click()
  await page.getByRole('menuitem', { name: 'Formation' }).click()
  await expect(page.getByRole('dialog', { name: 'Ajouter une formation' })).toBeVisible()
  if (!isMobile) await expect(page.getByRole('dialog').getByLabel('Heure (facultatif)')).toBeVisible()
})

test('un nouveau sondage, une nouvelle communication, bonne pratique ou campagne partent en notification', async ({ page }) => {
  await seConnecter(page, { ...tout(), communications: [] })
  const appels = await fonctionSimulee(page)
  await page.goto('./#/animation')
  await expect(page.getByRole('heading', { level: 1, name: 'Animation réseau' })).toBeVisible()
  const creer = async (nom: string) => {
    await page.getByRole('button', { name: 'Créer' }).last().click()
    await page.getByRole('menu', { name: 'Créer un contenu' }).getByRole('menuitem', { name: nom }).click()
  }
  await creer('Sondage')
  const s = page.getByRole('dialog', { name: 'Nouveau sondage' })
  await s.getByLabel('Question', { exact: true }).fill('Avez-vous reçu la PLV ?')
  await s.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(s).toBeHidden()
  await expect.poll(() => appels).toEqual([{ type: 'contenu', genre: 'sondage', id: '8' }])

  await creer('Bonne pratique')
  const p = page.getByRole('dialog', { name: 'Nouvelle bonne pratique' })
  await p.getByRole('combobox', { name: 'Magasin' }).fill('Lyon')
  await page.getByRole('option', { name: 'Lyon Test' }).click()
  await p.getByLabel('Titre').fill('Vitrine de Noël')
  await p.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(p).toBeHidden()
  await expect.poll(() => appels.map((a) => a.genre)).toEqual(['sondage', 'pratique'])
  expect(appels[1]).toEqual({ type: 'contenu', genre: 'pratique', id: expect.stringMatching(/^bp/) })

  await creer('Campagne')
  const k = page.getByRole('dialog', { name: 'Nouvelle campagne' })
  await k.getByLabel('Nom de la campagne').fill('Beaujolais')
  await k.getByLabel('Fin').fill(jour(20))
  await k.getByLabel('Point 1', { exact: true }).fill('Offre affichée')
  await k.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(k).toBeHidden()
  await expect.poll(() => appels.map((a) => a.genre)).toEqual(['sondage', 'pratique', 'campagne'])
  expect((appels[2].magasins as string[]).length).toBeGreaterThan(1)

  // Communication : l'onglet ouvre Infos réseau avec la fenêtre de publication
  await creer('Communication')
  const c = page.getByRole('dialog', { name: 'Nouvelle communication' })
  await c.getByLabel('Titre').fill('Arrivage de Noël')
  await c.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(c).toBeHidden()
  await expect.poll(() => appels.map((a) => a.genre ?? a.type)).toEqual(['sondage', 'pratique', 'campagne', 'communication'])
})

test('le franchisé voit l’heure de la formation et en ouvre le contenu, sans script', async ({ page, isMobile }, info) => {
  await seConnecter(page, { reunions: reunions(), acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] } })
  const section = page.getByRole('region', { name: 'Réunions et formations' })
  await expect(section).toContainText('Formation · ')
  await expect(section).toContainText('à 14 h 30')
  await section.getByRole('button', { name: 'Voir le contenu' }).click()
  const d = page.getByRole('dialog', { name: 'Formation accords mets et vins' })
  await expect(d.getByRole('heading', { name: 'Programme' })).toBeVisible()
  await expect(d.locator('script')).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-franchise-formation.png`, fullPage: !isMobile })
})

test('le Responsable Régional a l’onglet', async ({ page, isMobile }) => {
  await seConnecter(page, { ...tout(), appMetadata: { role: 'rr', rr: 'rr1' } })
  await ouvrirAnimation(page, isMobile)
  await expect(page.getByRole('region', { name: 'Contenus' })).toBeVisible()
})

test('le Coach n’a pas l’onglet', async ({ page, isMobile }) => {
  await seConnecter(page, { ...tout(), appMetadata: { role: 'coach', coach: 'Noé MODELE' } })
  if (isMobile) await page.getByRole('button', { name: 'Mon compte' }).click()
  await expect(page.getByRole(isMobile ? 'menuitem' : 'button', { name: 'Animation réseau' })).toHaveCount(0)
  if (isMobile) await page.keyboard.press('Escape')
  await page.goto('./#/animation')
  await expect(page.getByRole('heading', { level: 1, name: /^Accueil$|Bonjour|Bonsoir/ })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Animation réseau' })).toHaveCount(0)
})
