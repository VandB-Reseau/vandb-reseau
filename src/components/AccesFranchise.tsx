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
import KeyOutlined from '@mui/icons-material/KeyOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import MailOutlined from '@mui/icons-material/MailOutlined'
import { Ligne, Section } from './Section'
import { useApercu } from '../auth/Apercu'
import { couperAcces, creerEtOuvrirAcces, ErreurAcces, listerAcces, nouveauMotDePasse, supprimerCompte, type AccesFranchise } from '../data/espaceFranchise'
import { dateCourte } from '../lib/format'

const emailValide = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

// Identifiants à transmettre au franchisé : affichés une seule fois, copiés ou envoyés depuis la messagerie du Directeur
function DialogIdentifiants({ nom, email, motDePasse, onFermer }: { nom: string; email: string; motDePasse: string; onFermer: () => void }) {
  const [copie, setCopie] = useState(false)
  const adresse = `${window.location.origin}${window.location.pathname}`
  const texte = `Bonjour,\n\nTon accès à l’app V and B est ouvert.\n\nAdresse : ${adresse}\nEmail : ${email}\nMot de passe provisoire : ${motDePasse}\n\nTu choisiras ton mot de passe à la première connexion.`
  const copier = () => { navigator.clipboard?.writeText(texte).then(() => setCopie(true)).catch(() => undefined) }
  const courriel = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Ton accès à l’app V and B')}&body=${encodeURIComponent(texte)}`
  return (
    <Dialog open onClose={onFermer} fullWidth maxWidth="sm" aria-labelledby="titre-identifiants">
      <DialogTitle id="titre-identifiants">Identifiants de {nom}</DialogTitle>
      <DialogContent>
        <Ligne libelle="Adresse">{adresse}</Ligne>
        <Ligne libelle="Email">{email}</Ligne>
        <Ligne libelle="Mot de passe provisoire"><Box component="span" sx={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 600 }}>{motDePasse}</Box></Ligne>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button startIcon={<ContentCopyOutlined />} onClick={copier} sx={{ minHeight: 48, mr: 'auto' }}>{copie ? 'Copié' : 'Copier'}</Button>
        <Button startIcon={<MailOutlined />} href={courriel} sx={{ minHeight: 48 }}>Envoyer par email</Button>
        <Button variant="contained" onClick={onFermer} sx={{ minHeight: 48 }}>Fermer</Button>
      </DialogActions>
    </Dialog>
  )
}

// Accès d'un franchisé à son espace : compte créé depuis l'app (ou déjà créé dans Supabase), aperçu, coupure, suppression
export function SectionAcces({ nom, magasins, emailFiche = '', signaler }: { nom: string; magasins: string[]; emailFiche?: string; signaler: (m: string) => void }) {
  const naviguer = useNavigate()
  const { ouvrir } = useApercu()
  const [liste, setListe] = useState<AccesFranchise[] | null | undefined>(undefined)
  const [email, setEmail] = useState(emailFiche)
  const [identifiants, setIdentifiants] = useState<{ email: string; motDePasse: string } | null>(null)
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [coupure, setCoupure] = useState(false)
  const lire = () => listerAcces().then(setListe).catch(() => setListe(null))
  useEffect(() => { void lire() }, [])
  const acces = liste?.find((a) => a.franchise === nom)

  // Les identifiants affichés valent confirmation : pas de message en plus, qui masquerait leurs boutons
  const agir = async (action: () => Promise<unknown>, message: string) => {
    setEnvoi(true)
    setErreur('')
    try {
      const affiches = await action()
      await lire()
      if (affiches !== true) signaler(message)
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
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            <Button startIcon={<KeyOutlined />} disabled={envoi} sx={{ minHeight: 48 }}
              onClick={() => agir(async () => { const mot = await nouveauMotDePasse(acces.userId); setIdentifiants({ email: acces.email, motDePasse: mot }); return true }, `Nouveau mot de passe provisoire pour ${nom}.`)}>Nouveau mot de passe</Button>
            <Button color="error" onClick={() => setCoupure(true)} sx={{ minHeight: 48 }}>Couper l’accès</Button>
          </Box>
        </>
      )}
      {liste && !acces && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField label="Email du compte" type="email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ flex: '1 1 240px' }} />
          <Button variant="contained" startIcon={<LockOpenOutlined />} disabled={!emailValide(email) || envoi || !magasins.length}
            onClick={() => agir(async () => {
              const mot = await creerEtOuvrirAcces(email, nom, magasins)
              if (mot) setIdentifiants({ email: email.trim(), motDePasse: mot })
              return !!mot
            }, `Accès ouvert pour ${nom}.`)} sx={{ minHeight: 56 }}>Ouvrir l’accès</Button>
        </Box>
      )}
      {erreur && <Alert severity="error" sx={{ mt: 2 }}>{erreur}</Alert>}
      {coupure && acces && (
        <Dialog open onClose={() => setCoupure(false)} fullWidth maxWidth="xs" aria-labelledby="titre-coupure">
          <DialogTitle id="titre-coupure">Couper l’accès de {nom} ?</DialogTitle>
          <DialogContent><Typography variant="body1">Le compte {acces.email} ne verra plus aucun magasin. Supprimé, il disparaît aussi de Supabase.</Typography></DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Button onClick={() => setCoupure(false)} sx={{ minHeight: 48, mr: 'auto' }}>Annuler</Button>
            <Button color="error" disabled={envoi} onClick={() => agir(() => supprimerCompte(acces.userId), `Compte de ${nom} supprimé.`)} sx={{ minHeight: 48 }}>Supprimer le compte</Button>
            <Button variant="contained" color="error" disabled={envoi} onClick={() => agir(() => couperAcces(acces.userId), `Accès de ${nom} coupé.`)} sx={{ minHeight: 48 }}>Couper l’accès</Button>
          </DialogActions>
        </Dialog>
      )}
      {identifiants && <DialogIdentifiants nom={nom} {...identifiants} onFermer={() => setIdentifiants(null)} />}
    </Section>
  )
}
