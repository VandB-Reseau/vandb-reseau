import { useState, type ReactElement } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import MonitorHeartOutlined from '@mui/icons-material/MonitorHeartOutlined'
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined'
import PersonOutlined from '@mui/icons-material/PersonOutlined'
import StickyNote2Outlined from '@mui/icons-material/StickyNote2Outlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import { Section } from '../pages/FicheMagasin'
import { Fenetre } from './EditionEquipe'
import { FiltreMenu } from './FiltreMenu'
import { journalMagasin, typesJournal, type TypeJournal } from '../data/journal'
import { enregistrerEvaluations, enregistrerNoteMagasin, supprimerEvaluation, supprimerNoteMagasin } from '../data/chargement'
import { caseDe, historiqueSante, type IdCritere, type Note } from '../data/sante'
import { NotesParAxe, PastilleCase } from './Sante'
import { dateCourte } from '../lib/format'
import type { Magasin, NoteMagasin, Reseau } from '../data/modele'

const icones: Record<TypeJournal, ReactElement> = {
  visite: <EventNoteOutlined fontSize="small" />,
  sante: <MonitorHeartOutlined fontSize="small" />,
  deploiement: <RocketLaunchOutlined fontSize="small" />,
  coach: <PersonOutlined fontSize="small" />,
  note: <StickyNote2Outlined fontSize="small" />,
  ouverture: <StorefrontOutlined fontSize="small" />,
}

const PAS = 12

export function Journal({ reseau, m, signaler }: { reseau: Reseau; m: Magasin; signaler: (message: string) => void }) {
  const [types, setTypes] = useState<string[]>([])
  const [nombre, setNombre] = useState(PAS)
  const [note, setNote] = useState<NoteMagasin | null>(null)
  const [sante, setSante] = useState<string | null>(null)
  const tous = journalMagasin(reseau, m)
  const liste = tous.filter((e) => !types.length || types.includes(e.type))
  const nouvelle = (): NoteMagasin => ({ id: '', date: reseau.jour, texte: '', par: reseau.directeur.nom })
  return (
    <Section titre="Journal" action={<Button startIcon={<AddOutlined />} onClick={() => setNote(nouvelle())} sx={{ minHeight: 48 }}>Note</Button>}>
      <Box sx={{ mb: 1.5 }}>
        <FiltreMenu libelle="Afficher" choisis={types} onChange={setTypes}
          options={typesJournal.map((t) => ({ valeur: t.id, libelle: t.libelle, detail: `${tous.filter((e) => e.type === t.id).length}` }))} />
      </Box>
      {liste.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Rien d’enregistré pour l’instant.</Typography>
      ) : (
        <Box component="ol" aria-label={`Journal de ${m.nom}`} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {liste.slice(0, nombre).map((e) => {
            const n = e.noteId ? reseau.notesMagasins[m.nom]?.find((x) => x.id === e.noteId) : undefined
            return (
              <Box component="li" key={e.cle} sx={{ display: 'flex', gap: 1.5, py: 1, alignItems: 'flex-start', borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                <Typography variant="body2" color="text.secondary" sx={{ width: { xs: 84, sm: 110 }, flexShrink: 0, pt: 0.25 }}>{dateCourte(e.date)}</Typography>
                <Box sx={{ color: 'text.secondary', pt: 0.25, display: 'inline-flex' }} aria-label={typesJournal.find((t) => t.id === e.type)?.libelle}>{icones[e.type]}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{e.titre}</Typography>
                  {e.detail && <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{e.detail}</Typography>}
                </Box>
                {e.lien && <Tooltip title="Compte rendu PDF"><IconButton component={RouterLink} to={e.lien} aria-label={`Compte rendu du ${dateCourte(e.date)}`} sx={{ mt: -1 }}><PictureAsPdfOutlined /></IconButton></Tooltip>}
                {n && <Tooltip title="Modifier"><IconButton onClick={() => setNote(n)} aria-label={`Modifier la note du ${dateCourte(e.date)}`} sx={{ mt: -1 }}><EditOutlined /></IconButton></Tooltip>}
                {e.type === 'sante' && <Tooltip title="Modifier"><IconButton onClick={() => setSante(e.date)} aria-label={`Modifier le classement du ${dateCourte(e.date)}`} sx={{ mt: -1 }}><EditOutlined /></IconButton></Tooltip>}
              </Box>
            )
          })}
        </Box>
      )}
      {liste.length > nombre && <Button onClick={() => setNombre((x) => x + PAS * 2)} sx={{ mt: 1, minHeight: 48 }}>Afficher plus ({liste.length - nombre})</Button>}
      {sante && <DialogSante reseau={reseau} magasin={m.nom} date={sante} onFermer={(msg) => { setSante(null); if (msg) signaler(msg) }} />}
      {note && <DialogNote magasin={m.nom} note={note} onFermer={(msg) => { setNote(null); if (msg) signaler(msg) }} />}
    </Section>
  )
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
