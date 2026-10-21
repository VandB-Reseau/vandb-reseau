import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import SendOutlined from '@mui/icons-material/SendOutlined'
import ChatOutlined from '@mui/icons-material/ChatOutlined'
import MailOutlined from '@mui/icons-material/MailOutlined'
import ShareOutlined from '@mui/icons-material/ShareOutlined'
import { useAuth } from '../auth/AuthContext'
import { useMessagerie } from '../data/MessagerieContext'
import { participants } from '../data/messagerie'
import { fichePersonne } from '../data/personnes'
import { texteCompteRendu } from '../data/compteRendu'
import { nomsVisiteurs, type Reseau, type Visite } from '../data/modele'
import { dateCourte, dateLongue } from '../lib/format'

// Envoi du compte rendu au franchisé en un geste : message dans l'app (il est notifié), e-mail prérempli
// avec le compte rendu en texte (franchisé sans accès à l'app), ou partage depuis le téléphone.
// Réservé à l'équipe : un franchisé ne voit jamais ce bouton.

interface Destinataire { cle: string; nom: string; email: string }

function messageParDefaut(v: Visite, noms: string[]): string {
  const prenoms = noms.map((n) => n.split(' ')[0]).join(', ')
  const actions = v.plan.filter((a) => a.action.trim() && !a.faite)
  return [
    `Bonjour ${prenoms},`, '',
    `Voici le compte rendu de notre visite du ${dateLongue(v.date)} à ${v.magasin}.`,
    ...(actions.length ? ['', 'Nos actions :', ...actions.map((a) => `- ${a.action.trim()}${a.echeance ? ` (${/^\d{4}-\d{2}-\d{2}$/.test(a.echeance) ? dateCourte(a.echeance) : a.echeance})` : ''}`)] : []),
    '', 'À bientôt,', nomsVisiteurs(v),
  ].join('\n').replace(/\n+$/, '')
}

export function EnvoyerCompteRendu({ reseau, visite, icone = false }: { reseau: Reseau; visite: Visite; icone?: boolean }) {
  const theme = useTheme()
  const pleinEcran = useMediaQuery(theme.breakpoints.down('sm'))
  const { profil } = useAuth()
  const { envoyer } = useMessagerie()
  const [ouvert, setOuvert] = useState(false)
  const m = reseau.magasins.find((x) => x.nom === visite.magasin)
  const franchises: Destinataire[] = m ? participants(reseau, m).filter((p) => p.cle.startsWith('franchise:'))
    .map((p) => ({ cle: p.cle, nom: p.nom, email: fichePersonne(reseau, { type: 'franchise', cle: p.nom }).email.trim() })) : []
  const [choisis, setChoisis] = useState<Set<string>>(() => new Set(franchises.map((f) => f.cle)))
  const [texte, setTexte] = useState(() => messageParDefaut(visite, franchises.map((f) => f.nom)))
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(false)
  const [message, setMessage] = useState('')
  if (!profil || profil.role === 'franchise') return null

  const retenus = franchises.filter((f) => choisis.has(f.cle))
  const titre = `Compte rendu de visite · ${visite.magasin} · ${dateCourte(visite.date)}`
  const complet = `${texte.trim()}\n\n---\n\n${texteCompteRendu(visite, dateLongue(visite.date), nomsVisiteurs(visite))}`
  const emails = retenus.map((f) => f.email).filter(Boolean)
  const mailto = `mailto:${emails.map(encodeURIComponent).join(',')}?subject=${encodeURIComponent(titre)}&body=${encodeURIComponent(complet)}`
  const partage = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const dansLApp = async () => {
    setEnvoi(true); setErreur(false)
    try {
      for (const f of retenus) await envoyer(f.cle, texte.trim(), [visite.magasin], visite.magasin)
      setOuvert(false)
      setMessage(`Compte rendu envoyé à ${retenus.map((f) => f.nom).join(', ')} dans la messagerie.`)
    } catch { setErreur(true) } finally { setEnvoi(false) }
  }
  const partager = async () => {
    try { await navigator.share({ title: titre, text: complet }); setOuvert(false) } catch { /* partage annulé */ }
  }

  return (
    <>
      {icone
        ? <Tooltip title="Envoyer au franchisé"><IconButton onClick={() => setOuvert(true)} aria-label={`Envoyer au franchisé le compte rendu du ${dateCourte(visite.date)}`}><SendOutlined /></IconButton></Tooltip>
        : <Button variant="outlined" startIcon={<SendOutlined />} onClick={() => setOuvert(true)} sx={{ minHeight: 48 }}>Envoyer au franchisé</Button>}
      <Dialog open={ouvert} onClose={() => !envoi && setOuvert(false)} fullScreen={pleinEcran} fullWidth maxWidth="sm" aria-labelledby="titre-envoyer-cr">
        <DialogTitle id="titre-envoyer-cr">Envoyer le compte rendu</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{visite.magasin} · visite du {dateLongue(visite.date)}</Typography>
          {franchises.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>Aucun franchisé n’est rattaché à {visite.magasin}. Ajoute-le sur la fiche du magasin pour lui envoyer ses comptes rendus.</Alert>
          ) : (
            <Box role="group" aria-label="Destinataires" sx={{ display: 'flex', flexDirection: 'column', mb: 1.5 }}>
              {franchises.map((f) => (
                <FormControlLabel key={f.cle} sx={{ minHeight: 48 }}
                  control={<Checkbox checked={choisis.has(f.cle)} onChange={(e) => setChoisis((s) => { const t = new Set(s); if (e.target.checked) t.add(f.cle); else t.delete(f.cle); return t })} />}
                  label={<><Typography component="span">{f.nom}</Typography><Typography component="span" variant="body2" color="text.secondary"> · {f.email || 'pas d’e-mail'}</Typography></>} />
              ))}
            </Box>
          )}
          <TextField label="Message" value={texte} onChange={(e) => setTexte(e.target.value)} multiline minRows={6} fullWidth />
          {erreur && <Alert severity="error" sx={{ mt: 2 }}>Le message n’a pas pu partir. Vérifie ta connexion et réessaie.</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setOuvert(false)} disabled={envoi} sx={{ minHeight: 48, mr: 'auto' }}>Annuler</Button>
          {partage && <Button startIcon={<ShareOutlined />} onClick={partager} disabled={envoi} sx={{ minHeight: 48 }}>Partager</Button>}
          <Button startIcon={<MailOutlined />} href={emails.length ? mailto : undefined} disabled={envoi || !emails.length} onClick={() => setOuvert(false)} sx={{ minHeight: 48 }}>Par e-mail</Button>
          <Button variant="contained" startIcon={<ChatOutlined />} onClick={dansLApp} disabled={envoi || !retenus.length || !texte.trim()} sx={{ minHeight: 48 }}>
            {envoi ? 'Envoi…' : 'Dans l’app'}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}
