import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { enregistrerSituations } from '../data/chargement'
import { useReseau } from '../data/ReseauContext'
import { libelleFermeture, libelleSituation, type Magasin, type Situation, type TypeFermeture, type TypeSituation } from '../data/modele'
import { texteSituation } from '../data/situations'

// Situation d'un magasin (Directeur seul) : fermeture provisoire, passage intégré ou franchisé, sortie du réseau,
// soirée d'inauguration. Une ligne datée par changement ; une seule sortie du réseau à la fois.
const DATE = /^\d{4}-\d{2}-\d{2}$/

export function DialogSituation({ magasin, jour, onFermer }: { magasin: Magasin; jour: string; onFermer: (message?: string) => void }) {
  const pleinEcran = useMediaQuery(useTheme().breakpoints.down('sm'))
  const { recharger } = useReseau()
  const [liste, setListe] = useState<Situation[]>(magasin.situations)
  const [type, setType] = useState<TypeSituation | ''>('')
  const [date, setDate] = useState(jour)
  const [fin, setFin] = useState(jour)
  const [sortie, setSortie] = useState<TypeFermeture>('fermeture')
  const [motif, setMotif] = useState('')
  const [repreneur, setRepreneur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<'' | 'base' | 'echec'>('')
  // Le passage proposé est l'inverse du statut actuel
  const passage: TypeSituation = magasin.franchise ? 'integre' : 'franchise'
  const types: TypeSituation[] = ['travaux', passage, 'inauguration', 'sortie']
  const valide = DATE.test(date) && (type !== 'travaux' || (DATE.test(fin) && fin >= date))
  const change = liste !== magasin.situations || !!type

  const nouvelle = (): Situation | null => !type ? null : {
    date, type,
    ...(type === 'travaux' ? { fin } : {}),
    ...(type === 'sortie' ? { sortie } : {}),
    ...(motif.trim() ? { motif: motif.trim() } : {}),
    ...(type === 'sortie' && sortie === 'cession' && repreneur.trim() ? { repreneur: repreneur.trim() } : {}),
  }

  const enregistrer = async () => {
    const n = nouvelle()
    const l = (n ? [...liste.filter((s) => !(n.type === 'sortie' && s.type === 'sortie')), n] : liste).sort((a, b) => a.date.localeCompare(b.date))
    setEnvoi(true)
    setErreur('')
    const r = await enregistrerSituations(magasin.nom, l)
    if (r !== 'ok') { setErreur(r); setEnvoi(false); return }
    await recharger()
    onFermer(n ? `${texteSituation(n)} : enregistré pour ${magasin.nom}.` : `Situation de ${magasin.nom} mise à jour.`)
  }

  return (
    <Dialog open onClose={() => onFermer()} fullScreen={pleinEcran} fullWidth maxWidth="sm" aria-labelledby="titre-situation">
      <DialogTitle id="titre-situation">Situation de {magasin.nom}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {liste.length > 0 && (
            <Box component="ul" aria-label="Situations enregistrées" sx={{ listStyle: 'none', m: 0, p: 0, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              {liste.map((s, i) => (
                <Box component="li" key={`${s.type}-${s.date}-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1.5, borderTop: i ? 1 : 0, borderColor: 'divider' }}>
                  <Typography variant="body2" sx={{ flex: 1, py: 1, color: s.date < jour && s.type !== 'sortie' && (s.fin ?? s.date) < jour ? 'text.secondary' : 'text.primary' }}>{texteSituation(s)}</Typography>
                  <IconButton aria-label={`Retirer : ${texteSituation(s)}`} onClick={() => setListe(liste.filter((_, j) => j !== i))} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton>
                </Box>
              ))}
            </Box>
          )}
          <TextField select label="Ajouter" value={type} onChange={(e) => setType(e.target.value as TypeSituation)}>
            {types.map((t) => <MenuItem key={t} value={t} sx={{ minHeight: 48 }}>{libelleSituation[t]}</MenuItem>)}
          </TextField>
          {type === 'sortie' && (
            <TextField select label="Motif de sortie" value={sortie} onChange={(e) => setSortie(e.target.value as TypeFermeture)}>
              {(Object.keys(libelleFermeture) as TypeFermeture[]).map((t) => <MenuItem key={t} value={t} sx={{ minHeight: 48 }}>{libelleFermeture[t]}</MenuItem>)}
            </TextField>
          )}
          {type && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField type="date" label={type === 'travaux' ? 'Du' : 'Date'} value={date} onChange={(e) => { setDate(e.target.value); if (fin < e.target.value) setFin(e.target.value) }}
                error={!DATE.test(date)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1, minWidth: 160 }} />
              {type === 'travaux' && <TextField type="date" label="Au" value={fin} onChange={(e) => setFin(e.target.value)}
                error={!DATE.test(fin) || fin < date} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1, minWidth: 160 }} />}
            </Box>
          )}
          {type === 'sortie' && sortie === 'cession' && <TextField label="Repreneur" value={repreneur} onChange={(e) => setRepreneur(e.target.value)} slotProps={{ htmlInput: { maxLength: 120 } }} />}
          {type && <TextField label={type === 'travaux' ? 'Motif' : 'Précision'} value={motif} onChange={(e) => setMotif(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />}
          {erreur === 'base' && <Alert severity="warning">La base n’est pas encore prête pour la situation des magasins : la mise à jour de Supabase doit d’abord être passée.</Alert>}
          {erreur === 'echec' && <Alert severity="error">La situation n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onFermer()} sx={{ minHeight: 48 }}>Annuler</Button>
        <Button variant="contained" onClick={enregistrer} disabled={!change || (!!type && !valide) || envoi} sx={{ minHeight: 48 }}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
      </DialogActions>
    </Dialog>
  )
}
