// Plan d'action « Marché extérieur » d'un magasin (Joseph, 16/11/2026) : repérer autour du magasin les entreprises,
// prescripteurs (traiteurs, salles, DJ), associations et clubs, business clubs et CHR ; retenir des cibles ; les noter
// sur 5 critères ; les placer dans une matrice ; en tirer un plan d'action. Rubrique « exterieur » de suivi_magasins
// (0048), tenue par l'équipe et par le franchisé (ecrire_exterieur).
//
// Repérage : Annuaire des entreprises de l'État (API Recherche d'entreprises, recherche-entreprises.api.gouv.fr),
// gratuite, sans clé, appelée depuis le navigateur. Pappers (clé payante) et Societe.com (pas d'API ouverte) écartés :
// aucune clé ne peut aller dans ce dépôt public. Les business clubs n'ont pas de source fiable : ajout à la main
// (les organisations patronales et consulaires, NAF 94.11Z, sont proposées).
//
// Matrice : valeur directe = moyenne (potentiel commercial, bénéfice récurrent) ; valeur relais = moyenne (visibilité,
// prescription, intérêt pour la cause). Seuil à 3 sur 5 sur chaque axe.

import type { ActionLibre } from './modele'

export type Categorie = 'entreprise' | 'prescripteur' | 'association' | 'club' | 'chr'
export const CATEGORIES: { cle: Categorie; libelle: string; pluriel: string }[] = [
  { cle: 'entreprise', libelle: 'Entreprise', pluriel: 'Entreprises' },
  { cle: 'prescripteur', libelle: 'Prescripteur', pluriel: 'Prescripteurs' },
  { cle: 'association', libelle: 'Association ou club', pluriel: 'Associations et clubs' },
  { cle: 'club', libelle: 'Business club', pluriel: 'Business clubs' },
  { cle: 'chr', libelle: 'Café, hôtel, restaurant', pluriel: 'Cafés, hôtels, restaurants' },
]
export const libelleCategorie = (c: Categorie) => CATEGORIES.find((x) => x.cle === c)?.libelle ?? 'Entreprise'

export type Critere = 'potentiel' | 'visibilite' | 'prescription' | 'recurrence' | 'cause'
export const CRITERES: { cle: Critere; libelle: string; question: string }[] = [
  { cle: 'potentiel', libelle: 'Potentiel commercial', question: 'Volume possible sur un an : fûts, coffrets, cadeaux d’affaires' },
  { cle: 'visibilite', libelle: 'Visibilité', question: 'Le magasin est vu : logo, stand, public nombreux' },
  { cle: 'prescription', libelle: 'Prescription', question: 'Il recommande le magasin à ses clients ou à ses membres' },
  { cle: 'recurrence', libelle: 'Bénéfice concret attendu', question: 'Des commandes qui reviennent plutôt qu’un coup unique' },
  { cle: 'cause', libelle: 'Intérêt pour la cause', question: 'Le franchisé y croit, s’y implique, a un lien personnel' },
]

export type StatutAction = 'a_faire' | 'en_cours' | 'fait' | 'abandon'
export const STATUTS: [StatutAction, string][] = [['a_faire', 'À faire'], ['en_cours', 'En cours'], ['fait', 'Fait'], ['abandon', 'Abandonné']]
export type Offre = '' | 'exterieur' | 'remises_b2b' | 'soiree'
export const OFFRES: [Offre, string][] = [['', 'Aucun simulateur'], ['exterieur', 'Contrat extérieur'], ['remises_b2b', 'Remises entreprise par paliers'], ['soiree', 'Soirée, dégustation']]
export type Quadrant = 'priorite' | 'client' | 'relais' | 'plus_tard'
export const QUADRANTS: { cle: Quadrant; libelle: string; ton: 'rouge' | 'orange' | 'vert' | 'gris'; sens: string }[] = [
  { cle: 'priorite', libelle: 'Priorité', ton: 'rouge', sens: 'Rapporte et fait parler du magasin' },
  { cle: 'client', libelle: 'Client à signer', ton: 'orange', sens: 'Rapporte, peu d’effet relais' },
  { cle: 'relais', libelle: 'Partenaire relais', ton: 'vert', sens: 'Fait connaître le magasin, rapporte peu' },
  { cle: 'plus_tard', libelle: 'Plus tard', ton: 'gris', sens: 'Rien cette année' },
]

export interface Cible {
  id: string
  nom: string
  categorie: Categorie
  detail: string // activité, effectif
  adresse: string
  distance: number | null // mètres
  siren: string
  source: 'annuaire' | 'saisie'
  contact: string
  membres: number | null // salariés, licenciés ou adhérents, saisi
  notes: Partial<Record<Critere, number>> // 1 à 5
  action: string
  qui: string
  echeance: string // AAAA-MM-JJ
  caVise: number | null // € HT sur un an
  statut: StatutAction
  offre: Offre
  par: string
  le: string
}
export interface PlanExterieur { rayon: number; objectif: number | null; cibles: Cible[] }

export const RAYONS = [5, 10, 20]
export const planVide = (): PlanExterieur => ({ rayon: 10, objectif: null, cibles: [] })

const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const nombre = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const dans = <T extends string>(v: unknown, liste: readonly T[], defaut: T): T => (liste.includes(v as T) ? v as T : defaut)

export function normaliserCible(x: Record<string, unknown>): Cible | null {
  const id = texte(x.id, 40), nom = texte(x.nom, 160)
  if (!id || !nom) return null
  const n = x.notes && typeof x.notes === 'object' && !Array.isArray(x.notes) ? x.notes as Record<string, unknown> : {}
  const notes: Partial<Record<Critere, number>> = {}
  for (const { cle } of CRITERES) { const v = nombre(n[cle]); if (v !== null && v >= 1 && v <= 5) notes[cle] = Math.round(v) }
  const ca = nombre(x.caVise)
  const d = nombre(x.distance)
  return {
    id, nom, categorie: dans(x.categorie, CATEGORIES.map((c) => c.cle), 'entreprise'), detail: texte(x.detail, 200), adresse: texte(x.adresse, 200),
    distance: d !== null && d >= 0 ? Math.round(d) : null, siren: texte(x.siren, 14), source: x.source === 'annuaire' ? 'annuaire' : 'saisie',
    contact: texte(x.contact, 200), membres: (() => { const v = nombre(x.membres); return v !== null && v >= 0 ? Math.round(v) : null })(), notes, action: texte(x.action, 300), qui: texte(x.qui, 80),
    echeance: /^\d{4}-\d{2}-\d{2}$/.test(String(x.echeance)) ? String(x.echeance) : '', caVise: ca !== null && ca >= 0 ? ca : null,
    statut: dans(x.statut, STATUTS.map(([k]) => k), 'a_faire'), offre: dans(x.offre, OFFRES.map(([k]) => k), ''), par: texte(x.par, 80), le: texte(x.le, 10),
  }
}
export function normaliserPlan(v: unknown): PlanExterieur | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  const cibles = (Array.isArray(o.cibles) ? o.cibles : []).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object').map(normaliserCible).filter((c): c is Cible => !!c)
  const rayon = nombre(o.rayon)
  const objectif = nombre(o.objectif)
  return { rayon: rayon !== null && RAYONS.includes(rayon) ? rayon : 10, objectif: objectif !== null && objectif >= 0 ? objectif : null, cibles }
}
export function normaliserExterieur(v: unknown): Record<string, PlanExterieur> {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
  return Object.fromEntries(Object.entries(o).map(([m, p]) => [m, normaliserPlan(p)] as const).filter((e): e is [string, PlanExterieur] => !!e[1]))
}

// ── Diagnostic et matrice ──────────────────────────────────────────
const moyenne = (l: (number | undefined)[]) => { const v = l.filter((x): x is number => typeof x === 'number'); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null }
export const estNotee = (c: Cible) => CRITERES.every(({ cle }) => typeof c.notes[cle] === 'number')
export function axes(c: Cible): { direct: number; relais: number } | null {
  if (!estNotee(c)) return null
  return { direct: moyenne([c.notes.potentiel, c.notes.recurrence])!, relais: moyenne([c.notes.visibilite, c.notes.prescription, c.notes.cause])! }
}
export const SEUIL = 3
export function quadrant(c: Cible): Quadrant | null {
  const a = axes(c)
  if (!a) return null
  return a.direct >= SEUIL ? (a.relais >= SEUIL ? 'priorite' : 'client') : a.relais >= SEUIL ? 'relais' : 'plus_tard'
}
// Ordre du plan : priorités d'abord, puis clients à signer, partenaires relais, plus tard, puis cibles pas encore notées ;
// dans une case, la plus forte valeur totale d'abord
const rang: Record<Quadrant, number> = { priorite: 0, client: 1, relais: 2, plus_tard: 3 }
export function ordrePlan(cibles: Cible[]): Cible[] {
  const total = (c: Cible) => { const a = axes(c); return a ? a.direct + a.relais : -1 }
  return [...cibles].sort((a, b) => {
    const qa = quadrant(a), qb = quadrant(b)
    return (qa ? rang[qa] : 4) - (qb ? rang[qb] : 4) || total(b) - total(a) || a.nom.localeCompare(b.nom, 'fr')
  })
}
// Action proposée par défaut selon la case et le type de cible (modifiable)
export function actionProposee(c: Cible): { action: string; offre: Offre } {
  const q = quadrant(c)
  if (q === 'plus_tard') return { action: '', offre: '' }
  switch (c.categorie) {
    case 'entreprise': return { action: q === 'relais' ? 'Proposer une dégustation au comité social et économique' : 'Rendez-vous avec la direction : cadeaux d’affaires et pots', offre: 'remises_b2b' }
    case 'prescripteur': return { action: 'Dégustation et grille tarifaire réservée aux prescripteurs', offre: 'exterieur' }
    case 'association': return { action: 'Proposer la buvette avec tireuses prêtées', offre: 'exterieur' }
    case 'club': return { action: 'Soirée dégustation pour les membres', offre: 'soiree' }
    case 'chr': return { action: 'Proposer fûts et tireuse pour la saison', offre: 'exterieur' }
  }
}

export interface Synthese { cibles: number; notees: number; parQuadrant: Record<Quadrant, number>; actions: number; faites: number; caVise: number }
// Actions du plan = tâches du magasin rattachées à une cible (0049, Joseph 17/11/2026)
export const tachesDuPlan = (taches: ActionLibre[] | undefined, p: PlanExterieur) => {
  const ids = new Set(p.cibles.map((c) => c.id))
  return (taches ?? []).filter((t) => t.exterieur && ids.has(t.exterieur.cible))
}
export function synthese(p: PlanExterieur, taches: ActionLibre[] = []): Synthese {
  const parQuadrant: Record<Quadrant, number> = { priorite: 0, client: 0, relais: 0, plus_tard: 0 }
  for (const c of p.cibles) { const q = quadrant(c); if (q) parQuadrant[q]++ }
  const t = tachesDuPlan(taches, p)
  return {
    cibles: p.cibles.length, notees: p.cibles.filter(estNotee).length, parQuadrant, actions: t.length,
    faites: t.filter((x) => x.faite).length, caVise: p.cibles.reduce((s, c) => s + (c.caVise ?? 0), 0),
  }
}

// ── Repérage : Annuaire des entreprises ─────────────────────────────
// Correctif (Joseph, 16/11/2026, « je ne vois pas les usines Thales à Vendôme ») : la recherche « autour d'un point »
// de l'Annuaire ignore le filtre d'effectif ; elle rendait les 50 premières entreprises de toutes tailles. On cherche
// désormais par codes postaux (communes du rayon, données Géo de l'État) avec le filtre d'effectif, puis on garde les
// établissements dans le rayon. L'effectif retenu est celui du site, pas celui du groupe.
export const API = 'https://recherche-entreprises.api.gouv.fr/search'
export const GEO = 'https://geo.api.gouv.fr'
// Tranches d'effectif salarié de l'INSEE : code → libellé et effectif minimal
export const TRANCHES: Record<string, { libelle: string; min: number }> = {
  '00': { libelle: '0 salarié', min: 0 }, '01': { libelle: '1 ou 2 salariés', min: 1 }, '02': { libelle: '3 à 5 salariés', min: 3 },
  '03': { libelle: '6 à 9 salariés', min: 6 }, '11': { libelle: '10 à 19 salariés', min: 10 }, '12': { libelle: '20 à 49 salariés', min: 20 },
  '21': { libelle: '50 à 99 salariés', min: 50 }, '22': { libelle: '100 à 199 salariés', min: 100 }, '31': { libelle: '200 à 249 salariés', min: 200 },
  '32': { libelle: '250 à 499 salariés', min: 250 }, '41': { libelle: '500 à 999 salariés', min: 500 }, '42': { libelle: '1 000 à 1 999 salariés', min: 1000 },
  '51': { libelle: '2 000 à 4 999 salariés', min: 2000 }, '52': { libelle: '5 000 à 9 999 salariés', min: 5000 }, '53': { libelle: '10 000 salariés et plus', min: 10000 },
}
export const TAILLES = [10, 20, 50, 100]
export const tranchesDepuis = (min: number) => Object.entries(TRANCHES).filter(([, t]) => t.min >= min).map(([k]) => k)

// Codes d'activité (NAF) cherchés pour chaque type de cible ; les entreprises sont cherchées par effectif seul
export const NAF: Record<Exclude<Categorie, 'entreprise'>, Record<string, string>> = {
  prescripteur: { '56.21Z': 'Traiteur', '82.30Z': 'Organisation d’événements, salons', '90.01Z': 'Spectacle, DJ, animation', '90.02Z': 'Technique du spectacle, sonorisation', '93.29Z': 'Loisirs, salle de réception', '68.20B': 'Location de salles' },
  association: { '93.12Z': 'Club de sport', '94.99Z': 'Association (comité des fêtes, amicale…)', '93.11Z': 'Équipement sportif' },
  club: { '94.11Z': 'Organisation patronale ou consulaire', '94.12Z': 'Organisation professionnelle' },
  chr: { '56.10A': 'Restaurant', '56.30Z': 'Bar, débit de boissons', '55.10Z': 'Hôtel', '55.30Z': 'Camping', '55.20Z': 'Gîte, hébergement touristique' },
}
const libelleNaf = (code: string) => {
  for (const [cat, liste] of Object.entries(NAF)) if (liste[code]) return { categorie: cat as Categorie, libelle: liste[code] }
  return null
}

// effectif : effectif minimal du site (null s'il n'est pas publié) ; taille : tranche de l'entreprise entière
// ca : chiffre d'affaires de l'entreprise, dernière année publiée (comptes déposés) ; conseil : pourquoi l'app la met en avant
export interface Trouvee { id: string; nom: string; categorie: Categorie; activite: string; effectif: number | null; libelleEffectif: string; taille: string; detail: string; adresse: string; distance: number; siren: string; ca: { montant: number; annee: string } | null; conseil: string }
type Etablissement = { siret?: string; adresse?: string; latitude?: string | number | null; longitude?: string | number | null; activite_principale?: string; tranche_effectif_salarie?: string | null; liste_enseignes?: string[] | null; etat_administratif?: string }
type Resultat = { siren?: string; nom_complet?: string; nom_raison_sociale?: string; activite_principale?: string; tranche_effectif_salarie?: string | null; matching_etablissements?: Etablissement[]; siege?: Etablissement; finances?: Record<string, { ca?: number | null } | null> | null }

// Dernier chiffre d'affaires publié
export function dernierCA(f: Resultat['finances']): Trouvee['ca'] {
  const annees = Object.entries(f ?? {}).filter(([a, v]) => /^\d{4}$/.test(a) && typeof v?.ca === 'number' && Number.isFinite(v.ca) && v.ca > 0).sort(([a], [b]) => b.localeCompare(a))
  return annees.length ? { montant: annees[0][1]!.ca as number, annee: annees[0][0] } : null
}
export const libelleCA = (ca: Trouvee['ca']) => !ca ? '' : `${ca.montant >= 1e6 ? `${(ca.montant / 1e6).toFixed(1).replace('.', ',')} M€` : `${Math.round(ca.montant / 1000).toLocaleString('fr-FR')} k€`} (${ca.annee})`

// Cibles mises en avant (Joseph, 17/11/2026) : toutes restent listées ; l'app signale les plus prometteuses et dit pourquoi.
// Règles simples, assumées : la taille du site ou le chiffre d'affaires d'abord, le rôle de relais pour les business clubs.
export function conseil(t: Pick<Trouvee, 'categorie' | 'effectif' | 'ca' | 'activite'>): string {
  const e = t.effectif ?? 0, ca = t.ca?.montant ?? 0
  switch (t.categorie) {
    case 'entreprise':
      if (e >= 50) return 'Grand site : comité social et économique, cadeaux d’affaires, pots'
      if (!t.effectif && ca >= 10e6) return 'Grosse entreprise : cadeaux d’affaires, pots'
      return ''
    case 'prescripteur':
      if (ca >= 500000) return 'Grand prescripteur : volume d’événements'
      if (e >= 10) return 'Prescripteur de 10 salariés et plus : volume d’événements'
      return ''
    case 'association':
      return e >= 1 ? 'Association employeuse : structure active, événements réguliers' : ''
    case 'club':
      return 'Réseau de dirigeants : relais vers leurs entreprises'
    case 'chr':
      if (e >= 10 && /Hôtel|Camping|Gîte/.test(t.activite)) return 'Hébergement de 10 salariés et plus : séminaires, mariages'
      if (e >= 10) return 'Grosse affluence : fûts et tireuse'
      return ''
  }
}

export function distance(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = (x: number) => (x * Math.PI) / 180
  const dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}
const majuscules = (s: string) => s.toLowerCase().replace(/(^|[\s'’(-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase())
// Les magasins V and B ne sont pas des cibles
const estVandB = (nom: string) => /\bv\s*(and|&|et)\s*b\b/i.test(nom)
const nombreOuNul = (v: unknown) => (v === null || v === undefined || v === '' ? NaN : Number(v))

// Lecture d'une page de réponse : chaque site de l'entreprise dans le rayon (une usine et une agence sont deux cibles)
export function lireResultats(j: { results?: Resultat[] }, depuis: { lat: number; lon: number }, rayonM: number, categorie: Categorie): Trouvee[] {
  return (j.results ?? []).flatMap((r) => {
    const nomBase = r.nom_complet || r.nom_raison_sociale || ''
    if (!nomBase) return []
    const taille = TRANCHES[r.tranche_effectif_salarie ?? '']?.libelle ?? ''
    return (r.matching_etablissements?.length ? r.matching_etablissements : r.siege ? [r.siege] : [])
      .filter((e) => e.etat_administratif !== 'F')
      .map((e) => ({ e, lat: nombreOuNul(e.latitude), lon: nombreOuNul(e.longitude) }))
      .filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon))
      .map((x) => ({ ...x, d: distance(depuis, x) }))
      .filter((x) => x.d <= rayonM)
      .flatMap(({ e, d }) => {
        const enseigne = e.liste_enseignes?.find(Boolean)
        const nom = majuscules(enseigne && !nomBase.toLowerCase().includes(enseigne.toLowerCase()) ? `${enseigne} (${nomBase})` : nomBase)
        if (estVandB(nom)) return []
        const naf = e.activite_principale || r.activite_principale || ''
        const lu = libelleNaf(naf)
        const t = TRANCHES[e.tranche_effectif_salarie ?? '']
        const cat: Categorie = categorie === 'entreprise' ? 'entreprise' : lu?.categorie ?? categorie
        const activite = lu?.libelle ?? (naf ? `Activité ${naf}` : '')
        const libelleEffectif = t ? `${t.libelle} sur le site` : 'Effectif du site non publié'
        const detail = [activite, libelleEffectif, taille && !t ? `entreprise : ${taille}` : ''].filter(Boolean).join(' · ')
        const ca = dernierCA(r.finances)
        const effectif = t ? t.min : null
        const detailCA = ca ? `${detail} · CA ${libelleCA(ca)}` : detail
        return [{ id: `siret/${e.siret ?? r.siren}`, nom: nom.slice(0, 160), categorie: cat, activite, effectif, libelleEffectif, taille, detail: detailCA.slice(0, 200), adresse: majuscules(e.adresse ?? '').slice(0, 200), distance: Math.round(d), siren: r.siren ?? '', ca, conseil: conseil({ categorie: cat, effectif, ca, activite }) }]
      })
  })
}

// Les plus gros sites d'abord, effectif inconnu ensuite, puis du plus proche au plus loin
export const trierParPotentiel = (a: Trouvee, b: Trouvee) => Number(!!b.conseil) - Number(!!a.conseil) || (b.effectif ?? -1) - (a.effectif ?? -1) || (b.ca?.montant ?? 0) - (a.ca?.montant ?? 0) || a.distance - b.distance

// Points du cercle (centre et 8 directions) : leurs départements, pour un magasin près d'une limite
export function pointsDuCercle(lat: number, lon: number, rayonKm: number): { lat: number; lon: number }[] {
  const dLat = rayonKm / 111.2, dLon = rayonKm / (111.2 * Math.cos((lat * Math.PI) / 180))
  const pts = [{ lat, lon }]
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; pts.push({ lat: lat + dLat * Math.cos(a), lon: lon + dLon * Math.sin(a) }) }
  return pts
}
type CommuneGeo = { codesPostaux?: string[]; centre?: { coordinates?: [number, number] } }
// Codes postaux des communes dont le centre est dans le rayon (avec 3 km de marge pour les communes étendues)
export function codesDansLeRayon(communes: CommuneGeo[], lat: number, lon: number, rayonKm: number): string[] {
  const codes = new Set<string>()
  for (const c of communes) {
    const [clon, clat] = c.centre?.coordinates ?? []
    if (typeof clat !== 'number' || typeof clon !== 'number') continue
    if (distance({ lat, lon }, { lat: clat, lon: clon }) <= (rayonKm + 3) * 1000) for (const cp of c.codesPostaux ?? []) codes.add(cp)
  }
  return [...codes].sort()
}

const ATTENTE = 15000
async function lire<T>(url: string): Promise<T> {
  const ctrl = new AbortController()
  const minuterie = setTimeout(() => ctrl.abort(), ATTENTE)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json() as T
  } finally { clearTimeout(minuterie) }
}

export async function codesPostauxAutour(lat: number, lon: number, rayonKm: number): Promise<string[]> {
  const deps = new Set<string>()
  const lus = await Promise.allSettled(pointsDuCercle(lat, lon, rayonKm).map((p) => lire<{ codeDepartement?: string }[]>(`${GEO}/communes?lat=${p.lat.toFixed(5)}&lon=${p.lon.toFixed(5)}&fields=codeDepartement&format=json`)))
  for (const l of lus) if (l.status === 'fulfilled') for (const c of l.value ?? []) if (c.codeDepartement) deps.add(c.codeDepartement)
  if (!deps.size) throw new Error('geo')
  const communes = (await Promise.all([...deps].map((d) => lire<CommuneGeo[]>(`${GEO}/departements/${d}/communes?fields=codesPostaux,centre&format=json`)))).flat()
  const codes = codesDansLeRayon(communes, lat, lon, rayonKm)
  if (!codes.length) throw new Error('geo')
  return codes
}

export const PAGES_MAX = 8
export function requete(categorie: Categorie, codesPostaux: string[], tailleMin: number, page: number): string {
  const filtre = categorie === 'entreprise' ? `tranche_effectif_salarie=${tranchesDepuis(tailleMin).join(',')}` : `activite_principale=${Object.keys(NAF[categorie]).join(',')}`
  return `${API}?code_postal=${codesPostaux.join(',')}&${filtre}&etat_administratif=A&limite_matching_etablissements=20&per_page=25&page=${page}`
}

// Recherche d'un type de cible dans les codes postaux du rayon ; jusqu'à 8 pages de 25 entreprises
export async function chercher(categorie: Categorie, codesPostaux: string[], lat: number, lon: number, rayonKm: number, tailleMin: number): Promise<Trouvee[]> {
  const j1 = await lire<{ results?: Resultat[]; total_pages?: number }>(requete(categorie, codesPostaux, tailleMin, 1))
  const pages = [j1]
  const n = Math.min(PAGES_MAX, j1.total_pages ?? 1)
  for (let p = 2; p <= n; p += 3) {
    const lot = await Promise.allSettled([p, p + 1, p + 2].filter((x) => x <= n).map((x) => lire<{ results?: Resultat[] }>(requete(categorie, codesPostaux, tailleMin, x))))
    for (const l of lot) if (l.status === 'fulfilled') pages.push(l.value)
  }
  const vus = new Set<string>()
  return pages.flatMap((j) => lireResultats(j, { lat, lon }, rayonKm * 1000, categorie))
    // Entreprises : un site dont l'effectif publié est sous la taille demandée sort (une agence d'un grand groupe)
    .filter((t) => (categorie !== 'entreprise' || t.effectif === null || t.effectif >= tailleMin) && !vus.has(t.id) && (vus.add(t.id), true))
}

export function cibleDepuis(t: Trouvee, par: string, le: string): Cible {
  return { id: t.id, nom: t.nom, categorie: t.categorie, detail: t.detail, adresse: t.adresse, distance: t.distance, siren: t.siren, source: 'annuaire', contact: '', membres: null, notes: {}, action: '', qui: '', echeance: '', caVise: null, statut: 'a_faire', offre: '', par, le }
}
export const nouvelId = () => `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
export const libelleDistance = (d: number | null) => (d === null ? '' : d < 1000 ? `${Math.max(10, Math.round(d / 10) * 10)} m` : `${(d / 1000).toFixed(1).replace('.', ',')} km`)
