// Carnet du magasin (Joseph, 24/11/2026, proposition A) : notes en off de l'équipe, avec un ton, des thèmes, des réponses
// et des collègues prévenus. Jamais lues par le franchisé : rangées dans la rubrique « notes » de suivi_magasins, que la base
// ne lui renvoie pas. Les remarques internes des visites (appréciation) se lisent avec le ton correspondant.
import type { Magasin, NoteMagasin, Reseau, TonNote } from './modele'
import { porteursDu } from './actions'
import { lienFiche } from '../lib/format'

export const TONS: { v: TonNote; libelle: string; signal: 'error' | 'warning' | 'success' | 'info' }[] = [
  { v: 'alerte', libelle: 'Alerte', signal: 'error' },
  { v: 'surveiller', libelle: 'À surveiller', signal: 'warning' },
  { v: 'positif', libelle: 'Positif', signal: 'success' },
  { v: 'info', libelle: 'Info', signal: 'info' },
]
export const libelleTon = (t: TonNote) => TONS.find((x) => x.v === t)?.libelle ?? 'Info'

export const THEMES: { v: string; libelle: string }[] = [
  { v: 'engagement', libelle: 'Engagement' },
  { v: 'posture', libelle: 'Posture' },
  { v: 'evolution', libelle: 'Évolution' },
  { v: 'commercial', libelle: 'Commercial' },
  { v: 'equipe', libelle: 'Équipe du magasin' },
  { v: 'budget', libelle: 'Budget' },
]
export const libelleTheme = (t: string) => THEMES.find((x) => x.v === t)?.libelle ?? t

const depuisAppreciation = { preoccupante: 'alerte', mitigee: 'surveiller', satisfaisante: 'positif' } as const
export const tonDe = (n: NoteMagasin): TonNote => n.ton ?? (n.appreciation ? depuisAppreciation[n.appreciation] : 'info')
// Une alerte ou un point à surveiller reste ouvert tant que personne ne l'a clos
export const aClore = (n: NoteMagasin) => { const t = tonDe(n); return t === 'alerte' || t === 'surveiller' }
export const ouverte = (n: NoteMagasin) => aClore(n) && !n.close
export const instantNote = (n: NoteMagasin) => n.quand ?? `${n.date}T12:00:00`
export const dernierEchange = (n: NoteMagasin) => n.reponses?.at(-1)?.quand ?? instantNote(n)

export const nouvelIdNote = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// Collègues qu'on peut prévenir sur un magasin : son Coach, son RR, le Directeur (jamais le franchisé ni ses associés)
const ROLES_EQUIPE = ['Coach', 'Responsable Régional', 'Responsable des magasins intégrés', 'Directeur de réseau']
export function collegues(reseau: Reseau, magasin: string, moi: string): { nom: string; role: string }[] {
  return porteursDu(reseau, magasin).filter((p) => ROLES_EQUIPE.includes(p.role) && p.nom !== moi)
}

export const lienNote = (magasin: string, id?: string) => `${lienFiche(magasin)}?vue=carnet${id ? `&note=${encodeURIComponent(id)}` : ''}`

export const extrait = (t: string, n = 120) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

// Alertes encore ouvertes sur des magasins, de la plus récente à la plus ancienne
export function alertesOuvertes(reseau: Reseau, magasins: Magasin[]): { magasin: string; note: NoteMagasin }[] {
  return magasins.flatMap((m) => (reseau.notesMagasins[m.nom] ?? []).filter((n) => ouverte(n) && tonDe(n) === 'alerte').map((note) => ({ magasin: m.nom, note })))
    .sort((a, b) => dernierEchange(b.note).localeCompare(dernierEchange(a.note)))
}

export interface EvenementCarnet { id: string; titre: string; detail: string; quand: string; lien: string }
// Ce qui arrive dans la cloche (Joseph, 24/11/2026 : « bien remonter les mentions ») : on m'a nommé dans une note ou une
// réponse, on a répondu à une note que j'ai écrite ou où j'ai répondu ; pour le RR et le Directeur, toute nouvelle alerte.
export function evenementsCarnet(reseau: Reseau, moi: string, depuis: string, encadrement: boolean): EvenementCarnet[] {
  if (!moi) return []
  const r: EvenementCarnet[] = []
  for (const [magasin, notes] of Object.entries(reseau.notesMagasins)) {
    for (const n of notes) {
      const lien = lienNote(magasin, n.id)
      const quand = instantNote(n)
      if (n.par !== moi && quand.slice(0, 10) >= depuis) {
        if (n.mentions?.includes(moi)) r.push({ id: `nm:${n.id}`, titre: `${n.par || 'Un collègue'} te mentionne · ${magasin}`, detail: extrait(n.texte), quand, lien })
        else if (encadrement && tonDe(n) === 'alerte' && n.ton) r.push({ id: `na:${n.id}`, titre: `Alerte sur ${magasin}`, detail: `${n.par ? `${n.par} : ` : ''}${extrait(n.texte)}`, quand, lien })
      }
      const reponses = n.reponses ?? []
      reponses.forEach((x, i) => {
        if (x.par === moi || x.quand.slice(0, 10) < depuis) return
        const dansLeFil = n.par === moi || reponses.slice(0, i).some((y) => y.par === moi)
        if (x.mentions?.includes(moi)) r.push({ id: `nr:${x.id}`, titre: `${x.par || 'Un collègue'} te mentionne · ${magasin}`, detail: extrait(x.texte), quand: x.quand, lien })
        else if (dansLeFil) r.push({ id: `nr:${x.id}`, titre: `${x.par || 'Un collègue'} a répondu · ${magasin}`, detail: extrait(x.texte), quand: x.quand, lien })
      })
    }
  }
  return r
}
