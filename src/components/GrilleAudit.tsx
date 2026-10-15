import { useEffect, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddAPhotoOutlined from '@mui/icons-material/AddAPhotoOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import PhotoCameraOutlined from '@mui/icons-material/PhotoCameraOutlined'
import ImageNotSupportedOutlined from '@mui/icons-material/ImageNotSupportedOutlined'
import { ecarts, parTheme, resultatGrille, type EtatPoint, type Photo, type ReponsePoint, type Reponses } from '../data/grilles'
import { envoyerPhoto, lienPhoto, messagePhoto } from '../lib/photos'

export function MiniaturePhoto({ chemin, numero, onRetirer }: { chemin: string; numero: number; onRetirer?: () => void }) {
  const [lien, setLien] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let actif = true
    lienPhoto(chemin).then((l) => { if (actif) setLien(l) })
    return () => { actif = false }
  }, [chemin])
  const cadre = { width: 72, height: 72, borderRadius: 1, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', bgcolor: 'action.hover' }
  return (
    <Box sx={{ position: 'relative' }}>
      {lien
        ? <Link href={lien} target="_blank" rel="noopener" aria-label={`Ouvrir la photo ${numero}`} sx={cadre}><Box component="img" src={lien} alt={`Photo ${numero}`} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /></Link>
        : <Box sx={cadre}>{lien === undefined ? <CircularProgress size={20} /> : <Tooltip title="Photo indisponible"><ImageNotSupportedOutlined color="disabled" /></Tooltip>}</Box>}
      {onRetirer && (
        <IconButton aria-label={`Retirer la photo ${numero}`} onClick={onRetirer} size="small"
          sx={{ position: 'absolute', top: -14, right: -14, width: 48, height: 48, '& svg': { bgcolor: 'background.paper', borderRadius: '50%', boxShadow: 1 } }}>
          <CloseOutlined fontSize="small" />
        </IconButton>
      )}
    </Box>
  )
}

export function ResultatAuditPastille({ reponses, seuil }: { reponses: Reponses; seuil: number }) {
  const r = resultatGrille(reponses, seuil)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }} aria-live="polite">
      {r.conforme !== null && <Chip color={r.conforme ? 'success' : 'error'} label={r.conforme ? 'Conforme' : 'Non conforme'} />}
      <Typography variant="body1" sx={{ fontWeight: 600 }}>{r.score === null ? 'Aucun point noté' : `Score ${r.score.toLocaleString('fr-FR')} %`}</Typography>
      <Typography variant="body2" color="text.secondary">{r.renseignes} point{r.renseignes > 1 ? 's' : ''} sur {r.total} · seuil {seuil} %</Typography>
      {r.critiques.length > 0 && <Typography variant="body2" color="error">{r.critiques.length > 1 ? `${r.critiques.length} points critiques non conformes` : 'Point critique non conforme'}</Typography>}
    </Box>
  )
}

function LignePoint({ id, p, modifier, onRetirerPhoto }: { id: string; p: ReponsePoint; modifier: (id: string, x: Partial<ReponsePoint>) => void; onRetirerPhoto: (chemin: string) => void }) {
  const entree = useRef<HTMLInputElement>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const photos = p.photos ?? []
  const ajouter = async (fichiers: FileList | null) => {
    if (!fichiers?.length) return
    setEnvoi(true); setErreur(null)
    const ajoutees = [...photos]
    try {
      for (const f of Array.from(fichiers)) ajoutees.push(await envoyerPhoto(f))
    } catch (e) { setErreur(messagePhoto(e)) } finally {
      modifier(id, { photos: ajoutees }); setEnvoi(false)
      if (entree.current) entree.current.value = ''
    }
  }
  return (
    <Box sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        <Typography variant="body1" sx={{ flex: '1 1 220px', minWidth: 0 }}>
          {p.libelle}
          {p.critique && <Chip size="small" color="warning" variant="outlined" label="Critique" sx={{ ml: 1, fontSize: '0.75rem' }} />}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flex: { xs: '1 1 100%', md: '0 0 auto' } }}>
          <ToggleButtonGroup exclusive value={p.etat} onChange={(_e, v: EtatPoint | null) => modifier(id, { etat: v })} aria-label={p.libelle} sx={{ flex: 1 }}>
            <ToggleButton value="oui" color="success" sx={{ minHeight: 48, flex: 1, px: 1.5 }}>Oui</ToggleButton>
            <ToggleButton value="non" color="error" sx={{ minHeight: 48, flex: 1, px: 1.5 }}>Non</ToggleButton>
            <ToggleButton value="na" sx={{ minHeight: 48, flex: 1.6, px: 1.5, whiteSpace: 'nowrap' }}>Sans objet</ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="Ajouter une photo">
            <span>
              <IconButton aria-label={`Ajouter une photo : ${p.libelle}`} onClick={() => entree.current?.click()} disabled={envoi} sx={{ width: 48, height: 48 }}>
                {envoi ? <CircularProgress size={20} /> : <PhotoCameraOutlined />}
              </IconButton>
            </span>
          </Tooltip>
          <input ref={entree} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => ajouter(e.target.files)} data-testid={`photo-${id}`} />
        </Box>
      </Box>
      {p.etat === 'non' && (
        <TextField label="Écart constaté" value={p.commentaire ?? ''} onChange={(e) => modifier(id, { commentaire: e.target.value })} fullWidth multiline sx={{ mt: 1.5 }} />
      )}
      {photos.length > 0 && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2, ml: 0.5 }}>
          {photos.map((ph, i) => <MiniaturePhoto key={ph.chemin} chemin={ph.chemin} numero={i + 1} onRetirer={() => { onRetirerPhoto(ph.chemin); modifier(id, { photos: photos.filter((x) => x.chemin !== ph.chemin) }) }} />)}
        </Box>
      )}
      {erreur && <Alert severity="error" sx={{ mt: 1 }}>{erreur}</Alert>}
    </Box>
  )
}

export function SaisieGrille({ titre, reponses, setReponses, seuil, onRetirerPhoto }: {
  titre: string; reponses: Reponses; setReponses: (f: (r: Reponses) => Reponses) => void; seuil: number; onRetirerPhoto: (chemin: string) => void
}) {
  const modifier = (id: string, x: Partial<ReponsePoint>) => setReponses((r) => ({ ...r, [id]: { ...r[id], ...x } }))
  return (
    <Box component="section" aria-label={titre}>
      <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700, mb: 1 }}>{titre}</Typography>
      <ResultatAuditPastille reponses={reponses} seuil={seuil} />
      {parTheme(reponses).map((t) => (
        <Box key={t.theme} sx={{ mt: 2 }}>
          <Typography variant="subtitle2" component="h4" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.theme}</Typography>
          {t.points.map(([id, p]) => <LignePoint key={id} id={id} p={p} modifier={modifier} onRetirerPhoto={onRetirerPhoto} />)}
        </Box>
      ))}
    </Box>
  )
}

// Fiche magasin : écarts du dernier audit, avec leurs photos
export function EcartsAudit({ reponses }: { reponses: Reponses | undefined }) {
  const liste = ecarts(reponses)
  if (!liste.length) return null
  return (
    <Box sx={{ pl: { xs: 0, sm: 2 }, mb: 1 }}>
      {liste.map((p, i) => (
        <Box key={i} sx={{ py: 0.75 }}>
          <Typography variant="body2">
            <Box component="span" sx={{ color: 'error.main', fontWeight: 600 }}>{p.critique ? 'Critique · ' : ''}</Box>
            {p.libelle}
          </Typography>
          {p.commentaire && <Typography variant="body2" color="text.secondary">{p.commentaire}</Typography>}
          <RangeePhotos photos={p.photos} />
        </Box>
      ))}
    </Box>
  )
}

// Photos libres (visite, bonne pratique) : prises au téléphone ou choisies sur le PC
export function ChampPhotos({ photos, onChange, onRetirer, titre = 'Photos' }: { photos: Photo[]; onChange: (p: Photo[]) => void; onRetirer: (chemin: string) => void; titre?: string }) {
  const entree = useRef<HTMLInputElement>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const ajouter = async (fichiers: FileList | null) => {
    if (!fichiers?.length) return
    setEnvoi(true); setErreur(null)
    const ajoutees = [...photos]
    try {
      for (const f of Array.from(fichiers)) ajoutees.push(await envoyerPhoto(f))
    } catch (e) { setErreur(messagePhoto(e)) } finally {
      onChange(ajoutees); setEnvoi(false)
      if (entree.current) entree.current.value = ''
    }
  }
  return (
    <Box component="section" aria-label={titre}>
      <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>{titre}</Typography>
      {photos.length > 0 && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1.5, ml: 0.5, mt: 2 }}>
          {photos.map((ph, i) => <MiniaturePhoto key={ph.chemin} chemin={ph.chemin} numero={i + 1} onRetirer={() => { onRetirer(ph.chemin); onChange(photos.filter((x) => x.chemin !== ph.chemin)) }} />)}
        </Box>
      )}
      <Button startIcon={envoi ? <CircularProgress size={18} /> : <AddAPhotoOutlined />} onClick={() => entree.current?.click()} disabled={envoi} sx={{ minHeight: 48 }}>
        {envoi ? 'Envoi…' : 'Ajouter des photos'}
      </Button>
      <input ref={entree} type="file" accept="image/*" multiple hidden onChange={(e) => ajouter(e.target.files)} data-testid="photos-libres" />
      {erreur && <Alert severity="error" sx={{ mt: 1 }}>{erreur}</Alert>}
    </Box>
  )
}

// Lecture seule : rangée de miniatures
export function RangeePhotos({ photos }: { photos: Photo[] | undefined }) {
  if (!photos?.length) return null
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
      {photos.map((ph, k) => <MiniaturePhoto key={ph.chemin} chemin={ph.chemin} numero={k + 1} />)}
    </Box>
  )
}
