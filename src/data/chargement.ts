import { renommerAccesCoach } from './accesEquipe'
import { supabase } from '../lib/supabase'
import { construireReseau, type DonneesBrutes, type Parametres } from './construction'
import { avecPoint, definirGrille, delaisVisiteParDefaut, normaliserGrille, notesAu, sansPoint, thematiquesParDefaut, type GrilleNineBox, type Deploiements, type Evaluation, type Evaluations, type IdCritere, type Note, type Thematique } from './sante'
import type { ActionLibre, ActionPlan, Evenement, Situation, Figure, NoteMagasin, PreparationVisite, Reseau, Topographie, Visite } from './modele'
import { SEPARATEUR_VISITEURS, lireVisiteurs } from './modele'
import { colonnesChiffres, seuilsParDefaut, type Audits, type ChiffreMois, type ResultatAudit, type SeuilsAlerte } from './chiffres'
import { normaliserParties, normaliserPlan } from './compteRendu'
import { normaliserGrilles, type Grilles } from './grilles'
import { normaliserPratiques, type BonnePratique } from './bonnesPratiques'
import { normaliserCampagnes, type Campagne, type Campagnes } from './campagnes'
import { associesEnPlace, normaliserAssocies, type Associe, type Associes } from './associes'
import { normaliserActionsLibres } from './actions'
import { renommerAcces, supprimerComptesDe } from './espaceFranchise'
import { cleFiche, ficheVide, franchises, libelleRole, type FichePersonnelle, type RefPersonne } from './personnes'
import { configDepuisSuivi, eclater, assembler, rubriques, type CleSuivie } from './suivi'

function json<T>(valeur: unknown, defaut: T): T {
  if (valeur === null || valeur === undefined) return defaut
  if (typeof valeur !== 'string') return valeur as T
  try { return JSON.parse(valeur) as T } catch { return defaut }
}

export class ErreurChargement extends Error {}

type Ligne = Record<string, unknown>
// Tables lues, dans leur format Supabase (l'espace franchisé renvoie le même format, filtré par la base)
export interface Tables {
  config: { key: string; value: unknown }[]
  surcharges: Ligne[]; affectations: Ligne[]; coachs: Ligne[]; recrues: Ligne[]
  visites: Ligne[]; evenements: Ligne[]; finances: Ligne[]
  campagnesRegions?: Ligne[]
}

const absente = (message: string) => /does not exist|schema cache|Could not find the table/i.test(message)

// Une réponse Supabase compte au plus 1 000 lignes : les grandes tables se lisent par pages
type Requete = { range: (debut: number, fin: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> }
async function toutLire(requete: () => Requete): Promise<{ data: Ligne[]; error: { message: string } | null }> {
  const data: Ligne[] = []
  for (let debut = 0; ; debut += 1000) {
    const r = await requete().range(debut, debut + 999)
    if (r.error) return { data, error: r.error }
    data.push(...((r.data ?? []) as Ligne[]))
    if ((r.data ?? []).length < 1000) return { data, error: null }
  }
}

// Suivi rangé par magasin : table suivi_magasins une fois le script de cloisonnement passé, sinon app_config
let suiviEnTable: boolean | null = null
// Fiches des personnes : table fiches_personnes une fois 0015 passée, sinon clé d'app_config
let fichesEnTable: boolean | null = null

// Lit les tables Supabase partagées avec l'ancienne app (lecture seule)
export async function chargerReseau(jour = new Date().toISOString().slice(0, 10)): Promise<Reseau> {
  const [config, surcharges, affectations, coachs, recrues, visites, evenements, finances, suivi, regions, fiches] = await Promise.all([
    supabase.from('app_config').select('key,value').in('key', ['store_adds', 'store_renames', 'drs_data', 'params', 'cs_deletes', 'sante_parc', 'deploiements', 'fiches_personnes', 'notes_magasins', 'audits', 'grilles_audit', 'bonnes_pratiques', 'campagnes', 'associes', 'actions', 'derniere_sauvegarde', 'grille_ninebox', 'preparations_visites']),
    supabase.from('store_overrides').select('*'),
    supabase.from('reassigns').select('id,store,cs,date,note,type,created_at').order('date').order('id'),
    supabase.from('cs_overrides').select('*'),
    supabase.from('recruits').select('*'),
    toutLire(() => supabase.from('visits').select('*').order('visit_date', { ascending: false }).order('id')),
    supabase.from('events').select('*').order('start_date'),
    toutLire(() => supabase.from('store_finance').select('*').order('month').order('store_name')),
    toutLire(() => supabase.from('suivi_magasins').select('store_name,cle,valeur').order('store_name').order('cle')),
    supabase.from('campagnes_regions').select('id,rr,valeur').order('id'),
    toutLire(() => supabase.from('fiches_personnes').select('cle,fiche').order('cle')),
  ])
  const erreur = config.error ?? surcharges.error ?? affectations.error ?? coachs.error ?? (suivi.error && !absente(suivi.error.message) ? suivi.error : null)
  if (erreur) throw new ErreurChargement(erreur.message)
  suiviEnTable = !suivi.error
  if (fiches.error && !absente(fiches.error.message)) throw new ErreurChargement(fiches.error.message)
  fichesEnTable = !fiches.error
  // Tables facultatives : absentes ou vides, l'app fonctionne quand même
  const facultative = (r: { error: unknown; data: unknown }) => (r.error ? [] : (r.data as Ligne[] | null) ?? [])
  const lignesConfig = fichesEnTable
    ? [...(config.data ?? []).filter((l) => l.key !== 'fiches_personnes'), { key: 'fiches_personnes', value: JSON.stringify(Object.fromEntries(fiches.data.map((l) => [String(l.cle), l.fiche]))) }]
    : config.data ?? []
  return assemblerReseau({
    config: suiviEnTable ? configDepuisSuivi(lignesConfig, suivi.data as { store_name: string; cle: string; valeur: unknown }[]) : lignesConfig,
    surcharges: surcharges.data ?? [], affectations: affectations.data ?? [], coachs: coachs.data ?? [],
    recrues: facultative(recrues), visites: facultative(visites), evenements: facultative(evenements), finances: facultative(finances),
    campagnesRegions: facultative(regions),
  }, jour)
}

// Construit le réseau à partir des tables lues
export function assemblerReseau(tables: Tables, jour = new Date().toISOString().slice(0, 10)): Reseau {
  const { config: lignesConfig, surcharges, affectations, coachs, recrues, visites, evenements, finances } = tables
  const cle = (k: string) => lignesConfig.find((r) => r.key === k)?.value
  const params = json<Partial<Parametres>>(cle('params'), {})
  const brutes: DonneesBrutes = {
    magasins: json(cle('store_adds'), []),
    renommages: json(cle('store_renames'), {}),
    surcharges: surcharges as unknown as DonneesBrutes['surcharges'],
    affectations: affectations as unknown as DonneesBrutes['affectations'],
    configRR: json(cle('drs_data'), {}),
    coachs: coachs as unknown as DonneesBrutes['coachs'],
    coachsSupprimes: json<string[]>(cle('cs_deletes'), []),
    recrues: recrues as unknown as DonneesBrutes['recrues'],
    parametres: {
      prepDuration: Number(params.prepDuration) || 2, postDuration: Number(params.postDuration) || 4,
      maxUnits: Number(params.maxUnits) || 8, alertThreshold: Number(params.alertThreshold) || 7,
      poidsOuvert: params.poidsOuvert === undefined ? 1 : Number(params.poidsOuvert),
      poidsRenforce: params.poidsRenforce === undefined ? 2 : Number(params.poidsRenforce),
      maxCoachsRR: Number(params.maxCoachsRR) || 8,
      maxTourneeHeures: Number(params.maxTourneeHeures) || 12,
    },
  }
  const reseau = construireReseau(brutes, jour)
  // Santé du parc et déploiements : stockés dans app_config (aucune table à créer)
  // La grille de la nine box est fixée avant tout calcul de case
  reseau.grilleNineBox = normaliserGrille(json<unknown>(cle('grille_ninebox'), null))
  definirGrille(reseau.grilleNineBox)
  reseau.evaluations = json<Evaluations>(cle('sante_parc'), {})
  reseau.notesMagasins = json<Record<string, NoteMagasin[]>>(cle('notes_magasins'), {})
  reseau.preparations = json<Record<string, PreparationVisite>>(cle('preparations_visites'), {})
  reseau.audits = json<Audits>(cle('audits'), {})
  reseau.grilles = normaliserGrilles(json<unknown>(cle('grilles_audit'), {}))
  reseau.pratiques = normaliserPratiques(json<unknown>(cle('bonnes_pratiques'), []))
  reseau.campagnes = normaliserCampagnes(json<unknown>(cle('campagnes'), {}), tables.campagnesRegions)
  reseau.associes = normaliserAssocies(json<unknown>(cle('associes'), {}))
  reseau.actionsLibres = normaliserActionsLibres(json<unknown>(cle('actions'), {}))
  reseau.derniereSauvegarde = json<{ date?: string }>(cle('derniere_sauvegarde'), {}).date ?? ''
  const seuil = (k: keyof SeuilsAlerte) => (params[k as keyof typeof params] === undefined || isNaN(Number(params[k as keyof typeof params])) ? seuilsParDefaut[k] : Number(params[k as keyof typeof params]))
  reseau.seuils = { seuilDecroche: seuil('seuilDecroche'), seuilSurveiller: seuil('seuilSurveiller'), moisReference: seuil('moisReference') === 1 ? 1 : 12, delaiAppel: seuil('delaiAppel') }
  const brut = params as Record<string, unknown>
  reseau.delaisVisite = Object.fromEntries(Object.entries(delaisVisiteParDefaut).map(([k, d]) => [k, Number(brut[`alerteVisite_${k}`]) > 0 ? Number(brut[`alerteVisite_${k}`]) : d]))
  const dep = json<Partial<Deploiements>>(cle('deploiements'), {})
  reseau.deploiements = { thematiques: dep.thematiques?.length ? dep.thematiques : thematiquesParDefaut, valeurs: dep.valeurs ?? {}, journal: dep.journal ?? {} }
  type L = Ligne
  const t = (v: unknown) => (v === null || v === undefined ? '' : String(v))
  reseau.visites = (visites as L[]).map((v) => ({
    id: Number(v.id) || null, groupe: t(v.group_id), magasin: t(v.store), date: t(v.visit_date).slice(0, 10), type: t(v.type) || 'terrain',
    visiteurs: lireVisiteurs(t(v.visitor)), signatureRequise: !!v.signed_required, lienSigne: t(v.signed_url), dateSignature: t(v.signed_date).slice(0, 10),
    documents: Array.isArray(v.docs) ? (v.docs as { label?: string; url?: string; chemin?: string }[]).filter((d) => !d.chemin).map((d) => ({ label: t(d.label), url: t(d.url) })) : [], notes: t(v.notes),
    photos: Array.isArray(v.docs) ? (v.docs as { chemin?: string; taille?: number }[]).filter((d) => d.chemin).map((d) => ({ chemin: t(d.chemin), taille: Number(d.taille) || 0 })) : [],
    parties: normaliserParties(v.sections), plan: normaliserPlan(v.action_plan), creeLe: t(v.created_at),
    // Avant 0017 : une visite à venir, ou du jour sans compte rendu, est une visite planifiée
    prevue: v.prevue === undefined ? t(v.visit_date).slice(0, 10) > jour || (t(v.visit_date).slice(0, 10) === jour && !t(v.notes) && !v.sections) : v.prevue === true,
  }))
  // Chiffres mensuels : table facultative, absente = aucun chiffre
  const nb = (v: unknown) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v))
  reseau.chiffres = {}
  for (const f of finances as L[]) {
    const c = { magasin: t(f.store_name), mois: t(f.month).slice(0, 7), ...Object.fromEntries(Object.entries(colonnesChiffres).map(([id, col]) => [id, nb(f[col])])) } as ChiffreMois
    if (!c.magasin || !/^\d{4}-\d{2}$/.test(c.mois)) continue
    ;(reseau.chiffres[c.magasin] ??= []).push(c)
  }
  for (const l of Object.values(reseau.chiffres)) l.sort((a, b) => a.mois.localeCompare(b.mois))
  reseau.evenements = (evenements as L[]).map((e) => ({
    id: Number(e.id) || null, titre: t(e.title), type: t(e.type) || 'event', debut: t(e.start_date).slice(0, 10), fin: t(e.end_date).slice(0, 10) || t(e.start_date).slice(0, 10), notes: t(e.notes), couleur: t(e.color) || '#7c3aed',
    ...(Array.isArray(e.invites) && e.invites.length ? { invites: (e.invites as unknown[]).map(String) } : {}),
    ...(t(e.heure) ? { heure: t(e.heure) } : {}), ...(t(e.html) ? { html: t(e.html) } : {}),
  }))
  // Anniversaires : naissance (fiches Coach et RR) et arrivée (recrues)
  const ann: Reseau['anniversaires'] = []
  for (const c of coachs as L[]) if (c.birth && !c.tech) ann.push({ nom: t(c.cs_name), role: 'Coach', date: t(c.birth).slice(0, 10), nature: 'naissance' })
  const cfgRR = json<{ drs?: { name: string; birth?: string; entry?: string }[] }>(cle('drs_data'), {})
  for (const r of cfgRR.drs ?? []) {
    if (r.birth) ann.push({ nom: r.name, role: 'Responsable Régional', date: r.birth.slice(0, 10), nature: 'naissance' })
    if (r.entry) ann.push({ nom: r.name, role: 'Responsable Régional', date: r.entry.slice(0, 10), nature: 'arrivee' })
  }
  for (const r of recrues as L[]) if (r.start && !reseau.equipe.find((c) => c.nom === r.name)?.fictif) ann.push({ nom: t(r.name), role: 'Coach', date: t(r.start).slice(0, 10), nature: 'arrivee' })
  // Fiches personnelles : elles complètent ou remplacent les dates connues de l'ancienne app
  reseau.personnes = json<Reseau['personnes']>(cle('fiches_personnes'), {})
  const parCle = new Map(ann.map((a) => [`${a.nom}|${a.nature}`, a]))
  const ajouter = (nom: string, role: string, f: Partial<FichePersonnelle> | undefined) => {
    if (!nom || !f) return
    if (f.naissance) parCle.set(`${nom}|naissance`, { nom, role, date: f.naissance, nature: 'naissance' })
    if (f.arrivee) parCle.set(`${nom}|arrivee`, { nom, role, date: f.arrivee, nature: 'arrivee' })
  }
  const p = reseau.personnes
  if (reseau.directeur.nom !== 'Direction du réseau') ajouter(reseau.directeur.nom, libelleRole('directeur'), { naissance: reseau.directeur.naissance, arrivee: reseau.directeur.arrivee, ...p.directeur })
  for (const c of reseau.equipe) ajouter(c.nom, 'Coach', p[cleFiche({ type: 'coach', cle: c.nom })])
  for (const r of reseau.rrs) ajouter(r.nom, libelleRole('rr'), p[cleFiche({ type: 'rr', cle: r.id })])
  for (const f of franchises(reseau)) ajouter(f.nom, libelleRole('franchise', f.integresSeulement), p[cleFiche({ type: 'franchise', cle: f.nom })])
  reseau.anniversaires = [...parCle.values()].filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.date))
  return reseau
}

// ── Écritures (partagées avec l'ancienne app) ──

export class ErreurEnregistrement extends Error {}

// Les affectations (Coach du magasin, RR du Coach) changent au mois : à partir du 1er du mois choisi
const premierDuMois = (iso: string) => `${iso.slice(0, 7)}-01`
function moisSuivant(iso: string) {
  const [a, m] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10)
}

// Réaffecte un magasin à un Coach à partir du 1er du mois (même format que l'ancienne app)
// Un seul changement par mois : celui du même mois est remplacé
export async function reaffecter(magasin: string, coach: string, mois: string, note: string): Promise<void> {
  const date = premierDuMois(mois)
  const ancien = await supabase.from('reassigns').delete().eq('store', magasin).gte('date', date).lt('date', moisSuivant(date))
  if (ancien.error) throw new ErreurEnregistrement(ancien.error.message)
  const { error } = await supabase.from('reassigns').insert({ store: magasin, cs: coach, date, note, type: 'manual' })
  if (error) throw new ErreurEnregistrement(error.message)
}

// Met à jour quelques paramètres en conservant tous les autres réglages de l'ancienne app
// Changement de Coach d'un mois retiré de l'historique du magasin
export async function supprimerAffectation(magasin: string, mois: string) {
  const date = premierDuMois(mois)
  verifier(await supabase.from('reassigns').delete().eq('store', magasin).gte('date', date).lt('date', moisSuivant(date)))
}

export async function enregistrerParametres(changements: Record<string, number>): Promise<void> {
  const lu = await supabase.from('app_config').select('value').eq('key', 'params')
  if (lu.error) throw new ErreurEnregistrement(lu.error.message)
  const actuels = json<Record<string, unknown>>(lu.data?.[0]?.value, {})
  const value = JSON.stringify({ ...actuels, ...changements })
  const res = lu.data?.length
    ? await supabase.from('app_config').update({ value }).eq('key', 'params')
    : await supabase.from('app_config').insert({ key: 'params', value })
  if (res.error) throw new ErreurEnregistrement(res.error.message)
}

// ── Équipe : Directeur, Responsables Régionaux, Coachs ──

async function lireCle<T>(cle: string, defaut: T): Promise<{ valeur: T; existe: boolean }> {
  const lu = await supabase.from('app_config').select('value').eq('key', cle)
  if (lu.error) throw new ErreurEnregistrement(lu.error.message)
  return { valeur: json<T>(lu.data?.[0]?.value, defaut), existe: !!lu.data?.length }
}

async function ecrireCle(cle: string, valeur: unknown, existe: boolean) {
  const value = JSON.stringify(valeur)
  const res = existe
    ? await supabase.from('app_config').update({ value }).eq('key', cle)
    : await supabase.from('app_config').insert({ key: cle, value })
  if (res.error) throw new ErreurEnregistrement(res.error.message)
}

// Clé suivie (rangée par magasin) : même format qu'app_config, mais seules les lignes des magasins
// modifiés sont réécrites, et un Coach ou un RR ne lit que les siennes
interface LuSuivi<T> { valeur: T; existe: boolean; commun: string; lignes: Map<string, string> }
async function lireSuivi<T>(cle: CleSuivie, defaut: T): Promise<LuSuivi<T>> {
  if (suiviEnTable === null) {
    const essai = await supabase.from('suivi_magasins').select('store_name').limit(1)
    if (essai.error && !absente(essai.error.message)) throw new ErreurEnregistrement(essai.error.message)
    suiviEnTable = !essai.error
  }
  if (!suiviEnTable) return { ...(await lireCle<T>(cle, defaut)), commun: '', lignes: new Map() }
  const avecCommun = cle === 'deploiements' || cle === 'campagnes'
  const [commun, lu] = await Promise.all([
    avecCommun ? lireCle<unknown>(cle, {}) : Promise.resolve({ valeur: undefined, existe: false }),
    toutLire(() => supabase.from('suivi_magasins').select('store_name,valeur').eq('cle', rubriques[cle]).order('store_name')),
  ])
  if (lu.error) throw new ErreurEnregistrement(lu.error.message)
  const parMagasin = Object.fromEntries(lu.data.map((l) => [String(l.store_name), l.valeur]))
  const valeur = lu.data.length || avecCommun ? assembler(cle, commun.valeur, parMagasin) as T : defaut
  return { valeur, existe: commun.existe, commun: JSON.stringify(eclater(cle, commun.valeur).commun), lignes: new Map(lu.data.map((l) => [String(l.store_name), JSON.stringify(l.valeur)])) }
}

async function ecrireSuivi<T>(cle: CleSuivie, valeur: T, lu: LuSuivi<T>) {
  if (!suiviEnTable) return ecrireCle(cle, valeur, lu.existe)
  const { commun, parMagasin } = eclater(cle, valeur)
  if (commun !== undefined && JSON.stringify(commun) !== lu.commun) await ecrireCle(cle, commun, lu.existe)
  const rubrique = rubriques[cle]
  const changes = Object.entries(parMagasin).filter(([m, v]) => lu.lignes.get(m) !== JSON.stringify(v))
    .map(([m, v]) => ({ store_name: m, cle: rubrique, valeur: v, maj_le: new Date().toISOString() }))
  const retires = [...lu.lignes.keys()].filter((m) => !(m in parMagasin))
  for (let i = 0; i < changes.length; i += 500) verifier(await supabase.from('suivi_magasins').upsert(changes.slice(i, i + 500), { onConflict: 'store_name,cle' }))
  for (let i = 0; i < retires.length; i += 100) verifier(await supabase.from('suivi_magasins').delete().eq('cle', rubrique).in('store_name', retires.slice(i, i + 100)))
}

// Relit drs_data, applique la modification et réécrit tout (les champs inconnus de la nouvelle app sont conservés)
async function modifierConfigRR(changer: (c: ConfigRRComplete) => void) {
  const { valeur, existe } = await lireCle<ConfigRRComplete>('drs_data', {})
  changer(valeur)
  await ecrireCle('drs_data', valeur, existe)
}

type RRComplet = { id: string; name: string; tel?: string; email?: string; color?: string; role?: string; [k: string]: unknown }
type ConfigRRComplete = { drs?: RRComplet[]; cs_dr?: Record<string, string>; dr_assigns?: { cs: string; dr: string; date: string; saisi?: string }[]; directeur?: Record<string, unknown>; [k: string]: unknown }

export interface FicheDirecteur { nom: string; titre: string; telephone: string; email: string; naissance: string; arrivee: string }
export async function enregistrerDirecteur(d: FicheDirecteur) {
  await modifierConfigRR((c) => { c.directeur = { ...(c.directeur ?? {}), name: d.nom, titre: d.titre, tel: d.telephone, email: d.email, birth: d.naissance || null, entry: d.arrivee || null } })
}

export interface FicheRR { id?: string; nom: string; telephone: string; email: string; couleur: string; integres: boolean; naissance: string; arrivee: string }
export async function enregistrerRR(r: FicheRR): Promise<string> {
  const id = r.id ?? `dr_${Date.now()}`
  await modifierConfigRR((c) => {
    c.drs = c.drs ?? []
    const champs = { name: r.nom, tel: r.telephone, email: r.email, color: r.couleur, role: r.integres ? 'integres' : 'rr', birth: r.naissance || null, entry: r.arrivee || null }
    const ex = c.drs.find((x) => x.id === id)
    if (ex) Object.assign(ex, champs)
    else c.drs.push({ id, lon: null, lat: null, ...champs })
  })
  return id
}

export async function supprimerRR(id: string) {
  await modifierConfigRR((c) => {
    c.drs = (c.drs ?? []).filter((x) => x.id !== id)
    for (const cs of Object.keys(c.cs_dr ?? {})) if (c.cs_dr![cs] === id) delete c.cs_dr![cs]
  })
  await supprimerFichePersonne({ type: 'rr', cle: id })
}

// Rattache un Coach à un RR à partir du 1er du mois (historique conservé, comme dans l'ancienne app)
export async function rattacherCoach(coach: string, rrId: string, mois: string) {
  const date = premierDuMois(mois)
  await modifierConfigRR((c) => {
    // Historique conservé ; un seul changement par mois : celui du même mois est remplacé
    c.dr_assigns = [...(c.dr_assigns ?? []).filter((a) => !(a.cs === coach && a.date?.slice(0, 7) === date.slice(0, 7))), { cs: coach, dr: rrId, date, saisi: new Date().toISOString() }]
    // Rattachement « actuel » lu par l'ancienne app : seulement si le changement a déjà pris effet
    if (date <= new Date().toISOString().slice(0, 10)) c.cs_dr = { ...(c.cs_dr ?? {}), [coach]: rrId }
  })
}

export async function supprimerRattachement(coach: string, mois: string) {
  await modifierConfigRR((c) => { c.dr_assigns = (c.dr_assigns ?? []).filter((a) => !(a.cs === coach && a.date?.slice(0, 7) === mois.slice(0, 7))) })
}

export interface FicheCoach { nom: string; telephone: string; email: string; ville: string; fictif: boolean; arrivee: string }
export async function enregistrerCoach(f: FicheCoach) {
  const ligne = { cs_name: f.nom, tel: f.telephone, email: f.email, ville: f.ville, fictif: f.fictif }
  // Ville changée : l'ancienne position n'est plus valable, la carte se replace sur la nouvelle ville
  const autreVille = (v: unknown) => (typeof v === 'string' ? v : '').trim() !== f.ville.trim()
  const sansPosition = { lat: null, lon: null }
  const ex = await supabase.from('cs_overrides').select('cs_name,ville').eq('cs_name', f.nom)
  if (ex.error) throw new ErreurEnregistrement(ex.error.message)
  const res = ex.data?.length
    ? await supabase.from('cs_overrides').update(autreVille(ex.data[0].ville) ? { ...ligne, ...sansPosition } : ligne).eq('cs_name', f.nom)
    : await supabase.from('cs_overrides').insert(ligne)
  if (res.error) throw new ErreurEnregistrement(res.error.message)
  // Date d'arrivée : table des recrues de l'ancienne app
  const rec = await supabase.from('recruits').select('id,ville').eq('name', f.nom)
  if (rec.error) throw new ErreurEnregistrement(rec.error.message)
  if (rec.data?.length) {
    const r = await supabase.from('recruits').update({ start: f.arrivee || null, ville: f.ville, ...(autreVille(rec.data[0].ville) ? sansPosition : {}) }).eq('name', f.nom)
    if (r.error) throw new ErreurEnregistrement(r.error.message)
  } else if (f.arrivee) {
    const r = await supabase.from('recruits').insert({ name: f.nom, start: f.arrivee, ville: f.ville, color: '#4caf50' })
    if (r.error) throw new ErreurEnregistrement(r.error.message)
  }
  // Un Coach recréé ne doit plus être masqué
  const del = await lireCle<string[]>('cs_deletes', [])
  if (del.valeur.includes(f.nom)) await ecrireCle('cs_deletes', del.valeur.filter((n) => n !== f.nom), del.existe)
}

// Supprime la fiche du Coach ; l'historique des magasins est conservé
export async function supprimerCoach(nom: string) {
  for (const table of ['cs_overrides', 'recruits'] as const) {
    const colonne = table === 'cs_overrides' ? 'cs_name' : 'name'
    const r = await supabase.from(table).delete().eq(colonne, nom)
    if (r.error) throw new ErreurEnregistrement(r.error.message)
  }
  const del = await lireCle<string[]>('cs_deletes', [])
  if (!del.valeur.includes(nom)) await ecrireCle('cs_deletes', [...del.valeur, nom], del.existe)
  await supprimerFichePersonne({ type: 'coach', cle: nom })
}

// ── Renommages : le nom sert de lien entre les tables, on le change partout ──

async function renommerColonne(table: string, colonne: string, ancien: string, nouveau: string) {
  const r = await supabase.from(table).update({ [colonne]: nouveau }).eq(colonne, ancien)
  // Une table absente (fonction pas encore utilisée) n'empêche pas le renommage
  if (r.error && !/does not exist|schema cache/i.test(r.error.message)) throw new ErreurEnregistrement(r.error.message)
}

export async function renommerCoach(ancien: string, nouveau: string) {
  await renommerColonne('reassigns', 'cs', ancien, nouveau)
  await renommerColonne('cs_overrides', 'cs_name', ancien, nouveau)
  await renommerColonne('recruits', 'name', ancien, nouveau)
  await renommerColonne('leaves', 'person', ancien, nouveau)
  await renommerVisiteur(ancien, nouveau)
  await modifierConfigRR((c) => {
    c.dr_assigns?.forEach((a) => { if (a.cs === ancien) a.cs = nouveau })
    if (c.cs_dr?.[ancien]) { c.cs_dr[nouveau] = c.cs_dr[ancien]; delete c.cs_dr[ancien] }
  })
  // L'ancien nom peut exister dans le fichier de base de l'ancienne app : on le masque
  const del = await lireCle<string[]>('cs_deletes', [])
  await ecrireCle('cs_deletes', [...del.valeur.filter((n) => n !== nouveau && n !== ancien), ancien], del.existe)
  await deplacerFichePersonne({ type: 'coach', cle: ancien }, { type: 'coach', cle: nouveau })
  await renommerAccesCoach(ancien, nouveau).catch(() => undefined)
}

// Une visite peut avoir plusieurs participants : le nom est remplacé dans chaque liste
export async function renommerVisiteur(ancien: string, nouveau: string) {
  await renommerColonne('visits', 'visitor', ancien, nouveau)
  const lu = await supabase.from('visits').select('id,visitor').like('visitor', `%${ancien}%`)
  if (lu.error) return
  for (const v of (lu.data ?? []) as { id: number; visitor: string | null }[]) {
    const noms = lireVisiteurs(v.visitor ?? '')
    if (noms.length < 2 || !noms.includes(ancien)) continue
    const visitor = noms.map((n) => (n === ancien ? nouveau : n)).filter((n, i, t) => t.indexOf(n) === i).join(SEPARATEUR_VISITEURS)
    verifier(await supabase.from('visits').update({ visitor }).eq('id', v.id))
  }
}

// ── Fiches personnelles (Directeur, Responsables Régionaux, Coachs, franchisés) ──

// Seules les fiches modifiées sont réécrites dans la table ; sans la table (0015 pas encore passée), toute la clé d'app_config
function modifierFiches(changer: (f: Record<string, Partial<FichePersonnelle>>) => void) {
  return enFile(async () => {
    if (fichesEnTable === null) {
      const essai = await supabase.from('fiches_personnes').select('cle').limit(1)
      if (essai.error && !absente(essai.error.message)) throw new ErreurEnregistrement(essai.error.message)
      fichesEnTable = !essai.error
    }
    if (!fichesEnTable) {
      const { valeur, existe } = await lireCle<Record<string, Partial<FichePersonnelle>>>('fiches_personnes', {})
      changer(valeur)
      return ecrireCle('fiches_personnes', valeur, existe)
    }
    const lu = await toutLire(() => supabase.from('fiches_personnes').select('cle,fiche').order('cle'))
    if (lu.error) throw new ErreurEnregistrement(lu.error.message)
    const avant = new Map(lu.data.map((l) => [String(l.cle), JSON.stringify(l.fiche)]))
    const valeur = Object.fromEntries(lu.data.map((l) => [String(l.cle), l.fiche as Partial<FichePersonnelle>]))
    changer(valeur)
    const changes = Object.entries(valeur).filter(([k, f]) => avant.get(k) !== JSON.stringify(f)).map(([cle, fiche]) => ({ cle, fiche, maj_le: new Date().toISOString() }))
    const retirees = [...avant.keys()].filter((k) => !(k in valeur))
    if (changes.length) verifier(await supabase.from('fiches_personnes').upsert(changes, { onConflict: 'cle' }))
    if (retirees.length) verifier(await supabase.from('fiches_personnes').delete().in('cle', retirees))
  })
}

export function enregistrerFichePersonne(r: RefPersonne, f: FichePersonnelle) {
  const propre = Object.fromEntries(Object.keys(ficheVide()).map((k) => [k, String(f[k as keyof FichePersonnelle] ?? '').trim()])) as unknown as FichePersonnelle
  return modifierFiches((v) => { v[cleFiche(r)] = propre })
}
export function supprimerFichePersonne(r: RefPersonne) {
  return modifierFiches((v) => { delete v[cleFiche(r)] })
}
function deplacerFichePersonne(de: RefPersonne, vers: RefPersonne) {
  return modifierFiches((v) => {
    const a = cleFiche(de), b = cleFiche(vers)
    if (a !== b && v[a]) { v[b] = v[a]; delete v[a] }
  })
}

// Franchisé : son nom est inscrit sur chacun de ses magasins (colonne resp, partagée avec l'ancienne app)
async function surchargerMagasin(magasin: string, champs: Record<string, unknown>) {
  const ex = await supabase.from('store_overrides').select('store_name').eq('store_name', magasin)
  if (ex.error) throw new ErreurEnregistrement(ex.error.message)
  const l = { ...champs, updated_at: new Date().toISOString() }
  verifier(ex.data?.length
    ? await supabase.from('store_overrides').update(l).eq('store_name', magasin)
    : await supabase.from('store_overrides').insert({ store_name: magasin, ...l }))
}

// Situations datées du magasin (Directeur seul, règles de store_overrides) : la liste entière est réécrite.
// Base sans la colonne (0033 pas passée) : « base » pour un message qui le dit sans erreur technique
export async function enregistrerSituations(magasin: string, situations: Situation[]): Promise<'ok' | 'base' | 'echec'> {
  try {
    await surchargerMagasin(magasin, { situations })
    return 'ok'
  } catch (e) {
    return e instanceof ErreurEnregistrement && /situations|column/i.test(e.message) ? 'base' : 'echec'
  }
}

// Actions hors visite : relues puis réécrites (une liste par magasin)
function modifierActionsLibres(changer: (t: Record<string, ActionLibre[]>) => void) {
  return enFile(async () => {
    const lu = await lireSuivi<unknown>('actions', {})
    const { valeur } = lu
    const t = normaliserActionsLibres(valeur)
    changer(t)
    for (const k of Object.keys(t)) if (!t[k].length) delete t[k]
    await ecrireSuivi('actions', t, lu)
  })
}
// Renvoie l'identifiant de la tâche (créé pour une nouvelle)
export async function enregistrerActionLibre(magasin: string, a: Omit<ActionLibre, 'id'> & { id?: string }): Promise<string> {
  const id = a.id || `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  await modifierActionsLibres((t) => {
    const l = t[magasin] ?? (t[magasin] = [])
    const i = a.id ? l.findIndex((x) => x.id === a.id) : -1
    const propre: ActionLibre = { ...a, id }
    if (!propre.faite) { delete propre.faite; delete propre.faitePar }
    if (i >= 0) l[i] = propre
    else l.push(propre)
  })
  return id
}
export function supprimerActionLibre(magasin: string, id: string) {
  return modifierActionsLibres((t) => { t[magasin] = (t[magasin] ?? []).filter((x) => x.id !== id) })
}

// Associés d'un magasin : la liste est réécrite ; le premier associé en place d'un franchisé est inscrit sur le magasin
function modifierAssocies(changer: (a: Associes) => void) {
  return enFile(async () => {
    const lu = await lireSuivi<unknown>('associes', {})
    const { valeur } = lu
    const a = normaliserAssocies(valeur)
    changer(a)
    for (const k of Object.keys(a)) if (!a[k].length) delete a[k]
    await ecrireSuivi('associes', a, lu)
  })
}

// Liste relue au moment d'écrire (un import peut enchaîner plusieurs changements sur le même magasin)
export async function modifierAssociesMagasin(reseau: Reseau, magasin: string, changer: (l: Associe[]) => Associe[]) {
  const m = reseau.magasins.find((x) => x.nom === magasin)
  let liste: Associe[] = []
  await modifierAssocies((a) => {
    const base = a[magasin] ?? []
    const implicite = m?.franchise && m.responsable && !/recrutement/i.test(m.responsable.nom) && !base.some((x) => x.nom === m.responsable!.nom)
      ? [{ id: 'resp', nom: m.responsable.nom, entree: '', sortie: '', mandats: [] }] : []
    liste = changer([...implicite, ...base]).map((x, i) => ({ ...x, id: x.id === 'resp' || !x.id ? `as_${Date.now().toString(36)}_${i}${Math.random().toString(36).slice(2, 5)}` : x.id }))
    a[magasin] = liste
  })
  if (!m?.franchise) return
  const principal = liste.find((x) => !x.sortie || x.sortie > reseau.jour)?.nom ?? ''
  if (principal === (m.responsable?.nom ?? '') || (!principal && m.responsableARecruter)) return
  const fiche = principal ? reseau.personnes[cleFiche({ type: 'franchise', cle: principal })] ?? {} : {}
  await surchargerMagasin(magasin, { resp: principal, tel_resp: String(fiche.telephone ?? ''), email_resp: String(fiche.email ?? '') })
}
export const enregistrerAssocies = (reseau: Reseau, magasin: string, liste: Associe[]) => modifierAssociesMagasin(reseau, magasin, () => liste)

// Franchisé : inscrit sur un magasin sans franchisé, ou ajouté à ses associés ; sur un intégré, il devient le responsable
export async function enregistrerFranchise(nom: string, ancien: string | null, magasins: string[], anciensMagasins: string[], f: FichePersonnelle, reseau: Reseau) {
  const parNom = new Map(reseau.magasins.map((m) => [m.nom, m]))
  const coord = { tel_resp: f.telephone.trim(), email_resp: f.email.trim() }
  const assoc = normaliserAssocies((await lireSuivi<unknown>('associes', {})).valeur)
  for (const n of anciensMagasins.filter((x) => !magasins.includes(x))) {
    const m = parNom.get(n)
    const autres = (m ? associesEnPlace({ ...reseau, associes: assoc }, m) : []).filter((a) => a.nom !== ancien)
    // Une chaîne vide (et non null) efface bien la valeur venue du fichier de base de l'ancienne app
    if (!m || m.responsable?.nom === ancien) await surchargerMagasin(n, { resp: autres[0]?.nom ?? '', tel_resp: '', email_resp: '' })
  }
  for (const n of magasins) {
    const m = parNom.get(n)
    const resp = m?.responsable?.nom ?? ''
    const ajoute = m?.franchise && resp && resp !== ancien && resp !== nom
    if (!ajoute) await surchargerMagasin(n, { resp: nom, ...coord })
  }
  await modifierAssocies((a) => {
    for (const n of anciensMagasins.filter((x) => !magasins.includes(x))) a[n] = (a[n] ?? []).filter((x) => x.nom !== ancien)
    for (const l of Object.values(a)) for (const x of l) if (ancien && x.nom === ancien) x.nom = nom
    for (const n of magasins) {
      const m = parNom.get(n)
      const resp = m?.responsable?.nom ?? ''
      if (!m?.franchise || !resp || resp === ancien || resp === nom) continue
      const l = (a[n] ??= [])
      if (!l.some((x) => x.nom === resp)) l.unshift({ id: `as_${Date.now().toString(36)}_r`, nom: resp, entree: '', sortie: '', mandats: [] })
      if (!l.some((x) => x.nom === nom)) l.push({ id: `as_${Date.now().toString(36)}_${l.length}`, nom, entree: '', sortie: '', mandats: [] })
    }
  })
  if (ancien && ancien !== nom) await deplacerFichePersonne({ type: 'franchise', cle: ancien }, { type: 'franchise', cle: nom })
  await enregistrerFichePersonne({ type: 'franchise', cle: nom }, f)
  if (ancien && ancien !== nom) await renommerAcces(ancien, nom, magasins).catch(() => undefined)
}

export async function supprimerFranchise(nom: string, magasins: string[], reseau: Reseau) {
  for (const n of magasins) {
    const m = reseau.magasins.find((x) => x.nom === n)
    if (m && m.responsable?.nom !== nom) continue
    const suivant = m ? associesEnPlace(reseau, m).find((a) => a.nom !== nom)?.nom ?? '' : ''
    await surchargerMagasin(n, { resp: suivant, tel_resp: '', email_resp: '' })
  }
  await modifierAssocies((a) => { for (const k of Object.keys(a)) a[k] = a[k].filter((x) => x.nom !== nom) })
  await supprimerFichePersonne({ type: 'franchise', cle: nom })
  await supprimerComptesDe(nom).catch(() => undefined)
}

// ── Magasins ──

export interface FicheMagasin {
  nom: string; code: string; departement: string; ouverture: string; franchise: boolean
  telephone: string; email: string; adresse: string; codePostal: string; ville: string; pays: string
  responsable: string; telResponsable: string; emailResponsable: string // coordonnées reprises de la fiche du franchisé
  rrDirect: string
  topographie: Topographie | ''
  figure: Figure | ''
}

function ligneSurcharge(f: FicheMagasin) {
  const v = (x: string) => x.trim() || null
  return {
    store_name: f.nom, open_date: v(f.ouverture), dept: v(f.departement), tel: v(f.telephone), email_mag: v(f.email),
    // Adjoint et plateforme logistique ne sont plus affichés : leurs valeurs en base restent intactes
    resp: f.responsable.trim(), tel_resp: f.telResponsable.trim(), email_resp: f.emailResponsable.trim(),
    addr: v(f.adresse), code: v(f.code), updated_at: new Date().toISOString(),
    cp: v(f.codePostal), ville: v(f.ville), franchise: f.franchise, rr: v(f.rrDirect), pays: v(f.pays),
    topographie: f.topographie || null, figure: f.figure || null,
  }
}

type MagasinStocke = Record<string, unknown> & { n: string }

export async function enregistrerMagasin(f: FicheMagasin, ancienNom: string | null) {
  const adds = await lireCle<MagasinStocke[]>('store_adds', [])
  if (ancienNom === null) {
    // Création : le magasin rejoint la liste partagée avec l'ancienne app, avec le code suivant s'il n'en a pas
    if (!f.code.trim()) f = { ...f, code: prochainCode(adds.valeur.map((x) => String(x.code ?? ''))) }
    adds.valeur.push({ n: f.nom, open: f.ouverture || '2027-01-01', dept: f.departement, franchise: f.franchise, ville: f.ville, cp: f.codePostal, addr: f.adresse, code: f.code })
    await ecrireCle('store_adds', adds.valeur, adds.existe)
  } else if (ancienNom !== f.nom) {
    const m = adds.valeur.find((x) => x.n === ancienNom)
    if (m) { m.n = f.nom; await ecrireCle('store_adds', adds.valeur, adds.existe) }
    await renommerColonne('store_overrides', 'store_name', ancienNom, f.nom)
    await renommerColonne('reassigns', 'store', ancienNom, f.nom)
    await renommerColonne('visits', 'store', ancienNom, f.nom)
    // Fil de messages (fonction absente : messagerie pas encore activée)
    await supabase.rpc('renommer_magasin_messages', { p_ancien: ancienNom, p_nouveau: f.nom }).then(() => undefined, () => undefined)
    await renommerColonne('store_finance', 'store_name', ancienNom, f.nom)
    const bp = await lireCle<BonnePratique[]>('bonnes_pratiques', [])
    if (bp.valeur.some((p) => p.magasin === ancienNom || p.reprises?.includes(ancienNom))) {
      await ecrireCle('bonnes_pratiques', bp.valeur.map((p) => ({ ...p, magasin: p.magasin === ancienNom ? f.nom : p.magasin, reprises: (p.reprises ?? []).map((r) => (r === ancienNom ? f.nom : r)) })), bp.existe)
    }
    const cp = await lireSuivi<Campagnes>('campagnes', { liste: [], constats: {} })
    const constats = Object.values(cp.valeur.constats ?? {})
    if (constats.some((k) => ancienNom in k) || (cp.valeur.liste ?? []).some((c) => c.magasins?.includes(ancienNom))) {
      for (const k of constats) if (ancienNom in k) { k[f.nom] = k[ancienNom]; delete k[ancienNom] }
      for (const c of cp.valeur.liste ?? []) c.magasins = (c.magasins ?? []).map((n) => (n === ancienNom ? f.nom : n))
      await ecrireSuivi('campagnes', cp.valeur, cp)
    }
    const regions = await supabase.from('campagnes_regions').select('id,valeur')
    for (const l of regions.error ? [] : regions.data ?? []) {
      const v = l.valeur as Campagne | null
      if (v?.magasins?.includes(ancienNom)) verifier(await supabase.from('campagnes_regions').update({ valeur: { ...v, magasins: v.magasins.map((n) => (n === ancienNom ? f.nom : n)) } }).eq('id', l.id))
    }
    for (const cleConfig of ['sante_parc', 'deploiements', 'notes_magasins', 'audits', 'associes', 'actions', 'preparations_visites'] as const) {
      const lu = await lireSuivi<Record<string, unknown>>(cleConfig, {})
      const cibles = (cleConfig === 'deploiements' ? [lu.valeur.valeurs, lu.valeur.journal] : [lu.valeur]) as (Record<string, unknown> | undefined)[]
      let change = false
      for (const cible of cibles) if (cible && ancienNom in cible) { cible[f.nom] = cible[ancienNom]; delete cible[ancienNom]; change = true }
      if (change) await ecrireSuivi(cleConfig, lu.valeur, lu)
    }
  }
  const ligne = ligneSurcharge(f)
  const ex = await supabase.from('store_overrides').select('store_name').eq('store_name', f.nom)
  if (ex.error) throw new ErreurEnregistrement(ex.error.message)
  const ecrire = (l: Record<string, unknown>) => ex.data?.length
    ? supabase.from('store_overrides').update(l).eq('store_name', f.nom)
    : supabase.from('store_overrides').insert(l)
  let res = await ecrire(ligne)
  if (res.error) {
    // Base sans la figure du blason (migration 0032 pas encore passée) : la forme et le reste de la fiche sont enregistrés
    const { figure: _fg, ...sansFigure } = ligne
    res = await ecrire(sansFigure)
  }
  if (res.error) {
    // Base sans la colonne du blason (migration 0031 pas encore passée) : le reste de la fiche est enregistré
    const { topographie: _t, figure: _fg, ...sansBlason } = ligne
    res = await ecrire(sansBlason)
  }
  if (res.error) {
    // Base plus ancienne sans les colonnes d'adresse détaillée : on enregistre l'essentiel, comme l'ancienne app
    const { cp: _cp, ville: _v, franchise: _f, rr: _r, pays: _p, topographie: _t2, figure: _fg2, ...essentiel } = ligne
    res = await ecrire(essentiel)
  }
  if (res.error) throw new ErreurEnregistrement(res.error.message)
}

// Code magasin sur 3 chiffres (Joseph, 24/10/2026) : clé des imports et exports à la place du nom.
// Jamais réutilisé : le suivant prend le plus grand code numérique connu + 1
export const formatCode = (n: number) => String(n).padStart(3, '0')
export function prochainCode(codes: string[]) {
  const max = Math.max(0, ...codes.filter((c) => /^\d+$/.test(c)).map(Number))
  return formatCode(max + 1)
}

// Magasins sans code (noms à jour, dans l'ordre d'attribution voulu) : codes suivants, écrits dans la liste des magasins.
// Relue juste avant l'écriture : un code posé entre-temps par un autre appareil est gardé. Renvoie le nombre de codes posés
export async function attribuerCodes(manquants: string[], codesPris: string[]): Promise<number> {
  if (!manquants.length) return 0
  return enFile(async () => {
    const adds = await lireCle<MagasinStocke[]>('store_adds', [])
    const renommages = (await lireCle<Record<string, string>>('store_renames', {})).valeur
    const nomActuel = (n: string) => renommages[n] || n
    const codes = [...codesPris, ...adds.valeur.map((x) => String(x.code ?? ''))]
    let n = 0
    for (const nom of manquants) {
      const m = adds.valeur.find((x) => nomActuel(x.n) === nom || x.n === nom)
      if (!m || String(m.code ?? '').trim()) continue
      m.code = prochainCode(codes)
      codes.push(String(m.code))
      n++
    }
    if (n) await ecrireCle('store_adds', adds.valeur, adds.existe)
    return n
  })
}

export async function supprimerMagasin(nom: string) {
  const adds = await lireCle<MagasinStocke[]>('store_adds', [])
  if (adds.valeur.some((x) => x.n === nom)) await ecrireCle('store_adds', adds.valeur.filter((x) => x.n !== nom), adds.existe)
  const del = await lireCle<string[]>('store_deletes', [])
  if (!del.valeur.includes(nom)) await ecrireCle('store_deletes', [...del.valeur, nom], del.existe)
  for (const [table, colonne] of [['store_overrides', 'store_name'], ['reassigns', 'store']] as const) {
    const r = await supabase.from(table).delete().eq(colonne, nom)
    if (r.error) throw new ErreurEnregistrement(r.error.message)
  }
}

// ── Visites, événements ──

function verifier(r: { error: { message: string } | null }) { if (r.error) throw new ErreurEnregistrement(r.error.message) }

// Renvoie les identifiants des visites enregistrées
export async function enregistrerVisites(base: Omit<Visite, 'magasin' | 'id'>, magasins: string[], id: number | null): Promise<number[]> {
  const ligne = (magasin: string) => ({
    group_id: base.groupe || null, store: magasin, visit_date: base.date, type: base.type, visitor: base.visiteurs.join(SEPARATEUR_VISITEURS) || null,
    signed_required: base.signatureRequise, signed_url: base.lienSigne || null, signed_date: base.dateSignature || null,
    docs: [...base.documents.filter((d) => d.url.trim()), ...(base.photos ?? []).map((p) => ({ label: 'Photo', url: '', chemin: p.chemin, taille: p.taille }))], notes: base.notes || null,
    sections: base.parties.some((x) => x.trim()) ? base.parties.map((x) => x.trim()) : null, action_plan: base.plan.filter((a) => a.action.trim()).map((a, i) => ({ ...a, id: a.id || `a_${Date.now().toString(36)}_${i}` })),
    prevue: !!base.prevue,
  })
  return avecPrevue(async (sans) => {
    const l = (m: string) => { const x: Record<string, unknown> = ligne(m); if (sans) delete x.prevue; return x }
    if (id !== null) { const r = await supabase.from('visits').update(l(magasins[0])).eq('id', id); return { error: r.error, ids: [id] } }
    const r = await supabase.from('visits').insert(magasins.map(l)).select('id')
    return { error: r.error, ids: ((r.data ?? []) as { id: unknown }[]).map((x) => Number(x.id)).filter(Boolean) }
  })
}
// Base pas encore passée en 0017 : la colonne prevue manque, la visite s'enregistre sans elle
async function avecPrevue(f: (sans: boolean) => Promise<{ error: { message: string } | null; ids: number[] }>): Promise<number[]> {
  let r = await f(false)
  if (r.error && /prevue/.test(r.error.message)) r = await f(true)
  verifier(r)
  return r.ids
}
// Visite planifiée confirmée faite, sans compte rendu
export async function marquerVisiteFaite(id: number) { verifier(await supabase.from('visits').update({ prevue: false }).eq('id', id)) }
// Import d'un classeur de suivi : visites terrain par paquets, puis notes d'audit rangées à la date choisie
export async function importerVisites(visites: { magasin: string; date: string; visiteurs: string[]; notes: string; type?: string }[], audits: { magasin: string; type: string; score: number; date?: string }[], dateAudits: string) {
  const lignes = visites.map((v) => ({
    group_id: null, store: v.magasin, visit_date: v.date, type: v.type ?? 'terrain', visitor: v.visiteurs.join(SEPARATEUR_VISITEURS) || null,
    signed_required: false, signed_url: null, signed_date: null, docs: [], notes: v.notes || null, sections: null, action_plan: [],
  }))
  for (let i = 0; i < lignes.length; i += 200) verifier(await supabase.from('visits').insert(lignes.slice(i, i + 200)))
  if (!audits.length) return
  await enFile(async () => {
    const lu = await lireSuivi<Audits>('audits', {})
    const { valeur } = lu
    for (const a of audits) {
      const date = a.date ?? dateAudits
      const liste = (valeur[a.magasin] ?? []).filter((x) => !(x.date === date && x.type === a.type))
      valeur[a.magasin] = [...liste, { date, type: a.type, conforme: null, score: a.score }].sort((x, y) => x.date.localeCompare(y.date))
    }
    await ecrireSuivi('audits', valeur, lu)
  })
}
// Actions marquées faites (date) ou remises en cours ('') : celles d'un plan sont relues puis réécrites visite par visite,
// celles ajoutées hors visite (libre = id) dans la clé actions
// par : nom de la personne qui coche l'action faite
export async function marquerActions(lot: ({ visite: number; index: number; faite: string } | { libre: string; magasin: string; faite: string })[], par = '') {
  const marquer = (a: ActionPlan, faite: string) => {
    if (faite) { a.faite = faite; if (par) a.faitePar = par; else delete a.faitePar }
    else { delete a.faite; delete a.faitePar }
  }
  const libres = lot.filter((l) => 'libre' in l)
  if (libres.length) {
    await modifierActionsLibres((t) => {
      for (const l of libres) {
        const a = t[l.magasin]?.find((x) => x.id === l.libre)
        if (a) marquer(a, l.faite)
      }
    })
  }
  const plans = lot.filter((l) => 'visite' in l)
  for (const id of [...new Set(plans.map((l) => l.visite))]) {
    const lu = await supabase.from('visits').select('id,action_plan').eq('id', id)
    if (lu.error) throw new ErreurEnregistrement(lu.error.message)
    const plan = normaliserPlan(lu.data?.[0]?.action_plan)
    for (const l of plans.filter((x) => x.visite === id)) {
      const a = plan[l.index]
      if (a) marquer(a, l.faite)
    }
    verifier(await supabase.from('visits').update({ action_plan: plan }).eq('id', id))
  }
}
// Plan d'action d'une visite réécrit en entier (import Excel des tâches)
export async function modifierPlanVisite(id: number, plan: ActionPlan[]) { verifier(await supabase.from('visits').update({ action_plan: plan }).eq('id', id)) }
export async function supprimerVisite(id: number) { verifier(await supabase.from('visits').delete().eq('id', id)) }

// Renvoie le numéro de l'événement (null si la base ne le donne pas)
export async function enregistrerEvenement(e: Evenement): Promise<number | null> {
  // invites, heure et contenu seulement s'ils sont donnés : un événement simple s'enregistre aussi sur une base d'avant 0025 ou 0030
  const l = {
    title: e.titre, type: e.type, start_date: e.debut, end_date: e.fin || null, notes: e.notes || null, color: e.couleur,
    ...(e.invites ? { invites: e.invites.length ? e.invites : null } : {}),
    ...(e.heure !== undefined ? { heure: e.heure || null } : {}), ...(e.html !== undefined ? { html: e.html || null } : {}),
  }
  if (e.id !== null) { verifier(await supabase.from('events').update(l).eq('id', e.id)); return e.id }
  const r = await supabase.from('events').insert(l).select('id')
  verifier(r)
  return Number((r.data as { id?: unknown }[] | null)?.[0]?.id) || null
}
export async function supprimerEvenement(id: number) { verifier(await supabase.from('events').delete().eq('id', id)) }
// Visite prévue glissée à une autre date dans l'agenda : seule la date change
export async function deplacerVisite(id: number, date: string) { verifier(await supabase.from('visits').update({ visit_date: date }).eq('id', id)) }

// ── Santé du parc et déploiements (relus puis réécrits pour ne rien écraser) ──

// Les écritures sur app_config passent une par une : deux saisies rapides ne s'écrasent plus
let file: Promise<unknown> = Promise.resolve()
function enFile<T>(f: () => Promise<T>): Promise<T> {
  const p = file.then(f, f)
  file = p.catch(() => undefined)
  return p
}

export function enregistrerEvaluations(lot: { magasin: string; e: Evaluation }[]) {
  return enFile(async () => {
    const lu = await lireSuivi<Evaluations>('sante_parc', {})
    const { valeur } = lu
    for (const { magasin, e } of lot) valeur[magasin] = avecPoint(valeur[magasin], e)
    await ecrireSuivi('sante_parc', valeur, lu)
  })
}
// Supprime la note nine box d'un magasin à une date (comme une visite) ; sans autre saisie, le magasin redevient non classé
export function supprimerEvaluation(magasin: string, date: string) {
  return enFile(async () => {
    const lu = await lireSuivi<Evaluations>('sante_parc', {})
    const { valeur } = lu
    const e = sansPoint(valeur[magasin], date)
    if (e) valeur[magasin] = e
    else delete valeur[magasin]
    await ecrireSuivi('sante_parc', valeur, lu)
  })
}
// Efface toutes les notes nine box (une copie est gardée sous une autre clé, que l'app ne lit pas)
export function effacerToutesEvaluations() {
  return enFile(async () => {
    const lu = await lireSuivi<Evaluations>('sante_parc', {})
    const { valeur } = lu
    const copie = await lireSuivi<Evaluations>('sante_parc_sauvegarde', {})
    await ecrireSuivi('sante_parc_sauvegarde', valeur, copie)
    await ecrireSuivi('sante_parc', {}, lu)
  })
}
// Import d'un historique : plusieurs lignes datées par magasin, une seule par jour
export function importerHistorique(points: { magasin: string; date: string; notes: Partial<Record<IdCritere, Note>> }[], par: string) {
  return enFile(async () => {
    const lu = await lireSuivi<Evaluations>('sante_parc', {})
    const { valeur } = lu
    for (const p of [...points].sort((a, b) => a.date.localeCompare(b.date))) {
      // Les critères absents de la ligne reprennent leur valeur en vigueur à cette date
      const e: Evaluation = { notes: { ...notesAu(valeur[p.magasin], p.date), ...p.notes }, date: p.date, par }
      valeur[p.magasin] = avecPoint(valeur[p.magasin], e)
    }
    await ecrireSuivi('sante_parc', valeur, lu)
  })
}

// Grille de la nine box (critères, poids, seuils) : la case de chaque magasin est recalculée au chargement
export function enregistrerGrille(g: GrilleNineBox, jour: string) {
  return enFile(async () => {
    const { existe } = await lireCle<unknown>('grille_ninebox', null)
    await ecrireCle('grille_ninebox', { ...g, modifieLe: jour }, existe)
  })
}

export const enregistrerEvaluation = (magasin: string, e: Evaluation) => enregistrerEvaluations([{ magasin, e }])

function modifierDeploiements(changer: (d: Deploiements) => void) {
  return enFile(async () => {
    const lu = await lireSuivi<Partial<Deploiements>>('deploiements', {})
    const { valeur } = lu
    const d: Deploiements = { thematiques: valeur.thematiques?.length ? valeur.thematiques : thematiquesParDefaut, valeurs: valeur.valeurs ?? {}, journal: valeur.journal ?? {} }
    changer(d)
    await ecrireSuivi('deploiements', d, lu)
  })
}

// Chaque changement est daté ; à date égale le dernier remplace le précédent ; l'état actuel est le plus récent
export function enregistrerDeploiements(lot: { magasin: string; thematique: string; etat: string; date?: string }[], date: string) {
  return modifierDeploiements((d) => {
    for (const { magasin, thematique, etat, date: dateLigne } of lot) {
      const quand = dateLigne || date
      const avant = (d.journal![magasin] ?? []).filter((c) => c.thematique === thematique && c.date < quand).at(-1)
      const apres = (d.journal![magasin] ?? []).some((c) => c.thematique === thematique && c.date > quand)
      if (avant?.etat === etat && !apres && (d.valeurs[magasin]?.[thematique] ?? '') === etat) continue // rien ne change
      const j = [...(d.journal![magasin] ?? []).filter((c) => !(c.date === quand && c.thematique === thematique)), { date: quand, thematique, etat }]
        .sort((a, b) => a.date.localeCompare(b.date))
      d.journal![magasin] = j
      if (j.filter((c) => c.thematique === thematique).at(-1)?.date !== quand) continue // un changement plus récent existe déjà
      d.valeurs[magasin] = { ...(d.valeurs[magasin] ?? {}) }
      if (etat) d.valeurs[magasin][thematique] = etat
      else delete d.valeurs[magasin][thematique]
    }
  })
}
export const enregistrerDeploiement = (magasin: string, thematique: string, etat: string, date: string) => enregistrerDeploiements([{ magasin, thematique, etat }], date)

export async function enregistrerThematiques(thematiques: Thematique[]) {
  await modifierDeploiements((d) => {
    d.thematiques = thematiques
    const ids = new Set(thematiques.map((t) => t.id))
    for (const m of Object.keys(d.valeurs)) for (const k of Object.keys(d.valeurs[m])) if (!ids.has(k)) delete d.valeurs[m][k]
    for (const m of Object.keys(d.journal ?? {})) d.journal![m] = d.journal![m].filter((c) => ids.has(c.thematique))
  })
}

// ── Notes libres datées du journal d'un magasin ──
export function enregistrerNoteMagasin(magasin: string, note: NoteMagasin) {
  return enFile(async () => {
    const lu = await lireSuivi<Record<string, NoteMagasin[]>>('notes_magasins', {})
    const { valeur } = lu
    const liste = (valeur[magasin] ?? []).filter((n) => n.id !== note.id)
    valeur[magasin] = [...liste, note].sort((a, b) => a.date.localeCompare(b.date))
    await ecrireSuivi('notes_magasins', valeur, lu)
  })
}
export function supprimerNoteMagasin(magasin: string, id: string) {
  return enFile(async () => {
    const lu = await lireSuivi<Record<string, NoteMagasin[]>>('notes_magasins', {})
    const { valeur } = lu
    valeur[magasin] = (valeur[magasin] ?? []).filter((n) => n.id !== id)
    if (!valeur[magasin].length) delete valeur[magasin]
    await ecrireSuivi('notes_magasins', valeur, lu)
  })
}

// ── Préparation de la prochaine visite d'un magasin (notes et heure), retirée si tout est vide ──
export function enregistrerPreparation(magasin: string, preparation: PreparationVisite | null) {
  return enFile(async () => {
    const lu = await lireSuivi<Record<string, PreparationVisite>>('preparations_visites', {})
    const { valeur } = lu
    if (preparation && (preparation.notes.trim() || preparation.heure)) valeur[magasin] = { ...preparation, notes: preparation.notes.trim() }
    else delete valeur[magasin]
    await ecrireSuivi('preparations_visites', valeur, lu)
  })
}

// ── Chiffres mensuels (store_finance) : une ligne par magasin et par mois ──
// Seules les colonnes fournies sont écrites : un import sans marge ne l'efface pas
export async function enregistrerChiffres(lignes: (Partial<ChiffreMois> & { magasin: string; mois: string })[]) {
  const groupes = new Map<string, Record<string, unknown>[]>()
  for (const l of lignes) {
    const ligne: Record<string, unknown> = { store_name: l.magasin, month: `${l.mois}-01`, updated_at: new Date().toISOString() }
    for (const [id, col] of Object.entries(colonnesChiffres) as [keyof typeof colonnesChiffres, string][]) if (l[id] !== undefined) ligne[col] = l[id]
    const cle = Object.keys(ligne).join(',')
    groupes.set(cle, [...(groupes.get(cle) ?? []), ligne])
  }
  for (const g of groupes.values()) {
    for (let i = 0; i < g.length; i += 500) verifier(await supabase.from('store_finance').upsert(g.slice(i, i + 500), { onConflict: 'store_name,month' }))
  }
}

export async function supprimerChiffres(magasin: string, mois: string) {
  verifier(await supabase.from('store_finance').delete().eq('store_name', magasin).eq('month', `${mois}-01`))
}

// Résultat d'un audit, rattaché au magasin, à la date et au type de la visite
export function enregistrerAudit(magasin: string, ancien: { date: string; type: string } | null, audit: ResultatAudit | null) {
  return enFile(async () => {
    const lu = await lireSuivi<Audits>('audits', {})
    const { valeur } = lu
    const garde = (a: ResultatAudit) => !(ancien && a.date === ancien.date && a.type === ancien.type) && !(audit && a.date === audit.date && a.type === audit.type)
    const liste = [...(valeur[magasin] ?? []).filter(garde), ...(audit ? [audit] : [])].sort((a, b) => a.date.localeCompare(b.date))
    if (liste.length) valeur[magasin] = liste
    else delete valeur[magasin]
    await ecrireSuivi('audits', valeur, lu)
  })
}

// Grilles d'audit construites dans Paramètres
export function enregistrerGrilles(grilles: Grilles) {
  return enFile(async () => {
    const { existe } = await lireCle<Grilles>('grilles_audit', {})
    await ecrireCle('grilles_audit', grilles, existe)
  })
}

// Bonne pratique ajoutée, modifiée (même id) ou supprimée (null)
export function enregistrerPratique(id: string, pratique: BonnePratique | null) {
  return enFile(async () => {
    const { valeur, existe } = await lireCle<BonnePratique[]>('bonnes_pratiques', [])
    const liste = valeur.filter((p) => p.id !== id)
    // Les réactions ne passent pas par la fenêtre de modification : on garde celles déjà enregistrées
    const jaime = valeur.find((p) => p.id === id)?.jaime ?? []
    await ecrireCle('bonnes_pratiques', pratique ? [{ ...pratique, jaime }, ...liste] : liste, existe)
  })
}

// « J'aime » d'une personne de l'équipe sur une bonne pratique : ajouté ou retiré
export function basculerJaime(id: string, nom: string) {
  return enFile(async () => {
    const { valeur, existe } = await lireCle<BonnePratique[]>('bonnes_pratiques', [])
    await ecrireCle('bonnes_pratiques', valeur.map((p) => {
      if (p.id !== id) return p
      const jaime = p.jaime ?? []
      return { ...p, jaime: jaime.includes(nom) ? jaime.filter((n) => n !== nom) : [...jaime, nom] }
    }), existe)
  })
}

// ── Campagnes : liste et constats par magasin (app_config, clé campagnes) ──
function modifierCampagnes(changer: (c: Campagnes) => void) {
  return enFile(async () => {
    const lu = await lireSuivi<unknown>('campagnes', {})
    const { valeur } = lu
    const c = normaliserCampagnes(valeur)
    changer(c)
    await ecrireSuivi('campagnes', c, lu)
  })
}

// Campagne ajoutée ou modifiée (même id) ; null la supprime avec ses constats.
// Une campagne régionale est rangée à part (table campagnes_regions), écrite par son Responsable Régional.
export async function enregistrerCampagne(id: string, campagne: Campagne | null, regionale = false) {
  if (regionale) {
    verifier(campagne
      ? await supabase.from('campagnes_regions').upsert({ id, rr: campagne.rr, valeur: campagne, maj_le: new Date().toISOString() })
      : await supabase.from('campagnes_regions').delete().eq('id', id))
  }
  return modifierCampagnes((c) => {
    if (!campagne) { c.liste = c.liste.filter((x) => x.id !== id); delete c.constats[id]; return }
    if (!regionale) {
      const i = c.liste.findIndex((x) => x.id === id)
      if (i >= 0) c.liste[i] = campagne
      else c.liste.push(campagne)
    }
    // Points retirés : leurs constats disparaissent
    const ids = new Set(campagne.points.map((p) => p.id))
    for (const k of Object.values(c.constats[id] ?? {})) for (const p of Object.keys(k)) if (!ids.has(p)) delete k[p]
  })
}

// fait null : le point redevient à constater
export function enregistrerConstats(lot: { campagne: string; magasin: string; point: string; fait: boolean | null; date: string; par: string }[]) {
  return modifierCampagnes((c) => {
    for (const l of lot) {
      const parMagasin = (c.constats[l.campagne] ??= {})
      const k = (parMagasin[l.magasin] ??= {})
      if (l.fait === null) delete k[l.point]
      else k[l.point] = { fait: l.fait, date: l.date, par: l.par }
      if (!Object.keys(k).length) delete parMagasin[l.magasin]
    }
  })
}

// ── Sauvegarde complète : toutes les tables lues telles quelles ──
export const tablesSauvegardees = ['app_config', 'suivi_magasins', 'fiches_personnes', 'store_overrides', 'reassigns', 'cs_overrides', 'recruits', 'visits', 'leaves', 'events', 'store_finance', 'campagnes_regions'] as const

export async function lireSauvegarde(): Promise<Record<string, unknown[]>> {
  const tables: Record<string, unknown[]> = {}
  for (const t of tablesSauvegardees) {
    const lignes: unknown[] = []
    // Lecture par pages de 1 000 lignes (limite d'une réponse Supabase)
    for (let debut = 0; ; debut += 1000) {
      const r = await supabase.from(t).select('*').range(debut, debut + 999)
      if (r.error) {
        if (/does not exist|schema cache/i.test(r.error.message)) break // table jamais créée : rien à sauvegarder
        throw new ErreurEnregistrement(r.error.message)
      }
      lignes.push(...(r.data ?? []))
      if ((r.data ?? []).length < 1000) break
    }
    tables[t] = lignes
  }
  return tables
}

export function noterSauvegarde(date: string, par: string) {
  return enFile(async () => {
    const { existe } = await lireCle<unknown>('derniere_sauvegarde', {})
    await ecrireCle('derniere_sauvegarde', { date, par }, existe)
  })
}
