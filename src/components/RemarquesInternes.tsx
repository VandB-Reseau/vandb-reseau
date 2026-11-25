// Notes au carnet depuis une visite (Joseph 10/11/2026, puis 25/11/2026) : pendant ou après la visite, 2 ou 3 éléments
// ajoutés au carnet du magasin avec la barre d'écriture du carnet (ton, thèmes, collègues prévenus), liés à la visite par
// son numéro. Rangés dans la rubrique « notes » : jamais dans le compte rendu, jamais renvoyés au franchisé.
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import DeleteOutline from '@mui/icons-material/DeleteOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import { Section } from './Section'
import { Pastille, useCouleurTon } from './Carnet'
import { SaisieNote, type ContenuNote } from './SaisieNote'
import { useAuth } from '../auth/AuthContext'
import { useReseau } from '../data/ReseauContext'
import { monNomPorteur } from '../data/actions'
import { enregistrerNoteMagasin, supprimerNoteMagasin } from '../data/chargement'
import { collegues, libelleTheme, libelleTon, lienNote, nouvelIdNote, tonDe } from '../data/carnet'
import { dateCourte } from '../lib/format'
import type { NoteMagasin, Reseau, Visite } from '../data/modele'

export function RemarquesInternes({ reseau, magasin, visite, signaler }: { reseau: Reseau; magasin: string; visite: Visite; signaler: (m: string) => void }) {
  const { profil } = useAuth()
  const { recharger } = useReseau()
  const couleur = useCouleurTon()
  const [occupe, setOccupe] = useState(false)
  const moi = monNomPorteur(reseau, profil) || profil?.nom || ''
  const notes = (reseau.notesMagasins[magasin] ?? []).filter((n) => visite.id != null && n.visite === visite.id).sort((a, b) => (a.quand ?? a.date).localeCompare(b.quand ?? b.date))
  if (visite.id == null) return null
  const agir = async (f: () => Promise<unknown>, ok: string, ko: string) => {
    setOccupe(true)
    try { await f(); await recharger(); signaler(ok); return true }
    catch { signaler(ko); return false }
    finally { setOccupe(false) }
  }
  const noter = ({ texte, ton, themes, mentions }: ContenuNote) => {
    const note: NoteMagasin = { id: nouvelIdNote(), date: reseau.jour, quand: new Date().toISOString(), texte, par: moi, ton, visite: visite.id!, ...(themes.length ? { themes } : {}), ...(mentions.length ? { mentions } : {}) }
    return agir(() => enregistrerNoteMagasin(magasin, note),
      mentions.length ? `Ajouté au carnet. ${mentions.join(', ')} ${mentions.length > 1 ? 'sont prévenus' : 'est prévenu'}.` : 'Ajouté au carnet. Le franchisé ne le verra pas.',
      'La note n’est pas enregistrée. Vérifie ta connexion, puis réessaie.')
  }
  return (
    <Section titre="Au carnet du magasin" action={<Button component={RouterLink} to={lienNote(magasin)} sx={{ minHeight: 48 }}>Ouvrir le carnet</Button>}>
      <Box sx={{ display: 'grid', gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <LockOutlined sx={{ fontSize: 18 }} />Pour l’équipe seulement, jamais dans le compte rendu.
        </Typography>
        {notes.length > 0 && (
          <Box component="ul" aria-label="Notes de la visite" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {notes.map((n) => {
              const t = tonDe(n)
              return (
                <Box component="li" key={n.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                  <Box sx={{ pt: 0.75 }}><Pastille couleur={couleur(t).bord} /></Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {n.texte && <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.texte}</Typography>}
                    <Typography variant="body2" color="text.secondary">
                      {[libelleTon(t), ...(n.themes ?? []).map(libelleTheme), n.par, dateCourte(n.date), n.mentions?.length ? `Prévenu${n.mentions.length > 1 ? 's' : ''} : ${n.mentions.join(', ')}` : ''].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                  {(n.par === moi || n.par === profil?.nom) && (
                    <Tooltip title="Supprimer">
                      <IconButton disabled={occupe} aria-label="Supprimer la note" sx={{ width: 48, height: 48 }}
                        onClick={() => void agir(() => supprimerNoteMagasin(magasin, n.id), 'Note supprimée.', 'La note n’a pas pu être supprimée. Vérifie ta connexion et réessaie.')}>
                        <DeleteOutline />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              )
            })}
          </Box>
        )}
        <Box component="section" aria-label="Nouvelle note de la visite" sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 1 }}>
          <SaisieNote label="Ajouter au carnet" autres={collegues(reseau, magasin, moi)} envoyer={noter} occupe={occupe || !moi} />
        </Box>
      </Box>
    </Section>
  )
}

// Visite non prévue (Joseph, 25/11/2026) : la visite n'a pas encore de numéro, les notes attendent l'enregistrement
// de la saisie, puis partent au carnet du magasin liées à la visite (noterAuCarnet)
export function CarnetEnAttente({ reseau, magasin, notes, changer }: { reseau: Reseau; magasin: string; notes: ContenuNote[]; changer: (n: ContenuNote[]) => void }) {
  const { profil } = useAuth()
  const couleur = useCouleurTon()
  const moi = monNomPorteur(reseau, profil) || profil?.nom || ''
  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <LockOutlined sx={{ fontSize: 18 }} />Pour l’équipe seulement, jamais dans le compte rendu.
      </Typography>
      {notes.length > 0 && (
        <Box component="ul" aria-label="Notes de la visite" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {notes.map((n, i) => (
            <Box component="li" key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
              <Box sx={{ pt: 0.75 }}><Pastille couleur={couleur(n.ton).bord} /></Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.texte}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {[libelleTon(n.ton), ...n.themes.map(libelleTheme), n.mentions.length ? `Prévenu${n.mentions.length > 1 ? 's' : ''} : ${n.mentions.join(', ')}` : '', 'Part au carnet à l’enregistrement'].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              <Tooltip title="Retirer">
                <IconButton aria-label="Retirer la note" sx={{ width: 48, height: 48 }} onClick={() => changer(notes.filter((_, j) => j !== i))}><DeleteOutline /></IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      )}
      <Box component="section" aria-label="Nouvelle note de la visite" sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 1 }}>
        <SaisieNote label="Ajouter au carnet" autres={collegues(reseau, magasin, moi)} envoyer={async (n) => { changer([...notes, n]); return true }} occupe={!moi} libelleEnvoi="Ajouter" />
      </Box>
    </Box>
  )
}

export async function noterAuCarnet(reseau: Reseau, magasin: string, visite: number, par: string, notes: ContenuNote[]) {
  for (const { texte, ton, themes, mentions } of notes) {
    const note: NoteMagasin = { id: nouvelIdNote(), date: reseau.jour, quand: new Date().toISOString(), texte, par, ton, visite, ...(themes.length ? { themes } : {}), ...(mentions.length ? { mentions } : {}) }
    await enregistrerNoteMagasin(magasin, note)
  }
}
