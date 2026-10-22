import type { Photo } from './grilles'
import type { Reseau } from './modele'
import { libelleTypeVisite, visiteFaite } from './modele'
import { actionsDes } from './actions'
import { analyser, decalerMois, formatKEuros, formatPourcent, libelleMois } from './chiffres'
import { apercuDe, type Messagerie } from './messagerie'
import { lienCompteRendu } from './visites'
import { lienFiche } from '../lib/format'
import type { Communication } from './communications'
import type { BonnePratique } from './bonnesPratiques'
import { estImage, type Piece } from '../lib/pieces'
import { premiereImage } from '../lib/html'

// Fil d'activité des magasins suivis : visites, tâches, messages, chiffres, bonnes pratiques et communications du réseau,
// du plus récent au plus ancien
export type GenreFil = 'visite' | 'tache' | 'message' | 'chiffres' | 'pratique' | 'communication' | 'journal'

export interface ElementFil {
  cle: string
  genre: GenreFil
  instant: string // AAAA-MM-JJ ou date et heure ISO
  auteur: string // qui a agi (vide si inconnu)
  action: string // « a visité », « a fait la tâche »…
  magasin: string // vide pour une communication du réseau
  cible?: string // communication : « Tout le réseau », « 3 magasins »
  communication?: Communication // pour « J'aime » et commentaires depuis le fil
  pratique?: BonnePratique
  visuel?: { piece?: Piece; url?: string } // communication : photo affichée en grand (en-tête, photo jointe ou première image)
  titre?: string // tâche, bonne pratique
  texte?: string
  photos?: Photo[]
  valeur?: string // chiffres : CA du mois
  ecart?: number | null
  lien: string
  journal?: import('./journal').EvenementJournal // fiche magasin : note, santé, déploiement, Coach, ouverture
  libelleOuvrir?: string // élément du journal qui s'ouvre pour être modifié
}

const instantDe = (s: string) => (s.length === 10 ? `${s}T00:00:00` : s)

// Premier texte d'un compte rendu : les notes, sinon la première partie remplie
const resume = (notes: string, parties: string[]) => (notes || parties.find((p) => p.trim()) || '').trim()

// pratiquesReseau : les bonnes pratiques de tout le réseau (communes), pas seulement celles des magasins suivis
export function filDu(reseau: Reseau, noms: Set<string>, mg: Messagerie | null, jours = 45, communications: Communication[] = [], pratiquesReseau = false): ElementFil[] {
  const depuis = new Date(Date.parse(`${reseau.jour}T00:00:00`) - jours * 86_400_000).toISOString().slice(0, 10)
  const res: ElementFil[] = []
  for (const v of reseau.visites) {
    if (!noms.has(v.magasin) || !visiteFaite(v, reseau.jour) || v.date < depuis) continue
    res.push({
      cle: `v|${v.id ?? v.magasin + v.date}`, genre: 'visite', instant: v.date, auteur: v.visiteurs[0] ?? '', action: libelleTypeVisite(v.type).toLowerCase(),
      magasin: v.magasin, texte: resume(v.notes, v.parties), photos: v.photos, lien: v.id !== null ? lienCompteRendu(v) : `${lienFiche(v.magasin)}?vue=visites`,
    })
  }
  for (const x of actionsDes(reseau, noms)) {
    if (x.a.faite && x.a.faite >= depuis) {
      res.push({ cle: `t|${x.cle}`, genre: 'tache', instant: x.a.faite, auteur: x.a.faitePar ?? '', action: 'tâche faite', magasin: x.magasin, titre: x.a.action, lien: `${lienFiche(x.magasin)}?vue=actions` })
    } else if (x.libre && !x.a.faite && x.libre.creeLe >= depuis) {
      res.push({ cle: `n|${x.cle}`, genre: 'tache', instant: x.libre.creeLe, auteur: x.libre.auteur ?? '', action: 'nouvelle tâche', magasin: x.magasin, titre: x.a.action, lien: `${lienFiche(x.magasin)}?vue=actions` })
    }
  }
  for (const m of mg?.messages ?? []) {
    // Échanges à deux : restent dans la messagerie
    if (m.destinataire || !m.magasins.some((n) => noms.has(n)) || m.creeLe.slice(0, 10) < depuis) continue
    const magasin = m.magasins.find((n) => noms.has(n))!
    res.push({ cle: `m|${m.id}`, genre: 'message', instant: m.creeLe, auteur: m.auteurNom, action: 'message', magasin, texte: apercuDe(m), lien: `${lienFiche(magasin)}?vue=messages` })
  }
  for (const nom of noms) {
    const a = analyser(reseau, nom)
    if (!a || a.ca === null) continue
    // Chiffres d'un mois : connus au début du mois suivant
    const instant = `${decalerMois(a.mois, 1)}-01`
    if (instant < depuis || instant > reseau.jour) continue
    res.push({ cle: `c|${nom}|${a.mois}`, genre: 'chiffres', instant, auteur: '', action: `chiffres de ${libelleMois(a.mois).split(' ')[0]}`, magasin: nom, valeur: formatKEuros(a.ca), ecart: a.ecart, texte: a.ecart === null ? undefined : formatPourcent(a.ecart), lien: `${lienFiche(nom)}?vue=chiffres` })
  }
  for (const p of reseau.pratiques) {
    if ((!pratiquesReseau && !noms.has(p.magasin)) || p.date < depuis || p.date > reseau.jour) continue
    res.push({ cle: `p|${p.id}`, genre: 'pratique', instant: p.date, auteur: p.par, action: 'bonne pratique', magasin: p.magasin, titre: p.titre, texte: p.texte, photos: p.photos,
      lien: noms.has(p.magasin) ? `${lienFiche(p.magasin)}?vue=journal` : '/visites?vue=pratiques', pratique: p })
  }
  // Communications : celles de tout le réseau et celles qui citent un des magasins suivis
  for (const c of communications) {
    if (c.creeLe.slice(0, 10) < depuis || (c.magasins !== null && !c.magasins.some((n) => noms.has(n)))) continue
    res.push({
      cle: `k|${c.id}`, genre: 'communication', instant: c.creeLe, auteur: c.auteurNom, action: 'communication', magasin: '',
      cible: c.magasins === null ? 'Tout le réseau' : `${c.magasins.length} magasin${c.magasins.length > 1 ? 's' : ''}`,
      titre: c.titre, texte: c.texte, lien: `/communications?c=${c.id}`, visuel: visuelDe(c), communication: c,
    })
  }
  return res.sort((a, b) => instantDe(b.instant).localeCompare(instantDe(a.instant)))
}

function visuelDe(c: Communication): ElementFil['visuel'] {
  const piece = c.pieces.find((p) => p.chemin === c.entete && estImage(p)) ?? c.pieces.find(estImage)
  if (piece) return { piece }
  const url = c.html ? premiereImage(c.html) : ''
  return url ? { url } : undefined
}

// « Aujourd’hui », « Hier », « Il y a 3 j », « 12 oct. »
export function quand(instant: string, jour: string): string {
  const d = instant.slice(0, 10)
  const ecart = Math.round((Date.parse(`${jour}T00:00:00`) - Date.parse(`${d}T00:00:00`)) / 86_400_000)
  if (ecart <= 0) return instant.length > 10 ? new Date(instant).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Aujourd’hui'
  if (ecart === 1) return 'Hier'
  if (ecart < 7) return `Il y a ${ecart} j`
  const [a, m, j] = d.split('-').map(Number)
  return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(String(a) !== jour.slice(0, 4) ? { year: 'numeric' } : {}) })
}
