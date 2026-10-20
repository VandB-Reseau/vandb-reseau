import { lienPreparation } from './format'
import type { Magasin } from '../data/modele'

// Lien « Ajouter à Google Agenda » prérempli : aucune connexion à Google, la personne valide l'événement dans son agenda
export const DUREE_VISITE = 90 // minutes, par magasin

const compact = (iso: string) => iso.replace(/-/g, '')
const lendemain = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
function plus(heure: string, minutes: number) {
  const [h, m] = heure.split(':').map(Number)
  const t = h * 60 + m + minutes
  return { jours: Math.floor(t / 1440), heure: `${String(Math.floor(t / 60) % 24).padStart(2, '0')}${String(t % 60).padStart(2, '0')}00` }
}

export const adresseDe = (m: Magasin) => [m.adresse, [m.codePostal, m.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
export const lienApp = (chemin: string) => `${window.location.origin}${window.location.pathname}#${chemin}`

export function lienGoogleAgenda({ magasins, date, heure, notes }: { magasins: Magasin[]; date: string; heure: string; notes: Record<string, string> }) {
  const noms = magasins.map((m) => m.nom)
  let dates = `${compact(date)}/${compact(lendemain(date))}`
  if (/^\d{2}:\d{2}$/.test(heure)) {
    const fin = plus(heure, DUREE_VISITE * magasins.length)
    const jourFin = fin.jours ? lendemain(date) : date
    dates = `${compact(date)}T${heure.replace(':', '')}00/${compact(jourFin)}T${fin.heure}`
  }
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
