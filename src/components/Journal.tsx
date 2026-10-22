import { useState } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import { Fenetre } from './EditionEquipe'
import { journalMagasin } from '../data/journal'
import type { ElementFil } from '../data/fil'
import { enregistrerEvaluations, enregistrerNoteMagasin, supprimerEvaluation, supprimerNoteMagasin } from '../data/chargement'
import { caseDe, historiqueSante, type IdCritere, type Note } from '../data/sante'
import { NotesParAxe, PastilleCase } from './Sante'
import { dateCourte, lienFiche } from '../lib/format'
import type { Magasin, NoteMagasin, Reseau } from '../data/modele'

// Journal du magasin repris dans son fil : notes, santé, déploiements, Coachs, ouverture
// (les visites y sont déjà). Une note ou un classement s'ouvre pour être modifié.
export function journalDansLeFil(reseau: Reseau, m: Magasin): ElementFil[] {
  const fiche = lienFiche(m.nom)
  return journalMagasin(reseau, m).filter((e) => e.type !== 'visite').map((e) => {
    const n = e.noteId ? reseau.notesMagasins[m.nom]?.find((x) => x.id === e.noteId) : undefined
    return {
      cle: `j|${e.cle}`, genre: 'journal' as const, instant: e.date, auteur: n?.par ?? '', magasin: m.nom,
      action: n ? 'note' : e.titre, texte: n ? e.titre : e.detail || undefined, journal: e,
      lien: e.type === 'sante' || e.type === 'deploiement' ? `${fiche}?vue=chiffres` : `${fiche}?vue=fiche`,
      libelleOuvrir: n ? `Modifier la note du ${dateCourte(e.date)}` : e.type === 'sante' ? `Modifier le classement du ${dateCourte(e.date)}` : undefined,
    }
  })
}

// Ouvre la note ou le classement d'un élément du journal ; null : l'élément mène à sa partie de la fiche
export function useEditionJournal(reseau: Reseau, m: Magasin, signaler: (message: string) => void) {
  const [note, setNote] = useState<NoteMagasin | null>(null)
  const [sante, setSante] = useState<string | null>(null)
  const ouvrir = (e: ElementFil) => {
    const j = e.journal
    if (!j) return
    const n = j.noteId ? reseau.notesMagasins[m.nom]?.find((x) => x.id === j.noteId) : undefined
    if (n) setNote(n); else if (j.type === 'sante') setSante(j.date)
  }
  const nouvelleNote = () => setNote({ id: '', date: reseau.jour, texte: '', par: reseau.directeur.nom })
  const fenetres = <>
    {sante && <DialogSante reseau={reseau} magasin={m.nom} date={sante} onFermer={(msg) => { setSante(null); if (msg) signaler(msg) }} />}
    {note && <DialogNote magasin={m.nom} note={note} onFermer={(msg) => { setNote(null); if (msg) signaler(msg) }} />}
  </>
  return { ouvrir, nouvelleNote, fenetres }
}

function DialogNote({ magasin, note, onFermer }: { magasin: string; note: NoteMagasin; onFermer: (message?: string) => void }) {
  const [date, setDate] = useState(note.date)
  const [texte, setTexte] = useState(note.texte)
  return (
    <Fenetre titre={note.id ? 'Modifier la note' : 'Nouvelle note'} ouvert onFermer={onFermer} valide={!!texte.trim() && !!date}
      enregistrer={async () => {
        await enregistrerNoteMagasin(magasin, { ...note, id: note.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date, texte: texte.trim() })
        return 'Note enregistrée.'
      }}
      supprimer={note.id ? async () => { await supprimerNoteMagasin(magasin, note.id); return 'Note supprimée.' } : undefined}
      libelleSuppression="Supprimer cette note du journal ?">
      <TextField type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField label="Note" value={texte} onChange={(e) => setTexte(e.target.value)} multiline minRows={4} autoFocus />
    </Fenetre>
  )
}

// Classement nine box d'une date : notes modifiables, ou suppression de la saisie (comme une visite)
function DialogSante({ reseau, magasin, date, onFermer }: { reseau: Reseau; magasin: string; date: string; onFermer: (message?: string) => void }) {
  const point = historiqueSante(reseau.evaluations, magasin).find((p) => p.date === date)
  const e = reseau.evaluations[magasin]
  const [notes, setNotes] = useState<Partial<Record<IdCritere, Note>>>(() => ({ ...(point?.notes ?? (e?.date === date ? e.notes : {})) }))
  const noter = (id: IdCritere, n: Note | null) => setNotes((x) => { const y = { ...x }; if (n === null) delete y[id]; else y[id] = n; return y })
  return (
    <Fenetre titre={`Classement du ${dateCourte(date)}`} ouvert onFermer={onFermer} valide={Object.keys(notes).length > 0}
      enregistrer={async () => {
        await enregistrerEvaluations([{ magasin, e: { notes, date, par: reseau.directeur.nom } }])
        return 'Classement enregistré.'
      }}
      supprimer={async () => { await supprimerEvaluation(magasin, date); return 'Classement supprimé.' }}
      libelleSuppression={`Supprimer le classement du ${dateCourte(date)} ?`}>
      <Box><PastilleCase c={caseDe({ notes, date, par: '' })} /></Box>
      <Box><NotesParAxe integre={reseau.magasins.find((m) => m.nom === magasin)?.franchise === false} notes={notes} noter={noter} /></Box>
    </Fenetre>
  )
}
