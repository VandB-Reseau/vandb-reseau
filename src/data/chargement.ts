import { supabase } from '../lib/supabase'
import { construireReseau, type DonneesBrutes, type Parametres } from './construction'
import { thematiquesParDefaut, type Deploiements, type Evaluation, type Evaluations, type Thematique } from './sante'
import type { Conge, Evenement, Reseau, Visite } from './modele'
import { cleFiche, ficheVide, franchises, libelleRole, type FichePersonnelle, type RefPersonne } from './personnes'

function json<T>(valeur: unknown, defaut: T): T {
  if (valeur === null || valeur === undefined) return defaut
  if (typeof valeur !== 'string') return valeur as T
  try { return JSON.parse(valeur) as T } catch { return defaut }
}

export class ErreurChargement extends Error {}

// Lit les tables Supabase partagées avec l'ancienne app (lecture seule)
export async function chargerReseau(jour = new Date().toISOString().slice(0, 10)): Promise<Reseau> {
  const [config, surcharges, affectations, coachs, recrues, visites, conges, evenements] = await Promise.all([
    supabase.from('app_config').select('key,value').in('key', ['store_adds', 'store_renames', 'drs_data', 'params', 'cs_deletes', 'sante_parc', 'deploiements', 'fiches_personnes']),
    supabase.from('store_overrides').select('*'),
    supabase.from('reassigns').select('store,cs,date,note,type').order('date'),
    supabase.from('cs_overrides').select('*'),
    supabase.from('recruits').select('*'),
    supabase.from('visits').select('*').order('visit_date', { ascending: false }),
    supabase.from('leaves').select('*').order('start_date'),
    supabase.from('events').select('*').order('start_date'),
  ])
  const erreur = config.error ?? surcharges.error ?? affectations.error ?? coachs.error
  if (erreur) throw new ErreurChargement(erreur.message)

  const cle = (k: string) => config.data?.find((r) => r.key === k)?.value
  const params = json<Partial<Parametres>>(cle('params'), {})
  const brutes: DonneesBrutes = {
    magasins: json(cle('store_adds'), []),
    renommages: json(cle('store_renames'), {}),
    surcharges: surcharges.data ?? [],
    affectations: affectations.data ?? [],
    configRR: json(cle('drs_data'), {}),
    coachs: coachs.data ?? [],
    coachsSupprimes: json<string[]>(cle('cs_deletes'), []),
    recrues: recrues.error ? [] : recrues.data ?? [],
    parametres: {
      prepDuration: Number(params.prepDuration) || 2, postDuration: Number(params.postDuration) || 4,
      maxUnits: Number(params.maxUnits) || 8, alertThreshold: Number(params.alertThreshold) || 7,
      poidsOuvert: params.poidsOuvert === undefined ? 1 : Number(params.poidsOuvert),
      poidsRenforce: params.poidsRenforce === undefined ? 2 : Number(params.poidsRenforce),
    },
  }
  const reseau = construireReseau(brutes, jour)
  // Santé du parc et déploiements : stockés dans app_config (aucune table à créer)
  reseau.evaluations = json<Evaluations>(cle('sante_parc'), {})
  const dep = json<Partial<Deploiements>>(cle('deploiements'), {})
  reseau.deploiements = { thematiques: dep.thematiques?.length ? dep.thematiques : thematiquesParDefaut, valeurs: dep.valeurs ?? {} }
  // Tables facultatives : absentes ou vides, l'app fonctionne quand même
  type L = Record<string, unknown>
  const t = (v: unknown) => (v === null || v === undefined ? '' : String(v))
  reseau.visites = ((visites.error ? [] : visites.data) as L[]).map((v) => ({
    id: Number(v.id) || null, groupe: t(v.group_id), magasin: t(v.store), date: t(v.visit_date).slice(0, 10), type: t(v.type) || 'terrain',
    visiteur: t(v.visitor), signatureRequise: !!v.signed_required, lienSigne: t(v.signed_url), dateSignature: t(v.signed_date).slice(0, 10),
    documents: Array.isArray(v.docs) ? (v.docs as { label?: string; url?: string }[]).map((d) => ({ label: t(d.label), url: t(d.url) })) : [], notes: t(v.notes),
  }))
  reseau.conges = ((conges.error ? [] : conges.data) as L[]).map((c) => ({
    id: Number(c.id) || null, personne: t(c.person), role: t(c.role) || 'cs', debut: t(c.start_date).slice(0, 10), fin: t(c.end_date).slice(0, 10) || t(c.start_date).slice(0, 10), notes: t(c.notes),
  }))
  reseau.evenements = ((evenements.error ? [] : evenements.data) as L[]).map((e) => ({
    id: Number(e.id) || null, titre: t(e.title), type: t(e.type) || 'event', debut: t(e.start_date).slice(0, 10), fin: t(e.end_date).slice(0, 10) || t(e.start_date).slice(0, 10), notes: t(e.notes), couleur: t(e.color) || '#7c3aed',
  }))
  // Anniversaires : naissance (fiches Coach et RR) et arrivée (recrues)
  const ann: Reseau['anniversaires'] = []
  for (const c of coachs.data ?? []) if (c.birth && !c.tech) ann.push({ nom: c.cs_name, role: 'Coach', date: t(c.birth).slice(0, 10), nature: 'naissance' })
  const cfgRR = json<{ drs?: { name: string; birth?: string; entry?: string }[] }>(cle('drs_data'), {})
  for (const r of cfgRR.drs ?? []) {
    if (r.birth) ann.push({ nom: r.name, role: 'Responsable Régional', date: r.birth.slice(0, 10), nature: 'naissance' })
    if (r.entry) ann.push({ nom: r.name, role: 'Responsable Régional', date: r.entry.slice(0, 10), nature: 'arrivee' })
  }
  for (const r of recrues.error ? [] : recrues.data ?? []) if (r.start && !reseau.equipe.find((c) => c.nom === r.name)?.fictif) ann.push({ nom: r.name, role: 'Coach', date: t(r.start).slice(0, 10), nature: 'arrivee' })
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

// Réaffecte un magasin à un Coach à partir d'une date (même format que l'ancienne app)
export async function reaffecter(magasin: string, coach: string, date: string, note: string): Promise<void> {
  const { error } = await supabase.from('reassigns').insert({ store: magasin, cs: coach, date, note, type: 'manual' })
  if (error) throw new ErreurEnregistrement(error.message)
}

// Met à jour quelques paramètres en conservant tous les autres réglages de l'ancienne app
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

// Relit drs_data, applique la modification et réécrit tout (les champs inconnus de la nouvelle app sont conservés)
async function modifierConfigRR(changer: (c: ConfigRRComplete) => void) {
  const { valeur, existe } = await lireCle<ConfigRRComplete>('drs_data', {})
  changer(valeur)
  await ecrireCle('drs_data', valeur, existe)
}

type RRComplet = { id: string; name: string; tel?: string; email?: string; color?: string; role?: string; [k: string]: unknown }
type ConfigRRComplete = { drs?: RRComplet[]; cs_dr?: Record<string, string>; dr_assigns?: { cs: string; dr: string; date: string }[]; directeur?: Record<string, unknown>; [k: string]: unknown }

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

// Rattache un Coach à un RR à partir d'une date (historique conservé, comme dans l'ancienne app)
export async function rattacherCoach(coach: string, rrId: string, date: string) {
  await modifierConfigRR((c) => {
    c.dr_assigns = (c.dr_assigns ?? []).filter((a) => !(a.cs === coach && a.date === date))
    c.dr_assigns.push({ cs: coach, dr: rrId, date })
    c.cs_dr = { ...(c.cs_dr ?? {}), [coach]: rrId }
  })
}

export interface FicheCoach { nom: string; telephone: string; email: string; ville: string; fictif: boolean; arrivee: string }
export async function enregistrerCoach(f: FicheCoach) {
  const ligne = { cs_name: f.nom, tel: f.telephone, email: f.email, ville: f.ville, fictif: f.fictif }
  const ex = await supabase.from('cs_overrides').select('cs_name').eq('cs_name', f.nom)
  if (ex.error) throw new ErreurEnregistrement(ex.error.message)
  const res = ex.data?.length
    ? await supabase.from('cs_overrides').update(ligne).eq('cs_name', f.nom)
    : await supabase.from('cs_overrides').insert(ligne)
  if (res.error) throw new ErreurEnregistrement(res.error.message)
  // Date d'arrivée : table des recrues de l'ancienne app
  const rec = await supabase.from('recruits').select('id').eq('name', f.nom)
  if (rec.error) throw new ErreurEnregistrement(rec.error.message)
  if (rec.data?.length) {
    const r = await supabase.from('recruits').update({ start: f.arrivee || null, ville: f.ville }).eq('name', f.nom)
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
  await renommerColonne('visits', 'visitor', ancien, nouveau)
  await modifierConfigRR((c) => {
    c.dr_assigns?.forEach((a) => { if (a.cs === ancien) a.cs = nouveau })
    if (c.cs_dr?.[ancien]) { c.cs_dr[nouveau] = c.cs_dr[ancien]; delete c.cs_dr[ancien] }
  })
  // L'ancien nom peut exister dans le fichier de base de l'ancienne app : on le masque
  const del = await lireCle<string[]>('cs_deletes', [])
  await ecrireCle('cs_deletes', [...del.valeur.filter((n) => n !== nouveau && n !== ancien), ancien], del.existe)
  await deplacerFichePersonne({ type: 'coach', cle: ancien }, { type: 'coach', cle: nouveau })
}

// ── Fiches personnelles (Directeur, Responsables Régionaux, Coachs, franchisés) ──

function modifierFiches(changer: (f: Record<string, Partial<FichePersonnelle>>) => void) {
  return enFile(async () => {
    const { valeur, existe } = await lireCle<Record<string, Partial<FichePersonnelle>>>('fiches_personnes', {})
    changer(valeur)
    await ecrireCle('fiches_personnes', valeur, existe)
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

export async function enregistrerFranchise(nom: string, ancien: string | null, magasins: string[], anciensMagasins: string[], f: FichePersonnelle) {
  // Une chaîne vide (et non null) efface bien la valeur venue du fichier de base de l'ancienne app
  for (const m of anciensMagasins.filter((x) => !magasins.includes(x))) await surchargerMagasin(m, { resp: '', tel_resp: '', email_resp: '' })
  for (const m of magasins) await surchargerMagasin(m, { resp: nom, tel_resp: f.telephone.trim(), email_resp: f.email.trim() })
  if (ancien && ancien !== nom) await deplacerFichePersonne({ type: 'franchise', cle: ancien }, { type: 'franchise', cle: nom })
  await enregistrerFichePersonne({ type: 'franchise', cle: nom }, f)
}

export async function supprimerFranchise(nom: string, magasins: string[]) {
  for (const m of magasins) await surchargerMagasin(m, { resp: '', tel_resp: '', email_resp: '' })
  await supprimerFichePersonne({ type: 'franchise', cle: nom })
}

// ── Magasins ──

export interface FicheMagasin {
  nom: string; code: string; departement: string; ouverture: string; franchise: boolean
  telephone: string; email: string; adresse: string; codePostal: string; ville: string; pays: string
  responsable: string; telResponsable: string; emailResponsable: string // coordonnées reprises de la fiche du franchisé
  rrDirect: string
}

function ligneSurcharge(f: FicheMagasin) {
  const v = (x: string) => x.trim() || null
  return {
    store_name: f.nom, open_date: v(f.ouverture), dept: v(f.departement), tel: v(f.telephone), email_mag: v(f.email),
    // Adjoint et plateforme logistique ne sont plus affichés : leurs valeurs en base restent intactes
    resp: f.responsable.trim(), tel_resp: f.telResponsable.trim(), email_resp: f.emailResponsable.trim(),
    addr: v(f.adresse), code: v(f.code), updated_at: new Date().toISOString(),
    cp: v(f.codePostal), ville: v(f.ville), franchise: f.franchise, rr: v(f.rrDirect), pays: v(f.pays),
  }
}

type MagasinStocke = Record<string, unknown> & { n: string }

export async function enregistrerMagasin(f: FicheMagasin, ancienNom: string | null) {
  const adds = await lireCle<MagasinStocke[]>('store_adds', [])
  if (ancienNom === null) {
    // Création : le magasin rejoint la liste partagée avec l'ancienne app
    adds.valeur.push({ n: f.nom, open: f.ouverture || '2027-01-01', dept: f.departement, franchise: f.franchise, ville: f.ville, cp: f.codePostal, addr: f.adresse, code: f.code })
    await ecrireCle('store_adds', adds.valeur, adds.existe)
  } else if (ancienNom !== f.nom) {
    const m = adds.valeur.find((x) => x.n === ancienNom)
    if (m) { m.n = f.nom; await ecrireCle('store_adds', adds.valeur, adds.existe) }
    await renommerColonne('store_overrides', 'store_name', ancienNom, f.nom)
    await renommerColonne('reassigns', 'store', ancienNom, f.nom)
    await renommerColonne('visits', 'store', ancienNom, f.nom)
    await renommerColonne('store_finance', 'store_name', ancienNom, f.nom)
    for (const cleConfig of ['sante_parc', 'deploiements'] as const) {
      const lu = await lireCle<Record<string, unknown>>(cleConfig, {})
      const cible = (cleConfig === 'deploiements' ? lu.valeur.valeurs : lu.valeur) as Record<string, unknown> | undefined
      if (cible && ancienNom in cible) { cible[f.nom] = cible[ancienNom]; delete cible[ancienNom]; await ecrireCle(cleConfig, lu.valeur, lu.existe) }
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
    // Base plus ancienne sans les colonnes d'adresse détaillée : on enregistre l'essentiel, comme l'ancienne app
    const { cp: _cp, ville: _v, franchise: _f, rr: _r, pays: _p, ...essentiel } = ligne
    res = await ecrire(essentiel)
  }
  if (res.error) throw new ErreurEnregistrement(res.error.message)
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

// ── Visites, congés, événements ──

function verifier(r: { error: { message: string } | null }) { if (r.error) throw new ErreurEnregistrement(r.error.message) }

export async function enregistrerVisites(base: Omit<Visite, 'magasin' | 'id'>, magasins: string[], id: number | null) {
  const ligne = (magasin: string) => ({
    group_id: base.groupe || null, store: magasin, visit_date: base.date, type: base.type, visitor: base.visiteur || null,
    signed_required: base.signatureRequise, signed_url: base.lienSigne || null, signed_date: base.dateSignature || null,
    docs: base.documents.filter((d) => d.url.trim()), notes: base.notes || null,
  })
  if (id !== null) verifier(await supabase.from('visits').update(ligne(magasins[0])).eq('id', id))
  else verifier(await supabase.from('visits').insert(magasins.map(ligne)))
}
export async function supprimerVisite(id: number) { verifier(await supabase.from('visits').delete().eq('id', id)) }

export async function enregistrerConge(c: Conge) {
  const l = { person: c.personne, role: c.role, start_date: c.debut, end_date: c.fin, notes: c.notes || null }
  verifier(c.id !== null ? await supabase.from('leaves').update(l).eq('id', c.id) : await supabase.from('leaves').insert(l))
}
export async function supprimerConge(id: number) { verifier(await supabase.from('leaves').delete().eq('id', id)) }

export async function enregistrerEvenement(e: Evenement) {
  const l = { title: e.titre, type: e.type, start_date: e.debut, end_date: e.fin || null, notes: e.notes || null, color: e.couleur }
  verifier(e.id !== null ? await supabase.from('events').update(l).eq('id', e.id) : await supabase.from('events').insert(l))
}
export async function supprimerEvenement(id: number) { verifier(await supabase.from('events').delete().eq('id', id)) }

// ── Santé du parc et déploiements (relus puis réécrits pour ne rien écraser) ──

// Les écritures sur app_config passent une par une : deux saisies rapides ne s'écrasent plus
let file: Promise<unknown> = Promise.resolve()
function enFile<T>(f: () => Promise<T>): Promise<T> {
  const p = file.then(f, f)
  file = p.catch(() => undefined)
  return p
}

export function enregistrerEvaluations(lot: Record<string, { e: Evaluation; caseId: string | null }>) {
  return enFile(async () => {
    const { valeur, existe } = await lireCle<Evaluations>('sante_parc', {})
    for (const [magasin, { e, caseId }] of Object.entries(lot)) {
      const historique = [...(valeur[magasin]?.historique ?? [])]
      if (caseId && historique.at(-1)?.caseId !== caseId) historique.push({ date: e.date, caseId })
      valeur[magasin] = { ...e, historique }
    }
    await ecrireCle('sante_parc', valeur, existe)
  })
}
export const enregistrerEvaluation = (magasin: string, e: Evaluation, caseId: string | null) => enregistrerEvaluations({ [magasin]: { e, caseId } })

function modifierDeploiements(changer: (d: Deploiements) => void) {
  return enFile(async () => {
    const { valeur, existe } = await lireCle<Partial<Deploiements>>('deploiements', {})
    const d: Deploiements = { thematiques: valeur.thematiques?.length ? valeur.thematiques : thematiquesParDefaut, valeurs: valeur.valeurs ?? {} }
    changer(d)
    await ecrireCle('deploiements', d, existe)
  })
}

export function enregistrerDeploiements(lot: { magasin: string; thematique: string; etat: string }[]) {
  return modifierDeploiements((d) => {
    for (const { magasin, thematique, etat } of lot) {
      d.valeurs[magasin] = { ...(d.valeurs[magasin] ?? {}) }
      if (etat) d.valeurs[magasin][thematique] = etat
      else delete d.valeurs[magasin][thematique]
    }
  })
}
export const enregistrerDeploiement = (magasin: string, thematique: string, etat: string) => enregistrerDeploiements([{ magasin, thematique, etat }])

export async function enregistrerThematiques(thematiques: Thematique[]) {
  await modifierDeploiements((d) => {
    d.thematiques = thematiques
    const ids = new Set(thematiques.map((t) => t.id))
    for (const m of Object.keys(d.valeurs)) for (const k of Object.keys(d.valeurs[m])) if (!ids.has(k)) delete d.valeurs[m][k]
  })
}
