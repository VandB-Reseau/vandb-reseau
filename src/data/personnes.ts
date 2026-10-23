// Fiche personnelle commune au Directeur de réseau, aux Responsables Régionaux, aux Coachs et aux franchisés.
// Stockée dans la table fiches_personnes (0015 ; avant, clé fiches_personnes d'app_config) ; téléphone, email, ville et dates sont aussi recopiés
// aux endroits que lit l'ancienne app.
import type { Magasin, Reseau } from './modele'
import { associesEnPlace } from './associes'

export interface FichePersonnelle {
  prenom: string
  nom: string
  naissance: string // AAAA-MM-JJ
  arrivee: string // AAAA-MM-JJ
  codePostal: string
  departement: string
  ville: string
  pays: string
  email: string
  telephone: string
  visage: string // visage de la charte (v1 à v6) ; vide = initiales
}

export type TypePersonne = 'directeur' | 'rr' | 'coach' | 'franchise'
// cle : nom du Coach ou du franchisé, identifiant du Responsable Régional, vide pour le Directeur
export interface RefPersonne { type: TypePersonne; cle: string }

export const cleFiche = (r: RefPersonne) => (r.type === 'directeur' ? 'directeur' : `${r.type}:${r.cle}`)

export const ficheVide = (): FichePersonnelle => ({ prenom: '', nom: '', naissance: '', arrivee: '', codePostal: '', departement: '', ville: '', pays: 'France', email: '', telephone: '', visage: '' })

export const nomComplet = (f: Pick<FichePersonnelle, 'prenom' | 'nom'>) => `${f.prenom} ${f.nom}`.trim().replace(/\s+/g, ' ')

// « Camille DUPONT » → prénom Camille, nom DUPONT ; les mots en capitales de fin forment le nom
export function separerNom(complet: string): { prenom: string; nom: string } {
  const mots = complet.trim().split(/\s+/).filter(Boolean)
  if (mots.length < 2) return { prenom: '', nom: mots[0] ?? '' }
  let i = mots.length
  while (i > 1 && mots[i - 1] === mots[i - 1].toLocaleUpperCase('fr') && /\p{L}/u.test(mots[i - 1])) i--
  if (i === mots.length) i = mots.length - 1
  return { prenom: mots.slice(0, i).join(' '), nom: mots.slice(i).join(' ') }
}

export const estFrance = (pays: string) => !pays.trim() || /^france$/i.test(pays.trim())

export const codePostalValide = (cp: string) => !cp.trim() || /^\d{5}$/.test(cp.replace(/\s/g, ''))

export function departementDepuisCP(cp: string): string {
  const c = cp.replace(/\s/g, '')
  if (!/^\d{5}$/.test(c)) return ''
  if (c.startsWith('97') || c.startsWith('98')) return c.slice(0, 3)
  if (c.startsWith('20')) return Number(c) < 20200 ? '2A' : '2B'
  return c.slice(0, 2)
}

const NOMS_DEPARTEMENTS: Record<string, string> = {
  '01': 'Ain', '02': 'Aisne', '03': 'Allier', '04': 'Alpes-de-Haute-Provence', '05': 'Hautes-Alpes', '06': 'Alpes-Maritimes', '07': 'Ardèche', '08': 'Ardennes', '09': 'Ariège', '10': 'Aube',
  '11': 'Aude', '12': 'Aveyron', '13': 'Bouches-du-Rhône', '14': 'Calvados', '15': 'Cantal', '16': 'Charente', '17': 'Charente-Maritime', '18': 'Cher', '19': 'Corrèze', '2A': 'Corse-du-Sud', '2B': 'Haute-Corse',
  '21': 'Côte-d’Or', '22': 'Côtes-d’Armor', '23': 'Creuse', '24': 'Dordogne', '25': 'Doubs', '26': 'Drôme', '27': 'Eure', '28': 'Eure-et-Loir', '29': 'Finistère', '30': 'Gard',
  '31': 'Haute-Garonne', '32': 'Gers', '33': 'Gironde', '34': 'Hérault', '35': 'Ille-et-Vilaine', '36': 'Indre', '37': 'Indre-et-Loire', '38': 'Isère', '39': 'Jura', '40': 'Landes',
  '41': 'Loir-et-Cher', '42': 'Loire', '43': 'Haute-Loire', '44': 'Loire-Atlantique', '45': 'Loiret', '46': 'Lot', '47': 'Lot-et-Garonne', '48': 'Lozère', '49': 'Maine-et-Loire', '50': 'Manche',
  '51': 'Marne', '52': 'Haute-Marne', '53': 'Mayenne', '54': 'Meurthe-et-Moselle', '55': 'Meuse', '56': 'Morbihan', '57': 'Moselle', '58': 'Nièvre', '59': 'Nord', '60': 'Oise',
  '61': 'Orne', '62': 'Pas-de-Calais', '63': 'Puy-de-Dôme', '64': 'Pyrénées-Atlantiques', '65': 'Hautes-Pyrénées', '66': 'Pyrénées-Orientales', '67': 'Bas-Rhin', '68': 'Haut-Rhin', '69': 'Rhône', '70': 'Haute-Saône',
  '71': 'Saône-et-Loire', '72': 'Sarthe', '73': 'Savoie', '74': 'Haute-Savoie', '75': 'Paris', '76': 'Seine-Maritime', '77': 'Seine-et-Marne', '78': 'Yvelines', '79': 'Deux-Sèvres', '80': 'Somme',
  '81': 'Tarn', '82': 'Tarn-et-Garonne', '83': 'Var', '84': 'Vaucluse', '85': 'Vendée', '86': 'Vienne', '87': 'Haute-Vienne', '88': 'Vosges', '89': 'Yonne', '90': 'Territoire de Belfort',
  '91': 'Essonne', '92': 'Hauts-de-Seine', '93': 'Seine-Saint-Denis', '94': 'Val-de-Marne', '95': 'Val-d’Oise', '971': 'Guadeloupe', '972': 'Martinique', '973': 'Guyane', '974': 'La Réunion', '976': 'Mayotte',
}

export const libelleDepartement = (d: string) => (NOMS_DEPARTEMENTS[d] ? `${d} · ${NOMS_DEPARTEMENTS[d]}` : d)

// Franchisés : associés en place des magasins franchisés (le premier est inscrit dans le champ resp),
// et responsables des magasins intégrés
export interface Franchise { nom: string; magasins: Magasin[]; integresSeulement: boolean }

export function franchises(reseau: Reseau): Franchise[] {
  const parNom = new Map<string, Magasin[]>()
  const ajouter = (nom: string, m: Magasin) => { if (!(parNom.get(nom) ?? []).includes(m)) parNom.set(nom, [...(parNom.get(nom) ?? []), m]) }
  for (const m of reseau.magasins) {
    if (m.franchise) for (const a of associesEnPlace(reseau, m)) { if (!/recrutement/i.test(a.nom)) ajouter(a.nom, m) }
    else if (m.responsable) ajouter(m.responsable.nom, m)
  }
  return [...parNom].map(([nom, magasins]) => ({ nom, magasins, integresSeulement: magasins.every((m) => !m.franchise) }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }))
}

export const libelleRole = (type: TypePersonne, integresSeulement = false) =>
  type === 'directeur' ? 'Directeur de réseau' : type === 'rr' ? 'Responsable Régional' : type === 'coach' ? 'Coach' : integresSeulement ? 'Responsable de magasin intégré' : 'Franchisé'

// Nom affiché aujourd'hui pour une personne (sert à reconnaître une fiche renommée par l'ancienne app)
function nomActuel(reseau: Reseau, r: RefPersonne): string | null {
  if (r.type === 'directeur') return reseau.directeur.nom === 'Direction du réseau' ? '' : reseau.directeur.nom
  if (r.type === 'rr') return reseau.rrs.find((x) => x.id === r.cle)?.nom ?? null
  return r.cle
}

// Fiche complète : valeurs enregistrées, complétées par ce que l'ancienne app connaît déjà
export function fichePersonne(reseau: Reseau, r: RefPersonne): FichePersonnelle {
  const f = ficheVide()
  const nom = nomActuel(reseau, r) ?? ''
  if (r.type === 'directeur') {
    const d = reseau.directeur
    Object.assign(f, { telephone: d.telephone ?? '', email: d.email ?? '', naissance: d.naissance ?? '', arrivee: d.arrivee ?? '' })
  } else if (r.type === 'rr') {
    const x = reseau.rrs.find((y) => y.id === r.cle)
    if (x) Object.assign(f, { telephone: x.telephone ?? '', email: x.email ?? '', naissance: x.naissance, arrivee: x.arrivee })
  } else if (r.type === 'coach') {
    const c = reseau.equipe.find((y) => y.nom === r.cle)
    const p = reseau.coachs[r.cle]
    Object.assign(f, { telephone: p?.telephone ?? '', email: p?.email ?? '', ville: c?.ville ?? '', arrivee: c?.arrivee ?? '', naissance: c?.naissance ?? '' })
  } else {
    const p = reseau.magasins.find((m) => m.responsable?.nom === r.cle)?.responsable
    Object.assign(f, { telephone: p?.telephone ?? '', email: p?.email ?? '' })
  }
  const enregistree = reseau.personnes[cleFiche(r)] ?? {}
  for (const [k, v] of Object.entries(enregistree)) if (typeof v === 'string' && k in f) (f as unknown as Record<string, string>)[k] = v
  // Prénom et nom enregistrés seulement s'ils correspondent toujours au nom connu
  if (nomComplet(f) !== nom) Object.assign(f, separerNom(nom))
  if (!f.pays) f.pays = 'France'
  return f
}

export const ageDepuis = (iso: string, jour: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const n = Number(jour.slice(0, 4)) - Number(iso.slice(0, 4)) - (jour.slice(5) < iso.slice(5) ? 1 : 0)
  return n >= 0 ? n : null
}
