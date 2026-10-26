// Données exportées en Excel pré-rempli puis réimportées pour ajouter, mettre à jour ou supprimer ligne par ligne.
// Règles communes : une cellule vide ne change rien, une ligne inconnue est ajoutée quand le référentiel le permet,
// une ligne absente du fichier est supprimée quand le référentiel le permet.
import type { ActionLibre, Reseau, Situation, SuiviOuverture, TypeEvenement, TypeFermeture, TypeSituation, Visite } from './modele'
import { etapesOuverture, libelleFermeture, libelleSituation, libellesTypeEvenement, libelleTypeVisite, lireVisiteurs, typeEvenement, typesVisite } from './modele'
import { champsSaisis, completerChiffres, libellesChiffres, lireNombre, type ChampChiffre } from './chiffres'
import { lireMois } from './importChiffres'
import { lireCSV, lireDate, normaliser } from './import'
import { depuisDeploiement, historiqueSante, libelleNote, tousCriteres, type IdCritere, type Note } from './sante'
import { departementDepuisCP, fichePersonne, ficheVide, franchises, separerNom, type FichePersonnelle, type RefPersonne } from './personnes'
import {
  enregistrerAudit, enregistrerCampagne, enregistrerChiffres, enregistrerCoach, enregistrerConstats, enregistrerDeploiements, enregistrerEvenement,
  enregistrerFichePersonne, enregistrerFranchise, enregistrerOuverture, enregistrerMagasin, enregistrerNoteMagasin, enregistrerPratique, enregistrerActionLibre,
  enregistrerRR, enregistrerSituations, enregistrerVisites, importerHistorique, modifierPlanVisite, rattacherCoach, reaffecter, supprimerActionLibre,
  supprimerAffectation, supprimerChiffres, supprimerCoach, supprimerEvaluation, supprimerEvenement, supprimerFranchise, supprimerMagasin,
  supprimerNoteMagasin, supprimerRattachement, supprimerRR, supprimerVisite, modifierAssociesMagasin, type FicheMagasin,
} from './chargement'
import { associesDu, mandatEffectif, type Associe } from './associes'
import { PARTIES } from './compteRendu'
import { MAX_POINTS, perimetres } from './campagnes'
import { themesPratiques, type BonnePratique } from './bonnesPratiques'
import { aOuvrir } from './ouvertures'
import { JOURS, exploitationVide, libellesJour, libellesLicence, libellesTypologie, libellesZone, plageValide } from './exploitation'

export type TypeColonne = 'texte' | 'date' | 'mois' | 'nombre' | 'ouiNon' | 'choix' | 'liste'

export interface Colonne {
  id: string
  entete: string
  type?: TypeColonne
  choix?: string[] // valeurs possibles d'une colonne « choix »
  cle?: boolean // identifie la ligne
  cleVide?: boolean // clé qui peut rester vide (associé sans mandat)
  // Date (ou mois) depuis laquelle les valeurs de ces colonnes sont en place : vide ou inchangée, un changement prend la date du jour ;
  // une date plus ancienne seule fait remonter les valeurs en place à cette date
  depuis?: string[]
  nouveau?: boolean // un nom inconnu de l'app crée une nouvelle ligne au lieu d'être refusé
  largeur?: number
  lecture?: boolean // exportée pour lire le fichier (nom du magasin à côté de son code), jamais relue à l'import
  ancien?: string // ancien en-tête encore reconnu à l'import (fichiers exportés avant un changement de libellé)
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

export type GroupeReferentiel = 'Référentiels' | 'Suivi des magasins' | 'Animation du réseau'

export interface Referentiel {
  id: string
  libelle: string
  groupe: GroupeReferentiel
  feuille: string // 31 caractères au plus (limite d'Excel)
  colonnes: Colonne[]
  lignes: (r: Reseau) => Ligne[]
  ajout?: { obligatoires: string[] } // sans : une ligne inconnue est signalée, pas ajoutée
  appliquer: (r: Reseau, changements: Changement[]) => Promise<void>
  // Sans : une ligne absente du fichier ne change rien (référentiels d'une ligne par magasin ou par Coach)
  supprimer?: (r: Reseau, suppressions: Changement[]) => Promise<void>
  // Ligne exportée vide, à compléter dans le fichier : laissée telle quelle sans erreur
  aCompleter?: (l: Ligne) => boolean
  // Une ligne sans clé (N° vide) est une nouvelle ligne : le N° est donné par l'app
  ajoutSansCle?: boolean
  // Contrôle d'une ligne ajoutée ou modifiée (valeurs finales) : message si elle ne peut pas être enregistrée
  controler?: (l: Ligne, avant: Ligne | null, r: Reseau) => string | null
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
      if (c.id === 'code') return codeLu(t)
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

// « Magasin (clé) » et « Magasin » désignent la même colonne
const mots = (s: string) => normaliser(s).replace(/ d /g, ' ').replace(/ cle$/, '').trim()
const estEntete = (c: Colonne, e: string) => mots(c.entete) === mots(e) || (!!c.ancien && mots(c.ancien) === mots(e))

function ligneEntete(lignes: unknown[][], ref: Referentiel): number {
  let meilleure = -1, max = 0
  lignes.slice(0, 15).forEach((l, i) => {
    const n = l.filter((x) => ref.colonnes.some((c) => estEntete(c, String(x ?? '')))).length
    if (n > max) { max = n; meilleure = i }
  })
  return meilleure
}

// Feuille du référentiel dans un classeur : celle qui porte son nom, sinon celle dont les en-têtes correspondent le mieux
export function choisirFeuille(feuilles: { nom: string; lignes: unknown[][] }[], ref: Referentiel) {
  const parNom = feuilles.find((f) => normaliser(f.nom) === normaliser(ref.feuille))
  if (parNom) return parNom
  const score = (f: { lignes: unknown[][] }) => { const i = ligneEntete(f.lignes, ref); return i < 0 ? 0 : f.lignes[i].filter((x) => ref.colonnes.some((c) => estEntete(c, String(x ?? '')))).length }
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
    const c = ref.colonnes.find((x) => estEntete(x, e))
    if (c?.lecture) return
    if (c && !index.has(c.id)) index.set(c.id, i); else ignorees.push(e)
  })
  const cles = ref.colonnes.filter((c) => c.cle)
  // N° : une ligne sans numéro est une nouvelle ligne, la colonne peut donc manquer
  const manquantes = cles.filter((c) => !index.has(c.id) && !ref.ajoutSansCle).map((c) => c.entete)
  const colonnes = ref.colonnes.filter((c) => index.has(c.id))
  if (manquantes.length) return { ...vide, colonnes, ignorees, manquantes }

  const resolveurs = new Map(ref.colonnes.filter((c) => c.reference).map((c) => [c.id, c.reference!(reseau)]))
  const cleDe = (l: Ligne) => cles.map((c) => l[c.id] ?? '').join(' · ')
  // Clé lisible, suivie du nom du magasin quand la ligne porte un code
  const nomDe = new Map(tousMagasins(reseau).map((m) => [m.code, m.nom]))
  const libelleDe = (l: Ligne) => [...cles.filter((c) => l[c.id]).map((c) => (c.id === 'id' ? `N° ${l[c.id]}` : afficher(c, l[c.id]))), (l.code && nomDe.get(l.code)) || (ref.id === 'magasins' ? l.magasin : ''), cles.some((c) => c.id === 'date') ? '' : l.date ? afficher({ id: 'date', entete: '', type: 'date' }, l.date) : '']
    .filter(Boolean).join(' · ')
  const existantes = new Map(ref.lignes(reseau).filter((l) => !ref.aCompleter?.(l) && cles.every((c) => l[c.id] || c.cleVide)).map((l) => [cleDe(l), l]))
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
    if (ref.aCompleter?.(lue)) { inchangees++; return }
    const sansCle = cles.some((c) => !lue[c.id] && !c.cleVide)
    const cle = sansCle ? `nouvelle-${numero}` : cleDe(lue)
    if (!sansCle) citees.add(cle)
    if (problemes.length) { erreurs.push({ ligne: numero, message: problemes.join(' ; ') }); return }
    const avant = sansCle ? null : existantes.get(cle) ?? null
    const dates = colonnes.filter((c) => c.depuis)
    const parDefaut = (d: Colonne) => (d.type === 'mois' ? jour.slice(0, 7) : jour)
    if (avant) {
      const champs = colonnes.filter((c) => !c.cle && !c.depuis && lue[c.id] && !memeValeur(c, lue[c.id], avant[c.id] ?? '')).map((c) => c.id)
      const depuis: Ligne = {}
      for (const d of dates) {
        const lu = lue[d.id] ?? '', ancien = avant[d.id] ?? ''
        if (d.depuis!.some((id) => champs.includes(id))) { depuis[d.id] = lu && lu !== ancien ? lu : parDefaut(d); continue }
        if (!lu || lu === ancien) continue
        if (!d.depuis!.some((id) => avant[id])) { erreurs.push({ ligne: numero, message: `${d.entete} sans valeur à dater` }); return }
        if (ancien && lu > ancien) { erreurs.push({ ligne: numero, message: `${d.entete} plus récente que celle en place : change la valeur pour la dater` }); return }
        depuis[d.id] = lu
      }
      const modifiees = [...champs, ...Object.keys(depuis).filter((id) => depuis[id] !== avant[id])]
      if (!modifiees.length) { inchangees++; return }
      const ch: Changement = { type: 'modif', cle, libelle: libelleDe(avant), avant, apres: { ...avant, ...Object.fromEntries(champs.map((id) => [id, lue[id]])), ...depuis }, champs: modifiees }
      const refus = ref.controler?.(ch.apres, avant, reseau)
      if (refus) { erreurs.push({ ligne: numero, message: refus }); return }
      // Deux lignes pour la même clé : la dernière l'emporte
      if (vues.has(cle)) changements.splice(changements.indexOf(vues.get(cle)!), 1)
      vues.set(cle, ch); changements.push(ch)
      return
    }
    if (!ref.ajout) { erreurs.push({ ligne: numero, message: sansCle ? 'ligne sans identifiant' : `${cle} introuvable` }); return }
    if (sansCle && !ref.ajoutSansCle) { erreurs.push({ ligne: numero, message: `${cles.filter((c) => !lue[c.id]).map((c) => c.entete).join(', ')} à remplir` }); return }
    if (!sansCle && ref.ajoutSansCle && !cles.some((c) => c.nouveau)) { erreurs.push({ ligne: numero, message: `N° ${cle} introuvable : laisse le N° vide pour ajouter une ligne` }); return }
    const manque = ref.ajout.obligatoires.filter((id) => !lue[id])
    if (manque.length) { erreurs.push({ ligne: numero, message: `${manque.map((id) => ref.colonnes.find((c) => c.id === id)!.entete).join(', ')} à remplir pour un ajout` }); return }
    const apres = { ...lue, ...Object.fromEntries(dates.map((d) => [d.id, lue[d.id] || parDefaut(d)])) }
    const refus = ref.controler?.(apres, null, reseau)
    if (refus) { erreurs.push({ ligne: numero, message: refus }); return }
    const ch: Changement = { type: 'ajout', cle, libelle: libelleDe(apres) || `Ligne ${numero}`, avant: null, apres, champs: colonnes.filter((c) => !c.cle && apres[c.id]).map((c) => c.id) }
    if (vues.has(cle)) changements.splice(changements.indexOf(vues.get(cle)!), 1)
    vues.set(cle, ch); changements.push(ch)
  })
  // Fichier sans aucune ligne : rien n'est supprimé
  // Sans colonne N° (visites) : impossible de savoir quelles lignes manquent, rien n'est supprimé
  if (ref.supprimer && lues && cles.every((c) => index.has(c.id))) {
    for (const [cle, l] of existantes) {
      if (citees.has(cle)) continue
      changements.push({ type: 'suppression', cle, libelle: libelleDe(l), avant: l, apres: l, champs: [] })
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

// Colonnes clés : repérées par « (clé) » et un fond doré, elles identifient la ligne à mettre à jour
export const enteteExport = (c: Colonne) => (c.cle ? `${c.entete} (clé)` : c.entete)
const entete = (c: Colonne) => ({ value: enteteExport(c), fontWeight: 'bold' as const, type: String, ...(c.cle ? { backgroundColor: '#f8bb09', textColor: '#1d1d1b' } : {}) })

export function feuilleExport(ref: Referentiel, reseau: Reseau) {
  const lignes = ref.lignes(reseau)
  return {
    sheet: ref.feuille,
    data: [ref.colonnes.map(entete), ...lignes.map((l) => ref.colonnes.map((c) => cellule(c, l[c.id] ?? '')))],
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
// Clés (Joseph, 24/10/2026) : un magasin par son code à 3 chiffres (jamais par son nom) ; un mouvement (visite, tâche,
// note, événement, bonne pratique) par son N°, vide pour une nouvelle ligne ; une donnée unique par magasin et par période
// (chiffres, Coach, nine box, audits, situations) par code + mois ou date ; une personne par son nom.

export const tousMagasins = (r: Reseau) => [...r.magasins, ...r.fermes]
// Code retapé dans Excel : 12 et « 12 » valent « 012 »
export const codeLu = (v: string) => (/^\d{1,2}$/.test(v) ? v.padStart(3, '0') : v)
const annuaire = (r: Reseau) => {
  const tous = tousMagasins(r)
  return { nomDe: new Map(tous.map((m) => [m.code, m.nom])), codeDe: new Map(tous.map((m) => [m.nom, m.code])) }
}
const refCode = (r: Reseau) => { const codes = new Set(tousMagasins(r).map((m) => m.code).filter(Boolean)); return (v: string) => (codes.has(codeLu(v)) ? codeLu(v) : null) }
const parNom = (noms: string[]) => (v: string) => noms.find((n) => normaliser(n) === normaliser(v)) ?? null
const refCoach = (r: Reseau) => parNom(r.equipe.map((c) => c.nom))
const refRR = (r: Reseau) => parNom(r.rrs.filter((x) => !x.integres).map((x) => x.nom))
const refFranchise = (r: Reseau) => parNom(franchises(r).map((f) => f.nom))

const colCode = (cle = true): Colonne => ({ id: 'code', entete: 'Code magasin', cle, largeur: 14, reference: refCode })
const colNomMagasin: Colonne = { id: 'nom_magasin', entete: 'Magasin', lecture: true, largeur: 28 }
const colN = (type: TypeColonne = 'texte'): Colonne => ({ id: 'id', entete: 'N°', type, cle: true, largeur: 12 })
const listeCodes = (r: Reseau, noms: string[]) => { const { codeDe } = annuaire(r); return noms.map((n) => codeDe.get(n) ?? '').filter(Boolean).join(' ; ') }
const listeNoms = (r: Reseau, noms: string[]) => noms.filter((n) => annuaire(r).codeDe.get(n)).join(' ; ')
const nomsDesCodes = (r: Reseau, codes: string) => { const { nomDe } = annuaire(r); return elementsListe(codes).map((c) => nomDe.get(c) ?? '').filter(Boolean) }
// Ligne d'un magasin : son code et son nom (pour lire)
const leMagasin = (r: Reseau, nom: string): { code: string; nom_magasin: string } => ({ code: annuaire(r).codeDe.get(nom) ?? '', nom_magasin: nom })
const nomDuCode = (r: Reseau, code: string) => annuaire(r).nomDe.get(code) ?? ''
const parCode = <T extends { apres: Ligne }>(changements: T[], cle: (c: T) => string = (c) => c.apres.code) => [...new Set(changements.map(cle))]
const nouvelId = (prefixe: string) => `${prefixe}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

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
// Clé d'un libellé de liste (vide si absent)
const cleDe = <T extends string>(libelles: Record<T, string>, v: string): T | '' => (Object.keys(libelles) as T[]).find((k) => libelles[k] === v) ?? ''

// Code magasin modifiable dans le fichier seulement pour un magasin ajouté (vide = code suivant)
const magasins: Referentiel = {
  id: 'magasins', libelle: 'Magasins', groupe: 'Référentiels', feuille: 'Magasins',
  colonnes: [
    { id: 'code', entete: 'Code magasin', cle: true, nouveau: true, largeur: 14 },
    { id: 'magasin', entete: 'Magasin', largeur: 28 },
    { id: 'statut', entete: 'Statut', type: 'choix', choix: STATUTS },
    { id: 'ouverture', entete: 'Date d’ouverture', type: 'date', largeur: 16 },
    { id: 'adresse', entete: 'Adresse', largeur: 32 },
    { id: 'codePostal', entete: 'Code postal' },
    { id: 'ville', entete: 'Ville', largeur: 18 },
    { id: 'departement', entete: 'Département' },
    { id: 'pays', entete: 'Pays' },
    { id: 'telephone', entete: 'Téléphone', largeur: 16 },
    { id: 'email', entete: 'Email', largeur: 30 },
    { id: 'implantation', entete: 'Implantation des produits', ancien: 'Date d’implantation', type: 'date', largeur: 16 },
    { id: 'typologie', entete: 'Typologie', type: 'choix', choix: Object.values(libellesTypologie) },
    { id: 'zone', entete: 'Zone de chalandise', type: 'choix', choix: Object.values(libellesZone), largeur: 30 },
    { id: 'licence', entete: 'Licence', type: 'choix', choix: Object.values(libellesLicence) },
    { id: 'instagram', entete: 'Instagram', largeur: 30 },
    ...JOURS.map((j): Colonne => ({ id: `h:${j}`, entete: libellesJour[j], largeur: 16 })),
  ],
  lignes: (r) => tousMagasins(r).map((m) => ({
    code: m.code, magasin: m.nom, statut: m.franchise ? STATUTS[0] : STATUTS[1], ouverture: m.ouvertureConnue ? m.ouverture : '',
    adresse: m.adresse, codePostal: m.codePostal, ville: m.ville, departement: m.departement, pays: m.pays, telephone: m.telephone, email: m.email,
    implantation: m.exploitation.implantation, typologie: m.exploitation.typologie ? libellesTypologie[m.exploitation.typologie] : '',
    zone: m.exploitation.zoneChalandise ? libellesZone[m.exploitation.zoneChalandise] : '', licence: m.exploitation.licence ? libellesLicence[m.exploitation.licence] : '',
    instagram: m.exploitation.instagram, ...Object.fromEntries(JOURS.map((j) => [`h:${j}`, m.exploitation.horaires[j] ?? ''])),
  })),
  ajout: { obligatoires: ['magasin'] },
  ajoutSansCle: true,
  controler(l, avant, r) {
    if (!avant && l.code && !/^\d{3,}$/.test(l.code)) return `code ${l.code} : 3 chiffres attendus, ou laisse-le vide`
    const jour = JOURS.find((j) => l[`h:${j}`] && !plageValide(l[`h:${j}`]))
    if (jour) return `horaires du ${jour} « ${l[`h:${jour}`]} » : 10:00-20:00 attendu, plusieurs plages séparées par une virgule`
    const autre = tousMagasins(r).find((m) => normaliser(m.nom) === normaliser(l.magasin) && m.code !== avant?.code)
    return autre ? `${l.magasin} existe déjà (code ${autre.code || 'à venir'})` : null
  },
  async appliquer(r, changements) {
    for (const ch of changements) {
      const m = ch.avant ? tousMagasins(r).find((x) => x.code === ch.avant!.code) : undefined
      const l = ch.apres
      const f: FicheMagasin = {
        nom: l.magasin, code: l.code ?? '', departement: l.departement || departementDepuisCP(l.codePostal ?? ''), ouverture: l.ouverture ?? '',
        franchise: (l.statut ?? STATUTS[0]) === STATUTS[0], telephone: l.telephone ?? '', email: l.email ?? '',
        adresse: l.adresse ?? '', codePostal: l.codePostal ?? '', ville: l.ville ?? '', pays: l.pays ?? '',
        responsable: m?.responsable?.nom ?? '', telResponsable: m?.responsable?.telephone ?? '', emailResponsable: m?.responsable?.email ?? '',
        rrDirect: m?.rrEnDirect && m.rr ? m.rr.id : '', topographie: m?.topographie ?? '', figure: m?.figure ?? '',
        exploitation: {
          ...(m?.exploitation ?? exploitationVide()),
          ...(l.implantation !== undefined ? { implantation: l.implantation } : {}),
          ...(l.typologie !== undefined ? { typologie: cleDe(libellesTypologie, l.typologie) } : {}),
          ...(l.zone !== undefined ? { zoneChalandise: cleDe(libellesZone, l.zone) } : {}),
          ...(l.licence !== undefined ? { licence: cleDe(libellesLicence, l.licence) } : {}),
          ...(l.instagram !== undefined ? { instagram: l.instagram } : {}),
          ...(JOURS.some((j) => l[`h:${j}`] !== undefined) ? { horaires: Object.fromEntries(JOURS.map((j) => [j, l[`h:${j}`] ?? m?.exploitation.horaires[j] ?? '']).filter(([, v]) => v)) } : {}),
        },
      }
      await enregistrerMagasin(f, m ? m.nom : null)
    }
  },
  async supprimer(r, suppressions) { for (const ch of suppressions) await supprimerMagasin(nomDuCode(r, ch.avant!.code)) },
}

const franchisesRef: Referentiel = {
  id: 'franchises', libelle: 'Franchisés', groupe: 'Référentiels', feuille: 'Franchisés',
  colonnes: [
    { id: 'nom', entete: 'Franchisé', cle: true, nouveau: true, largeur: 26, reference: refFranchise },
    { id: 'codes', entete: 'Codes magasins', type: 'liste', largeur: 20, reference: refCode },
    { id: 'noms', entete: 'Magasins', lecture: true, largeur: 40 },
    ...colsPersonne,
  ],
  lignes: (r) => franchises(r).map((f) => ({ nom: f.nom, codes: listeCodes(r, f.magasins.map((m) => m.nom)), noms: listeNoms(r, f.magasins.map((m) => m.nom)), ...ligneFiche(fichePersonne(r, { type: 'franchise', cle: f.nom })) })),
  ajout: { obligatoires: ['nom', 'codes'] },
  async appliquer(r, changements) {
    for (const ch of changements) {
      const nom = ch.apres.nom
      const anciens = ch.avant ? nomsDesCodes(r, ch.avant.codes) : []
      await enregistrerFranchise(nom, ch.avant ? nom : null, nomsDesCodes(r, ch.apres.codes), anciens, ficheDepuis(r, ch.avant ? { type: 'franchise', cle: nom } : null, nom, ch.apres), r)
    }
  },
  async supprimer(r, suppressions) { for (const ch of suppressions) await supprimerFranchise(ch.cle, nomsDesCodes(r, ch.avant!.codes), r) },
}

// Une ligne par mandat (ou par associé sans mandat) : franchisés associés d'un franchisé, associés d'un intégré
const mandats: Referentiel = {
  id: 'mandats', libelle: 'Associés et mandats', groupe: 'Référentiels', feuille: 'Mandats',
  colonnes: [
    colCode(), colNomMagasin,
    { id: 'nom', entete: 'Franchisé ou associé', ancien: 'Franchisé', cle: true, nouveau: true, largeur: 26, reference: refFranchise },
    { id: 'entree', entete: 'Entrée', type: 'date', largeur: 16 },
    { id: 'debut', entete: 'Début du mandat', type: 'date', cle: true, cleVide: true, largeur: 16 },
    { id: 'fin', entete: 'Fin du mandat', type: 'date', largeur: 16 },
    { id: 'sortie', entete: 'Date de sortie', type: 'date', largeur: 16 },
    { id: 'enCoursDebut', entete: 'Mandat en cours : début', type: 'date', lecture: true, largeur: 16 },
    { id: 'enCoursFin', entete: 'Mandat en cours : fin', type: 'date', lecture: true, largeur: 16 },
    { id: 'enCoursNumero', entete: 'N° du mandat en cours', lecture: true, largeur: 12 },
  ],
  // Mandat en cours (saisi ou calculé sur 5 ans) sur la ligne du mandat saisi correspondant, ou sur la ligne sans mandat
  lignes: (r) => r.magasins.filter((m) => m.code).flatMap((m) => associesDu(r, m).filter((a) => !/recrutement/i.test(a.nom)).flatMap((a) => {
    const e = mandatEffectif(r, m, a)
    return (a.mandats.length ? a.mandats : [{ debut: '', fin: '' }]).map((x) => {
      const courant = e && (e.calcule || x === e.mandat)
      return { ...leMagasin(r, m.nom), nom: a.nom, entree: a.entree, debut: x.debut, fin: x.fin, sortie: a.sortie,
        enCoursDebut: courant ? e.mandat.debut : '', enCoursFin: courant ? e.mandat.fin : '', enCoursNumero: courant ? String(e.numero) : '' }
    })
  })),
  ajout: { obligatoires: ['code', 'nom'] },
  aCompleter: (l) => !!l.code && !!l.nom && !l.entree && !l.debut && !l.fin && !l.sortie,
  async appliquer(r, changements) {
    for (const code of parCode(changements)) {
      await modifierAssociesMagasin(r, nomDuCode(r, code), (liste) => {
        const l = liste.map((a) => ({ ...a, mandats: [...a.mandats] }))
        for (const ch of changements.filter((c) => c.apres.code === code)) {
          let a = l.find((x) => x.nom === ch.apres.nom)
          if (!a) { a = { id: '', nom: ch.apres.nom, entree: '', sortie: '', mandats: [] } as Associe; l.push(a) }
          if (ch.apres.sortie !== undefined && (ch.type === 'ajout' || ch.champs.includes('sortie'))) a.sortie = ch.apres.sortie
          if (ch.apres.entree !== undefined && (ch.type === 'ajout' || ch.champs.includes('entree'))) a.entree = ch.apres.entree
          const ancien = ch.avant ? a.mandats.findIndex((x) => x.debut === ch.avant!.debut) : -1
          const fin = ch.apres.fin ?? (ancien >= 0 ? a.mandats[ancien].fin : '')
          if (!ch.apres.debut && !fin) continue
          if (ancien >= 0) a.mandats[ancien] = { debut: ch.apres.debut, fin }
          else a.mandats = [...a.mandats.filter((x) => x.debut !== ch.apres.debut || (!x.debut && !x.fin)), { debut: ch.apres.debut, fin }]
          a.mandats.sort((x, y) => (x.debut || x.fin).localeCompare(y.debut || y.fin))
        }
        return l
      })
    }
  },
  async supprimer(r, suppressions) {
    for (const code of parCode(suppressions)) {
      await modifierAssociesMagasin(r, nomDuCode(r, code), (liste) => {
        // Seuls les mandats sont retirés : un associé quitte le magasin depuis sa fiche ou avec une date de sortie
        const l = liste.map((a) => ({ ...a, mandats: [...a.mandats] }))
        for (const ch of suppressions.filter((c) => c.apres.code === code)) {
          const a = l.find((x) => x.nom === ch.avant!.nom)
          if (a) a.mandats = a.mandats.filter((x) => x.debut !== ch.avant!.debut)
        }
        return l
      })
    }
  },
}

const coachs: Referentiel = {
  id: 'coachs', libelle: 'Coachs', groupe: 'Référentiels', feuille: 'Coachs',
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

const COULEURS_RR = ['#307672', '#ea6029', '#1d1d1b', '#f8bb09', '#c24119', '#3a8f8d', '#f7d802', '#312e2e']
const rrs: Referentiel = {
  id: 'rrs', libelle: 'Responsables Régionaux', groupe: 'Référentiels', feuille: 'Responsables Régionaux',
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

// Historique : une ligne par changement de Coach (effet le 1er du mois)
const affectations: Referentiel = {
  id: 'affectations', libelle: 'Coach des magasins', groupe: 'Référentiels', feuille: 'Coach des magasins',
  colonnes: [colCode(), colNomMagasin, { id: 'mois', entete: 'À partir du mois', type: 'mois', cle: true, largeur: 18 }, { id: 'coach', entete: 'Coach', largeur: 24, reference: refCoach }],
  lignes: (r) => tousMagasins(r).filter((m) => m.code).flatMap((m) => {
    // Un seul changement par mois : le dernier du mois
    const parMois = new Map(m.historiqueCoach.map((a) => [a.date.slice(0, 7), a.coach]))
    return [...parMois].map(([mois, coach]) => ({ ...leMagasin(r, m.nom), mois, coach }))
  }),
  ajout: { obligatoires: ['code', 'mois', 'coach'] },
  async appliquer(r, changements) {
    for (const ch of changements) await reaffecter(nomDuCode(r, ch.apres.code), ch.apres.coach, `${ch.apres.mois}-01`, 'Import Excel')
  },
  async supprimer(r, suppressions) { for (const ch of suppressions) await supprimerAffectation(nomDuCode(r, ch.avant!.code), ch.avant!.mois) },
}

// Historique : une ligne par rattachement d'un Coach à un Responsable Régional (effet le 1er du mois)
const rattachements: Referentiel = {
  id: 'rattachements', libelle: 'Responsable Régional des Coachs', groupe: 'Référentiels', feuille: 'RR des Coachs',
  colonnes: [{ id: 'coach', entete: 'Coach', cle: true, largeur: 24, reference: refCoach }, { id: 'mois', entete: 'À partir du mois', type: 'mois', cle: true, largeur: 18 }, { id: 'rr', entete: 'Responsable Régional', largeur: 24, reference: refRR }],
  lignes: (r) => r.equipe.flatMap((c) => {
    const parMois = new Map(c.historiqueRR.map((a) => [a.date.slice(0, 7), a.rr?.nom ?? '']))
    if (!parMois.size && c.rr) return [{ coach: c.nom, mois: '', rr: c.rr.nom }]
    return [...parMois].map(([mois, rr]) => ({ coach: c.nom, mois, rr }))
  }),
  ajout: { obligatoires: ['coach', 'mois', 'rr'] },
  // Rattachement d'avant l'historique daté : le mois est à remplir pour le reprendre
  aCompleter: (l) => !!l.coach && !l.mois,
  async appliquer(r, changements) {
    for (const ch of changements) await rattacherCoach(ch.apres.coach, r.rrs.find((x) => x.nom === ch.apres.rr)!.id, `${ch.apres.mois}-01`)
  },
  async supprimer(_r, suppressions) { for (const ch of suppressions) await supprimerRattachement(ch.avant!.coach, ch.avant!.mois) },
}

const TYPES_SITUATION = Object.values(libelleSituation)
const TYPES_SORTIE = Object.values(libelleFermeture)
const idSituation = (s: string) => (Object.entries(libelleSituation).find(([, v]) => v === s)?.[0] ?? 'travaux') as TypeSituation
const idSortie = (s: string) => (Object.entries(libelleFermeture).find(([, v]) => v === s)?.[0] ?? 'fermeture') as TypeFermeture
const situations: Referentiel = {
  id: 'situations', libelle: 'Situations des magasins', groupe: 'Suivi des magasins', feuille: 'Situations',
  colonnes: [
    colCode(), colNomMagasin,
    { id: 'date', entete: 'Date', type: 'date', cle: true },
    { id: 'type', entete: 'Situation', type: 'choix', choix: TYPES_SITUATION, cle: true, largeur: 24 },
    { id: 'fin', entete: 'Fin', type: 'date' },
    { id: 'sortie', entete: 'Type de sortie', type: 'choix', choix: TYPES_SORTIE, largeur: 20 },
    { id: 'motif', entete: 'Motif', largeur: 30 },
    { id: 'repreneur', entete: 'Repreneur', largeur: 24 },
  ],
  lignes: (r) => tousMagasins(r).filter((m) => m.code).flatMap((m) => m.situations.map((s) => ({
    ...leMagasin(r, m.nom), date: s.date, type: libelleSituation[s.type], fin: s.fin ?? '', sortie: s.sortie ? libelleFermeture[s.sortie] : '', motif: s.motif ?? '', repreneur: s.repreneur ?? '',
  }))),
  ajout: { obligatoires: ['code', 'date', 'type'] },
  controler: (l) => (idSituation(l.type) === 'travaux' && l.fin && l.fin < l.date ? 'fin avant la date de début' : null),
  async appliquer(r, changements) { await ecrireSituations(r, changements, []) },
  async supprimer(r, suppressions) { await ecrireSituations(r, [], suppressions) },
}
async function ecrireSituations(r: Reseau, changements: Changement[], suppressions: Changement[]) {
  for (const code of parCode([...changements, ...suppressions])) {
    const m = tousMagasins(r).find((x) => x.code === code)!
    const meme = (s: Situation, l: Ligne) => s.date === l.date && s.type === idSituation(l.type)
    let liste = m.situations.filter((s) => !suppressions.some((c) => c.apres.code === code && meme(s, c.avant!)))
    for (const ch of changements.filter((c) => c.apres.code === code)) {
      const l = ch.apres, type = idSituation(l.type)
      const s: Situation = { date: l.date, type, ...(type === 'travaux' && l.fin ? { fin: l.fin } : {}), ...(type === 'sortie' ? { sortie: idSortie(l.sortie ?? '') } : {}), ...(l.motif ? { motif: l.motif } : {}), ...(type === 'sortie' && l.repreneur ? { repreneur: l.repreneur } : {}) }
      liste = [...liste.filter((x) => !meme(x, l)), s]
    }
    liste.sort((a, b) => a.date.localeCompare(b.date))
    const res = await enregistrerSituations(m.nom, liste)
    if (res !== 'ok') throw new Error('situations')
  }
}

const chiffres: Referentiel = {
  id: 'chiffres', libelle: 'Chiffres mensuels', groupe: 'Suivi des magasins', feuille: 'Chiffres mensuels',
  colonnes: [colCode(), colNomMagasin, { id: 'mois', entete: 'Mois', type: 'mois', cle: true }, ...champsSaisis.map((c) => ({ id: c, entete: `${libellesChiffres[c].libelle}${libellesChiffres[c].unite ? ` (${libellesChiffres[c].unite})` : ''}`, type: 'nombre' as const, largeur: 20 }))],
  lignes: (r) => Object.values(r.chiffres).flat().map((c) => ({ ...leMagasin(r, c.magasin), mois: c.mois, ...Object.fromEntries(champsSaisis.map((k) => [k, c[k] === null ? '' : String(c[k])])) })),
  ajout: { obligatoires: ['code', 'mois'] },
  async appliquer(r, changements) {
    await enregistrerChiffres(changements.map((ch) => {
      const magasin = nomDuCode(r, ch.apres.code)
      const l = { magasin, mois: ch.apres.mois, ...Object.fromEntries(ch.champs.map((k) => [k, Number(ch.apres[k])])) } as { magasin: string; mois: string } & Partial<Record<ChampChiffre, number>>
      return completerChiffres(l, r.chiffres[magasin]?.find((c) => c.mois === l.mois))
    }))
  },
  async supprimer(r, suppressions) { for (const ch of suppressions) await supprimerChiffres(nomDuCode(r, ch.avant!.code), ch.avant!.mois) },
}

const NOTES = [libelleNote[1], libelleNote[2], libelleNote[3], libelleNote[0]]
const noteDe = (s: string) => Number(Object.entries(libelleNote).find(([, v]) => v === s)?.[0] ?? '') as Note
// Historique : une ligne par classement daté, une colonne par critère de la grille en vigueur
function ninebox(reseau: Reseau | null): Referentiel {
  const criteres = reseau?.grilleNineBox.criteres ?? tousCriteres
  return {
    id: 'ninebox', libelle: 'Nine box', groupe: 'Suivi des magasins', feuille: 'Nine box',
    colonnes: [
      colCode(), colNomMagasin,
      { id: 'date', entete: 'Date du classement', type: 'date', cle: true, largeur: 18 },
      ...criteres.map((c) => ({ id: c.id, entete: c.libelle, type: 'choix' as const, choix: NOTES, largeur: 18 })),
    ],
    lignes: (r) => tousMagasins(r).filter((m) => m.code).flatMap((m) => historiqueSante(r.evaluations, m.nom).filter((p) => p.notes).map((p) => ({
      ...leMagasin(r, m.nom), date: p.date, ...Object.fromEntries(criteres.map((c) => { const n = p.notes![c.id]; return [c.id, n === undefined ? '' : libelleNote[n]] })),
    }))),
    ajout: { obligatoires: ['code', 'date'] },
    async appliquer(r, changements) {
      await importerHistorique(changements.map((ch) => ({
        magasin: nomDuCode(r, ch.apres.code), date: ch.apres.date,
        notes: Object.fromEntries(criteres.filter((c) => ch.apres[c.id]).map((c) => [c.id, noteDe(ch.apres[c.id])])) as Partial<Record<IdCritere, Note>>,
      })), r.directeur.nom)
    },
    async supprimer(r, suppressions) { for (const ch of suppressions) await supprimerEvaluation(nomDuCode(r, ch.avant!.code), ch.avant!.date) },
  }
}

const TYPES_AUDIT: Record<string, string> = { hygiene: 'Audit hygiène', excellence: 'Audit excellence' }
const audits: Referentiel = {
  id: 'audits', libelle: 'Notes d’audit', groupe: 'Suivi des magasins', feuille: 'Notes d’audit',
  colonnes: [
    colCode(), colNomMagasin,
    { id: 'date', entete: 'Date', type: 'date', cle: true },
    { id: 'type', entete: 'Audit', type: 'choix', choix: Object.values(TYPES_AUDIT), cle: true, largeur: 18 },
    { id: 'score', entete: 'Note (%)', type: 'nombre' },
    { id: 'conforme', entete: 'Conforme', type: 'ouiNon' },
  ],
  lignes: (r) => Object.entries(r.audits).flatMap(([nom, liste]) => liste.filter((a) => TYPES_AUDIT[a.type]).map((a) => ({
    ...leMagasin(r, nom), date: a.date, type: TYPES_AUDIT[a.type], score: a.score === null ? '' : String(a.score), conforme: a.conforme === null ? '' : ouiNon(a.conforme),
  }))).filter((l) => l.code),
  ajout: { obligatoires: ['code', 'date', 'type'] },
  async appliquer(r, changements) {
    for (const ch of changements) {
      const nom = nomDuCode(r, ch.apres.code)
      const type = Object.keys(TYPES_AUDIT).find((k) => TYPES_AUDIT[k] === ch.apres.type)!
      const avant = r.audits[nom]?.find((a) => a.date === ch.apres.date && a.type === type)
      await enregistrerAudit(nom, null, { ...avant, date: ch.apres.date, type, score: ch.apres.score ? Number(ch.apres.score) : null, conforme: ch.apres.conforme ? ch.apres.conforme === OUI : null })
    }
  },
  async supprimer(r, suppressions) {
    for (const ch of suppressions) {
      const type = Object.keys(TYPES_AUDIT).find((k) => TYPES_AUDIT[k] === ch.avant!.type)!
      await enregistrerAudit(nomDuCode(r, ch.avant!.code), { date: ch.avant!.date, type }, null)
    }
  },
}

// Une ligne par magasin : pour chaque thématique, l'état et la date depuis laquelle il est en place.
// Colonnes construites à partir des thématiques du moment
function deploiements(reseau: Reseau | null): Referentiel {
  const ths = reseau?.deploiements.thematiques ?? []
  return {
    id: 'deploiements', libelle: 'Déploiements', groupe: 'Suivi des magasins', feuille: 'Déploiements',
    colonnes: [colCode(), colNomMagasin, ...ths.flatMap((t): Colonne[] => [
      { id: `t:${t.id}`, entete: t.libelle, type: 'choix', choix: t.options.map((o) => o.libelle), largeur: 18 },
      { id: `d:${t.id}`, entete: `${t.libelle} : date`, type: 'date', depuis: [`t:${t.id}`], largeur: 16 },
    ])],
    lignes: (r) => r.magasins.filter((m) => m.code).map((m) => ({ ...leMagasin(r, m.nom), ...Object.fromEntries(ths.flatMap((t) => {
      return [[`t:${t.id}`, r.deploiements.valeurs[m.nom]?.[t.id] ?? ''], [`d:${t.id}`, depuisDeploiement(r.deploiements, m.nom, t.id)]]
    })) })),
    async appliquer(r, changements) {
      await enregistrerDeploiements(changements.flatMap((ch) => ths
        .filter((t) => ch.apres[`t:${t.id}`] && (ch.champs.includes(`t:${t.id}`) || ch.champs.includes(`d:${t.id}`)))
        .map((t) => ({ magasin: nomDuCode(r, ch.apres.code), thematique: t.id, etat: ch.apres[`t:${t.id}`], date: ch.apres[`d:${t.id}`] }))), r.jour)
    },
  }
}

const TYPES = typesVisite.map((t) => t.libelle)
const typeDe = (s: string) => typesVisite.find((t) => t.libelle === s)?.id ?? 'terrain'
// Le N° est celui de la base : changer la date ou le magasin d'une visite garde son compte rendu
const visites: Referentiel = {
  id: 'visites', libelle: 'Visites', groupe: 'Suivi des magasins', feuille: 'Visites',
  colonnes: [
    colN('nombre'),
    colCode(false), colNomMagasin,
    { id: 'date', entete: 'Date', type: 'date' },
    { id: 'type', entete: 'Type', type: 'choix', choix: TYPES, largeur: 22 },
    { id: 'prevue', entete: 'Prévue', type: 'ouiNon' },
    { id: 'visiteurs', entete: 'Participants', largeur: 30 },
    { id: 'notes', entete: 'Notes', largeur: 50 },
    ...PARTIES.map((p, i): Colonne => ({ id: `p${i}`, entete: p.titre, largeur: 40 })),
  ],
  lignes: (r) => r.visites.filter((v) => v.id !== null).map((v) => ({
    id: String(v.id), ...leMagasin(r, v.magasin), date: v.date, type: libelleTypeVisite(v.type), prevue: ouiNon(!!v.prevue), visiteurs: v.visiteurs.join(', '), notes: v.notes,
    ...Object.fromEntries(PARTIES.map((_p, i) => [`p${i}`, v.parties[i] ?? ''])),
  })),
  ajout: { obligatoires: ['code', 'date'] },
  ajoutSansCle: true,
  async appliquer(r, changements) {
    const parties = (l: Ligne, avant?: string[]) => PARTIES.map((_p, i) => l[`p${i}`] ?? avant?.[i] ?? '')
    for (const ch of changements) {
      const l = ch.apres
      const v = ch.avant ? r.visites.find((x) => String(x.id) === ch.cle)! : null
      const base: Omit<Visite, 'magasin' | 'id'> = v
        ? (({ id: _id, magasin: _m, ...b }) => b)(v)
        : { groupe: '', date: '', type: 'terrain', visiteurs: [], signatureRequise: false, lienSigne: '', dateSignature: '', documents: [], notes: '', parties: [], plan: [] }
      await enregistrerVisites({
        ...base, date: l.date, type: typeDe(l.type ?? ''), visiteurs: lireVisiteurs(l.visiteurs ?? ''), notes: l.notes ?? '', prevue: l.prevue === OUI, parties: parties(l, v?.parties),
      }, [nomDuCode(r, l.code) || v!.magasin], v?.id ?? null)
    }
  },
  async supprimer(_r, suppressions) { for (const ch of suppressions) await supprimerVisite(Number(ch.cle)) },
}

// Tâches hors visite (N° = identifiant de la tâche) et tâches des plans d'action (N° = V + numéro de la visite + rang)
const ORIGINE_LIBRE = 'Hors visite'
const taches: Referentiel = {
  id: 'taches', libelle: 'Tâches', groupe: 'Suivi des magasins', feuille: 'Tâches',
  colonnes: [
    colN(), colCode(false), colNomMagasin,
    { id: 'origine', entete: 'Origine', lecture: true, largeur: 22 },
    { id: 'creeLe', entete: 'Créée le', type: 'date', lecture: true },
    { id: 'action', entete: 'Tâche', largeur: 50 },
    { id: 'porteur', entete: 'Porteurs', largeur: 30 },
    { id: 'echeance', entete: 'Échéance', type: 'date' },
    { id: 'faite', entete: 'Faite le', type: 'date' },
    { id: 'equipe', entete: 'Équipe seule', type: 'ouiNon' },
  ],
  lignes: (r) => {
    const iso = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d ?? '') ? d : '')
    const libres = Object.entries(r.actionsLibres).flatMap(([nom, l]) => l.map((a) => ({
      id: a.id, ...leMagasin(r, nom), origine: ORIGINE_LIBRE, creeLe: iso(a.creeLe), action: a.action, porteur: a.porteur, echeance: iso(a.echeance), faite: iso(a.faite ?? ''), equipe: ouiNon(a.fil === 'equipe'),
    })))
    const plans = r.visites.filter((v) => v.id !== null).flatMap((v) => v.plan.map((a, i) => ({
      id: `V${v.id}-${i + 1}`, ...leMagasin(r, v.magasin), origine: `Visite n° ${v.id}`, creeLe: v.date, action: a.action, porteur: a.porteur, echeance: iso(a.echeance), faite: iso(a.faite ?? ''), equipe: NON,
    })))
    return [...libres, ...plans].filter((l) => l.code)
  },
  ajout: { obligatoires: ['code', 'action'] },
  ajoutSansCle: true,
  controler: (l, avant) => {
    if (avant?.id.startsWith('V') && l.code !== avant.code) return 'le magasin d’une tâche de visite se change dans la visite'
    if (avant?.id.startsWith('V') && l.equipe === OUI) return 'une tâche de visite est vue par le franchisé'
    return null
  },
  async appliquer(r, changements) {
    const enPlan = changements.filter((c) => c.avant?.id.startsWith('V'))
    await ecrirePlans(r, enPlan, [])
    for (const ch of changements.filter((c) => !enPlan.includes(c))) {
      const l = ch.apres, nom = nomDuCode(r, l.code)
      const ancienNom = ch.avant ? nomDuCode(r, ch.avant.code) : ''
      const a = ch.avant ? r.actionsLibres[ancienNom]?.find((x) => x.id === ch.cle) : undefined
      const t: ActionLibre = { ...(a ?? { id: '', creeLe: r.jour, auteur: r.directeur.nom }), action: l.action, porteur: l.porteur ?? '', echeance: l.echeance || a?.echeance || '', faite: l.faite ?? '' }
      if (l.equipe === OUI) t.fil = 'equipe'; else delete t.fil
      if (a && ancienNom !== nom) await supprimerActionLibre(ancienNom, a.id)
      await enregistrerActionLibre(nom, a && ancienNom === nom ? t : { ...t, id: a?.id ?? nouvelId('l') })
    }
  },
  async supprimer(r, suppressions) {
    const enPlan = suppressions.filter((c) => c.cle.startsWith('V'))
    await ecrirePlans(r, [], enPlan)
    for (const ch of suppressions.filter((c) => !enPlan.includes(c))) await supprimerActionLibre(nomDuCode(r, ch.avant!.code), ch.cle)
  },
}
// Plans d'action : chaque visite concernée réécrite une fois, rangs comptés sur le plan en place
async function ecrirePlans(r: Reseau, changements: Changement[], suppressions: Changement[]) {
  const rang = (cle: string) => { const [v, i] = cle.slice(1).split('-'); return { visite: Number(v), index: Number(i) - 1 } }
  for (const id of [...new Set([...changements, ...suppressions].map((c) => rang(c.cle).visite))]) {
    const v = r.visites.find((x) => x.id === id)
    if (!v) continue
    const plan = v.plan.map((a) => ({ ...a }))
    for (const ch of changements.filter((c) => rang(c.cle).visite === id)) {
      const a = plan[rang(ch.cle).index]
      if (!a) continue
      Object.assign(a, { action: ch.apres.action, porteur: ch.apres.porteur ?? '', echeance: ch.apres.echeance || a.echeance })
      if (ch.apres.faite) a.faite = ch.apres.faite
    }
    const retires = new Set(suppressions.filter((c) => rang(c.cle).visite === id).map((c) => rang(c.cle).index))
    await modifierPlanVisite(id, plan.filter((_a, i) => !retires.has(i)))
  }
}

const journal: Referentiel = {
  id: 'journal', libelle: 'Journal des magasins', groupe: 'Suivi des magasins', feuille: 'Journal',
  colonnes: [colN(), colCode(false), colNomMagasin, { id: 'date', entete: 'Date', type: 'date' }, { id: 'par', entete: 'Auteur', largeur: 24 }, { id: 'texte', entete: 'Note', largeur: 60 }],
  lignes: (r) => Object.entries(r.notesMagasins).flatMap(([nom, l]) => l.map((n) => ({ id: n.id, ...leMagasin(r, nom), date: n.date, par: n.par, texte: n.texte }))).filter((l) => l.code),
  ajout: { obligatoires: ['code', 'date', 'texte'] },
  ajoutSansCle: true,
  async appliquer(r, changements) {
    for (const ch of changements) {
      const l = ch.apres, nom = nomDuCode(r, l.code)
      if (ch.avant && ch.avant.code !== l.code) await supprimerNoteMagasin(nomDuCode(r, ch.avant.code), ch.cle)
      await enregistrerNoteMagasin(nom, { id: ch.avant ? ch.cle : nouvelId('n'), date: l.date, texte: l.texte, par: l.par || r.directeur.nom })
    }
  },
  async supprimer(r, suppressions) { for (const ch of suppressions) await supprimerNoteMagasin(nomDuCode(r, ch.avant!.code), ch.cle) },
}

// Campagnes nationales (les campagnes régionales restent tenues par leur Responsable Régional)
const PERIMETRES = perimetres.map((p) => p.libelle)
const campagnes: Referentiel = {
  id: 'campagnes', libelle: 'Campagnes', groupe: 'Animation du réseau', feuille: 'Campagnes',
  colonnes: [
    { id: 'nom', entete: 'Campagne', cle: true, nouveau: true, largeur: 28 },
    { id: 'debut', entete: 'Début', type: 'date' },
    { id: 'fin', entete: 'Fin', type: 'date' },
    { id: 'perimetre', entete: 'Magasins concernés', type: 'choix', choix: PERIMETRES, largeur: 26 },
    { id: 'codes', entete: 'Codes magasins choisis', type: 'liste', largeur: 24, reference: refCode },
    { id: 'points', entete: 'Points à constater', type: 'liste', largeur: 60 },
  ],
  lignes: (r) => r.campagnes.liste.filter((c) => !c.rr).map((c) => ({
    nom: c.nom, debut: c.debut, fin: c.fin, perimetre: perimetres.find((p) => p.id === c.perimetre)?.libelle ?? '', codes: listeCodes(r, c.magasins), points: c.points.map((p) => p.libelle).join(' ; '),
  })),
  ajout: { obligatoires: ['nom', 'debut', 'fin', 'points'] },
  controler: (l) => (l.fin < l.debut ? 'fin avant le début' : elementsListe(l.points).length > MAX_POINTS ? `${MAX_POINTS} points au plus` : null),
  async appliquer(r, changements) {
    for (const ch of changements) {
      const ex = r.campagnes.liste.find((c) => !c.rr && c.nom === ch.cle)
      const l = ch.apres
      const points = elementsListe(l.points).map((libelle, i) => ex?.points.find((p) => p.libelle === libelle) ?? { id: `p${Date.now().toString(36)}${i}`, libelle })
      const id = ex?.id ?? nouvelId('c')
      await enregistrerCampagne(id, {
        id, nom: l.nom, debut: l.debut, fin: l.fin, points, perimetre: perimetres.find((p) => p.libelle === l.perimetre)?.id ?? 'tous', magasins: nomsDesCodes(r, l.codes ?? ''),
      })
    }
  },
  async supprimer(r, suppressions) { for (const ch of suppressions) await enregistrerCampagne(r.campagnes.liste.find((c) => !c.rr && c.nom === ch.cle)!.id, null) },
}

// Un point constaté (ou non) dans un magasin pour une campagne ; retirer la ligne remet le point « à constater »
const constats: Referentiel = {
  id: 'constats', libelle: 'Constats de campagne', groupe: 'Animation du réseau', feuille: 'Constats',
  colonnes: [
    { id: 'campagne', entete: 'Campagne', cle: true, largeur: 28, reference: (r) => parNom(r.campagnes.liste.map((c) => c.nom)) },
    colCode(), colNomMagasin,
    { id: 'point', entete: 'Point', cle: true, largeur: 40 },
    { id: 'fait', entete: 'Fait', type: 'ouiNon' },
    { id: 'date', entete: 'Date du constat', type: 'date' },
    { id: 'par', entete: 'Constaté par', largeur: 24 },
  ],
  lignes: (r) => r.campagnes.liste.flatMap((c) => Object.entries(r.campagnes.constats[c.id] ?? {}).flatMap(([nom, k]) => Object.entries(k).map(([point, x]) => ({
    campagne: c.nom, ...leMagasin(r, nom), point: c.points.find((p) => p.id === point)?.libelle ?? '', fait: ouiNon(x.fait), date: x.date, par: x.par,
  })))).filter((l) => l.code && l.point),
  ajout: { obligatoires: ['campagne', 'code', 'point', 'fait'] },
  controler: (l, _a, r) => (r.campagnes.liste.find((c) => c.nom === l.campagne)?.points.some((p) => p.libelle === l.point) ? null : `point « ${l.point} » absent de la campagne`),
  async appliquer(r, changements) {
    await enregistrerConstats(changements.map((ch) => {
      const c = r.campagnes.liste.find((x) => x.nom === ch.apres.campagne)!
      return { campagne: c.id, magasin: nomDuCode(r, ch.apres.code), point: c.points.find((p) => p.libelle === ch.apres.point)!.id, fait: ch.apres.fait === OUI, date: ch.apres.date || r.jour, par: ch.apres.par || r.directeur.nom }
    }))
  },
  async supprimer(r, suppressions) {
    await enregistrerConstats(suppressions.map((ch) => {
      const c = r.campagnes.liste.find((x) => x.nom === ch.avant!.campagne)!
      return { campagne: c.id, magasin: nomDuCode(r, ch.avant!.code), point: c.points.find((p) => p.libelle === ch.avant!.point)!.id, fait: null, date: '', par: '' }
    }))
  },
}

const TYPES_EVENEMENT = Object.values(libellesTypeEvenement)
const agenda: Referentiel = {
  id: 'agenda', libelle: 'Agenda', groupe: 'Animation du réseau', feuille: 'Agenda',
  colonnes: [
    colN('nombre'),
    { id: 'titre', entete: 'Titre', largeur: 32 },
    { id: 'type', entete: 'Type', type: 'choix', choix: TYPES_EVENEMENT },
    { id: 'debut', entete: 'Début', type: 'date' },
    { id: 'fin', entete: 'Fin', type: 'date' },
    { id: 'heure', entete: 'Heure' },
    { id: 'notes', entete: 'Notes', largeur: 50 },
    { id: 'invites', entete: 'Codes magasins invités', type: 'liste', largeur: 24, reference: refCode },
  ],
  lignes: (r) => r.evenements.filter((e) => e.id !== null).map((e) => ({
    id: String(e.id), titre: e.titre, type: libellesTypeEvenement[typeEvenement(e)], debut: e.debut, fin: e.fin, heure: e.heure ?? '', notes: e.notes, invites: listeCodes(r, e.invites ?? []),
  })),
  ajout: { obligatoires: ['titre', 'debut'] },
  ajoutSansCle: true,
  controler: (l) => (l.heure && !/^\d{1,2}[:h]\d{2}$/.test(l.heure) ? `heure ${l.heure} : écris-la 09:30` : l.fin && l.fin < l.debut ? 'fin avant le début' : null),
  async appliquer(r, changements) {
    for (const ch of changements) {
      const l = ch.apres
      const e = ch.avant ? r.evenements.find((x) => String(x.id) === ch.cle) : undefined
      const type = (Object.entries(libellesTypeEvenement).find(([, v]) => v === l.type)?.[0] ?? 'event') as TypeEvenement
      await enregistrerEvenement({
        ...(e ?? { id: null, couleur: '#307672', notes: '', fin: '' }), titre: l.titre, type, debut: l.debut, fin: l.fin ?? '', notes: l.notes ?? '',
        heure: l.heure ? l.heure.replace('h', ':').padStart(5, '0') : '', invites: type === 'event' ? [] : nomsDesCodes(r, l.invites ?? ''),
      })
    }
  },
  async supprimer(_r, suppressions) { for (const ch of suppressions) await supprimerEvenement(Number(ch.cle)) },
}

// Texte des bonnes pratiques ; photos et J'aime gardés tels quels
const pratiques: Referentiel = {
  id: 'pratiques', libelle: 'Bonnes pratiques', groupe: 'Animation du réseau', feuille: 'Bonnes pratiques',
  colonnes: [
    colN(), colCode(false), colNomMagasin,
    { id: 'date', entete: 'Date', type: 'date' },
    { id: 'titre', entete: 'Titre', largeur: 32 },
    { id: 'theme', entete: 'Thème', type: 'choix', choix: themesPratiques, largeur: 22 },
    { id: 'texte', entete: 'Texte', largeur: 60 },
    { id: 'par', entete: 'Remontée par', largeur: 24 },
    { id: 'reprises', entete: 'Codes magasins qui l’appliquent', type: 'liste', largeur: 24, reference: refCode },
  ],
  lignes: (r) => r.pratiques.map((p) => ({ id: p.id, ...leMagasin(r, p.magasin), date: p.date, titre: p.titre, theme: themesPratiques.includes(p.theme) ? p.theme : '', texte: p.texte, par: p.par, reprises: listeCodes(r, p.reprises) })),
  ajout: { obligatoires: ['titre', 'date'] },
  ajoutSansCle: true,
  async appliquer(r, changements) {
    for (const ch of changements) {
      const l = ch.apres
      const p = ch.avant ? r.pratiques.find((x) => x.id === ch.cle) : undefined
      const base: BonnePratique = p ?? { id: nouvelId('bp'), magasin: '', date: '', titre: '', theme: '', texte: '', par: r.directeur.nom, photos: [], entete: '', reprises: [], jaime: [] }
      await enregistrerPratique(base.id, {
        ...base, magasin: l.code ? nomDuCode(r, l.code) : base.magasin, date: l.date, titre: l.titre, theme: l.theme ?? base.theme, texte: l.texte ?? '', par: l.par ?? base.par,
        reprises: l.reprises !== undefined ? nomsDesCodes(r, l.reprises) : base.reprises,
      })
    }
  },
  async supprimer(_r, suppressions) { for (const ch of suppressions) await enregistrerPratique(ch.cle, null) },
}

// Étapes d'une ouverture : une ligne par magasin et par étape ; les magasins à ouvrir ont leurs étapes exportées vides, à remplir
// Implantation des produits (PR #142) : date unique de la fiche du magasin, faite une fois passée ; s'écrit dans la fiche
const IMPLANTATION = 'Implantation des produits'
function implantation(r: Reseau, m: { nom: string; exploitation: { implantation: string } }) {
  const d = m.exploitation.implantation
  return { ...leMagasin(r, m.nom), etape: IMPLANTATION, prevu: d, fait: d && d <= r.jour ? d : '' }
}
const etapes: Referentiel = {
  id: 'ouvertures', libelle: 'Étapes d’ouverture', groupe: 'Suivi des magasins', feuille: 'Étapes d’ouverture',
  colonnes: [
    colCode(), colNomMagasin,
    { id: 'etape', entete: 'Étape', type: 'choix', choix: [...etapesOuverture.map((e) => e.libelle), IMPLANTATION], cle: true, largeur: 26 },
    { id: 'prevu', entete: 'Prévue le', type: 'date' },
    { id: 'fait', entete: 'Faite le', type: 'date' },
  ],
  lignes: (r) => tousMagasins(r).filter((m) => m.code && (r.ouvertures[m.nom] || aOuvrir(m, r.jour))).flatMap((m) => [...etapesOuverture.map((e) => {
    const x = r.ouvertures[m.nom]?.etapes[e.id]
    return { ...leMagasin(r, m.nom), etape: e.libelle, prevu: x?.prevu ?? '', fait: x?.fait ?? '' }
  }), implantation(r, m)]),
  ajout: { obligatoires: ['code', 'etape'] },
  aCompleter: (l) => !l.prevu && !l.fait,
  async appliquer(r, changements) { await ecrireEtapes(r, changements, []) },
  async supprimer(r, suppressions) { await ecrireEtapes(r, [], suppressions) },
}
async function ecrireEtapes(r: Reseau, changements: Changement[], suppressions: Changement[]) {
  const date = (ch: Changement, l: Ligne) => (ch.champs.includes('prevu') ? l.prevu : ch.champs.includes('fait') ? l.fait : l.prevu || l.fait) ?? ''
  const fiches = [
    ...changements.filter((ch) => ch.apres.etape === IMPLANTATION).map((ch) => ({ code: ch.apres.code, date: date(ch, ch.apres) })),
    ...suppressions.filter((ch) => ch.avant!.etape === IMPLANTATION).map((ch) => ({ code: ch.avant!.code, date: '' })),
  ]
  if (fiches.length) {
    const actuelles = magasins.lignes(r)
    await magasins.appliquer!(r, fiches.flatMap(({ code, date }) => {
      const avant = actuelles.find((l) => l.code === code)
      return avant ? [{ type: 'modif' as const, cle: code, libelle: code, avant, apres: { ...avant, implantation: date }, champs: ['implantation'] }] : []
    }))
  }
  changements = changements.filter((ch) => ch.apres.etape !== IMPLANTATION)
  suppressions = suppressions.filter((ch) => ch.avant!.etape !== IMPLANTATION)
  const id = (libelle: string) => etapesOuverture.find((e) => e.libelle === libelle)!.id
  for (const code of parCode([...changements, ...suppressions])) {
    const nom = nomDuCode(r, code)
    const suivi: SuiviOuverture = { etapes: { ...(r.ouvertures[nom]?.etapes ?? {}) }, par: r.directeur.nom, maj: r.jour }
    for (const ch of suppressions.filter((c) => c.apres.code === code)) delete suivi.etapes[id(ch.avant!.etape)]
    for (const ch of changements.filter((c) => c.apres.code === code)) suivi.etapes[id(ch.apres.etape)] = { prevu: ch.apres.prevu ?? '', fait: ch.apres.fait ?? '' }
    await enregistrerOuverture(nom, suivi)
  }
}

export function referentiels(reseau: Reseau | null): Referentiel[] {
  return [
    magasins, franchisesRef, mandats, coachs, rrs, affectations, rattachements,
    situations, etapes, chiffres, ninebox(reseau), audits, deploiements(reseau), visites, taches, journal,
    campagnes, constats, agenda, pratiques,
  ]
}
