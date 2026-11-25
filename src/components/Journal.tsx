import { creerOuGarder } from '../lib/horsLigne'
import Autocomplete from '@mui/material/Autocomplete'
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
import type { Magasin, NoteMagasin, Reseau, TonNote } from '../data/modele'
import Typography from '@mui/material/Typography'
import LockOutlined from '@mui/icons-material/LockOutlined'
import { Choix, Pastille, useCouleurTon } from './Carnet'
import { useReseau } from '../data/ReseauContext'
import { useAuth } from '../auth/AuthContext'
import { monNomPorteur } from '../data/actions'
import { collegues, nouvelIdNote, THEMES, tonDe, TONS } from '../data/carnet'
import { TexteDicte } from './Dictee'
import { ChampDate } from './ChampDate'

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
  const { profil } = useAuth()
  const nouvelleNote = () => setNote({ id: '', date: reseau.jour, texte: '', par: monNomPorteur(reseau, profil) || profil?.nom || reseau.directeur.nom })
  const fenetres = <>
    {sante && <DialogSante reseau={reseau} magasin={m.nom} date={sante} onFermer={(msg) => { setSante(null); if (msg) signaler(msg) }} />}
    {note && <DialogNote magasin={m.nom} note={note} onFermer={(msg) => { setNote(null); if (msg) signaler(msg) }} />}
  </>
  return { ouvrir, nouvelleNote, fenetres }
}

// magasins : note créée depuis le « + » (refonte vague 4, 42A), le magasin se choisit dans la fenêtre
export function DialogNote({ magasin: initial, note, magasins, onFermer }: { magasin: string; note: NoteMagasin; magasins?: string[]; onFermer: (message?: string) => void }) {
  const { reseau } = useReseau()
  const couleur = useCouleurTon()
  const [date, setDate] = useState(note.date)
  const [texte, setTexte] = useState(note.texte)
  const [magasin, setMagasin] = useState(initial)
  // Carnet du magasin (Joseph, 24/11/2026) : ton, thèmes et collègues prévenus, comme dans l'onglet Carnet
  const [ton, setTon] = useState<TonNote>(tonDe(note))
  const [themes, setThemes] = useState<string[]>(note.themes ?? [])
  const [prevenir, setPrevenir] = useState<string[]>(note.mentions ?? [])
  const autres = reseau && magasin ? collegues(reseau, magasin, note.par) : []
  return (
    <Fenetre titre={note.id ? 'Modifier la note' : 'Nouvelle note'} ouvert onFermer={onFermer} valide={!!texte.trim() && !!date && !!magasin}
      enregistrer={async () => {
        const mentions = prevenir.filter((p) => autres.some((a) => a.nom === p))
        const n: NoteMagasin = { ...note, id: note.id || nouvelIdNote(), date, texte: texte.trim(), ton, themes, mentions, ...(note.id ? {} : { quand: new Date().toISOString() }) }
        if (!themes.length) delete n.themes
        if (!mentions.length) delete n.mentions
        // Choix 114 : une nouvelle note se garde sur l'appareil sans réseau
        if (!note.id) return (await creerOuGarder('note', `Note · ${magasin}`, { magasin, note: n }, () => enregistrerNoteMagasin(magasin, n))) ? 'Note gardée sur l’appareil : elle partira seule au retour du réseau.' : 'Note enregistrée. Le franchisé ne la verra pas.'
        await enregistrerNoteMagasin(magasin, n)
        return 'Note enregistrée.'
      }}
      supprimer={note.id ? async () => { await supprimerNoteMagasin(magasin, note.id); return 'Note supprimée.' } : undefined}
      libelleSuppression="Supprimer cette note du carnet ?">
      <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontWeight: 700, color: 'warning.dark' }}>
        <LockOutlined sx={{ fontSize: 18 }} />Équipe seule, jamais le franchisé
      </Typography>
      {magasins && <Autocomplete options={magasins} value={magasin || null} onChange={(_, v) => setMagasin(v ?? '')} renderInput={(p) => <TextField {...p} label="Magasin" />} />}
      <ChampDate label="Date" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <TexteDicte label="Note" libelleDictee="Note" valeur={texte} changer={setTexte} multiline minRows={4} autoFocus />
      <Choix label="Ton" options={TONS.map((t) => ({ v: t.v, libelle: t.libelle, icone: <Pastille couleur={couleur(t.v).bord} /> }))} valeurs={[ton]} changer={(v) => setTon(v[0])} />
      <Choix label="Thèmes" multiple options={THEMES} valeurs={themes} changer={setThemes} />
      {autres.length > 0 && <Choix label="Prévenir" multiple options={autres.map((p) => ({ v: p.nom, libelle: p.nom }))} valeurs={prevenir} changer={setPrevenir} />}
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
