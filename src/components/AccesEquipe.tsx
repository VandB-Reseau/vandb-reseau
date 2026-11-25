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
import { Ligne, Section } from './Section'
import { useApercu } from '../auth/Apercu'
import { couperAccesDirection, couperAccesEquipe, ErreurAccesEquipe, listerAccesDirection, listerAccesEquipe, ouvrirAccesDirection, ouvrirAccesEquipe, type AccesDirection, type AccesEquipe, type RoleEquipe } from '../data/accesEquipe'
import { dateCourte } from '../lib/format'

const emailValide = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

// Accès d'un Coach ou d'un Responsable Régional (cle : nom du Coach, identifiant du RR) : ouverture sur un
// compte créé dans Supabase, aperçu de l'app avec son périmètre, coupure
export function SectionAccesEquipe({ role, cle, nom, signaler }: { role: RoleEquipe; cle: string; nom: string; signaler: (m: string) => void }) {
  const naviguer = useNavigate()
  const { ouvrirEquipe } = useApercu()
  const [liste, setListe] = useState<AccesEquipe[] | null | undefined>(undefined)
  const [email, setEmail] = useState('')
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [coupure, setCoupure] = useState(false)
  const lire = () => listerAccesEquipe().then(setListe).catch(() => setListe(null))
  useEffect(() => { void lire() }, [])
  const acces = liste?.find((a) => a.role === role && a.nom === cle)

  const agir = async (action: () => Promise<void>, message: string) => {
    setEnvoi(true)
    setErreur('')
    try {
      await action()
      await lire()
      signaler(message)
      setEmail('')
    } catch (e) {
      setErreur(e instanceof ErreurAccesEquipe ? e.message : 'Enregistrement impossible pour le moment. Réessaie dans un instant.')
    } finally {
      setEnvoi(false)
      setCoupure(false)
    }
  }
  const voir = () => { ouvrirEquipe({ role, cle, nom }); naviguer('/', { replace: true }) }

  return (
    <Section titre="Accès à l’app" action={<Button startIcon={<VisibilityOutlined />} onClick={voir} sx={{ minHeight: 48 }}>Voir comme {nom.split(' ')[0]}</Button>}>
      {liste === undefined && <Skeleton variant="rounded" height={56} />}
      {liste === null && <Typography variant="body2" color="text.secondary">Les accès de l’équipe ne sont pas encore activés dans la base.</Typography>}
      {liste && acces && (
        <>
          <Ligne libelle="Compte">{acces.email}</Ligne>
          <Ligne libelle="Dernière connexion">{acces.derniereConnexion ? dateCourte(acces.derniereConnexion) : 'Jamais connecté'}</Ligne>
          <Button color="error" onClick={() => setCoupure(true)} sx={{ minHeight: 48, mt: 1 }}>Couper l’accès</Button>
        </>
      )}
      {liste && !acces && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField label="Email du compte" type="email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ flex: '1 1 240px' }} />
          <Button variant="contained" startIcon={<LockOpenOutlined />} disabled={envoi}
            onClick={() => !emailValide(email) ? setErreur('Écris une adresse email valide pour ouvrir l’accès.') : agir(() => ouvrirAccesEquipe(email, role, cle), `Accès ouvert pour ${nom}.`)} sx={{ minHeight: 56 }}>Ouvrir l’accès</Button>
        </Box>
      )}
      {erreur && <Alert severity="error" sx={{ mt: 2 }}>{erreur}</Alert>}
      {coupure && acces && (
        <Dialog open onClose={() => setCoupure(false)} fullWidth maxWidth="xs" aria-labelledby="titre-coupure-equipe">
          <DialogTitle id="titre-coupure-equipe">Couper l’accès de {nom} ?</DialogTitle>
          <DialogContent><Typography variant="body1">Le compte {acces.email} ne pourra plus ouvrir l’app.</Typography></DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setCoupure(false)} sx={{ minHeight: 48 }}>Annuler</Button>
            <Button variant="contained" color="error" disabled={envoi} onClick={() => agir(() => couperAccesEquipe(acces.userId), `Accès de ${nom} coupé.`)} sx={{ minHeight: 48 }}>Couper l’accès</Button>
          </DialogActions>
        </Dialog>
      )}
    </Section>
  )
}

// Bandeau de l'aperçu « Voir comme » : retour à sa propre vue
export function BandeauApercuEquipe() {
  const { equipe, quitter } = useApercu()
  const naviguer = useNavigate()
  if (!equipe) return null
  return (
    <Box role="region" aria-label="Aperçu" sx={{ bgcolor: 'secondary.main', color: 'secondary.contrastText', px: { xs: 2, md: 5 }, py: 1, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
      <VisibilityOutlined />
      <Typography variant="body1" sx={{ flex: 1, fontWeight: 600, minWidth: 0 }}>L’app vue par {equipe.nom}</Typography>
      <Button variant="outlined" color="inherit" onClick={() => { const e = equipe; quitter(); naviguer(e.role === 'coach' ? `/equipe/coach/${encodeURIComponent(e.cle)}` : `/equipe/rr/${encodeURIComponent(e.cle)}`, { replace: true }) }} sx={{ minHeight: 48 }}>Quitter l’aperçu</Button>
    </Box>
  )
}

// Accès « Direction » (24/11/2026) : un DG ou un autre accès donné par le Directeur. Lit tout le réseau, carnets des
// magasins et budgets compris ; n'écrit que dans le carnet. Jamais vu du franchisé.
export function SectionAccesDirection({ signaler }: { signaler: (m: string) => void }) {
  const [liste, setListe] = useState<AccesDirection[] | null | undefined>(undefined)
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [coupure, setCoupure] = useState<AccesDirection | null>(null)
  const lire = () => listerAccesDirection().then(setListe).catch(() => setListe(null))
  useEffect(() => { void lire() }, [])
  const agir = async (action: () => Promise<void>, message: string) => {
    setEnvoi(true)
    setErreur('')
    try {
      await action()
      await lire()
      signaler(message)
      setEmail('')
      setNom('')
    } catch (e) {
      setErreur(e instanceof ErreurAccesEquipe ? e.message : 'Enregistrement impossible pour le moment. Réessaie dans un instant.')
    } finally {
      setEnvoi(false)
      setCoupure(null)
    }
  }
  const ouvrir = () => {
    if (!nom.trim()) return setErreur('Écris le nom de la personne.')
    if (!emailValide(email)) return setErreur('Écris une adresse email valide pour ouvrir l’accès.')
    void agir(() => ouvrirAccesDirection(email, nom), `Accès Direction ouvert pour ${nom.trim()}.`)
  }
  return (
    <Section titre="Accès Direction" region>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Lit tout le réseau, carnets des magasins et budgets compris. N’écrit que dans le carnet.</Typography>
      {liste === undefined && <Skeleton variant="rounded" height={56} />}
      {liste === null && <Typography variant="body2" color="text.secondary">Les accès Direction ne sont pas encore activés dans la base.</Typography>}
      {liste && liste.length > 0 && (
        <Box component="ul" aria-label="Accès Direction ouverts" sx={{ listStyle: 'none', m: 0, p: 0, mb: 2, display: 'grid', gap: 1 }}>
          {liste.map((a) => (
            <Box component="li" key={a.userId} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{a.nom || a.email}</Typography>
                <Typography variant="body2" color="text.secondary">{`${a.email} · ${a.derniereConnexion ? `connecté le ${dateCourte(a.derniereConnexion)}` : 'jamais connecté'}`}</Typography>
              </Box>
              <Button color="error" onClick={() => setCoupure(a)} aria-label={`Couper l’accès de ${a.nom || a.email}`} sx={{ minHeight: 48 }}>Couper l’accès</Button>
            </Box>
          ))}
        </Box>
      )}
      {liste && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField label="Nom" value={nom} onChange={(e) => setNom(e.target.value.slice(0, 80))} sx={{ flex: '1 1 180px' }} />
          <TextField label="Email du compte" type="email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ flex: '1 1 240px' }} />
          <Button variant="contained" startIcon={<LockOpenOutlined />} disabled={envoi} onClick={ouvrir} sx={{ minHeight: 56 }}>Ouvrir l’accès</Button>
        </Box>
      )}
      {erreur && <Alert severity="error" sx={{ mt: 2 }}>{erreur}</Alert>}
      {coupure && (
        <Dialog open onClose={() => setCoupure(null)} fullWidth maxWidth="xs" aria-labelledby="titre-coupure-direction">
          <DialogTitle id="titre-coupure-direction">Couper l’accès de {coupure.nom || coupure.email} ?</DialogTitle>
          <DialogContent><Typography variant="body1">Le compte {coupure.email} ne pourra plus ouvrir l’app.</Typography></DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setCoupure(null)} sx={{ minHeight: 48 }}>Annuler</Button>
            <Button variant="contained" color="error" disabled={envoi} onClick={() => void agir(() => couperAccesDirection(coupure.userId), `Accès de ${coupure.nom || coupure.email} coupé.`)} sx={{ minHeight: 48 }}>Couper l’accès</Button>
          </DialogActions>
        </Dialog>
      )}
    </Section>
  )
}
