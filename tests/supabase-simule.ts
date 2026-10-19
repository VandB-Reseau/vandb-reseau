import type { Page } from '@playwright/test'
import { assembler, eclater, estSuivie, rubriques, type CleSuivie } from '../src/data/suivi'
import { affectationsFictives, coachsFictifs, congesFictifs, evenementsFictifs, recruesFictives, visitesFictives, configRRFictive, magasinsFictifs, santeFictive, deploiementsFictifs, fichesFictives, notesMagasinsFictives, chiffresFictifs, auditsFictifs } from './donnees-fictives'

export const COMPTE = { email: 'joseph@vandb.test', motDePasse: 'bon-mot-de-passe' }

// Simule l'API d'authentification Supabase : seul COMPTE est accepté.
export interface Ecriture { methode: string; table: string; corps: unknown; filtre: string }

// Accès lu dans la base (fonction mon_acces) ; null : fonctions pas encore créées (script non passé)
export interface AccesSimule { role: string; franchise?: string; magasins?: string[]; coach?: string; rr?: string }
export interface AccesFranchiseSimule { user_id: string; email: string; franchise: string; magasins: string[]; ouvert_le?: string; derniere_connexion?: string | null }
export interface EspaceSimule { visites?: Record<string, unknown>[]; reperes?: unknown; campagnes?: unknown; pratiques?: unknown[] }
// Périmètre envoyé par l'app du Directeur (fonction maj_perimetre_equipe)
export interface PerimetreRecu { magasin: string; coach: string; rrs: string[] }
export interface OptionsSimulation { perimetreRecu?: PerimetreRecu[]; suiviEnConfig?: boolean; acces?: AccesSimule | null; accesFranchises?: AccesFranchiseSimule[]; espace?: EspaceSimule; appMetadata?: Record<string, unknown>; panne?: boolean; ecritures?: Ecriture[]; persister?: boolean; config?: Record<string, unknown>; sansPhotos?: boolean }
// Image PNG de 40 × 40 px, rouge
export const PNG = 'iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAIAAAADnC86AAAAL0lEQVR4nO3NMQ0AAAgDsMmZfxXIwgQJT5P+zbQvIhaLxWKxWCwWi8VisVgsFt9ZvKLWW/PEN6QAAAAASUVORK5CYII='

export async function simulerSupabase(page: Page, options: OptionsSimulation = {}) {
  // « config » remplace des clés d'app_config ; avec « persister », les clés réécrites sont relues telles qu'enregistrées
  const configEcrite = new Map<string, string>(Object.entries(options.config ?? {}).map(([k, v]) => [k, JSON.stringify(v)]))
  // Suivi rangé par magasin (table suivi_magasins) : données fictives et clés fournies par le test, éclatées par magasin.
  // suiviEnConfig : script de cloisonnement pas encore passé, tout reste dans app_config.
  const suiviDeBase = (Object.keys(rubriques) as CleSuivie[]).flatMap((k) => {
    const fictif: Partial<Record<CleSuivie, unknown>> = { sante_parc: santeFictive, deploiements: deploiementsFictifs, notes_magasins: notesMagasinsFictives, audits: auditsFictifs }
    const brut = configEcrite.has(k) ? JSON.parse(configEcrite.get(k)!) : fictif[k]
    return Object.entries(eclater(k, brut).parMagasin).map(([store_name, valeur]) => ({ store_name, cle: rubriques[k] as string, valeur }))
  })
  if (!options.suiviEnConfig) for (const k of Object.keys(rubriques) as CleSuivie[]) {
    const commun = eclater(k, configEcrite.has(k) ? JSON.parse(configEcrite.get(k)!) : k === 'deploiements' ? deploiementsFictifs : undefined).commun
    if (commun === undefined) configEcrite.delete(k)
    else configEcrite.set(k, JSON.stringify(commun))
  }
  let suiviPersiste = structuredClone(suiviDeBase)
  let suiviCourant = structuredClone(suiviDeBase)
  // Pour les tests, chaque écriture dans suivi_magasins est aussi notée comme la valeur complète de l'ancienne clé d'app_config
  const noterSuivi = (rubrique: string) => {
    if (options.persister) suiviPersiste = structuredClone(suiviCourant)
    const cle = (Object.keys(rubriques) as CleSuivie[]).find((k) => rubriques[k] === rubrique)!
    const commun = configEcrite.has(cle) ? JSON.parse(configEcrite.get(cle)!) : undefined
    const value = JSON.stringify(assembler(cle, commun, Object.fromEntries(suiviCourant.filter((l) => l.cle === rubrique).map((l) => [l.store_name, l.valeur]))))
    options.ecritures?.push({ methode: 'SUIVI', table: 'app_config', corps: { key: cle, value }, filtre: `?key=eq.${cle}` })
  }
  await page.route('https://*.tile.openstreetmap.org/**', (r) => r.fulfill({ status: 204, body: '' }))
  // Communes simulées (centre des villes des fiches personnes)
  await page.route('https://geo.api.gouv.fr/**', (r) => {
    const cp = new URL(r.request().url()).searchParams.get('codePostal')
    const communes: Record<string, unknown[]> = { '59000': [{ nom: 'Lille', centre: { type: 'Point', coordinates: [3.06, 50.63] }, population: 236000 }] }
    return r.fulfill({ json: communes[cp ?? ''] ?? [] })
  })
  // Service d'itinéraire simulé : 1,25 fois la distance à vol d'oiseau, à 72 km/h
  await page.route('https://router.project-osrm.org/**', (r) => {
    const u = new URL(r.request().url())
    const pts = decodeURIComponent(u.pathname.split('/').pop()!).split(';').map((c) => c.split(',').map(Number))
    const idx = (k: string) => u.searchParams.get(k)!.split(';').map(Number)
    const m = (a: number[], b: number[]) => {
      const rad = Math.PI / 180, dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2
      return 6371000 * 2 * Math.asin(Math.sqrt(h)) * 1.25
    }
    const distances = idx('sources').map((i) => idx('destinations').map((k) => m(pts[i], pts[k])))
    return r.fulfill({ json: { code: 'Ok', distances, durations: distances.map((l) => l.map((x) => x / 20)) } })
  })
  // Géolocalisation simulée : toute adresse avec un code postal est trouvée dans sa commune (position fictive)
  await page.route('https://data.geopf.fr/**', (r) => {
    const q = new URL(r.request().url()).searchParams.get('q') ?? ''
    const cp = q.match(/\b\d{5}\b/)?.[0]
    if (!cp) return r.fulfill({ json: { features: [] } })
    return r.fulfill({ json: { features: [{ geometry: { coordinates: [-2.0 + Number(cp.slice(0, 2)) / 100, 47.65] }, properties: { score: 0.9, postcode: cp } }] } })
  })
  await page.route('https://nominatim.openstreetmap.org/**', (r) => r.fulfill({ json: [] }))
  await page.route(/^https:\/\/www\.google\.com\/maps/, (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>Carte</title><p>Carte simulée</p>' }))
  await page.route('https://supabase.test/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      const corps = req.postDataJSON() as { email: string; password: string }
      if (corps.email !== COMPTE.email || corps.password !== COMPTE.motDePasse) {
        return route.fulfill({ status: 400, json: { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials', code: 'invalid_credentials' } })
      }
      const maintenant = Math.floor(Date.now() / 1000)
      return route.fulfill({
        json: {
          access_token: 'jeton-test', token_type: 'bearer', expires_in: 3600, expires_at: maintenant + 3600, refresh_token: 'rafraichissement-test',
          user: { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: COMPTE.email, app_metadata: options.appMetadata ?? {}, user_metadata: {}, created_at: '2026-10-14T00:00:00Z' },
        },
      })
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' })
    if (url.pathname === '/auth/v1/user' && req.method() === 'PUT') {
      options.ecritures?.push({ methode: 'PUT', table: 'auth/user', corps: req.postDataJSON(), filtre: '' })
      return route.fulfill({ json: { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: COMPTE.email, app_metadata: options.appMetadata ?? {}, user_metadata: {} } })
    }
    // Fonctions de la base (script supabase/acces_franchises.sql)
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.replace('/rest/v1/rpc/', '')
      const corps = (req.postDataJSON() ?? {}) as Record<string, unknown>
      const absente = () => route.fulfill({ status: 404, json: { code: 'PGRST202', message: `Could not find the function public.${fn}` } })
      if (options.acces === null) return absente()
      const meta = options.appMetadata ?? {}
      const acces: AccesSimule = options.acces ?? (meta.role === 'coach' || meta.role === 'rr' ? { role: String(meta.role), coach: meta.coach as string, rr: meta.rr as string } : { role: 'directeur' })
      if (fn === 'maj_perimetre_equipe') options.perimetreRecu = corps.p_lignes as PerimetreRecu[]
      if (!['mon_acces', 'espace_franchise', 'liste_acces_franchises', 'maj_perimetre_equipe'].includes(fn)) options.ecritures?.push({ methode: 'POST', table: `rpc/${fn}`, corps, filtre: '' })
      if (fn === 'mon_acces') return route.fulfill({ json: { role: acces.role, coach: acces.coach ?? null, rr: acces.rr ?? null, franchise: acces.franchise ?? null, magasins: acces.magasins ?? [] } })
      if (fn === 'espace_franchise') {
        const apercu = Array.isArray(corps.p_magasins)
        if (apercu ? acces.role !== 'directeur' : acces.role !== 'franchise') return route.fulfill({ status: 400, json: { code: 'P0001', message: 'acces_refuse' } })
        options.ecritures?.push({ methode: 'POST', table: 'rpc/espace_franchise', corps, filtre: '' })
        const magasins = apercu ? (corps.p_magasins as string[]) : acces.magasins ?? []
        return route.fulfill({ json: espaceSimule(apercu ? String(corps.p_franchise) : acces.franchise ?? '', magasins, options.espace ?? {}) })
      }
      const liste = options.accesFranchises ?? []
      if (fn === 'liste_acces_franchises') return route.fulfill({ json: liste.map((a) => ({ ouvert_le: '2026-10-19T10:00:00Z', derniere_connexion: null, ...a })) })
      if (fn === 'ouvrir_acces_franchise') {
        if (corps.p_email === 'inconnu@exemple.test') return route.fulfill({ status: 400, json: { code: 'P0001', message: 'compte_introuvable' } })
        liste.push({ user_id: 'u-nouveau', email: String(corps.p_email), franchise: String(corps.p_franchise), magasins: corps.p_magasins as string[] })
        options.accesFranchises = liste
      }
      if (fn === 'couper_acces_franchise') options.accesFranchises = liste.filter((a) => a.user_id !== corps.p_user)
      if (fn === 'maj_acces_franchise') { const a = liste.find((x) => x.user_id === corps.p_user); if (a) { a.franchise = String(corps.p_franchise); a.magasins = corps.p_magasins as string[] } }
      return route.fulfill({ status: 200, json: null })
    }
    // Espace photos (Storage) : envoi, liens temporaires, suppression
    if (url.pathname.startsWith('/storage/v1/')) {
      const chemin = url.pathname.replace('/storage/v1/object/', '')
      if (options.sansPhotos) return route.fulfill({ status: 400, json: { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' } })
      if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(PNG, 'base64') })
      if (chemin.startsWith('sign/')) return route.fulfill({ json: { signedURL: `/object/${chemin}?token=jeton` } })
      options.ecritures?.push({ methode: req.method(), table: 'storage', corps: req.method() === 'DELETE' ? req.postDataJSON() : { taille: req.postDataBuffer()?.length ?? 0 }, filtre: chemin })
      if (req.method() === 'DELETE') return route.fulfill({ json: [] })
      return route.fulfill({ json: { Key: chemin, Id: 'photo-test' } })
    }
    if (options.panne && url.pathname.startsWith('/rest/')) return route.fulfill({ status: 500, json: { message: 'indisponible' } })
    const table = url.pathname.replace('/rest/v1/', '')
    if (table === 'suivi_magasins' && options.suiviEnConfig) return route.fulfill({ status: 404, json: { code: '42P01', message: 'relation "public.suivi_magasins" does not exist' } })
    if (req.method() !== 'GET' && req.method() !== 'HEAD') {
      options.ecritures?.push({ methode: req.method(), table, corps: req.postDataJSON(), filtre: url.search })
      if (table === 'suivi_magasins') {
        const corps = req.postDataJSON() as { store_name: string; cle: string; valeur: unknown }[] | null
        const rubrique = req.method() === 'DELETE' ? url.searchParams.get('cle')!.replace(/^eq\./, '') : corps![0].cle
        if (req.method() === 'DELETE') {
          const noms = url.searchParams.get('store_name')!.replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''))
          suiviCourant = suiviCourant.filter((l) => !(l.cle === rubrique && noms.includes(l.store_name)))
        } else {
          for (const l of corps!) suiviCourant = [...suiviCourant.filter((x) => !(x.cle === l.cle && x.store_name === l.store_name)), { store_name: l.store_name, cle: l.cle, valeur: l.valeur }]
        }
        noterSuivi(rubrique)
        return route.fulfill({ status: 201, json: [] })
      }
      const cle = url.searchParams.get('key')?.replace(/^eq\./, '') ?? (table === 'app_config' && req.method() === 'POST' ? (req.postDataJSON() as { key?: string }).key : undefined)
      if (options.persister && table === 'app_config' && cle) configEcrite.set(cle, (req.postDataJSON() as { value: string }).value)
      return route.fulfill({ status: 201, json: [] })
    }
    // Filtres simples « colonne=eq.valeur » appliqués comme le ferait Supabase
    const filtrer = (lignes: Record<string, unknown>[]) => lignes.filter((l) => [...url.searchParams].every(([k, v]) => {
      if (v.startsWith('eq.')) return String(l[k]) === v.slice(3)
      // « in.(a,b) » : sans lui, une clé oubliée dans la liste chargée passerait inaperçue
      if (v.startsWith('in.(')) return v.slice(4, -1).split(',').map((x) => x.replace(/^"|"$/g, '')).includes(String(l[k]))
      return true
    }))
    if (table === 'suivi_magasins') {
      suiviCourant = structuredClone(options.persister ? suiviPersiste : suiviDeBase)
      return route.fulfill({ json: filtrer(suiviCourant) })
    }
    if (table === 'app_config') {
      const enTable = (k: string) => !options.suiviEnConfig && estSuivie(k)
      return route.fulfill({ json: filtrer([
        { key: 'store_adds', value: JSON.stringify(magasinsFictifs) },
        { key: 'drs_data', value: JSON.stringify(configRRFictive) },
        { key: 'sante_parc', value: JSON.stringify(santeFictive) },
        { key: 'deploiements', value: JSON.stringify(deploiementsFictifs) },
        { key: 'fiches_personnes', value: JSON.stringify(fichesFictives) },
        { key: 'notes_magasins', value: JSON.stringify(notesMagasinsFictives) },
        { key: 'audits', value: JSON.stringify(auditsFictifs) },
        { key: 'params', value: JSON.stringify({ prepDuration: 2, postDuration: 4, directionHorizon: 6 }) },
      ].map((l) => (configEcrite.has(l.key) ? { ...l, value: configEcrite.get(l.key)! } : l))
        // Clés fournies par le test et absentes des données de base
        .concat([...configEcrite].filter(([k]) => !['store_adds', 'drs_data', 'sante_parc', 'deploiements', 'fiches_personnes', 'notes_magasins', 'audits', 'params'].includes(k)).map(([key, value]) => ({ key, value })))
        // Une fois le cloisonnement passé, app_config ne garde que la partie commune (thématiques, liste des campagnes)
        .filter((l) => !enTable(l.key) || configEcrite.has(l.key))) })
    }
    if (table === 'store_overrides') return route.fulfill({ json: filtrer([{ store_name: 'Nice Test', resp: 'Responsable surchargé' }, { store_name: 'Metz Test', rr: 'rr1' }]) })
    if (table === 'reassigns') return route.fulfill({ json: affectationsFictives })
    if (table === 'cs_overrides') return route.fulfill({ json: filtrer(coachsFictifs) })
    if (table === 'visits') return route.fulfill({ json: filtrer(visitesFictives) })
    if (table === 'leaves') return route.fulfill({ json: filtrer(congesFictifs) })
    if (table === 'events') return route.fulfill({ json: filtrer(evenementsFictifs) })
    if (table === 'store_finance') return route.fulfill({ json: filtrer(chiffresFictifs) })
    if (table === 'recruits') return route.fulfill({ json: filtrer(recruesFictives) })
    return route.fulfill({ json: [] })
  })
}

// Ce que la base renvoie à un franchisé : ses magasins seulement, au format des tables
function espaceSimule(franchise: string, magasins: string[], e: EspaceSimule) {
  const dans = (n: unknown) => magasins.includes(String(n))
  const coachs = new Set(affectationsFictives.filter((a) => a && dans(a.store)).map((a) => a!.cs))
  return {
    franchise, magasins,
    app_config: [
      { key: 'store_adds', value: magasinsFictifs.filter((m) => dans(m.n)) },
      { key: 'drs_data', value: { directeur: { name: configRRFictive.directeur.name, titre: configRRFictive.directeur.titre }, drs: configRRFictive.drs, dr_assigns: configRRFictive.dr_assigns.filter((a) => coachs.has(a.cs)) } },
      { key: 'params', value: { prepDuration: 2, postDuration: 4 } },
      { key: 'audits', value: Object.fromEntries(Object.entries(auditsFictifs).filter(([k]) => dans(k))) },
      { key: 'campagnes', value: e.campagnes ?? { liste: [], constats: {} } },
      { key: 'bonnes_pratiques', value: e.pratiques ?? [] },
    ],
    store_overrides: [],
    reassigns: affectationsFictives.filter((a) => a && dans(a.store)),
    cs_overrides: coachsFictifs.filter((c) => coachs.has(c.cs_name) && !c.tech).map((c) => ({ cs_name: c.cs_name, tel: c.tel, email: c.email })),
    visits: [...visitesFictives, ...(e.visites ?? [])].filter((v) => dans(v.store) && !['appel', 'point'].includes(String(v.type))),
    store_finance: chiffresFictifs.filter((c) => dans(c.store_name)),
    reperes: e.reperes === undefined ? { mois: '2026-09', indicateurs: { evolution: { n: 40, mediane: -2, quartHaut: 3 }, pmCave: { n: 40, mediane: 38, quartHaut: 42 }, fluxBar: { n: 40, mediane: 2500, quartHaut: 3000 } } } : e.reperes,
  }
}

export async function seConnecter(page: Page, options: OptionsSimulation = {}) {
  await simulerSupabase(page, options)
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1, name: /Bonjour|Bonsoir/ }).waitFor()
}

// Liste les textes visibles plus petits que min px
export async function textesTropPetits(page: Page, min = 12): Promise<string[]> {
  return page.evaluate((min) => {
    const fautifs: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const n = walker.currentNode
      const t = n.textContent?.trim()
      const el = n.parentElement
      if (!t || !el || el.closest('[role=img]')) continue // le logo est une image
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none') continue
      if (parseFloat(s.fontSize) < min) fautifs.push(`${t} (${s.fontSize})`)
    }
    return fautifs
  }, min)
}

// Choisit un mois dans un champ « mois » (les affectations se font au mois)
export async function choisirMois(page: Page, libelle: string, mois: string) {
  await page.getByLabel(libelle).click()
  await page.getByRole('option', { name: mois, exact: true }).click()
  await page.getByRole('listbox').waitFor({ state: 'hidden' })
}
