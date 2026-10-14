import { supabase } from '../lib/supabase'
import { construireReseau, type DonneesBrutes, type Parametres } from './construction'
import type { Reseau } from './modele'

function json<T>(valeur: unknown, defaut: T): T {
  if (valeur === null || valeur === undefined) return defaut
  if (typeof valeur !== 'string') return valeur as T
  try { return JSON.parse(valeur) as T } catch { return defaut }
}

export class ErreurChargement extends Error {}

// Lit les tables Supabase partagées avec l'ancienne app (lecture seule)
export async function chargerReseau(jour = new Date().toISOString().slice(0, 10)): Promise<Reseau> {
  const [config, surcharges, affectations, coachs, recrues] = await Promise.all([
    supabase.from('app_config').select('key,value').in('key', ['store_adds', 'store_renames', 'drs_data', 'params', 'cs_deletes']),
    supabase.from('store_overrides').select('*'),
    supabase.from('reassigns').select('store,cs,date,note,type').order('date'),
    supabase.from('cs_overrides').select('*'),
    supabase.from('recruits').select('*'),
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
  return construireReseau(brutes, jour)
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

export interface FicheDirecteur { nom: string; titre: string; telephone: string; email: string }
export async function enregistrerDirecteur(d: FicheDirecteur) {
  await modifierConfigRR((c) => { c.directeur = { ...(c.directeur ?? {}), name: d.nom, titre: d.titre, tel: d.telephone, email: d.email } })
}

export interface FicheRR { id?: string; nom: string; telephone: string; email: string; couleur: string; integres: boolean }
export async function enregistrerRR(r: FicheRR): Promise<string> {
  const id = r.id ?? `dr_${Date.now()}`
  await modifierConfigRR((c) => {
    c.drs = c.drs ?? []
    const champs = { name: r.nom, tel: r.telephone, email: r.email, color: r.couleur, role: r.integres ? 'integres' : 'rr' }
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
}

// ── Magasins ──

export interface FicheMagasin {
  nom: string; code: string; departement: string; ouverture: string; franchise: boolean; plateforme: string
  telephone: string; email: string; adresse: string; codePostal: string; ville: string; pays: string
  responsable: string; telResponsable: string; emailResponsable: string; adjoint: string; telAdjoint: string
  rrDirect: string
}

function ligneSurcharge(f: FicheMagasin) {
  const v = (x: string) => x.trim() || null
  return {
    store_name: f.nom, open_date: v(f.ouverture), dept: v(f.departement), tel: v(f.telephone), email_mag: v(f.email),
    resp: v(f.responsable), tel_resp: v(f.telResponsable), email_resp: v(f.emailResponsable), adj: v(f.adjoint), tel_adj: v(f.telAdjoint),
    addr: v(f.adresse), code: v(f.code), plat: v(f.plateforme), updated_at: new Date().toISOString(),
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
