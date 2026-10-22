import { lienPreparation } from './format'
import type { Magasin } from '../data/modele'

// Lien « Ajouter à Google Agenda » prérempli : aucune connexion à Google, la personne valide l'événement dans son agenda.
// Une visite se pose à la journée, sans heure (Joseph, 22/10/2026)

const compact = (iso: string) => iso.replace(/-/g, '')
const lendemain = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)

export const adresseDe = (m: Magasin) => [m.adresse, [m.codePostal, m.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
export const lienApp = (chemin: string) => `${window.location.origin}${window.location.pathname}#${chemin}`

export function lienGoogleAgenda({ magasins, date, notes }: { magasins: Magasin[]; date: string; notes: Record<string, string> }) {
  const noms = magasins.map((m) => m.nom)
  const dates = `${compact(date)}/${compact(lendemain(date))}`
  const details = magasins.map((m) => [
    magasins.length > 1 ? m.nom : '',
    notes[m.nom]?.trim() ?? '',
    `Fiche avant visite : ${lienApp(lienPreparation(m.nom))}`,
  ].filter(Boolean).join('\n')).join('\n\n')
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: noms.length > 1 ? `Tournée : ${noms.join(', ')}` : `Visite ${noms[0]}`,
    dates, ctz: 'Europe/Paris', details,
    location: magasins[0] ? adresseDe(magasins[0]) : '',
  })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}
