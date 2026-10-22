import type { Locator, Page } from '@playwright/test'
import { assembler, eclater, estSuivie, rubriques, type CleSuivie } from '../src/data/suivi'
import { affectationsFictives, coachsFictifs, congesFictifs, evenementsFictifs, recruesFictives, visitesFictives, configRRFictive, magasinsFictifs, santeFictive, deploiementsFictifs, fichesFictives, notesMagasinsFictives, chiffresFictifs, auditsFictifs } from './donnees-fictives'

export const COMPTE = { email: 'joseph@vandb.test', motDePasse: 'bon-mot-de-passe' }

// Simule l'API d'authentification Supabase : seul COMPTE est accepté.
export interface Ecriture { methode: string; table: string; corps: unknown; filtre: string }

// Accès lu dans la base (fonction mon_acces) ; null : fonctions pas encore créées (script non passé)
export interface AccesSimule { role: string; franchise?: string; magasins?: string[]; coach?: string; rr?: string }
export interface AccesFranchiseSimule { user_id: string; email: string; franchise: string; magasins: string[]; ouvert_le?: string; derniere_connexion?: string | null }
export interface AccesEquipeSimule { user_id: string; email: string; role: 'coach' | 'rr'; nom: string; derniere_connexion?: string | null }
export interface EspaceSimule { actions?: Record<string, Record<string, unknown>[]>; visites?: Record<string, unknown>[]; reperes?: unknown; campagnes?: unknown; pratiques?: unknown[] }
// Messagerie (script supabase/migrations/0006_messagerie.sql) : null = pas encore activée
// destinataire : échange à deux (clé de la personne), avec auteur_cle et magasins cités ; sinon ancien message par magasin (store)
export interface MessageSimule {
  id: number; store?: string | null; auteur: string; auteur_nom: string; auteur_role: string; texte: string; mentions: string[]; cree_le: string
  equipe?: boolean; lot?: string | null; destinataire?: string | null; auteur_cle?: string | null; magasins?: string[]; pieces?: { chemin: string; nom: string; taille: number; type: string }[]
  groupe?: number | null // groupe libre (script 0018_echanges_groupes.sql)
}
// Groupe libre (script 0018_echanges_groupes.sql) : membres = clés des personnes
export interface GroupeSimule { id: number; nom: string; membres: string[]; cree_par: string }
// version 1 et 2 : base d'avant les échanges à deux (script 0006_messagerie.sql pas encore repassé) ; 3 : avant les groupes (0018)
export interface MessagerieSimulee { messages?: MessageSimule[]; lus?: Record<string, string>; reference?: string | null; version?: number; groupes?: GroupeSimule[] }
export const MOI = '00000000-0000-0000-0000-000000000001'
// Comme la base : seuls les fichiers rangés sous le compte connecté, 10 au plus
const piecesPropres = (v: unknown) => (Array.isArray(v) ? v : []).slice(0, 10).filter((p) => typeof p?.chemin === 'string' && p.chemin.startsWith(`${MOI}/`))
// Périmètre envoyé par l'app du Directeur (fonction maj_perimetre_equipe)
// Communications du réseau (script 0008_communications.sql), au format renvoyé par la base
export interface CommunicationSimulee {
  id: number; titre: string; texte: string; html?: string | null; entete?: string | null; pieces?: unknown[]; magasins: string[] | null; auteur: string; auteur_nom: string; auteur_role: string; cree_le: string
  pouces?: { user_id: string; nom: string }[]; commentaires?: { id: number; auteur: string; auteur_nom: string; auteur_role: string; texte: string; cree_le: string }[]
  // Franchisés concernés qui l'ont lue ou pas (script 0013_lectures_communications.sql)
  lus?: string[]; non_lus?: string[]
  a_la_une?: string | null // AAAA-MM-JJ (script 0014_communications_a_la_une.sql)
}
// « J'aime » et commentaires des bonnes pratiques (script 0010_pratiques_reactions.sql), rangés par pratique
export interface ReactionsPratiquesSimulees { pouces?: Record<string, { user_id: string; nom: string }[]>; commentaires?: Record<string, { id: number; auteur: string; auteur_nom: string; auteur_role: string; texte: string; cree_le: string }[]> }
export interface PerimetreRecu { magasin: string; coach: string; rrs: string[] }
export interface OptionsSimulation { reactionsPratiques?: ReactionsPratiquesSimulees; lecturesPratiques?: Record<string, { lus: string[]; non_lus: string[] }> | null; reactionsVisites?: ReactionsPratiquesSimulees; communications?: CommunicationSimulee[] | null; messagerie?: MessagerieSimulee | null; perimetreRecu?: PerimetreRecu[]; suiviEnConfig?: boolean; fichesEnConfig?: boolean; acces?: AccesSimule | null; accesFranchises?: AccesFranchiseSimule[]; accesEquipe?: AccesEquipeSimule[]; reperesEquipe?: unknown; espace?: EspaceSimule; appMetadata?: Record<string, unknown>; panne?: boolean; ecritures?: Ecriture[]; persister?: boolean; config?: Record<string, unknown>; sansPhotos?: boolean; campagnesRegions?: { id: string; rr: string; valeur: unknown }[] | null; preferences?: Record<string, unknown> | null }
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
  // Fiches des personnes (table fiches_personnes, 0015) ; fichesEnConfig : 0015 pas encore passée, fiches dans app_config.
  // Chaque écriture dans la table est aussi notée comme la valeur complète de l'ancienne clé d'app_config.
  const fichesDeBase: Record<string, unknown> = configEcrite.has('fiches_personnes') ? JSON.parse(configEcrite.get('fiches_personnes')!) : structuredClone(fichesFictives)
  if (!options.fichesEnConfig) configEcrite.delete('fiches_personnes')
  let fichesPersistees = structuredClone(fichesDeBase)
  let fichesCourantes = structuredClone(fichesDeBase)
  const noterFiches = () => {
    if (options.persister) fichesPersistees = structuredClone(fichesCourantes)
    options.ecritures?.push({ methode: 'FICHES', table: 'app_config', corps: { key: 'fiches_personnes', value: JSON.stringify(fichesCourantes) }, filtre: '?key=eq.fiches_personnes' })
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
    // Fonctions de la base (script supabase/migrations/0004_acces_franchises.sql)
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.replace('/rest/v1/rpc/', '')
      const corps = (req.postDataJSON() ?? {}) as Record<string, unknown>
      const absente = () => route.fulfill({ status: 404, json: { code: 'PGRST202', message: `Could not find the function public.${fn}` } })
      if (options.acces === null) return absente()
      const meta = options.appMetadata ?? {}
      const acces: AccesSimule = options.acces ?? (meta.role === 'coach' || meta.role === 'rr' ? { role: String(meta.role), coach: meta.coach as string, rr: meta.rr as string } : { role: 'directeur' })
      if (fn === 'maj_perimetre_equipe') options.perimetreRecu = corps.p_lignes as PerimetreRecu[]
      if (!['mon_acces', 'espace_franchise', 'liste_acces_franchises', 'liste_acces_equipe', 'reperes_equipe', 'maj_perimetre_equipe', 'messagerie', 'communications', 'lectures_communications', 'a_la_une', 'reactions_pratiques', 'reactions_visites', 'lectures_pratiques'].includes(fn)) options.ecritures?.push({ methode: 'POST', table: `rpc/${fn}`, corps, filtre: '' })
      // « Vu par » des bonnes pratiques (script 0023_lectures_pratiques.sql)
      if (fn === 'lectures_pratiques' || fn === 'lire_pratiques') {
        if (options.lecturesPratiques === null) return absente()
        const vues = (options.lecturesPratiques ??= {})
        if (fn === 'lectures_pratiques') {
          if (!['directeur', 'rr'].includes(acces.role)) return route.fulfill({ status: 400, json: { code: 'P0001', message: 'acces_refuse' } })
          return route.fulfill({ json: Object.entries(vues).map(([id, l]) => ({ id, ...l })) })
        }
        if (acces.role === 'franchise') for (const id of corps.p_ids as string[]) {
          const l = (vues[id] ??= { lus: [], non_lus: [] })
          l.non_lus = l.non_lus.filter((n) => n !== acces.franchise)
          if (!l.lus.includes(acces.franchise ?? '')) l.lus.push(acces.franchise ?? '')
        }
        return route.fulfill({ status: 200, json: null })
      }
      if (fn === 'mon_acces') return route.fulfill({ json: { role: acces.role, coach: acces.coach ?? null, rr: acces.rr ?? null, franchise: acces.franchise ?? null, magasins: acces.magasins ?? [] } })
      if (fn === 'espace_franchise') {
        const apercu = Array.isArray(corps.p_magasins)
        if (apercu ? acces.role !== 'directeur' : acces.role !== 'franchise') return route.fulfill({ status: 400, json: { code: 'P0001', message: 'acces_refuse' } })
        options.ecritures?.push({ methode: 'POST', table: 'rpc/espace_franchise', corps, filtre: '' })
        const magasins = apercu ? (corps.p_magasins as string[]) : acces.magasins ?? []
        return route.fulfill({ json: espaceSimule(apercu ? String(corps.p_franchise) : acces.franchise ?? '', magasins, options.espace ?? {}) })
      }
      if (['messagerie', 'envoyer_message', 'envoyer_a', 'marquer_lu', 'marquer_lu_personne', 'supprimer_message', 'renommer_magasin_messages', 'envoyer_fil', 'marquer_lu_fil', 'creer_groupe', 'modifier_groupe', 'quitter_groupe', 'supprimer_groupe'].includes(fn)) {
        if (options.messagerie === null) return absente()
        const mg = (options.messagerie ??= {})
        mg.messages ??= []; mg.lus ??= {}; mg.groupes ??= []
        const visibles = (st: string) => acces.role !== 'franchise' || (acces.magasins ?? []).includes(st)
        const cle = acces.role === 'directeur' ? 'directeur' : acces.role === 'rr' ? `rr:${acces.rr}` : acces.role === 'coach' ? `coach:${acces.coach}` : `franchise:${acces.franchise}`
        const version = mg.version ?? 4
        const refus = () => route.fulfill({ status: 400, json: { code: 'P0001', message: 'acces_refuse' } })
        const nom = acces.role === 'franchise' ? acces.franchise : acces.role === 'coach' ? acces.coach : acces.role === 'rr' ? configRRFictive.drs.find((d) => d.id === acces.rr)?.name : configRRFictive.directeur.name
        if (fn === 'messagerie') {
          if (!['directeur', 'rr', 'coach', 'franchise'].includes(acces.role)) return refus()
          const mesGroupes = version >= 4 ? mg.groupes.filter((g) => g.membres.includes(cle)) : []
          return route.fulfill({ json: { moi: MOI, ...(version >= 2 ? { version } : {}), ...(version >= 3 ? { cle } : {}), ...(version >= 4 ? { groupes: mesGroupes } : {}), reference: mg.reference ?? null, lus: mg.lus,
            messages: mg.messages.filter((m) => (m.groupe ? version >= 4 && mesGroupes.some((g) => g.id === m.groupe) : m.destinataire ? m.auteur === MOI || m.destinataire === cle : visibles(String(m.store)) && !(m.equipe && acces.role === 'franchise'))) } })
        }
        // Groupes et fils (script 0018_echanges_groupes.sql) : magasin:<nom>, equipe:<nom>, groupe:<id>
        if (['envoyer_fil', 'marquer_lu_fil', 'creer_groupe', 'modifier_groupe', 'quitter_groupe', 'supprimer_groupe'].includes(fn)) {
          if (version < 4) return absente()
          const prochain = () => Math.max(0, ...mg.messages!.map((m) => m.id)) + 1
          if (fn === 'creer_groupe') {
            if (acces.role !== 'directeur' && acces.role !== 'rr') return refus()
            const g = { id: Math.max(0, ...mg.groupes!.map((x) => x.id)) + 1, nom: String(corps.p_nom ?? '').trim(), membres: [...new Set([...((corps.p_membres as string[]) ?? []), cle])], cree_par: cle }
            mg.groupes!.push(g)
            return route.fulfill({ json: g.id })
          }
          const g = mg.groupes!.find((x) => x.id === Number(corps.p_id))
          if (fn === 'modifier_groupe' || fn === 'supprimer_groupe') {
            if (!g || (acces.role !== 'directeur' && g.cree_par !== cle)) return refus()
            if (fn === 'supprimer_groupe') { mg.groupes = mg.groupes!.filter((x) => x !== g); mg.messages = mg.messages!.filter((m) => m.groupe !== g.id) }
            else { g.nom = String(corps.p_nom ?? g.nom).trim(); g.membres = [...new Set([...((corps.p_membres as string[]) ?? []), g.cree_par])] }
            return route.fulfill({ status: 200, json: null })
          }
          if (fn === 'quitter_groupe') { if (g) g.membres = g.membres.filter((x) => x !== cle); return route.fulfill({ status: 200, json: null }) }
          const fil = String(corps.p_fil ?? '')
          const genre = fil.split(':')[0], valeur = fil.slice(genre.length + 1)
          const groupe = genre === 'groupe' ? mg.groupes!.find((x) => x.id === Number(valeur)) : undefined
          const permis = genre === 'magasin' ? visibles(valeur) : genre === 'equipe' ? acces.role !== 'franchise' && visibles(valeur) : !!groupe?.membres.includes(cle)
          if (!valeur || !permis) return refus()
          const lu = genre === 'groupe' ? `${fil}|messages` : `${valeur}|${genre === 'equipe' ? 'equipe' : 'messages'}`
          const maintenant = new Date().toISOString()
          mg.lus[lu] = maintenant
          if (fn === 'marquer_lu_fil') return route.fulfill({ status: 200, json: null })
          const mentions = ((corps.p_mentions as string[]) ?? []).filter((x) => (genre !== 'equipe' || !x.startsWith('franchise:')) && (!groupe || groupe.membres.includes(x)))
          const id = prochain()
          mg.messages.push({ id, store: groupe ? null : valeur, destinataire: groupe ? fil : null, groupe: groupe?.id ?? null, auteur: MOI, auteur_nom: nom ?? 'joseph', auteur_role: acces.role, auteur_cle: cle, texte: String(corps.p_texte ?? '').trim(), mentions, cree_le: maintenant, equipe: genre === 'equipe', pieces: piecesPropres(corps.p_pieces) })
          return route.fulfill({ json: { id, cree_le: maintenant } })
        }
        if ((fn === 'envoyer_a' || fn === 'marquer_lu_personne') && version < 3) return absente()
        if (fn === 'envoyer_a') {
          const dest = String(corps.p_destinataire ?? '')
          const magasins = (corps.p_magasins as string[] | undefined) ?? []
          if (!/^(directeur|rr:.+|coach:.+|franchise:.+)$/.test(dest) || dest === cle || (acces.role === 'franchise' && dest.startsWith('franchise:')) || !magasins.every(visibles)) return refus()
          const maintenant = new Date().toISOString()
          mg.messages.push({ id: Math.max(0, ...mg.messages.map((m) => m.id)) + 1, store: null, auteur: MOI, auteur_nom: nom ?? 'joseph', auteur_role: acces.role, texte: String(corps.p_texte).trim(), mentions: [dest], cree_le: maintenant, destinataire: dest, auteur_cle: cle, magasins: [...new Set(magasins)], pieces: piecesPropres(corps.p_pieces) })
          mg.lus[`personne:${dest}|messages`] = maintenant
          return route.fulfill({ json: { id: mg.messages.length } })
        }
        if (fn === 'marquer_lu_personne') { mg.lus[`personne:${String(corps.p_cle)}|messages`] = new Date().toISOString(); return route.fulfill({ status: 200, json: null }) }
        const st = String(corps.p_store ?? '')
        if ((fn === 'envoyer_message' || fn === 'marquer_lu') && !visibles(st)) return route.fulfill({ status: 400, json: { code: 'P0001', message: 'acces_refuse' } })
        if (fn === 'envoyer_message') {
          if (corps.p_equipe && acces.role === 'franchise') return refus()
          const maintenant = new Date().toISOString()
          mg.messages.push({ id: Math.max(0, ...mg.messages.map((m) => m.id)) + 1, store: st, auteur: MOI, auteur_nom: nom ?? 'joseph', auteur_role: acces.role, texte: String(corps.p_texte).trim(), mentions: (corps.p_mentions as string[]) ?? [], cree_le: maintenant, equipe: corps.p_equipe === true, lot: (corps.p_lot as string | null) ?? null })
          mg.lus[`${st}|messages`] = maintenant
          return route.fulfill({ json: { id: mg.messages.length } })
        }
        if (fn === 'marquer_lu') mg.lus[`${st}|${String(corps.p_sujet ?? 'messages')}`] = new Date().toISOString()
        if (fn === 'supprimer_message') {
          const lot = mg.messages.find((m) => m.id === corps.p_id && m.auteur === MOI)?.lot
          mg.messages = mg.messages.filter((m) => !(m.auteur === MOI && (m.id === corps.p_id || (lot && m.lot === lot))))
        }
        return route.fulfill({ status: 200, json: null })
      }
      // Réactions aux bonnes pratiques (0010_pratiques_reactions.sql) et aux comptes rendus (0022_reactions_visites.sql) :
      // absentes des options = migration pas encore passée
      const reaction = /^(reactions|basculer_pouce|commenter|supprimer_commentaire)_?(pratiques?|visites?)$/.exec(fn)
      if (reaction) {
        const surVisite = reaction[2].startsWith('visite')
        const suffixe = surVisite ? 'visite' : 'pratique'
        const r = surVisite ? options.reactionsVisites : options.reactionsPratiques
        if (!r) return absente()
        const pouces = (r.pouces ??= {}), commentaires = (r.commentaires ??= {})
        const nom = acces.role === 'franchise' ? acces.franchise : acces.role === 'coach' ? acces.coach : acces.role === 'rr' ? configRRFictive.drs.find((d) => d.id === acces.rr)?.name : configRRFictive.directeur.name
        if (fn === `reactions_${suffixe}s`) return route.fulfill({ json: { moi: MOI, pouces, commentaires } })
        const id = String(corps.p_id)
        if (fn === `basculer_pouce_${suffixe}`) {
          const avant = pouces[id] ?? []
          pouces[id] = avant.some((p) => p.user_id === MOI) ? avant.filter((p) => p.user_id !== MOI) : [...avant, { user_id: MOI, nom: nom ?? '' }]
          return route.fulfill({ json: pouces[id].some((p) => p.user_id === MOI) })
        }
        if (fn === `supprimer_commentaire_${suffixe}`) { for (const k of Object.keys(commentaires)) commentaires[k] = commentaires[k].filter((c) => !(c.id === corps.p_id && c.auteur === MOI)); return route.fulfill({ status: 200, json: null }) }
        const tous = Object.values(commentaires).flat()
        commentaires[id] = [...(commentaires[id] ?? []), { id: Math.max(0, ...tous.map((k) => k.id)) + 1, auteur: MOI, auteur_nom: nom ?? '', auteur_role: acces.role, texte: String(corps.p_texte ?? '').trim(), cree_le: new Date().toISOString() }]
        return route.fulfill({ json: { id: tous.length + 1 } })
      }
      // Communications du réseau (script 0008_communications.sql) : le Directeur pour tout le réseau, un RR pour ses magasins
      if (['communications', 'publier_communication', 'supprimer_communication', 'basculer_pouce_communication', 'commenter_communication', 'supprimer_commentaire_communication', 'lectures_communications', 'lire_communications', 'a_la_une', 'mettre_a_la_une'].includes(fn)) {
        if (options.communications === null) return absente()
        const liste = (options.communications ??= [])
        const refus = () => route.fulfill({ status: 400, json: { code: 'P0001', message: 'acces_refuse' } })
        const mesMagasins = acces.role === 'franchise' ? acces.magasins ?? [] : acces.role === 'directeur' ? null : magasinsFictifs.map((m) => String(m.n))
        const visible = (c: CommunicationSimulee) => c.magasins === null || c.auteur === MOI || mesMagasins === null || c.magasins.some((m) => mesMagasins.includes(m))
        const nom = acces.role === 'franchise' ? acces.franchise : acces.role === 'coach' ? acces.coach : acces.role === 'rr' ? configRRFictive.drs.find((d) => d.id === acces.rr)?.name : configRRFictive.directeur.name
        const id = Number(corps.p_id)
        const c = liste.find((x) => x.id === id)
        if (fn === 'communications') return route.fulfill({ json: { moi: MOI, role: acces.role, liste: structuredClone(liste.filter(visible)).sort((a, b) => b.cree_le.localeCompare(a.cree_le)).map((x) => ({ pouces: [], commentaires: [], pieces: [], ...x, lus: undefined, non_lus: undefined, a_la_une: undefined })) } })
        if (fn === 'a_la_une') {
          const jour = new Date().toLocaleDateString('sv-SE')
          return route.fulfill({ json: liste.filter((x) => visible(x) && x.a_la_une && x.a_la_une >= jour).map((x) => ({ id: x.id, jusqu_au: x.a_la_une })) })
        }
        if (fn === 'mettre_a_la_une') {
          if (!['directeur', 'rr'].includes(acces.role) || !c || !(c.auteur === MOI || acces.role === 'directeur')) return refus()
          c.a_la_une = corps.p_jusqu_au ? String(corps.p_jusqu_au) : null
          return route.fulfill({ status: 200, json: null })
        }
        if (fn === 'lectures_communications') {
          if (!['directeur', 'rr'].includes(acces.role)) return refus()
          return route.fulfill({ json: liste.filter(visible).filter((x) => x.lus || x.non_lus).map((x) => ({ id: x.id, lus: x.lus ?? [], non_lus: x.non_lus ?? [] })) })
        }
        if (fn === 'lire_communications') {
          if (acces.role === 'franchise') for (const x of liste.filter((x) => visible(x) && (corps.p_ids as number[]).includes(x.id))) {
            x.non_lus = (x.non_lus ?? []).filter((n) => n !== acces.franchise)
            if (!(x.lus ?? []).includes(acces.franchise ?? '')) x.lus = [...(x.lus ?? []), acces.franchise ?? '']
          }
          return route.fulfill({ status: 200, json: null })
        }
        if (fn === 'publier_communication') {
          if (!['directeur', 'rr'].includes(acces.role) || !String(corps.p_titre ?? '').trim()) return refus()
          // Comme la base : la photo d'en-tête est une des photos jointes
          const pieces = corps.p_id === null ? piecesPropres(corps.p_pieces) : [...(c?.pieces ?? []).filter((p) => (corps.p_pieces as { chemin: string }[]).some((x) => x.chemin === (p as { chemin: string }).chemin)), ...piecesPropres(corps.p_pieces).filter((p) => !(c?.pieces ?? []).some((x) => (x as { chemin: string }).chemin === p.chemin))]
          const forme = { html: corps.p_html ? String(corps.p_html) : null, entete: pieces.some((p) => p.chemin === corps.p_entete && String(p.type).startsWith('image/')) ? String(corps.p_entete) : null }
          if (corps.p_id === null) liste.push({ id: Math.max(0, ...liste.map((x) => x.id)) + 1, titre: String(corps.p_titre), texte: String(corps.p_texte ?? ''), ...forme, pieces, magasins: acces.role === 'rr' ? ['Lyon Test', 'Metz Test'] : null, auteur: MOI, auteur_nom: nom ?? '', auteur_role: acces.role, cree_le: new Date().toISOString() })
          else if (!c || c.auteur !== MOI) return refus()
          else Object.assign(c, { titre: String(corps.p_titre), texte: String(corps.p_texte ?? ''), ...forme, pieces })
          return route.fulfill({ json: { id: corps.p_id ?? liste.length } })
        }
        if (fn === 'supprimer_communication') { options.communications = liste.filter((x) => !(x.id === id && (x.auteur === MOI || acces.role === 'directeur'))); return route.fulfill({ status: 200, json: null }) }
        if (fn === 'supprimer_commentaire_communication') { for (const x of liste) x.commentaires = (x.commentaires ?? []).filter((k) => !(k.id === id && k.auteur === MOI)); return route.fulfill({ status: 200, json: null }) }
        if (!c || !visible(c)) return refus()
        if (fn === 'basculer_pouce_communication') {
          const avant = c.pouces ?? []
          c.pouces = avant.some((p) => p.user_id === MOI) ? avant.filter((p) => p.user_id !== MOI) : [...avant, { user_id: MOI, nom: nom ?? '' }]
          return route.fulfill({ json: c.pouces.some((p) => p.user_id === MOI) })
        }
        const texte = String(corps.p_texte ?? '').trim()
        if (!texte) return route.fulfill({ status: 400, json: { code: 'P0001', message: 'message_vide' } })
        const tous = liste.flatMap((x) => x.commentaires ?? [])
        c.commentaires = [...(c.commentaires ?? []), { id: Math.max(0, ...tous.map((k) => k.id)) + 1, auteur: MOI, auteur_nom: nom ?? '', auteur_role: acces.role, texte, cree_le: new Date().toISOString() }]
        return route.fulfill({ json: { id: c.commentaires.length } })
      }
      // Actions du franchisé (script 0007_actions_franchise.sql) : la base pose son nom et la date
      if (fn === 'ajouter_action_franchise' || fn === 'marquer_action_franchise') {
        const st = String(corps.p_store ?? '')
        const introuvable = () => route.fulfill({ status: 400, json: { code: 'P0001', message: 'action_introuvable' } })
        if (acces.role !== 'franchise' || !(acces.magasins ?? []).includes(st)) return route.fulfill({ status: 400, json: { code: 'P0001', message: 'acces_refuse' } })
        const e = (options.espace ??= {})
        const actions = (e.actions ??= {})
        const jour = new Date().toISOString().slice(0, 10)
        const marquer = (a: Record<string, unknown>) => { if (corps.p_faite) Object.assign(a, { faite: jour, faitePar: acces.franchise }); else { delete a.faite; delete a.faitePar } }
        if (fn === 'ajouter_action_franchise') {
          actions[st] = [...(actions[st] ?? []), { id: `l_simule${Object.values(actions).flat().length + 1}`, action: String(corps.p_action).trim(), porteur: String(corps.p_porteur ?? ''), echeance: String(corps.p_echeance ?? ''), creeLe: jour, auteur: acces.franchise, ...(piecesPropres(corps.p_pieces).length ? { pieces: piecesPropres(corps.p_pieces) } : {}) }]
        } else if (corps.p_libre) {
          const a = actions[st]?.find((x) => x.id === corps.p_libre)
          if (!a) return introuvable()
          marquer(a)
        } else {
          const v = e.visites?.find((x) => x.id === corps.p_visite && x.store === st)
          const plan = ((v?.action_plan ?? []) as Record<string, unknown>[]).filter((a) => String(a.action ?? '').trim())
          const a = plan[Number(corps.p_index)]
          if (!v || !a || a.action !== corps.p_texte) return introuvable()
          marquer(a)
          v.action_plan = plan
        }
        return route.fulfill({ status: 200, json: null })
      }
      // Accès de l'équipe et repères réseau (script 0005_cloisonnement_equipe.sql)
      if (fn === 'reperes_equipe') {
        if (!['directeur', 'rr', 'coach'].includes(acces.role)) return route.fulfill({ status: 400, json: { code: 'P0001', message: 'acces_refuse' } })
        return route.fulfill({ json: options.reperesEquipe === undefined ? { mois: '2026-09', indicateurs: { evolution: { n: 40, mediane: -2, quartHaut: 3 }, pmCave: { n: 40, mediane: 38, quartHaut: 42 } } } : options.reperesEquipe })
      }
      const equipe = options.accesEquipe ?? []
      if (['liste_acces_equipe', 'ouvrir_acces_equipe', 'couper_acces_equipe'].includes(fn) && acces.role !== 'directeur') return route.fulfill({ status: 400, json: { code: 'P0001', message: 'acces_refuse' } })
      if (fn === 'liste_acces_equipe') return route.fulfill({ json: equipe.map((a) => ({ derniere_connexion: null, ...a })) })
      if (fn === 'ouvrir_acces_equipe') {
        if (corps.p_email === 'inconnu@exemple.test') return route.fulfill({ status: 400, json: { code: 'P0001', message: 'compte_introuvable' } })
        options.accesEquipe = [...equipe.filter((a) => !(a.role === corps.p_role && a.nom === corps.p_nom)), { user_id: 'u-equipe', email: String(corps.p_email), role: corps.p_role as 'coach' | 'rr', nom: String(corps.p_nom) }]
      }
      if (fn === 'couper_acces_equipe') options.accesEquipe = equipe.filter((a) => a.user_id !== corps.p_user)
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
    if (table === 'fiches_personnes' && options.fichesEnConfig) return route.fulfill({ status: 404, json: { code: '42P01', message: 'relation "public.fiches_personnes" does not exist' } })
    // Préférences : notées seulement quand le test s'en occupe (sinon chaque fiche ouverte en écrirait une)
    if (table === 'preferences' && options.preferences === undefined && req.method() !== 'GET') return route.fulfill({ status: 201, json: [] })
    if (req.method() !== 'GET' && req.method() !== 'HEAD') {
      options.ecritures?.push({ methode: req.method(), table, corps: req.postDataJSON(), filtre: url.search })
      // Campagnes régionales : enregistrées telles quelles, relues au chargement suivant
      if (table === 'campagnes_regions' && options.campagnesRegions !== null) {
        const liste = (options.campagnesRegions ??= [])
        const id = url.searchParams.get('id')?.replace(/^eq\./, '')
        if (req.method() === 'DELETE') options.campagnesRegions = liste.filter((l) => l.id !== id)
        else if (req.method() === 'PATCH') { const l = liste.find((x) => x.id === id); if (l) Object.assign(l, req.postDataJSON()) }
        else for (const l of [req.postDataJSON()].flat() as { id: string; rr: string; valeur: unknown }[]) options.campagnesRegions = [...options.campagnesRegions!.filter((x) => x.id !== l.id), { id: l.id, rr: l.rr, valeur: l.valeur }]
        return route.fulfill({ status: 201, json: [] })
      }
      if (table === 'fiches_personnes') {
        if (req.method() === 'DELETE') {
          for (const k of url.searchParams.get('cle')!.replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''))) delete fichesCourantes[k]
        } else for (const l of [req.postDataJSON()].flat() as { cle: string; fiche: unknown }[]) fichesCourantes[l.cle] = l.fiche
        noterFiches()
        return route.fulfill({ status: 201, json: [] })
      }
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
    // Préférences du compte (migration 0021) : null = table absente
    if (table === 'preferences') {
      if (options.preferences === null) return route.fulfill({ status: 404, json: { code: '42P01', message: 'relation "public.preferences" does not exist' } })
      return route.fulfill({ json: options.preferences ? [{ valeur: options.preferences }] : [] })
    }
    if (table === 'campagnes_regions') {
      if (options.campagnesRegions === null) return route.fulfill({ status: 404, json: { code: '42P01', message: 'relation "public.campagnes_regions" does not exist' } })
      return route.fulfill({ json: structuredClone(options.campagnesRegions ?? []) })
    }
    if (table === 'fiches_personnes') {
      fichesCourantes = structuredClone(options.persister ? fichesPersistees : fichesDeBase)
      return route.fulfill({ json: filtrer(Object.entries(fichesCourantes).map(([cle, fiche]) => ({ cle, fiche }))) })
    }
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
        .filter((l) => !enTable(l.key) || configEcrite.has(l.key))
        .filter((l) => options.fichesEnConfig || l.key !== 'fiches_personnes')) })
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
      { key: 'actions', value: Object.fromEntries(Object.entries(e.actions ?? {}).filter(([k]) => dans(k))) },
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
  await page.getByRole('heading', { level: 1, name: /^Accueil$|Bonjour|Bonsoir/ }).waitFor()
}

// Ouvre une rubrique à onglets : sur téléphone, au-delà de 4 rubriques, les dernières sont derrière « Plus »
// Un onglet regroupé (« Chiffres et santé ») s'ouvre aussi par son nom court (« Chiffres »)
export async function ouvrirOnglet(page: Page, nom: string, dans: Locator | Page = page) {
  const nomComplet = new RegExp(`^${nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( et .+)?$`)
  const onglet = dans.getByRole('tab', { name: nomComplet })
  if (await onglet.isVisible()) return onglet.click()
  await dans.getByRole('tab', { name: /autres rubriques$/i }).click()
  await page.getByRole('dialog').getByRole('button', { name: nomComplet }).click()
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

// Fiche magasin : Planifier, Préparer et Modifier sont dans le menu « Autres actions »
export async function actionFiche(page: Page, nom: 'Planifier la visite' | 'Préparer la visite' | 'Modifier la fiche') {
  await page.getByRole('button', { name: 'Autres actions' }).click()
  await page.getByRole('menu').getByRole('menuitem', { name: nom }).click()
}

// Téléphone : « À traiter » ne montre que deux lignes ; on déplie la liste (et ses puces) avant de la vérifier
export async function deplierATraiter(page: Page) {
  const bloc = page.getByRole('region', { name: 'À traiter' })
  await bloc.waitFor()
  if (page.viewportSize()!.width >= 900) return
  const voir = bloc.getByRole('button', { name: /^Voir les \d+$/ })
  if (await voir.count()) await voir.click()
}
