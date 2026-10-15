import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined'
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import CleaningServicesOutlined from '@mui/icons-material/CleaningServicesOutlined'
import StarOutlineOutlined from '@mui/icons-material/StarOutlineOutlined'
import { Onglets } from './Onglets'
import { enregistrerGrilles } from '../data/chargement'
import { useReseau } from '../data/ReseauContext'
import { grillesParDefaut, libellesGrilles, nombrePoints, nouvelId, photosDe, type Grille, type Grilles, type ThemeGrille } from '../data/grilles'
import { ESPACE_GRATUIT, formatTaille } from '../lib/photos'
import type { Reseau } from '../data/modele'

const copie = (g: Grilles): Grilles => JSON.parse(JSON.stringify(g))
const deplacer = <T,>(liste: T[], i: number, d: number) => { const l = [...liste]; const [x] = l.splice(i, 1); l.splice(i + d, 0, x); return l }

function EditeurGrille({ grille, onChange }: { grille: Grille; onChange: (g: Grille) => void }) {
  const themes = (f: (t: ThemeGrille[]) => ThemeGrille[]) => onChange({ ...grille, themes: f(grille.themes) })
  const theme = (i: number, f: (t: ThemeGrille) => ThemeGrille) => themes((ts) => ts.map((t, k) => (k === i ? f(t) : t)))
  const seuilInvalide = grille.seuil === null || !Number.isInteger(grille.seuil) || grille.seuil < 0 || grille.seuil > 100
  return (
    <Box>
      <TextField type="number" label="Seuil de conformité (%)" value={Number.isNaN(grille.seuil) ? '' : grille.seuil} onChange={(e) => onChange({ ...grille, seuil: e.target.value === '' ? NaN : Number(e.target.value) })}
        error={seuilInvalide} helperText={seuilInvalide ? 'Entre 0 et 100, nombre entier.' : `${nombrePoints(grille)} points`} slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }} sx={{ width: { xs: '100%', sm: 280 } }} />
      {grille.themes.map((t, i) => (
        <Box key={t.id} sx={{ mt: 3, p: { xs: 1.5, md: 2 }, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField label="Thème" value={t.libelle} onChange={(e) => theme(i, (x) => ({ ...x, libelle: e.target.value }))} error={!t.libelle.trim()} sx={{ flex: 1 }} slotProps={{ htmlInput: { style: { fontWeight: 600 } } }} />
            <Tooltip title="Monter le thème"><span><IconButton aria-label={`Monter le thème ${t.libelle}`} disabled={i === 0} onClick={() => themes((ts) => deplacer(ts, i, -1))} sx={{ width: 48, height: 48 }}><ArrowUpwardOutlined /></IconButton></span></Tooltip>
            <Tooltip title="Supprimer le thème"><IconButton aria-label={`Supprimer le thème ${t.libelle}`} onClick={() => themes((ts) => ts.filter((_x, k) => k !== i))} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton></Tooltip>
          </Box>
          {t.points.map((p, j) => (
            <Box key={p.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1.5, flexWrap: { xs: 'wrap', md: 'nowrap' }, pl: { md: 2 } }}>
              <TextField label={`Point ${j + 1}`} value={p.libelle} error={!p.libelle.trim()} multiline
                onChange={(e) => theme(i, (x) => ({ ...x, points: x.points.map((y, k) => (k === j ? { ...y, libelle: e.target.value } : y)) }))} sx={{ flex: '1 1 100%' }} />
              <Box sx={{ display: 'flex', alignItems: 'center', ml: { xs: 'auto', md: 0 } }}>
                <FormControlLabel label="Critique" sx={{ minHeight: 48, mr: 1 }} control={
                  <Checkbox checked={!!p.critique} icon={<StarOutlineOutlined />} onChange={(e) => theme(i, (x) => ({ ...x, points: x.points.map((y, k) => (k === j ? { ...y, critique: e.target.checked || undefined } : y)) }))} sx={{ width: 48, height: 48 }} />
                } />
                <Tooltip title="Monter"><span><IconButton aria-label={`Monter le point ${j + 1} de ${t.libelle}`} disabled={j === 0} onClick={() => theme(i, (x) => ({ ...x, points: deplacer(x.points, j, -1) }))} sx={{ width: 48, height: 48 }}><ArrowUpwardOutlined /></IconButton></span></Tooltip>
                <Tooltip title="Descendre"><span><IconButton aria-label={`Descendre le point ${j + 1} de ${t.libelle}`} disabled={j === t.points.length - 1} onClick={() => theme(i, (x) => ({ ...x, points: deplacer(x.points, j, 1) }))} sx={{ width: 48, height: 48 }}><ArrowDownwardOutlined /></IconButton></span></Tooltip>
                <Tooltip title="Supprimer"><IconButton aria-label={`Supprimer le point ${j + 1} de ${t.libelle}`} onClick={() => theme(i, (x) => ({ ...x, points: x.points.filter((_y, k) => k !== j) }))} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton></Tooltip>
              </Box>
            </Box>
          ))}
          <Button startIcon={<AddOutlined />} onClick={() => theme(i, (x) => ({ ...x, points: [...x.points, { id: nouvelId(x.id), libelle: '' }] }))} sx={{ minHeight: 48, mt: 1 }}>Ajouter un point</Button>
        </Box>
      ))}
      <Button variant="outlined" startIcon={<AddOutlined />} onClick={() => themes((ts) => [...ts, { id: nouvelId('theme'), libelle: '', points: [{ id: nouvelId('point'), libelle: '' }] }])} sx={{ minHeight: 48, mt: 2 }}>Ajouter un thème</Button>
    </Box>
  )
}

export function GrillesAudit({ reseau }: { reseau: Reseau }) {
  const { recharger } = useReseau()
  const [vue, setVue] = useState<'hygiene' | 'excellence'>('hygiene')
  const [grilles, setGrilles] = useState<Grilles>(() => copie(reseau.grilles))
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(false)
  const [ok, setOk] = useState(false)
  const modifie = JSON.stringify(grilles) !== JSON.stringify(reseau.grilles)
  const invalide = Object.values(grilles).some((g) => !Number.isInteger(g.seuil) || g.seuil < 0 || g.seuil > 100 || g.themes.some((t) => !t.libelle.trim() || t.points.some((p) => !p.libelle.trim())))
  const enregistrer = async () => {
    setEnvoi(true); setErreur(false)
    const propres: Grilles = Object.fromEntries(Object.entries(grilles).map(([k, g]) => [k, { ...g, themes: g.themes.map((t) => ({ ...t, libelle: t.libelle.trim(), points: t.points.map((p) => ({ ...p, libelle: p.libelle.trim() })) })) }]))
    try { await enregistrerGrilles(propres); await recharger(); setOk(true) } catch { setErreur(true) } finally { setEnvoi(false) }
  }
  return (
    <Card sx={{ mt: 2 }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h3" component="h2" sx={{ mb: 2 }}>Grilles d’audit</Typography>
        <Onglets valeur={vue} onChange={setVue} libelle="Grilles d’audit" rubriques={[
          { vue: 'hygiene', libelle: libellesGrilles.hygiene, icone: <CleaningServicesOutlined /> },
          { vue: 'excellence', libelle: libellesGrilles.excellence, court: 'Excellence', icone: <StarOutlineOutlined /> },
        ]} />
        <EditeurGrille key={vue} grille={grilles[vue]} onChange={(g) => setGrilles((x) => ({ ...x, [vue]: g }))} />
        {erreur && <Alert severity="error" sx={{ mt: 2 }}>Les grilles n’ont pas pu être enregistrées. Vérifie ta connexion et réessaie.</Alert>}
        <Box sx={{ display: 'flex', gap: 1, mt: 3, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button onClick={() => setGrilles((x) => ({ ...x, [vue]: copie(grillesParDefaut)[vue] }))} sx={{ minHeight: 48, mr: 'auto' }}>Grille de départ</Button>
          <Button disabled={!modifie || envoi} onClick={() => setGrilles(copie(reseau.grilles))} sx={{ minHeight: 48 }}>Annuler</Button>
          <Button variant="contained" disabled={!modifie || envoi || invalide} onClick={enregistrer} sx={{ minHeight: 48 }}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </Box>
      </CardContent>
      <Snackbar open={ok} autoHideDuration={5000} onClose={() => setOk(false)} message="Grilles d’audit enregistrées." />
    </Card>
  )
}

// Espace photos utilisé, à partir des tailles enregistrées avec chaque photo
export function EspacePhotos({ reseau }: { reseau: Reseau }) {
  const photos = [...Object.values(reseau.audits).flat().flatMap((a) => photosDe(a.reponses)), ...reseau.visites.flatMap((v) => v.photos ?? []), ...reseau.pratiques.flatMap((p) => p.photos)]
  const total = photos.reduce((n, p) => n + (p.taille || 0), 0)
  const part = Math.min(100, (total / ESPACE_GRATUIT) * 100)
  return (
    <Card sx={{ mt: 2 }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h3" component="h2" sx={{ mb: 2 }}>Espace photos</Typography>
        <Typography variant="body1" sx={{ mb: 1 }}>
          {photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''} · ${formatTaille(total)} sur ${formatTaille(ESPACE_GRATUIT)}` : `Aucune photo · ${formatTaille(ESPACE_GRATUIT)} disponible`}
        </Typography>
        <LinearProgress variant="determinate" value={part} color={part >= 90 ? 'error' : part >= 70 ? 'warning' : 'primary'} aria-label="Espace photos utilisé" sx={{ height: 8, borderRadius: 4 }} />
        {part >= 70 && <Alert severity={part >= 90 ? 'error' : 'warning'} sx={{ mt: 2 }}>L’espace photos gratuit est presque plein.</Alert>}
      </CardContent>
    </Card>
  )
}
