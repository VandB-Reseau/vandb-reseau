import type { Magasin, Reseau } from './modele'
import { libelleTypeVisite, nomsVisiteurs, visiteFaite } from './modele'
import { historiqueSante, libelleCritere, libelleNote, nineBox, tousCriteres, unChangementParJour, type Note } from './sante'

// Ordre de la grille ; les critères retirés de la grille passent après
const rangCritere = (id: string) => { const i = tousCriteres.findIndex((c) => c.id === id); return i < 0 ? tousCriteres.length : i }
import { lienCompteRendu } from './visites'
import { auditDe, libelleAudit } from './chiffres'

// Journal d'un magasin : tout ce qui s'y est passé, du plus récent au plus ancien
export type TypeJournal = 'visite' | 'sante' | 'deploiement' | 'coach' | 'note' | 'ouverture'
export const typesJournal: { id: TypeJournal; libelle: string }[] = [
  { id: 'visite', libelle: 'Visites' },
  { id: 'sante', libelle: 'Santé' },
  { id: 'deploiement', libelle: 'Déploiements' },
  { id: 'coach', libelle: 'Coachs' },
  { id: 'note', libelle: 'Notes' },
  { id: 'ouverture', libelle: 'Ouverture' },
]

export interface EvenementJournal {
  cle: string; date: string; type: TypeJournal; titre: string; detail: string
  lien?: string; noteId?: string // note libre : modifiable et supprimable
}

export function journalMagasin(reseau: Reseau, m: Magasin): EvenementJournal[] {
  const ev: EvenementJournal[] = []
  if (m.ouvertureConnue && m.ouverture <= reseau.jour) ev.push({ cle: 'ouverture', date: m.ouverture, type: 'ouverture', titre: 'Ouverture du magasin', detail: '' })

  m.historiqueCoach.filter((h) => h.date <= reseau.jour).forEach((h, i) => ev.push({
    cle: `coach-${i}`, date: h.date, type: 'coach', titre: h.coach ? `Coach : ${h.coach}` : 'Sans Coach', detail: h.note,
  }))

  reseau.visites.filter((v) => v.magasin === m.nom && visiteFaite(v, reseau.jour)).forEach((v) => {
    const actions = v.plan.length
    const audit = auditDe(reseau, m.nom, v.date, v.type)
    ev.push({
      cle: `visite-${v.id ?? v.date}`, date: v.date, type: 'visite', titre: `${libelleTypeVisite(v.type)}${v.visiteurs.length ? ` · ${nomsVisiteurs(v)}` : ''}`,
      detail: [audit ? libelleAudit(audit) : '', v.notes, actions ? `${actions} tâche${actions > 1 ? 's' : ''} au plan` : ''].filter(Boolean).join(' · '),
      lien: v.id !== null ? lienCompteRendu(v) : undefined,
    })
  })

  // Santé : un événement par saisie, en disant ce qui a changé
  let avant: Partial<Record<string, Note>> = {}
  let caseAvant = ''
  historiqueSante(reseau.evaluations, m.nom).forEach((p, i) => {
    const c = nineBox.find((x) => x.id === p.caseId)
    const changements = p.notes ? Object.keys(p.notes).filter((k) => p.notes![k] !== undefined && p.notes![k] !== avant[k])
      .sort((a, b) => rangCritere(a) - rangCritere(b))
      .map((k) => `${libelleCritere(k)} : ${libelleNote[p.notes![k]!]}`) : []
    const titre = c ? (caseAvant && caseAvant !== p.caseId ? `Passe en ${c.libelle}` : `Classé ${c.libelle}`) : 'Santé mise à jour'
    ev.push({ cle: `sante-${i}`, date: p.date, type: 'sante', titre, detail: changements.join(' · ') })
    if (p.notes) avant = p.notes
    if (p.caseId) caseAvant = p.caseId
  })

  const thematiques = new Map(reseau.deploiements.thematiques.map((t) => [t.id, t.libelle]))
  unChangementParJour(reseau.deploiements.journal?.[m.nom] ?? []).forEach((c, i) => {
    const t = thematiques.get(c.thematique)
    if (t) ev.push({ cle: `dep-${i}`, date: c.date, type: 'deploiement', titre: `${t} : ${c.etat || 'non renseigné'}`, detail: '' })
  })

  ;(reseau.notesMagasins[m.nom] ?? []).forEach((n) => ev.push({ cle: `note-${n.id}`, date: n.date, type: 'note', titre: n.texte, detail: n.par, noteId: n.id }))

  const ordre: TypeJournal[] = ['note', 'visite', 'sante', 'deploiement', 'coach', 'ouverture']
  return ev.sort((a, b) => b.date.localeCompare(a.date) || ordre.indexOf(a.type) - ordre.indexOf(b.type))
}
