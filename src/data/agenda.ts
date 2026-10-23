// Éléments de l'agenda (visites, campagnes, ouvertures, événements, anniversaires) et calculs de dates, partagés avec l'Accueil
import { lienFiche } from '../lib/format'
import { libellePerimetre, magasinsConcernes } from './campagnes'
import { estVisite } from './chiffres'
import { libelleTypeVisite, libellesTypeEvenement, nomsVisiteurs, typeEvenement, type Evenement, type Reseau, type Visite } from './modele'

export type Categorie = 'visite' | 'campagne' | 'ouverture' | 'anniversaire' | 'evenement' | 'formation'
export interface Element { cle: string; categorie: Categorie; debut: string; fin: string; titre: string; detail: string; lien?: string; evenement?: Evenement; visite?: Visite; couleur: string; magasin?: string }

export const iso = (d: Date) => d.toISOString().slice(0, 10)
export const jourUTC = (s: string) => new Date(`${s}T00:00:00Z`)
export const ajouterJours = (s: string, n: number) => { const d = jourUTC(s); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
export const nomMois = (s: string) => jourUTC(s).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
export const ecartJours = (a: string, b: string) => Math.round((jourUTC(b).getTime() - jourUTC(a).getTime()) / 86400000)
// 14:30 → 14 h 30 (heure de Paris, telle que saisie)
export const heureLisible = (h: string) => h.replace(':', ' h ')
export const jourLong = (s: string) => jourUTC(s).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

export function elementsDuMois(reseau: Reseau, debut: string, fin: string): Element[] {
  const el: Element[] = []
  // Visites faites et prévues (pas les appels ni les points)
  for (const v of reseau.visites) if (v.date >= debut && v.date <= fin && estVisite(v)) {
    el.push({ cle: `v-${v.id ?? v.date}-${v.magasin}`, categorie: 'visite', debut: v.date, fin: v.date, titre: `Visite ${v.magasin}`, detail: [libelleTypeVisite(v.type), nomsVisiteurs(v)].filter(Boolean).join(' · '), lien: lienFiche(v.magasin), couleur: '#307672', magasin: v.magasin, visite: v })
  }
  // Campagnes datées qui concernent au moins un magasin visible du compte
  for (const c of reseau.campagnes.liste) {
    const d = c.debut || c.fin, f = c.fin || c.debut
    if (d && d <= fin && f >= debut && magasinsConcernes(reseau, c).length) el.push({ cle: `cp-${c.id}`, categorie: 'campagne', debut: d, fin: f, titre: c.nom, detail: ['Campagne', libellePerimetre(c)].filter(Boolean).join(' · '), lien: `/plus/sante?vue=campagnes&campagne=${encodeURIComponent(c.id)}`, couleur: '#312e2e' })
  }
  for (const m of reseau.magasins) {
    if (m.ouvertureConnue && m.ouverture >= debut && m.ouverture <= fin) el.push({ cle: `o-${m.nom}`, categorie: 'ouverture', debut: m.ouverture, fin: m.ouverture, titre: `Ouverture ${m.nom}`, detail: m.coach ? `Coach ${m.coach}` : 'Sans Coach', lien: lienFiche(m.nom), couleur: '#ea6029' })
  }
  // Formations à part (23/10/2026) ; une réunion reste un événement
  for (const e of reseau.evenements) if (e.debut <= fin && e.fin >= debut) {
    const t = typeEvenement(e)
    el.push({ cle: `e-${e.id}`, categorie: t === 'formation' ? 'formation' : 'evenement', debut: e.debut, fin: e.fin, titre: e.titre,
      detail: [t !== 'event' && libellesTypeEvenement[t], e.heure && `à ${heureLisible(e.heure)}`, e.notes].filter(Boolean).join(' · '), evenement: e, couleur: e.couleur })
  }
  const annee = debut.slice(0, 4)
  for (const a of reseau.anniversaires) {
    const jour = `${annee}-${a.date.slice(5)}`
    const ans = Number(annee) - Number(a.date.slice(0, 4))
    if (jour >= debut && jour <= fin && ans > 0) el.push({ cle: `a-${a.nom}-${a.nature}`, categorie: 'anniversaire', debut: jour, fin: jour, titre: a.nature === 'naissance' ? `Anniversaire de ${a.nom}` : `${a.nom} : ${ans} an${ans > 1 ? 's' : ''} chez V and B`, detail: a.role, couleur: '#c2185b' })
  }
  return el.sort((a, b) => a.debut.localeCompare(b.debut) || a.titre.localeCompare(b.titre, 'fr'))
}

