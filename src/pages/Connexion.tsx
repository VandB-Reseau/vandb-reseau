import { useState, type FormEvent } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CircularProgress from '@mui/material/CircularProgress'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Logo } from '../components/Logo'
import { brandStripe } from '../theme/theme'
import { useAuth } from '../auth/AuthContext'
import { supabaseConfigured } from '../lib/supabase'

export function Connexion() {
  const { connexion } = useAuth()
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const valider = async (e: FormEvent) => {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    const msg = await connexion(email.trim(), motDePasse)
    setEnvoi(false)
    if (msg) setErreur(msg)
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Box aria-hidden sx={{ height: 4, background: brandStripe }} />
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Card component="form" onSubmit={valider} sx={{ width: '100%', maxWidth: 400, p: { xs: 3, sm: 4 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}><Logo size={30} /></Box>
          <Typography variant="h2" component="h1" align="center">Réseau V and B</Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1, mb: 3 }}>Connecte-toi pour accéder au pilotage du réseau.</Typography>
          {!supabaseConfigured && <Alert severity="warning" sx={{ mb: 2 }}>La connexion n’est pas encore configurée sur cette adresse.</Alert>}
          {erreur && <Alert severity="error" sx={{ mb: 2 }}>{erreur}</Alert>}
          <TextField label="Email" type="email" autoComplete="email" required fullWidth value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} />
          <TextField label="Mot de passe" type="password" autoComplete="current-password" required fullWidth value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} sx={{ mb: 3 }} />
          <Button type="submit" variant="contained" fullWidth size="large" disabled={envoi} sx={{ minHeight: 48 }}>
            {envoi ? <CircularProgress size={22} color="inherit" /> : 'Se connecter'}
          </Button>
        </Card>
      </Box>
    </Box>
  )
}
