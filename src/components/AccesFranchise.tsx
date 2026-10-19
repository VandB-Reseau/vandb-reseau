import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Skeleton from '@mui/material/Skeleton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import LockOpenOutlined from '@mui/icons-material/LockOpenOutlined'
import { Ligne, Section } from '../pages/FicheMagasin'
import { useApercu } from '../auth/Apercu'
import { couperAcces, ErreurAcces, listerAcces, ouvrirAcces, type AccesFranchise } from '../data/espaceFranchise'
import { dateCourte } from '../lib/format'

const emailValide = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

// Accès d'un franchisé à son espace : ouverture sur un compte créé dans Supabase, aperçu, coupure
export function SectionAcces({ nom, magasins, signaler }: { nom: string; magasins: string[]; signaler: (m: string) => void }) {
  const naviguer = useNavigate()
  const { ouvrir } = useApercu()
  const [liste, setListe] = useState<AccesFranchise[] | null | undefined>(undefined)
  const [email, setEmail] = useState('')
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [coupure, setCoupure] = useState(false)
  const lire = () => listerAcces().then(setListe).catch(() => setListe(null))
  useEffect(() => { void lire() }, [])
  const acces = liste?.find((a) => a.franchise === nom)

  const agir = async (action: () => Promise<void>, message: string) => {
    setEnvoi(true)
    setErreur('')
    try {
      await action()
      await lire()
      signaler(message)
      setEmail('')
    } catch (e) {
      setErreur(e instanceof ErreurAcces ? e.message : 'Enregistrement impossible pour le moment. Réessaie dans un instant.')
    } finally {
      setEnvoi(false)
      setCoupure(false)
    }
  }
  const voir = () => { ouvrir({ franchise: nom, magasins }); naviguer('/', { replace: true }) }

  return (
    <Section titre="Accès à l’app" action={<Button startIcon={<VisibilityOutlined />} onClick={voir} disabled={!magasins.length} sx={{ minHeight: 48 }}>Voir son espace</Button>}>
      {liste === undefined && <Skeleton variant="rounded" height={56} />}
      {liste === null && <Typography variant="body2" color="text.secondary">Les accès franchisés ne sont pas encore activés dans la base.</Typography>}
      {liste && acces && (
        <>
          <Ligne libelle="Compte">{acces.email}</Ligne>
          <Ligne libelle="Ouvert le">{acces.ouvertLe ? dateCourte(acces.ouvertLe) : null}</Ligne>
          <Ligne libelle="Dernière connexion">{acces.derniereConnexion ? dateCourte(acces.derniereConnexion) : 'Jamais connecté'}</Ligne>
          <Ligne libelle="Magasins visibles">{acces.magasins.join(', ') || 'Aucun'}</Ligne>
          <Button color="error" onClick={() => setCoupure(true)} sx={{ minHeight: 48, mt: 1 }}>Couper l’accès</Button>
        </>
      )}
      {liste && !acces && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField label="Email du compte" type="email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ flex: '1 1 240px' }} />
          <Button variant="contained" startIcon={<LockOpenOutlined />} disabled={!emailValide(email) || envoi || !magasins.length}
            onClick={() => agir(() => ouvrirAcces(email, nom, magasins), `Accès ouvert pour ${nom}.`)} sx={{ minHeight: 56 }}>Ouvrir l’accès</Button>
        </Box>
      )}
      {erreur && <Alert severity="error" sx={{ mt: 2 }}>{erreur}</Alert>}
      {coupure && acces && (
        <Dialog open onClose={() => setCoupure(false)} fullWidth maxWidth="xs" aria-labelledby="titre-coupure">
          <DialogTitle id="titre-coupure">Couper l’accès de {nom} ?</DialogTitle>
          <DialogContent><Typography variant="body1">Le compte {acces.email} ne verra plus aucun magasin.</Typography></DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setCoupure(false)} sx={{ minHeight: 48 }}>Annuler</Button>
            <Button variant="contained" color="error" disabled={envoi} onClick={() => agir(() => couperAcces(acces.userId), `Accès de ${nom} coupé.`)} sx={{ minHeight: 48 }}>Couper l’accès</Button>
          </DialogActions>
        </Dialog>
      )}
    </Section>
  )
}
