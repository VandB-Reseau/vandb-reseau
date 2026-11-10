// Remarques internes d'une visite (Joseph 10/11/2026) : notes et appréciation de l'équipe, prises pendant ou après la
// visite. Rangées dans le journal du magasin (rubrique « notes ») avec le numéro de la visite : jamais dans le compte
// rendu, jamais renvoyées au franchisé.
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import { Section } from './Section'
import { Fenetre } from './EditionEquipe'
import { Puces } from './Social'
import { TexteDicte } from './Dictee'
import { useAuth } from '../auth/AuthContext'
import { useReseau } from '../data/ReseauContext'
import { enregistrerNoteMagasin, supprimerNoteMagasin } from '../data/chargement'
import { dateCourte } from '../lib/format'
import type { Appreciation, Reseau, Visite } from '../data/modele'

export const libelleAppreciation: Record<Appreciation, string> = { satisfaisante: 'Satisfaisante', mitigee: 'Mitigée', preoccupante: 'Préoccupante' }
const couleur: Record<Appreciation, string> = { satisfaisante: 'success.main', mitigee: 'warning.dark', preoccupante: 'error.main' }

export function RemarquesInternes({ reseau, magasin, visite, signaler }: { reseau: Reseau; magasin: string; visite: Visite; signaler: (m: string) => void }) {
  const { profil } = useAuth()
  const { recharger } = useReseau()
  const [ouvert, setOuvert] = useState(false)
  const [texte, setTexte] = useState('')
  const [appreciation, setAppreciation] = useState<Appreciation | ''>('')
  const notes = (reseau.notesMagasins[magasin] ?? []).filter((n) => visite.id != null && n.visite === visite.id).sort((a, b) => a.date.localeCompare(b.date))
  if (visite.id == null) return null
  const supprimer = async (id: string) => {
    try { await supprimerNoteMagasin(magasin, id); await recharger(); signaler('Remarque supprimée.') }
    catch { signaler('La remarque n’a pas pu être supprimée. Vérifie ta connexion et réessaie.') }
  }
  return (
    <Section titre="Remarques internes" action={<Button startIcon={<AddOutlined />} onClick={() => { setTexte(''); setAppreciation(''); setOuvert(true) }} sx={{ minHeight: 48 }}>Ajouter une remarque</Button>}>
      <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: notes.length ? 1 : 0 }}>
        <LockOutlined sx={{ fontSize: 18 }} />Visibles de l’équipe seulement, jamais du franchisé ni dans le compte rendu.
      </Typography>
      {notes.length > 0 && (
        <Box component="ul" aria-label="Remarques internes de la visite" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {notes.map((n) => (
            <Box component="li" key={n.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {n.appreciation && <Typography variant="body2" sx={{ fontWeight: 700, color: couleur[n.appreciation] }}>Appréciation : {libelleAppreciation[n.appreciation]}</Typography>}
                {n.texte && <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.texte}</Typography>}
                <Typography variant="body2" color="text.secondary">{[n.par, dateCourte(n.date)].filter(Boolean).join(' · ')}</Typography>
              </Box>
              <Tooltip title="Supprimer"><IconButton onClick={() => void supprimer(n.id)} aria-label="Supprimer la remarque"><DeleteOutline /></IconButton></Tooltip>
            </Box>
          ))}
        </Box>
      )}
      {ouvert && (
        <Fenetre titre="Remarque interne" ouvert onFermer={(m) => { setOuvert(false); if (m) signaler(m) }} valide={!!texte.trim() || !!appreciation}
          enregistrer={async () => {
            await enregistrerNoteMagasin(magasin, { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: reseau.jour, texte: texte.trim(), par: profil?.nom ?? '', visite: visite.id!, ...(appreciation ? { appreciation } : {}) })
            return 'Remarque enregistrée. Le franchisé ne la verra pas.'
          }}>
          <Puces label="Appréciation" valeur={appreciation} onChange={setAppreciation}
            options={[{ v: '' as const, libelle: 'Aucune' }, ...(['satisfaisante', 'mitigee', 'preoccupante'] as const).map((v) => ({ v, libelle: libelleAppreciation[v] }))]} />
          <TexteDicte label="Remarque" libelleDictee="Remarque" valeur={texte} changer={setTexte} autoFocus multiline minRows={3} />
        </Fenetre>
      )}
    </Section>
  )
}
