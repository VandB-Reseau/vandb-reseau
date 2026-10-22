import type { Magasin, Statut } from './modele'
import { libellesLevier, type Levier } from './leviers'

export interface Filtres {
  texte: string
  statuts: Statut[]
  types: ('franchise' | 'integre')[]
  coachs: string[]
  rrs: string[] // id des RR
  alertes: Alerte[]
  leviers: Levier[] // levier du CA le plus en retrait
}

// Alertes d'un magasin : chiffres qui décrochent ou à surveiller, visite attendue depuis plus longtemps que sa case
export type Alerte = 'decroche' | 'surveiller' | 'visite'
export const libellesAlerte: Record<Alerte, string> = { decroche: 'Décroche', surveiller: 'À surveiller', visite: 'Pas vu depuis longtemps' }

export const filtresVides: Filtres = { texte: '', statuts: [], types: [], coachs: [], rrs: [], alertes: [], leviers: [] }

export function normaliser(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function filtrer(magasins: Magasin[], f: Filtres, alertesDe: (nom: string) => Alerte[] = () => [], levierDe: (nom: string) => Levier | null = () => null): Magasin[] {
  const t = normaliser(f.texte)
  return magasins.filter((m) => {
    if (t) {
      const champs = [m.nom, m.ville, m.departement, m.codePostal, m.code, m.coach, m.rr?.nom ?? '', m.responsable?.nom ?? '']
      if (!champs.some((c) => normaliser(c).includes(t))) return false
    }
    if (f.statuts.length && !f.statuts.includes(m.statut)) return false
    if (f.types.length && !f.types.includes(m.franchise ? 'franchise' : 'integre')) return false
    if (f.coachs.length && !f.coachs.includes(m.coach || '__aucun__')) return false
    if (f.rrs.length && !f.rrs.includes(m.rr?.id ?? '__aucun__')) return false
    if (f.alertes.length && !alertesDe(m.nom).some((a) => f.alertes.includes(a))) return false
    if (f.leviers.length && !f.leviers.includes(levierDe(m.nom) as Levier)) return false
    return true
  })
}

// Filtres <-> adresse (partageable, bouton retour du navigateur)
export function filtresDepuisUrl(p: URLSearchParams): Filtres {
  const liste = (k: string) => (p.get(k) ? p.get(k)!.split('|').filter(Boolean) : [])
  return {
    texte: p.get('q') ?? '',
    statuts: liste('statut') as Statut[],
    types: liste('type') as Filtres['types'],
    coachs: liste('coach'),
    rrs: liste('rr'),
    alertes: liste('alerte').filter((a): a is Alerte => a in libellesAlerte),
    leviers: liste('levier').filter((a): a is Levier => a in libellesLevier),
  }
}

export function filtresVersUrl(f: Filtres, base: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base)
  const poser = (k: string, v: string) => (v ? p.set(k, v) : p.delete(k))
  poser('q', f.texte)
  poser('statut', f.statuts.join('|'))
  poser('type', f.types.join('|'))
  poser('coach', f.coachs.join('|'))
  poser('rr', f.rrs.join('|'))
  poser('alerte', f.alertes.join('|'))
  poser('levier', f.leviers.join('|'))
  return p
}

export function nbFiltresActifs(f: Filtres): number {
  return f.statuts.length + f.types.length + f.coachs.length + f.rrs.length + f.alertes.length + f.leviers.length
}
