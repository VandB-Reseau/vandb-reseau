import { expect, test } from '@playwright/test'
import { PNG, seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'
import { effetDeploiement, type Thematique } from '../src/data/sante'
import type { Reseau } from '../src/data/modele'

// Sprint 25 (Joseph, 24/10/2026) : agenda ouvert sur aujourd'hui (S1), agenda dans Google Agenda (F2), ouvertures par
// étapes (F3), effet d'un déploiement sur le chiffre (F4), partage d'une photo vers l'app (F5)

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const decale = (j: number) => { const d = new Date(); d.setDate(d.getDate() + j); return d.toLocaleDateString('sv-SE') }

test('S1 : l’agenda s’ouvre sur aujourd’hui, le début du mois replié, sans phrase d’explication', async ({ page, isMobile }, info) => {
  const jour = new Date().toISOString().slice(0, 10)
  const debutMois = `${jour.slice(0, 8)}01`
  test.skip(jour === debutMois, 'Le 1er du mois, rien n’est passé dans le mois')
  await seConnecter(page, { reunions: { presences: [], evenements: [
    { id: 1, title: 'Séminaire des Coachs', type: 'event', start_date: decale(1), end_date: decale(2) },
    { id: 2, title: 'Réunion de rentrée', type: 'event', start_date: debutMois, end_date: debutMois },
  ] } })
  await page.goto('./#/plus/agenda')
  await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible()
  await expect(page.getByText('Visites, campagnes, formations et événements')).toHaveCount(0)
  if (!isMobile) return
  await expect(page.getByRole('heading', { name: /^Aujourd’hui · / })).toBeVisible()
  await expect(page.getByText('Séminaire des Coachs')).toBeVisible()
  await expect(page.getByText('Réunion de rentrée')).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-agenda-aujourdhui.png` })
  await page.getByRole('button', { name: /^Plus tôt ce mois · \d+$/ }).click()
  await expect(page.getByText('Réunion de rentrée')).toBeVisible()
})

test('F2 : lien personnel vers Google Agenda depuis le menu du compte', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Inès EXEMPLE' }, ecritures })
  await page.getByRole('button', { name: 'Mon compte' }).click()
  await page.getByRole('menuitem', { name: 'Mon agenda dans Google Agenda' }).click()
  const d = page.getByRole('dialog', { name: 'Mon agenda dans Google Agenda' })
  const google = d.getByRole('link', { name: 'Ouvrir Google Agenda' })
  await expect(google).toHaveAttribute('href', `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(`webcal://supabase.test/functions/v1/agenda?jeton=${'a'.repeat(64)}`)}`)
  expect(ecritures.find((e) => e.table === 'rpc/mon_agenda')?.corps).toEqual({ p_nom: 'Inès EXEMPLE', p_nouveau: false })
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-agenda-google.png` })
  await d.getByRole('button', { name: 'Changer le lien' }).click()
  await expect(page.getByText('Nouveau lien créé : l’ancien ne marche plus.')).toBeVisible()
  expect(ecritures.filter((e) => e.table === 'rpc/mon_agenda').at(-1)?.corps).toEqual({ p_nom: 'Inès EXEMPLE', p_nouveau: true })
})

test('F2 : pas de lien d’agenda pour un franchisé', async ({ page }) => {
  await seConnecter(page, { acces: { role: 'franchise', franchise: 'Franchisé 2', magasins: ['Nantes Test'] } })
  await page.getByRole('button', { name: 'Mon compte' }).click()
  await expect(page.getByRole('menuitem', { name: 'Se déconnecter' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Mon agenda dans Google Agenda' })).toHaveCount(0)
})

const ouvertures = { 'Rodez Test': { etapes: { contrat: { prevu: '2026-03-01', fait: '2026-03-02' }, local: { prevu: '2026-04-01', fait: '2026-04-10' }, travaux: { prevu: decale(-9), fait: '' } }, par: 'Dominique DIRECTION', maj: '2026-10-01' } }

test('F3 : les ouvertures à venir montrent leurs étapes et l’étape en retard', async ({ page }, info) => {
  await seConnecter(page, { config: { ouvertures_magasins: ouvertures } })
  await page.goto('./#/parametres/evolution')
  const liste = page.getByRole('region', { name: 'À venir sur 12 mois' })
  const rodez = liste.getByRole('link', { name: /Rodez Test/ })
  await expect(rodez).toContainText('Travaux en retard')
  await expect(rodez.getByRole('img', { name: '2 étapes sur 7' })).toBeVisible()
  await expect(liste.getByRole('link', { name: /Dax Test/ })).toContainText('0 étape sur 7 · prochaine : contrat')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-ouvertures-etapes.png` })
})

test('F3 : le Directeur saisit les étapes depuis la fiche du magasin', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { config: { ouvertures_magasins: ouvertures }, ecritures })
  await page.goto('./#/magasins/Rodez%20Test')
  const carte = page.getByRole('list', { name: 'Étapes de l’ouverture' })
  await expect(carte.getByRole('listitem').filter({ hasText: 'Contrat' })).toContainText('Fait le 2 mars 2026')
  await expect(carte.getByRole('listitem').filter({ hasText: 'Travaux' })).toContainText('En retard')
  await page.getByRole('button', { name: 'Modifier' }).first().click()
  const d = page.getByRole('dialog', { name: 'Ouverture de Rodez Test' })
  await d.getByRole('group', { name: 'Travaux' }).getByLabel('Fait le').fill(decale(-1))
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const ecrit = ecritures.filter((e) => (e.corps as { key?: string }).key === 'ouvertures_magasins').at(-1)
  const valeur = JSON.parse((ecrit!.corps as { value: string }).value)
  expect(valeur['Rodez Test'].etapes.travaux).toEqual({ prevu: decale(-9), fait: decale(-1) })
  await page.screenshot({ path: `captures/${info.project.name}-fiche-ouverture.png`, fullPage: true })
})

test('F3 : un Coach voit les étapes sans les modifier ; un magasin ouvert n’a pas de carte Ouverture', async ({ page }) => {
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Noé MODELE' }, config: { ouvertures_magasins: ouvertures } })
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByRole('heading', { name: 'Équipe' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Étapes de l’ouverture' })).toHaveCount(0)
})

test('F4 : l’effet d’une thématique s’ouvre depuis Déploiements', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/plus/sante?vue=deploiements')
  await page.getByRole('button', { name: 'Effet de Concept 2.0 sur le chiffre' }).click()
  const d = page.getByRole('dialog', { name: 'Effet de Concept 2.0' })
  await expect(d).toContainText('Pas encore assez de magasins pour conclure')
  await expect(d).toContainText('1 déployé et 0 non déployé comparables')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-effet-deploiement.png` })
})

test('F4 : un Coach ne voit pas l’effet', async ({ page }) => {
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Noé MODELE' } })
  await page.goto('./#/plus/sante?vue=deploiements')
  await expect(page.getByRole('region', { name: 'Avancement des déploiements' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Effet de / })).toHaveCount(0)
})

test('F4 : calcul de l’écart, mêmes mois pour les deux groupes', ({ isMobile }) => {
  test.skip(isMobile, 'Calcul seul')
  const t: Thematique = { id: 'terrasse', libelle: 'Terrasse', options: [{ libelle: 'Oui', ton: 'positif' }, { libelle: 'Non', ton: 'negatif' }] }
  const noms = Array.from({ length: 24 }, (_x, i) => `M${i}`)
  const deployes = noms.slice(0, 12)
  const chiffres: Record<string, { mois: string; caCave: number; caBar: null; caExt: null }[]> = {}
  for (const n of noms) {
    const hausse = deployes.includes(n) ? 1.1 : 1.02
    chiffres[n] = ['2025-04', '2025-05', '2025-06', '2026-04', '2026-05', '2026-06'].map((mois) => ({ mois, caCave: mois.startsWith('2026') ? 100 * hausse : 100, caBar: null, caExt: null }))
  }
  const reseau = {
    jour: '2026-10-24',
    magasins: noms.map((nom) => ({ nom, statut: 'ouvert' })),
    chiffres,
    deploiements: {
      thematiques: [t],
      valeurs: Object.fromEntries(noms.map((n) => [n, { terrasse: deployes.includes(n) ? 'Oui' : 'Non' }])),
      journal: Object.fromEntries(deployes.map((n) => [n, [{ date: '2026-03-15', thematique: 'terrasse', etat: 'Oui' }]])),
    },
  } as unknown as Reseau
  const e = effetDeploiement(reseau, t)
  expect(e.assez).toBe(true)
  expect(e.deployes).toBe(12)
  expect(e.temoins).toBe(12)
  expect(e.evolDeployes).toBeCloseTo(10)
  expect(e.evolTemoins).toBeCloseTo(2)
  expect(e.ecart).toBeCloseTo(8)
  // Moins de 10 magasins d'un côté : pas d'écart affiché
  const peu = effetDeploiement({ ...reseau, magasins: reseau.magasins.slice(0, 15) } as Reseau, t)
  expect(peu.assez).toBe(false)
  expect(peu.ecart).toBeNull()
})

test('F5 : une photo partagée devient une tâche du magasin choisi', async ({ page }, info) => {
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Inès EXEMPLE' } })
  // Ce que le service de l'app range quand la galerie partage une photo
  await page.evaluate(async (png) => {
    const base = new URL('partage/', location.href.split('#')[0]).href
    const cache = await caches.open('partage')
    const octets = Uint8Array.from(atob(png), (c) => c.charCodeAt(0))
    await cache.put(`${base}photo-0`, new Response(new Blob([octets], { type: 'image/png' }), { headers: { 'Content-Type': 'image/png', 'X-Nom': 'vitrine.png' } }))
    await cache.put(`${base}texte`, new Response(''))
  }, PNG)
  await page.goto('./#/partage')
  await expect(page.getByRole('list', { name: 'Photos partagées' }).getByRole('img')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Que faire de cette photo ?' })).toBeVisible()
  await page.getByRole('group', { name: 'Ranger en' }).getByRole('button', { name: 'Tâche' }).click()
  await page.getByLabel('Magasin').fill('Nantes')
  await page.getByRole('option', { name: 'Nantes Test' }).click()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-partage-photo.png` })
  await page.getByRole('button', { name: 'Continuer' }).click()
  const d = page.getByRole('dialog', { name: /tâche/i })
  await expect(d.getByRole('list', { name: 'Pièces jointes' })).toContainText('vitrine.jpg')
})

test('F5 : rien de partagé, l’écran le dit', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/partage')
  await expect(page.getByText('Rien à partager')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Accueil' }).last()).toBeVisible()
})
