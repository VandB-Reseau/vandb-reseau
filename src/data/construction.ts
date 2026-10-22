import { grillesParDefaut } from './grilles'
import { seuilsParDefaut } from './chiffres'
import { couleurAuto } from './zones'
import { delaisVisiteParDefaut, grilleParDefaut } from './sante'
import type { AffectationCoach, Coach, Magasin, Personne, Reseau, ResponsableRegional, Statut } from './modele'

// Lignes brutes telles que stockées par l'ancienne app
export interface MagasinBrut {
  n: string; dept?: string | number; open?: string; code?: string; tel?: string; email_mag?: string; plat?: string
  resp?: string; tel_resp?: string; email_resp?: string; adj?: string; tel_adj?: string
  addr?: string; cp?: string; ville?: string; pays?: string; franchise?: boolean; rr?: string
  lat?: number; lon?: number; geo?: string
}
export interface SurchargeMagasin extends Partial<Record<keyof MagasinBrut, unknown>> {
  store_name: string; email_mag?: string; open_date?: string
}
export interface AffectationBrute { store: string; cs: string; date: string; note?: string; type?: string }
export interface RRBrut { id: string; name: string; tel?: string; email?: string; color?: string; role?: string; birth?: string; entry?: string }
export interface ConfigRR { directeur?: { name?: string; titre?: string; tel?: string; email?: string; birth?: string; entry?: string }; drs?: RRBrut[]; cs_dr?: Record<string, string>; dr_assigns?: { cs: string; dr: string; date: string }[] }
export interface SurchargeCoach { cs_name: string; color?: string; tel?: string; email?: string; birth?: string | null; tech?: boolean; fictif?: boolean; ville?: string; lat?: number | null; lon?: number | null }
export interface RecrueBrute { name: string; color?: string; start?: string | null; post?: string | null; ville?: string; lat?: number | null; lon?: number | null; fictif?: boolean }
export interface Parametres { prepDuration: number; postDuration: number; maxUnits?: number; alertThreshold?: number; poidsOuvert?: number; poidsRenforce?: number; maxCoachsRR?: number; maxTourneeHeures?: number }

export interface DonneesBrutes {
  magasins: MagasinBrut[]
  renommages: Record<string, string>
  surcharges: SurchargeMagasin[]
  affectations: AffectationBrute[]
  configRR: ConfigRR
  coachs: SurchargeCoach[]
  recrues?: RecrueBrute[]
  coachsSupprimes?: string[]
  parametres: Parametres
}

// Dates par défaut posées par l'import Excel quand la date d'ouverture manque
const DATES_INCONNUES = new Set(['2020-01-01', '2027-01-01'])
const COULEUR_DEFAUT = '#6b6b73'

export function ajouterMois(iso: string, mois: number): string {
  const [a, m, j] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + mois, j))
  return d.toISOString().slice(0, 10)
}

export function statutA(ouverture: string, jour: string, p: Parametres): Statut {
  if (jour >= ouverture && jour < ajouterMois(ouverture, p.postDuration)) return 'nouveau'
  if (jour >= ouverture) return 'ouvert'
  if (jour >= ajouterMois(ouverture, -p.prepDuration)) return 'preouverture'
  return 'avenir'
}

function texte(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim()
}

function personne(nom: unknown, tel?: unknown, email?: unknown): Personne | null {
  const n = texte(nom)
  if (!n || /recrutement/i.test(n)) return null
  return { nom: n, telephone: texte(tel) || undefined, email: texte(email) || undefined }
}

// Coordonnées par défaut (centre de la France) = magasin pas encore géolocalisé
function coordonnees(lat: unknown, lon: unknown): [number | null, number | null] {
  const la = Number(lat), lo = Number(lon)
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return [null, null]
  if (Math.abs(la - 46.5) < 0.05 && Math.abs(lo - 2.5) < 0.05) return [null, null]
  return [la, lo]
}

export function construireReseau(d: DonneesBrutes, jour: string): Reseau {
  // 1) Liste de base + renommages + surcharges (même ordre d'application que l'ancienne app)
  // store_deletes ne concerne que le fichier de base de l'ancienne app, jamais store_adds
  const bruts = d.magasins.map((m) => ({ ...m }))
  for (const [ancien, nouveau] of Object.entries(d.renommages)) {
    const m = bruts.find((x) => x.n === ancien)
    if (m && nouveau) m.n = nouveau
  }
  const surcharges = new Map(d.surcharges.map((s) => [s.store_name, s]))

  // 2) Responsables Régionaux et rattachement Coach → RR à la date du jour
  const rrs: ResponsableRegional[] = (d.configRR.drs ?? []).map((r) => ({
    id: r.id, nom: r.name, telephone: r.tel || undefined, email: r.email || undefined,
    couleur: r.color || COULEUR_DEFAUT, integres: r.role === 'integres',
    naissance: texte(r.birth).slice(0, 10), arrivee: texte(r.entry).slice(0, 10),
  }))
  const rrParId = new Map(rrs.map((r) => [r.id, r]))
  const rrDuCoach = (coach: string): ResponsableRegional | null => {
    const hist = (d.configRR.dr_assigns ?? []).filter((a) => a.cs === coach && a.date <= jour).sort((a, b) => a.date.localeCompare(b.date))
    const id = hist.length ? hist[hist.length - 1].dr : d.configRR.dr_assigns?.length ? undefined : d.configRR.cs_dr?.[coach]
    return id ? rrParId.get(id) ?? null : null
  }

  // 3) Coachs (coordonnées)
  const coachs: Record<string, Personne> = {}
  const techniciens: Personne[] = d.coachs.filter((c) => c.tech).map((c) => ({ nom: c.cs_name, telephone: c.tel || undefined, email: c.email || undefined }))
  const ajouterCoach = (nom: string) => { if (nom && !coachs[nom]) coachs[nom] = { nom } }
  d.affectations.forEach((a) => ajouterCoach(a.cs))
  const recrues = d.recrues ?? []
  recrues.forEach((r) => ajouterCoach(r.name))
  d.coachs.forEach((c) => {
    if (c.tech) return
    ajouterCoach(c.cs_name)
    coachs[c.cs_name] = { nom: c.cs_name, telephone: c.tel || undefined, email: c.email || undefined }
  })

  // 4) Affectations Coach par magasin
  const parMagasin = new Map<string, AffectationCoach[]>()
  ;[...d.affectations].sort((a, b) => a.date.localeCompare(b.date)).forEach((a) => {
    // Un seul changement par jour : le dernier enregistré remplace les précédents
    const l = (parMagasin.get(a.store) ?? []).filter((x) => x.date !== a.date)
    l.push({ coach: a.cs, date: a.date, note: a.note ?? '' })
    parMagasin.set(a.store, l)
  })

  const magasins: Magasin[] = bruts.map((b) => {
    const s = surcharges.get(b.n)
    const v = (cle: keyof MagasinBrut) => (s && s[cle] !== null && s[cle] !== undefined ? s[cle] : b[cle])
    const ouverture = texte(s?.open_date) || texte(b.open) || '2020-01-01'
    const historique = parMagasin.get(b.n) ?? []
    const actuelles = historique.filter((h) => h.date <= jour)
    const coach = actuelles.length ? actuelles[actuelles.length - 1].coach : ''
    const rrDirectId = texte(v('rr'))
    const rrDirect = rrDirectId ? rrParId.get(rrDirectId) ?? null : null
    const rr = rrDirect && !rrDirect.integres ? rrDirect : coach ? rrDuCoach(coach) : rrDirect
    const [lat, lon] = coordonnees(v('lat'), v('lon'))
    // L'import Excel de l'ancienne app posait le magasin au chef-lieu du département (geo « dept ») en attendant
    // une géolocalisation précise ; une position enregistrée dans store_overrides est toujours précise
    const surchargePosition = s?.lat !== null && s?.lat !== undefined && s?.lon !== null && s?.lon !== undefined
    const positionApprochee = !surchargePosition && (lat === null || b.geo === 'dept' || b.geo === 'fail')
    return {
      nom: b.n,
      code: texte(v('code')),
      departement: texte(v('dept')),
      ville: texte(v('ville')),
      codePostal: texte(v('cp')),
      adresse: texte(v('addr')),
      pays: texte(v('pays')),
      ouverture,
      ouvertureConnue: !DATES_INCONNUES.has(ouverture),
      statut: statutA(ouverture, jour, d.parametres),
      franchise: v('franchise') !== false,
      telephone: texte(v('tel')),
      email: texte(v('email_mag')),
      coach,
      rr,
      rrEnDirect: !!rrDirect && !rrDirect.integres,
      responsable: personne(v('resp'), v('tel_resp'), v('email_resp')),
      responsableARecruter: /recrutement/i.test(texte(v('resp'))),
      lat, lon, positionApprochee,
      historiqueCoach: historique,
    }
  })
  magasins.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

  // 5) Équipe : tout Coach présent dans les affectations ou fiches, hors techniciens
  const nomsTech = new Set([...techniciens.map((t) => t.nom), ...(d.coachsSupprimes ?? [])])
  const equipe: Coach[] = Object.values(coachs)
    .filter((c) => !nomsTech.has(c.nom))
    .map((c) => {
      const ov = d.coachs.find((x) => x.cs_name === c.nom)
      const rec = recrues.find((x) => x.name === c.nom)
      const [lat, lon] = coordonnees(ov?.lat ?? rec?.lat, ov?.lon ?? rec?.lon)
      return {
      ...c,
      fictif: !!(ov?.fictif || rec?.fictif),
      couleur: [ov?.color, rec?.color].find((x) => x && x !== '#000000') || couleurAuto(c.nom),
      arrivee: texte(rec?.start).slice(0, 10),
      naissance: texte(ov?.birth).slice(0, 10),
      ville: texte(ov?.ville) || texte(rec?.ville),
      lat, lon,
      rr: rrDuCoach(c.nom),
      historiqueRR: (d.configRR.dr_assigns ?? []).filter((a) => a.cs === c.nom).sort((a, b) => a.date.localeCompare(b.date))
        .filter((a, i, l) => l[i + 1]?.date !== a.date) // un seul changement par jour : le dernier saisi
        .map((a) => ({ rr: rrParId.get(a.dr) ?? null, date: a.date })),
    }})
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

  const parametres = {
    prepDuration: d.parametres.prepDuration, postDuration: d.parametres.postDuration,
    maxUnits: d.parametres.maxUnits || 8, alertThreshold: d.parametres.alertThreshold || 7,
    poidsOuvert: d.parametres.poidsOuvert ?? 1, poidsRenforce: d.parametres.poidsRenforce ?? 2,
    maxCoachsRR: d.parametres.maxCoachsRR || 8,
    maxTourneeHeures: d.parametres.maxTourneeHeures || 12,
  }
  const dir = d.configRR.directeur
  const directeur = { nom: dir?.name || 'Direction du réseau', titre: dir?.titre || 'Directeur de réseau', telephone: dir?.tel || undefined, email: dir?.email || undefined, naissance: texte(dir?.birth).slice(0, 10), arrivee: texte(dir?.entry).slice(0, 10) }
  return { personnes: {}, evaluations: {}, grilleNineBox: grilleParDefaut, notesMagasins: {}, preparations: {}, chiffres: {}, audits: {}, grilles: grillesParDefaut, pratiques: [], campagnes: { liste: [], constats: {} }, associes: {}, actionsLibres: {}, derniereSauvegarde: '', seuils: { ...seuilsParDefaut }, delaisVisite: { ...delaisVisiteParDefaut }, deploiements: { thematiques: [], valeurs: {} }, visites: [], evenements: [], anniversaires: [], magasins, coachs, equipe, techniciens, directeur, rrs, parametres, jour, chargeLe: new Date().toISOString() }
}
