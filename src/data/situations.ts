import { dateLongue } from '../lib/format'
import { libelleFermeture, libelleSituation, type Magasin, type Situation, type TypeFermeture } from './modele'

// Pastille de la fiche d'un magasin sorti du réseau
export const etatSortie: Record<TypeFermeture, string> = { fermeture: 'Fermé', liquidation: 'Liquidé', enseigne: 'Hors enseigne', cession: 'Cédé' }

// Une situation en une ligne : « Fermeture provisoire du 3 novembre 2026 au 17 novembre 2026 · Lifting »
export function texteSituation(s: Situation): string {
  const quoi = s.type === 'sortie' ? libelleFermeture[s.sortie ?? 'fermeture'] : libelleSituation[s.type]
  const quand = s.type === 'travaux' && s.fin && s.fin !== s.date ? `du ${dateLongue(s.date)} au ${dateLongue(s.fin)}` : `le ${dateLongue(s.date)}`
  return [`${quoi} ${quand}`, s.repreneur && `repris par ${s.repreneur}`, s.motif].filter(Boolean).join(' · ')
}

// Bandeaux de la fiche : sortie du réseau, fermeture provisoire en cours ou à venir, et ce qui est prévu
export function situationsAffichees(m: Magasin, jour: string): Situation[] {
  return m.situations.filter((s) => s.type === 'sortie' ? s.date === m.fermeture?.date : s.type === 'travaux' ? (s.fin ?? s.date) >= jour : s.date >= jour)
}

// Pendant une fermeture provisoire, le magasin n'attend pas de visite
export const enTravaux = (m: Magasin, jour: string) => !!m.travaux && m.travaux.debut <= jour && jour <= m.travaux.fin
