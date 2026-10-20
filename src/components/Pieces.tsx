import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import AttachFileOutlined from '@mui/icons-material/AttachFileOutlined'
import Cancel from '@mui/icons-material/Cancel'
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined'
import { useAuth } from '../auth/AuthContext'
import { formatTaille } from '../lib/photos'
import { ACCEPTE, envoyerPiece, estImage, lienPiece, messagePiece, NOMBRE_MAX, retirerPiece, type Piece } from '../lib/pieces'
import { Bulle } from './Outils'

// Choix des fichiers : envoyés aussitôt, ajoutés à la liste une fois en ligne
function useEnvoiPieces(pieces: Piece[], changer: (p: Piece[]) => void, signaler: (m: string) => void) {
  const { profil } = useAuth()
  const [envoi, setEnvoi] = useState(0)
  const entree = useRef<HTMLInputElement | null>(null)
  const choisir = async (fichiers: FileList | null) => {
    const liste = [...(fichiers ?? [])].slice(0, NOMBRE_MAX - pieces.length)
    if (!liste.length || !profil) return
    setEnvoi(liste.length)
    const ajout: Piece[] = []
    for (const f of liste) {
      try { ajout.push(await envoyerPiece(f, profil.id)) } catch (e) { signaler(messagePiece(e)) }
    }
    setEnvoi(0)
    if (ajout.length) changer([...pieces, ...ajout])
  }
  const champ = (
    <input ref={entree} type="file" accept={ACCEPTE} multiple hidden aria-label="Fichiers à joindre"
      onChange={(e) => { void choisir(e.target.files); e.target.value = '' }} />
  )
  return { envoi, ouvrir: () => entree.current?.click(), champ, plein: pieces.length >= NOMBRE_MAX }
}

// Fichiers prêts à partir, retirables avant l'envoi
export function PiecesEnAttente({ pieces, changer }: { pieces: Piece[]; changer: (p: Piece[]) => void }) {
  if (!pieces.length) return null
  return (
    <Box role="list" aria-label="Pièces jointes" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {pieces.map((p) => (
        <Box role="listitem" key={p.chemin}>
          <Chip icon={<InsertDriveFileOutlined />} label={`${p.nom} · ${formatTaille(p.taille)}`} sx={{ maxWidth: 280, minHeight: 40 }}
            onDelete={() => { changer(pieces.filter((x) => x.chemin !== p.chemin)); void retirerPiece(p.chemin) }}
            deleteIcon={<Cancel aria-label={`Retirer ${p.nom}`} aria-hidden={false} />} />
        </Box>
      ))}
    </Box>
  )
}

// Dans un formulaire : bouton « Joindre » et fichiers choisis
export function ChampPieces({ pieces, changer, signaler }: { pieces: Piece[]; changer: (p: Piece[]) => void; signaler: (m: string) => void }) {
  const { envoi, ouvrir, champ, plein } = useEnvoiPieces(pieces, changer, signaler)
  return (
    <Box sx={{ display: 'grid', gap: 1, justifyItems: 'start' }}>
      {champ}
      <PiecesEnAttente pieces={pieces} changer={changer} />
      <Button startIcon={envoi ? <CircularProgress size={18} /> : <AttachFileOutlined />} onClick={ouvrir} disabled={!!envoi || plein} sx={{ minHeight: 48, ml: -1 }}>
        {envoi ? 'Envoi du fichier…' : 'Joindre une photo ou un fichier'}
      </Button>
    </Box>
  )
}

// Dans la saisie d'un message : un trombone, les fichiers au-dessus du champ
export function BoutonJoindre({ pieces, changer, signaler }: { pieces: Piece[]; changer: (p: Piece[]) => void; signaler: (m: string) => void }) {
  const { envoi, ouvrir, champ, plein } = useEnvoiPieces(pieces, changer, signaler)
  return (
    <>
      {champ}
      <Bulle titre="Joindre une photo ou un fichier">
        <span>
          <IconButton onClick={ouvrir} disabled={!!envoi || plein} aria-label="Joindre une photo ou un fichier" sx={{ width: 48, height: 48, flexShrink: 0 }}>
            {envoi ? <CircularProgress size={20} aria-label="Envoi du fichier" /> : <AttachFileOutlined />}
          </IconButton>
        </span>
      </Bulle>
    </>
  )
}

// Lecture : vignettes des photos, liens des documents (liens temporaires demandés à l'affichage)
export function ListePieces({ pieces, clair = false }: { pieces: Piece[]; clair?: boolean }) {
  const [liens, setLiens] = useState<Record<string, string | null>>({})
  const cles = pieces.map((p) => p.chemin).join('|')
  useEffect(() => {
    let actif = true
    void Promise.all(pieces.map(async (p) => [p.chemin, await lienPiece(p.chemin, estImage(p) ? undefined : p.nom)] as const))
      .then((l) => { if (actif) setLiens(Object.fromEntries(l)) })
    return () => { actif = false }
  }, [cles]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!pieces.length) return null
  const images = pieces.filter(estImage)
  const fichiers = pieces.filter((p) => !estImage(p))
  return (
    <Box sx={{ display: 'grid', gap: 0.75, mt: 0.75 }}>
      {images.length > 0 && (
        <Box role="list" aria-label="Photos jointes" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {images.map((p) => (
            <Box role="listitem" key={p.chemin}>
              <Link href={liens[p.chemin] ?? undefined} target="_blank" rel="noopener" aria-label={`Ouvrir ${p.nom}`}
                sx={{ display: 'block', width: 96, height: 96, borderRadius: 2, overflow: 'hidden', bgcolor: 'action.hover' }}>
                {liens[p.chemin] && <Box component="img" src={liens[p.chemin]!} alt={p.nom} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
              </Link>
            </Box>
          ))}
        </Box>
      )}
      {fichiers.length > 0 && (
        <Box role="list" aria-label="Fichiers joints" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {fichiers.map((p) => (
            <Box role="listitem" key={p.chemin}>
              <Chip component="a" clickable href={liens[p.chemin] ?? undefined} target="_blank" rel="noopener" icon={<InsertDriveFileOutlined />}
                label={`${p.nom} · ${formatTaille(p.taille)}`} variant="outlined"
                sx={{ maxWidth: 280, minHeight: 40, ...(clair ? { color: 'inherit', borderColor: 'currentColor', '& .MuiChip-icon': { color: 'inherit' } } : {}) }} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
