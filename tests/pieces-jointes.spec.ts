import { expect, test } from '@playwright/test'
import { MOI, PNG, seConnecter, textesTropPetits, type Ecriture, type MessageSimule } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const photo = { name: 'vitrine.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') }
const devis = { name: 'devis.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fictif') }
const envois = (ecritures: Ecriture[]) => ecritures.filter((e) => e.table === 'storage' && e.methode === 'POST' && !e.filtre.startsWith('sign/'))
type Piece = { chemin: string; nom: string; taille: number; type: string }
const AUTRE = '00000000-0000-0000-0000-0000000000aa'

test('le Directeur joint une photo et un document à une tâche', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, persister: true })
  await page.goto('./#/echanges?vue=taches')
  await page.getByRole('button', { name: 'Ajouter une tâche' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une tâche' })
  await d.getByLabel('Magasin').click()
  await page.getByRole('option', { name: 'Lyon Test' }).click()
  await d.getByLabel('Tâche', { exact: true }).fill('Refaire la vitrine de Noël')
  await d.getByLabel('Fichiers à joindre').setInputFiles([photo, devis, { name: 'brouillon.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') }])
  const jointes = d.getByRole('list', { name: 'Pièces jointes' })
  await expect(jointes.getByRole('listitem')).toHaveCount(3)
  // Rangées sous l'identifiant de l'auteur ; la photo part en JPEG
  expect(envois(ecritures).map((e) => e.filtre)).toEqual([
    expect.stringMatching(new RegExp(`^pieces/${MOI}/\\d{4}-\\d{2}/.+\\.jpg$`)),
    expect.stringMatching(new RegExp(`^pieces/${MOI}/.+\\.pdf$`)),
    expect.stringMatching(new RegExp(`^pieces/${MOI}/.+\\.pdf$`)),
  ])
  expect(await textesTropPetits(page)).toEqual([])
  if (info.project.name === 'telephone') expect((await d.getByRole('button', { name: 'Joindre une photo ou un fichier' }).boundingBox())!.height).toBeGreaterThanOrEqual(48)
  // Un fichier retiré avant l'enregistrement est aussi effacé
  await jointes.getByLabel('Retirer brouillon.pdf').click()
  await expect(jointes.getByRole('listitem')).toHaveCount(2)
  await expect.poll(() => ecritures.some((e) => e.table === 'storage' && e.methode === 'DELETE')).toBe(true)
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Tâche ajoutée.')).toBeVisible()

  const ecrit = ecritures.filter((e) => e.table === 'app_config' && JSON.stringify(e.corps).includes('Refaire la vitrine')).at(-1)!
  const tache = (JSON.parse((ecrit.corps as { value: string }).value) as Record<string, { action: string; pieces?: Piece[] }[]>)['Lyon Test'][0]
  expect(tache.pieces!.map((p) => [p.nom, p.type])).toEqual([['vitrine.jpg', 'image/jpeg'], ['devis.pdf', 'application/pdf']])
  // Dans la liste : la vignette de la photo et le lien du document
  const ligne = page.getByRole('list', { name: 'Tâches à faire' }).getByRole('listitem').filter({ hasText: 'Refaire la vitrine de Noël' })
  await expect(ligne.getByRole('img', { name: 'vitrine.jpg' })).toBeVisible()
  await expect(ligne.getByRole('link', { name: /devis\.pdf/ })).toHaveAttribute('href', /token=jeton/)
  await page.screenshot({ path: `captures/${info.project.name}-tache-pieces.png`, fullPage: true })
})

test('le franchisé joint une photo à une tâche, la base la range', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] }, espace: {}, ecritures })
  await page.goto('./#/echanges?vue=taches')
  await page.getByRole('button', { name: 'Ajouter une tâche' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une tâche' })
  await d.getByLabel('Tâche', { exact: true }).fill('Changer l’ampoule du comptoir')
  await d.getByLabel('Fichiers à joindre').setInputFiles(photo)
  await expect(d.getByRole('list', { name: 'Pièces jointes' }).getByRole('listitem')).toHaveCount(1)
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Tâche ajoutée.')).toBeVisible()
  const corps = ecritures.filter((e) => e.table === 'rpc/ajouter_action_franchise').at(-1)!.corps as { p_pieces: Piece[] }
  expect(corps.p_pieces).toEqual([{ chemin: expect.stringMatching(new RegExp(`^${MOI}/`)), nom: 'vitrine.jpg', taille: expect.any(Number), type: 'image/jpeg' }])
  await expect(page.getByRole('list', { name: 'Tâches à faire' }).getByRole('img', { name: 'vitrine.jpg' })).toBeVisible()
  // Le franchisé n'écrit dans aucune table : la base et l'espace fichiers seulement
  expect(ecritures.filter((e) => !e.table.startsWith('rpc/') && e.table !== 'storage')).toEqual([])
})

test('message avec une photo seule, document reçu ouvert par lien', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  const recu: MessageSimule = { id: 1, store: null, auteur: AUTRE, auteur_nom: 'Paul MULTI', auteur_role: 'franchise', auteur_cle: 'franchise:Paul MULTI', destinataire: 'coach:Hugo FICTIF',
    texte: '', mentions: ['coach:Hugo FICTIF'], cree_le: new Date(Date.now() - 600_000).toISOString(), magasins: [],
    pieces: [{ chemin: `${AUTRE}/2026-10/x.pdf`, nom: 'facture.pdf', taille: 48_000, type: 'application/pdf' }] }
  await seConnecter(page, { acces: { role: 'coach', coach: 'Hugo FICTIF' }, ecritures, messagerie: { messages: [recu] } })
  await page.goto('./#/echanges')
  const liste = page.getByRole('list', { name: 'Conversations' })
  // Sans texte, l'aperçu dit ce qui a été joint
  await expect(liste.getByRole('button', { name: /^Paul MULTI/ })).toContainText('Fichier joint')
  await liste.getByRole('button', { name: /^Paul MULTI/ }).click()
  const fil = page.getByRole('list', { name: 'Messages de Paul MULTI' })
  await expect(fil.getByRole('link', { name: /facture\.pdf/ })).toHaveAttribute('href', /token=jeton/)

  await page.getByLabel('Fichiers à joindre').setInputFiles(photo)
  await expect(page.getByRole('list', { name: 'Pièces jointes' }).getByRole('listitem')).toHaveCount(1)
  await page.getByRole('button', { name: 'Envoyer' }).click()
  await expect(page.getByRole('list', { name: 'Pièces jointes' })).toHaveCount(0)
  const corps = ecritures.find((e) => e.table === 'rpc/envoyer_a')!.corps as { p_texte: string; p_pieces: Piece[] }
  expect(corps.p_texte).toBe('')
  expect(corps.p_pieces.map((p) => p.nom)).toEqual(['vitrine.jpg'])
  await expect(fil.getByRole('listitem', { name: 'Message de Hugo FICTIF' }).getByRole('img', { name: 'vitrine.jpg' })).toBeVisible()
  if (info.project.name === 'telephone') expect((await page.getByRole('button', { name: 'Joindre une photo ou un fichier' }).boundingBox())!.height).toBeGreaterThanOrEqual(48)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-message-pieces.png` })
})

test('espace fichiers pas encore activé : un message clair, rien ne casse', async ({ page }) => {
  await seConnecter(page, { sansPhotos: true })
  await page.goto('./#/echanges?vue=taches')
  await page.getByRole('button', { name: 'Ajouter une tâche' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une tâche' })
  await d.getByLabel('Fichiers à joindre').setInputFiles(devis)
  await expect(d.getByText('Les pièces jointes ne sont pas encore activées : le script SQL des pièces jointes doit être lancé dans Supabase.')).toBeVisible()
  await expect(d.getByRole('list', { name: 'Pièces jointes' })).toHaveCount(0)
})

test('un fichier qui n’est ni une photo ni un document est refusé', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/echanges?vue=taches')
  await page.getByRole('button', { name: 'Ajouter une tâche' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une tâche' })
  await d.getByLabel('Fichiers à joindre').setInputFiles({ name: 'outil.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ') })
  await expect(d.getByText('« outil.exe » n’est ni une photo, ni un PDF, ni un document bureautique.')).toBeVisible()
})
