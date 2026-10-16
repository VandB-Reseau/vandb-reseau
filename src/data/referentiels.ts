// Référentiels exportés en Excel pré-rempli puis réimportés pour mise à jour.
// Règles communes : une cellule vide ne change rien, une ligne inconnue est ajoutée quand le référentiel le permet,
// une ligne absente du fichier est supprimée quand le référentiel le permet (magasins, personnes, chiffres, visites).
import type { Reseau } from './modele'
import { libelleTypeVisite, lireVisiteurs, typesVisite } from './modele'
import { coachA } from './charge'
import { champsSaisis, completerChiffres, libellesChiffres, lireNombre, type ChampChiffre } from './chiffres'
import { lireMois } from './importChiffres'
import { lireCSV, lireDate, normaliser, trouveurMagasin } from './import'
import { libelleNote, tousCriteres, type IdCritere, type Note } from './sante'
import { departementDepuisCP, fichePersonne, ficheVide, franchises, separerNom, type FichePersonnelle, type RefPersonne } from './personnes'
import {
  enregistrerChiffres, enregistrerCoach, enregistrerDeploiements, enregistrerFichePersonne, enregistrerFranchise, enregistrerMagasin,
  enregistrerRR, enregistrerVisites, importerHistorique, importerVisites, rattacherCoach, reaffecter, supprimerChiffres, supprimerCoach,
  supprimerFranchise, supprimerMagasin, supprimerRR, supprimerVisite, type FicheMagasin,
} from './chargement'

export type TypeColonne = 'texte' | 'date' | 'mois' | 'nombre' | 'ouiNon' | 'choix' | 'liste'

export interface Colonne {
  id: string
  entete: string
  type?: TypeColonne
  choix?: string[] // valeurs possibles d'une colonne « choix »
  cle?: boolean // identifie la ligne
  parametre?: boolean // exportée vide, sert seulement à l'import (date ou mois du changement)
  nouveau?: boolean // un nom inconnu de l'app crée une nouvelle ligne au lieu d'être refusé
  largeur?: number
  // Noms reconnus (magasins, Coachs…) : la valeur lue est remplacée par le nom exact de l'app
  reference?: (r: Reseau) => (v: string) => string | null
}

export type Ligne = Record<string, string>

export interface Changement {
  type: 'ajout' | 'modif' | 'suppression'
  cle: string
  libelle: string // clé lisible, pour l'aperçu
  avant: Ligne | null
  apres: Ligne
  champs: string[] // colonnes modifiées (toutes les colonnes remplies pour un ajout, aucune pour une suppression)
}

export interface Referentiel {
  id: string
  libelle: string
  feuille: string // 31 caractères au plus (limite d'Excel)
  colonnes: Colonne[]
  lignes: (r: Reseau) => Ligne[]
  ajout?: { obligatoires: string[] } // sans : une ligne inconnue est signalée, pas ajoutée
  appliquer: (r: Reseau, changements: Changement[]) => Promise<void>
  // Sans : une ligne absente du fichier ne change rien (référentiels d'une ligne par magasin ou par Coach)
  supprimer?: (r: Reseau, suppressions: Changement[]) => Promise<void>
}

// Suppressions d'abord : un Franchisé remplacé libère ses magasins avant que le nouveau les reprenne
export async function appliquerImport(ref: Referentiel, r: Reseau, changements: Changement[]) {
  const suppressions = changements.filter((c) => c.type === 'suppression')
  if (suppressions.length) await ref.supprimer!(r, suppressions)
  const autres = changements.filter((c) => c.type !== 'suppression')
  if (autres.length) await ref.appliquer(r, autres)
}

// ── Valeurs ──

const OUI = 'Oui', NON = 'Non'
const ouiNon = (b: boolean) => (b ? OUI : NON)

// Valeur lue dans une case, ramenée à la forme de l'app ; null = valeur non reconnue
export function lireValeur(c: Colonne, v: unknown): string | null {
  if (v === null || v === undefined || (typeof v === 'string' && !v.trim())) return ''
  switch (c.type ?? 'texte') {
    case 'date': return lireDate(v)
    case 'mois': return lireMois(v)
    case 'nombre': { const n = lireNombre(v); return n === null ? null : String(n) }
    case 'ouiNon': {
      const n = normaliser(v)
      if (['oui', 'o', 'x', 'vrai', 'true', '1', 'yes'].includes(n) || v === true) return OUI
      if (['non', 'n', 'faux', 'false', '0', 'no'].includes(n) || v === false) return NON
      return null
    }
    case 'choix': return c.choix!.find((x) => normaliser(x) === normaliser(v)) ?? null
    case 'liste': return String(v).split(/[;\n]/).map((x) => x.trim()).filter(Boolean).join(' ; ')
    default: {
      // Un numéro de téléphone retapé dans Excel perd son 0 de tête
      const t = String(v).trim()
      return c.id === 'telephone' && /^[1-9]\d{8}$/.test(t) ? `0${t}` : t
    }
  }
}

const memeValeur = (c: Colonne, a: string, b: string) => (c.type === 'nombre' && a && b ? Number(a) === Number(b) : a === b)

export const elementsListe = (s: string) => (s ? s.split(' ; ') : [])

// Valeur affichée dans l'aperçu
export function afficher(c: Colonne, v: string): string {
  if (!v) return '—'
  if (c.type === 'date') return v.split('-').reverse().join('/')
  if (c.type === 'mois') return `${v.slice(5, 7)}/${v.slice(0, 4)}`
  if (c.type === 'nombre') return Number(v).toLocaleString('fr-FR')
  return v
}

// Cellule écrite dans le fichier exporté
export function cellule(c: Colonne, v: string): { value: string | number | Date; format?: string; type?: StringConstructor } | null {
  if (!v) return null
  if (c.type === 'nombre') return { value: Number(v) }
  if (c.type === 'date') { const [a, m, j] = v.split('-').map(Number); return { value: new Date(Date.UTC(a, m - 1, j)), format: 'dd/mm/yyyy' } }
  if (c.type === 'mois') return { value: `${v.slice(5, 7)}/${v.slice(0, 4)}`, type: String }
  return { value: v, type: String }
}

// ── Analyse d'un fichier ──

export interface Analyse {
  feuille: string
  colonnes: Colonne[] // colonnes reconnues
  ignorees: string[]
  manquantes: string[] // colonnes clés absentes : rien ne peut être importé
  changements: Changement[]
  inchangees: number
  erreurs: { ligne: number; message: string }[]
}

const mots = (s: string) => normaliser(s).replace(/ d /g, ' ').trim()

function ligneEntete(lignes: unknown[][], ref: Referentiel): number {
  let meilleure = -1, max = 0
  lignes.slice(0, 15).forEach((l, i) => {
    const n = l.filter((x) => ref.colonnes.some((c) => mots(c.entete) === mots(String(x ?? '')))).length
    if (n > max) { max = n; meilleure = i }
  })
  return meilleure
}

// Feuille du référentiel dans un classeur : celle qui porte son nom, sinon celle dont les en-têtes correspondent le mieux
export function choisirFeuille(feuilles: { nom: string; lignes: unknown[][] }[], ref: Referentiel) {
  const parNom = feuilles.find((f) => normaliser(f.nom) === normaliser(ref.feuille))
  if (parNom) return parNom
  const score = (f: { lignes: unknown[][] }) => { const i = ligneEntete(f.lignes, ref); return i < 0 ? 0 : f.lignes[i].filter((x) => ref.colonnes.some((c) => mots(c.entete) === mots(String(x ?? '')))).length }
  return [...feuilles].sort((a, b) => score(b) - score(a))[0]
}

export function analyserReferentiel(ref: Referentiel, feuille: { nom: string; lignes: unknown[][] }, reseau: Reseau, jour: string): Analyse {
  const vide: Analyse = { feuille: feuille.nom, colonnes: [], ignorees: [], manquantes: ref.colonnes.filter((c) => c.cle).map((c) => c.entete), changements: [], inchangees: 0, erreurs: [] }
  const iEntete = ligneEntete(feuille.lignes, ref)
  if (iEntete < 0) return vide
  const entetes = feuille.lignes[iEntete].map((x) => String(x ?? '').trim())
  const index = new Map<string, number>()
  const ignorees: string[] = []
  entetes.forEach((e, i) => {
    if (!e) return
    const c = ref.colonnes.find((x) => mots(x.entete) === mots(e))
    if (c && !index.has(c.id)) index.set(c.id, i); else ignorees.push(e)
  })
  const cles = ref.colonnes.filter((c) => c.cle)
  // N° de visite : une ligne sans numéro est une nouvelle visite, la colonne peut donc manquer
  const manquantes = cles.filter((c) => !index.has(c.id) && !(ref.ajout && ref.id === 'visites')).map((c) => c.entete)
  const colonnes = ref.colonnes.filter((c) => index.has(c.id))
  if (manquantes.length) return { ...vide, colonnes, ignorees, manquantes }

  const resolveurs = new Map(ref.colonnes.filter((c) => c.reference).map((c) => [c.id, c.reference!(reseau)]))
  const cleDe = (l: Ligne) => cles.map((c) => l[c.id] ?? '').join(' · ')
  const libelleDe = (l: Ligne) => cles.map((c) => afficher(c, l[c.id] ?? '')).join(' · ')
  const existantes = new Map(ref.lignes(reseau).map((l) => [cleDe(l), l]))
  const vues = new Map<string, Changement>()
  const changements: Changement[] = [], erreurs: Analyse['erreurs'] = []
  const citees = new Set<string>() // lignes de l'app présentes dans le fichier, même illisibles : jamais supprimées
  let lues = 0
  let inchangees = 0
  feuille.lignes.slice(iEntete + 1).forEach((brute, k) => {
    const numero = iEntete + k + 2 // numéro de ligne dans Excel
    if (!brute.some((x) => normaliser(x))) return
    lues++
    const lue: Ligne = {}
    const problemes: string[] = []
    for (const c of colonnes) {
      const v = lireValeur(c, brute[index.get(c.id)!])
      if (v === null) { problemes.push(`« ${String(brute[index.get(c.id)!]).trim()} » non reconnu dans ${c.entete}`); continue }
      if (!v) continue
      const res = resolveurs.get(c.id)
      if (res && c.type === 'liste') {
        const noms = elementsListe(v).map((x) => ({ x, n: res(x) }))
        const inconnus = noms.filter((y) => !y.n).map((y) => y.x)
        if (inconnus.length) problemes.push(`${inconnus.join(', ')} introuvable${inconnus.length > 1 ? 's' : ''} dans ${c.entete}`)
        else lue[c.id] = [...new Set(noms.map((y) => y.n!))].join(' ; ')
      } else if (res) {
        const n = res(v)
        if (n) lue[c.id] = n
        else if (!c.nouveau) problemes.push(`${v} introuvable dans ${c.entete}`)
        else lue[c.id] = v
      } else lue[c.id] = v
    }
    const sansCle = cles.some((c) => !lue[c.id])
    const cle = sansCle ? `nouvelle-${numero}` : cleDe(lue)
    if (!sansCle) citees.add(cle)
    if (problemes.length) { erreurs.push({ ligne: numero, message: problemes.join(' ; ') }); return }
    const avant = sansCle ? null : existantes.get(cle) ?? null
    const parametres = Object.fromEntries(ref.colonnes.filter((c) => c.parametre).map((c) => [c.id, lue[c.id] || (c.type === 'mois' ? jour.slice(0, 7) : jour)]))
    if (avant) {
      const champs = colonnes.filter((c) => !c.cle && !c.parametre && lue[c.id] && !memeValeur(c, lue[c.id], avant[c.id] ?? ''))
      if (!champs.length) { inchangees++; return }
      const ch: Changement = { type: 'modif', cle, libelle: ref.id === 'visites' ? `Visite n° ${cle} · ${avant.magasin}` : libelleDe(avant), avant, apres: { ...avant, ...Object.fromEntries(champs.map((c) => [c.id, lue[c.id]])), ...parametres }, champs: champs.map((c) => c.id) }
      // Deux lignes pour la même clé : la dernière l'emporte
      if (vues.has(cle)) changements.splice(changements.indexOf(vues.get(cle)!), 1)
      vues.set(cle, ch); changements.push(ch)
      return
    }
    if (!ref.ajout) { erreurs.push({ ligne: numero, message: sansCle ? 'ligne sans identifiant' : `${cle} introuvable` }); return }
    if (sansCle && ref.id !== 'visites') { erreurs.push({ ligne: numero, message: `${cles.map((c) => c.entete).join(', ')} à remplir` }); return }
    if (!sansCle && ref.id === 'visites') { erreurs.push({ ligne: numero, message: `visite n° ${cle} introuvable` }); return }
    const manque = ref.ajout.obligatoires.filter((id) => !lue[id])
    if (manque.length) { erreurs.push({ ligne: numero, message: `${manque.map((id) => ref.colonnes.find((c) => c.id === id)!.entete).join(', ')} à remplir pour un ajout` }); return }
    const ch: Changement = { type: 'ajout', cle, libelle: sansCle ? `${lue.magasin ?? ''} · ${afficher({ id: 'date', entete: '', type: 'date' }, lue.date ?? '')}` : libelleDe(lue), avant: null, apres: { ...lue, ...parametres }, champs: colonnes.filter((c) => !c.cle && !c.parametre && lue[c.id]).map((c) => c.id) }
    if (vues.has(cle)) changements.splice(changements.indexOf(vues.get(cle)!), 1)
    vues.set(cle, ch); changements.push(ch)
  })
  // Fichier sans aucune ligne : rien n'est supprimé
  // Sans colonne N° (visites) : impossible de savoir quelles lignes manquent, rien n'est supprimé
  if (ref.supprimer && lues && cles.every((c) => index.has(c.id))) {
    for (const [cle, l] of existantes) {
      if (citees.has(cle)) continue
      changements.push({ type: 'suppression', cle, libelle: ref.id === 'visites' ? `Visite n° ${cle} · ${l.magasin} · ${afficher({ id: 'date', entete: '', type: 'date' }, l.date ?? '')}` : libelleDe(l), avant: l, apres: l, champs: [] })
    }
  }
  return { feuille: feuille.nom, colonnes, ignorees, manquantes: [], changements, inchangees, erreurs }
}

// ── Lecture et écriture des fichiers ──

export async function lireClasseur(f: File): Promise<{ nom: string; lignes: unknown[][] }[]> {
  if (/\.(csv|txt|tsv)$/i.test(f.name)) {
    return [{ nom: f.name.replace(/\.[^.]+$/, ''), lignes: lireCSV(await f.text()) }]
  }
  const { default: lire } = await import('read-excel-file/browser')
  return (await lire(f)).map((s) => ({ nom: s.sheet, lignes: s.data as unknown[][] }))
}

const entete = (c: Colonne) => ({ value: c.entete, fontWeight: 'bold' as const, type: String })

export function feuilleExport(ref: Referentiel, reseau: Reseau) {
  const lignes = ref.lignes(reseau)
  return {
    sheet: ref.feuille,
    data: [ref.colonnes.map(entete), ...lignes.map((l) => ref.colonnes.map((c) => (c.parametre ? null : cellule(c, l[c.id] ?? ''))))],
    columns: ref.colonnes.map((c) => ({ width: c.largeur ?? Math.max(12, c.entete.length + 2) })),
    stickyRowsCount: 1,
  }
}

export async function telechargerClasseur(feuilles: ReturnType<typeof feuilleExport>[], nomFichier: string) {
  const { default: ecrire } = await import('write-excel-file/universal')
  const blob = await ecrire(feuilles).toBlob()
  telechargerBlob(blob, nomFichier)
}

export function telechargerBlob(blob: Blob, nomFichier: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nomFichier
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

// ── Les référentiels ──

const refMagasin = (r: Reseau) => { const t = trouveurMagasin(r); return (v: string) => t(v) }
const parNom = (noms: string[]) => (v: string) => noms.find((n) => normaliser(n) === normaliser(v)) ?? null
const refCoach = (r: Reseau) => parNom(r.equipe.map((c) => c.nom))
const refRR = (r: Reseau) => parNom(r.rrs.filter((x) => !x.integres).map((x) => x.nom))

const colMagasin = (nouveau = false): Colonne => ({ id: 'magasin', entete: 'Magasin', cle: true, largeur: 28, reference: refMagasin, nouveau })
const colDateChangement: Colonne = { id: 'date', entete: 'Date du changement', type: 'date', parametre: true, largeur: 18 }
const colMoisChangement: Colonne = { id: 'depuis', entete: 'À partir du mois', type: 'mois', parametre: true, largeur: 18 }
const colsPersonne: Colonne[] = [
  { id: 'telephone', entete: 'Téléphone', largeur: 16 },
  { id: 'email', entete: 'Email', largeur: 30 },
  { id: 'naissance', entete: 'Date de naissance', type: 'date' },
  { id: 'arrivee', entete: 'Date d’arrivée', type: 'date' },
  { id: 'codePostal', entete: 'Code postal' },
  { id: 'ville', entete: 'Ville', largeur: 18 },
  { id: 'pays', entete: 'Pays' },
]
const ligneFiche = (f: FichePersonnelle): Ligne => ({ telephone: f.telephone, email: f.email, naissance: f.naissance, arrivee: f.arrivee, codePostal: f.codePostal, ville: f.ville, pays: f.pays })
function ficheDepuis(reseau: Reseau, ref: RefPersonne | null, nom: string, l: Ligne): FichePersonnelle {
  const f = ref ? fichePersonne(reseau, ref) : { ...ficheVide(), ...separerNom(nom) }
  for (const k of ['telephone', 'email', 'naissance', 'arrivee', 'codePostal', 'ville', 'pays'] as const) if (l[k] !== undefined) f[k] = l[k]
  if (f.codePostal && !f.departement) f.departement = departementDepuisCP(f.codePostal)
  return f
}

const STATUTS = ['Franchisé', 'Intégré']

const magasins: Referentiel = {
  id: 'magasins', libelle: 'Magasins', feuille: 'Magasins',
  colonnes: [
    colMagasin(true),
    { id: 'code', entete: 'Code' },
    { id: 'statut', entete: 'Statut', type: 'choix', choix: STATUTS },
    { id: 'ouverture', entete: 'Date d’ouverture', type: 'date', largeur: 16 },
    { id: 'adresse', entete: 'Adresse', largeur: 32 },
    { id: 'codePostal', entete: 'Code postal' },
    { id: 'ville', entete: 'Ville', largeur: 18 },
    { id: 'departement', entete: 'Département' },
    { id: 'pays', entete: 'Pays' },
    { id: 'telephone', entete: 'Téléphone', largeur: 16 },
    { id: 'email', entete: 'Email', largeur: 30 },
  ],
  lignes: (r) => r.magasins.map((m) => ({
    magasin: m.nom, code: m.code, statut: m.franchise ? STATUTS[0] : STATUTS[1], ouverture: m.ouvertureConnue ? m.ouverture : '',
    adresse: m.adresse, codePostal: m.codePostal, ville: m.ville, departement: m.departement, pays: m.pays, telephone: m.telephone, email: m.email,
  })),
  ajout: { obligatoires: ['magasin'] },
  async appliquer(r, changements) {
    for (const ch of changements) {
      const m = r.magasins.find((x) => x.nom === ch.cle)
      const l = ch.apres
      const f: FicheMagasin = {
        nom: l.magasin, code: l.code ?? '', departement: l.departement || departementDepuisCP(l.codePostal ?? ''), ouverture: l.ouverture ?? '',
        franchise: (l.statut ?? STATUTS[0]) === STATUTS[0], telephone: l.telephone ?? '', email: l.email ?? '',
        adresse: l.adresse ?? '', codePostal: l.codePostal ?? '', ville: l.ville ?? '', pays: l.pays ?? '',
        responsable: m?.responsable?.nom ?? '', telResponsable: m?.responsable?.telephone ?? '', emailResponsable: m?.responsable?.email ?? '',
        rrDirect: m?.rrEnDirect && m.rr ? m.rr.id : '',
      }
      await enregistrerMagasin(f, m ? m.nom : null)
    }
  },
  async supprimer(_r, suppressions) { for (const ch of suppressions) await supprimerMagasin(ch.cle) },
}

const franchisesRef: Referentiel = {
  id: 'franchises', libelle: 'Franchisés', feuille: 'Franchisés',
  colonnes: [
    { id: 'nom', entete: 'Franchisé', cle: true, nouveau: true, largeur: 26, reference: (r) => parNom(franchises(r).map((f) => f.nom)) },
    { id: 'magasins', entete: 'Magasins', type: 'liste', largeur: 40, reference: refMagasin },
    ...colsPersonne,
  ],
  lignes: (r) => franchises(r).map((f) => ({ nom: f.nom, magasins: f.magasins.map((m) => m.nom).join(' ; '), ...ligneFiche(fichePersonne(r, { type: 'franchise', cle: f.nom })) })),
  ajout: { obligatoires: ['nom', 'magasins'] },
  async appliquer(r, changements) {
    for (const ch of changements) {
      const nom = ch.apres.nom
      const anciens = ch.avant ? elementsListe(ch.avant.magasins) : []
      await enregistrerFranchise(nom, ch.avant ? nom : null, elementsListe(ch.apres.magasins), anciens, ficheDepuis(r, ch.avant ? { type: 'franchise', cle: nom } : null, nom, ch.apres))
    }
  },
  async supprimer(_r, suppressions) { for (const ch of suppressions) await supprimerFranchise(ch.cle, elementsListe(ch.avant!.magasins)) },
}

const coachs: Referentiel = {
  id: 'coachs', libelle: 'Coachs', feuille: 'Coachs',
  colonnes: [
    { id: 'nom', entete: 'Coach', cle: true, nouveau: true, largeur: 24, reference: refCoach },
    { id: 'fictif', entete: 'Poste à pourvoir', type: 'ouiNon' },
    ...colsPersonne,
  ],
  lignes: (r) => r.equipe.map((c) => ({ nom: c.nom, fictif: ouiNon(c.fictif), ...ligneFiche(fichePersonne(r, { type: 'coach', cle: c.nom })) })),
  ajout: { obligatoires: ['nom'] },
  async appliquer(r, changements) {
    for (const ch of changements) {
      const nom = ch.apres.nom
      const f = ficheDepuis(r, ch.avant ? { type: 'coach', cle: nom } : null, nom, ch.apres)
      await enregistrerCoach({ nom, telephone: f.telephone.trim(), email: f.email.trim(), ville: f.ville.trim(), fictif: ch.apres.fictif === OUI, arrivee: f.arrivee })
      await enregistrerFichePersonne({ type: 'coach', cle: nom }, f)
    }
  },
  async supprimer(_r, suppressions) { for (const ch of suppressions) await supprimerCoach(ch.cle) },
}

const COULEURS_RR = ['#1b6fce', '#ef7d00', '#2e7d32', '#7c3aed', '#c2185b', '#00838f', '#6d4c41', '#eaa400']
const rrs: Referentiel = {
  id: 'rrs', libelle: 'Responsables Régionaux', feuille: 'Responsables Régionaux',
  colonnes: [
    { id: 'nom', entete: 'Responsable Régional', cle: true, nouveau: true, largeur: 24, reference: (r) => parNom(r.rrs.map((x) => x.nom)) },
    { id: 'integres', entete: 'Responsable des magasins intégrés', type: 'ouiNon' },
    ...colsPersonne,
  ],
  lignes: (r) => r.rrs.map((x) => ({ nom: x.nom, integres: ouiNon(x.integres), ...ligneFiche(fichePersonne(r, { type: 'rr', cle: x.id })) })),
  ajout: { obligatoires: ['nom'] },
  async appliquer(r, changements) {
    const prises = new Set(r.rrs.map((x) => x.couleur))
    for (const ch of changements) {
      const ex = r.rrs.find((x) => x.nom === ch.apres.nom)
      const f = ficheDepuis(r, ex ? { type: 'rr', cle: ex.id } : null, ch.apres.nom, ch.apres)
      const couleur = ex?.couleur ?? COULEURS_RR.find((c) => !prises.has(c)) ?? COULEURS_RR[0]
      prises.add(couleur)
      const id = await enregistrerRR({ id: ex?.id, nom: ch.apres.nom, telephone: f.telephone.trim(), email: f.email.trim(), couleur, integres: ch.apres.integres === OUI, naissance: f.naissance, arrivee: f.arrivee })
      await enregistrerFichePersonne({ type: 'rr', cle: id }, f)
    }
  },
  async supprimer(r, suppressions) { for (const ch of suppressions) await supprimerRR(r.rrs.find((x) => x.nom === ch.cle)!.id) },
}

const affectations: Referentiel = {
  id: 'affectations', libelle: 'Coach des magasins', feuille: 'Coach des magasins',
  colonnes: [colMagasin(), { id: 'coach', entete: 'Coach', largeur: 24, reference: refCoach }, colMoisChangement],
  lignes: (r) => r.magasins.map((m) => ({ magasin: m.nom, coach: coachA(m, r.jour) || m.historiqueCoach.at(-1)?.coach || '' })),
  async appliquer(_r, changements) {
    for (const ch of changements) await reaffecter(ch.apres.magasin, ch.apres.coach, `${ch.apres.depuis}-01`, 'Import Excel')
  },
}

const rattachements: Referentiel = {
  id: 'rattachements', libelle: 'Responsable Régional des Coachs', feuille: 'RR des Coachs',
  colonnes: [{ id: 'coach', entete: 'Coach', cle: true, largeur: 24, reference: refCoach }, { id: 'rr', entete: 'Responsable Régional', largeur: 24, reference: refRR }, colMoisChangement],
  lignes: (r) => r.equipe.map((c) => ({ coach: c.nom, rr: c.rr?.nom ?? '' })),
  async appliquer(r, changements) {
    for (const ch of changements) await rattacherCoach(ch.apres.coach, r.rrs.find((x) => x.nom === ch.apres.rr)!.id, `${ch.apres.depuis}-01`)
  },
}

const chiffres: Referentiel = {
  id: 'chiffres', libelle: 'Chiffres mensuels', feuille: 'Chiffres mensuels',
  colonnes: [colMagasin(), { id: 'mois', entete: 'Mois', type: 'mois', cle: true }, ...champsSaisis.map((c) => ({ id: c, entete: `${libellesChiffres[c].libelle}${libellesChiffres[c].unite ? ` (${libellesChiffres[c].unite})` : ''}`, type: 'nombre' as const, largeur: 20 }))],
  lignes: (r) => Object.values(r.chiffres).flat().map((c) => ({ magasin: c.magasin, mois: c.mois, ...Object.fromEntries(champsSaisis.map((k) => [k, c[k] === null ? '' : String(c[k])])) })),
  ajout: { obligatoires: ['magasin', 'mois'] },
  async appliquer(r, changements) {
    await enregistrerChiffres(changements.map((ch) => {
      const l = { magasin: ch.apres.magasin, mois: ch.apres.mois, ...Object.fromEntries(ch.champs.map((k) => [k, Number(ch.apres[k])])) } as { magasin: string; mois: string } & Partial<Record<ChampChiffre, number>>
      return completerChiffres(l, r.chiffres[l.magasin]?.find((c) => c.mois === l.mois))
    }))
  },
  async supprimer(_r, suppressions) { for (const ch of suppressions) await supprimerChiffres(ch.avant!.magasin, ch.avant!.mois) },
}

const NOTES = [libelleNote[1], libelleNote[2], libelleNote[3], libelleNote[0]]
const noteDe = (s: string) => (Object.entries(libelleNote).find(([, v]) => v === s)?.[0] ?? '') as `${Note}`
const ninebox: Referentiel = {
  id: 'ninebox', libelle: 'Nine box', feuille: 'Nine box',
  colonnes: [colMagasin(), ...tousCriteres.map((c) => ({ id: c.id, entete: c.libelle, type: 'choix' as const, choix: NOTES, largeur: 18 })), colDateChangement],
  lignes: (r) => r.magasins.map((m) => ({ magasin: m.nom, ...Object.fromEntries(tousCriteres.map((c) => { const n = r.evaluations[m.nom]?.notes[c.id]; return [c.id, n === undefined ? '' : libelleNote[n]] })) })),
  async appliquer(r, changements) {
    await importerHistorique(changements.map((ch) => ({
      magasin: ch.apres.magasin, date: ch.apres.date,
      notes: Object.fromEntries(ch.champs.map((k) => [k, Number(noteDe(ch.apres[k])) as Note])) as Partial<Record<IdCritere, Note>>,
    })), r.directeur.nom)
  },
}

// Colonnes construites à partir des thématiques du moment
function deploiements(reseau: Reseau | null): Referentiel {
  const ths = reseau?.deploiements.thematiques ?? []
  return {
    id: 'deploiements', libelle: 'Déploiements', feuille: 'Déploiements',
    colonnes: [colMagasin(), ...ths.map((t) => ({ id: `t:${t.id}`, entete: t.libelle, type: 'choix' as const, choix: t.options.map((o) => o.libelle), largeur: 20 })), colDateChangement],
    lignes: (r) => r.magasins.map((m) => ({ magasin: m.nom, ...Object.fromEntries(ths.map((t) => [`t:${t.id}`, r.deploiements.valeurs[m.nom]?.[t.id] ?? ''])) })),
    async appliquer(r, changements) {
      await enregistrerDeploiements(changements.flatMap((ch) => ch.champs.map((k) => ({ magasin: ch.apres.magasin, thematique: k.slice(2), etat: ch.apres[k], date: ch.apres.date }))), r.jour)
    },
  }
}

const TYPES = typesVisite.map((t) => t.libelle)
const visites: Referentiel = {
  id: 'visites', libelle: 'Visites', feuille: 'Visites',
  colonnes: [
    { id: 'id', entete: 'N°', type: 'nombre', cle: true, largeur: 8 },
    { id: 'magasin', entete: 'Magasin', largeur: 28, reference: refMagasin },
    { id: 'date', entete: 'Date', type: 'date' },
    { id: 'type', entete: 'Type', type: 'choix', choix: TYPES, largeur: 22 },
    { id: 'visiteurs', entete: 'Participants', largeur: 30 },
    { id: 'notes', entete: 'Notes', largeur: 50 },
  ],
  lignes: (r) => r.visites.filter((v) => v.id !== null).map((v) => ({ id: String(v.id), magasin: v.magasin, date: v.date, type: libelleTypeVisite(v.type), visiteurs: v.visiteurs.join(', '), notes: v.notes })),
  ajout: { obligatoires: ['magasin', 'date'] },
  async appliquer(r, changements) {
    const typeDe = (s: string) => typesVisite.find((t) => t.libelle === s)?.id ?? 'terrain'
    const nouvelles = changements.filter((c) => c.type === 'ajout')
    for (const ch of changements.filter((c) => c.type === 'modif')) {
      const v = r.visites.find((x) => String(x.id) === ch.cle)!
      const { id: _id, magasin: _m, ...base } = v
      await enregistrerVisites({ ...base, date: ch.apres.date, type: typeDe(ch.apres.type), visiteurs: lireVisiteurs(ch.apres.visiteurs), notes: ch.apres.notes }, [ch.apres.magasin], v.id)
    }
    if (nouvelles.length) await importerVisites(nouvelles.map((ch) => ({ magasin: ch.apres.magasin, date: ch.apres.date, visiteurs: lireVisiteurs(ch.apres.visiteurs ?? ''), notes: ch.apres.notes ?? '', type: typeDe(ch.apres.type ?? '') })), [], r.jour)
  },
  async supprimer(_r, suppressions) { for (const ch of suppressions) await supprimerVisite(Number(ch.cle)) },
}

export function referentiels(reseau: Reseau | null): Referentiel[] {
  return [magasins, franchisesRef, coachs, rrs, affectations, rattachements, chiffres, ninebox, deploiements(reseau), visites]
}
