import { useNavigate } from 'react-router-dom'
import Card from '@mui/material/Card'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ChevronRight from '@mui/icons-material/ChevronRight'
import { PageHeader } from '../components/PageHeader'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { magasins, parametres, pourRole, secondaires, type Destination } from '../navigation/destinations'
import { useAuth } from '../auth/AuthContext'
import { perimetreDuProfil } from '../data/perimetre'
import { useReseau } from '../data/ReseauContext'
import { cartouche } from '../components/Social'

export function Plus() {
  const naviguer = useNavigate()
  const { profil } = useAuth()
  const sansParametres = !!perimetreDuProfil(profil)
  // Libellés seuls (Joseph, 21/10/2026), avec un compteur quand il est utile
  const { reseau } = useReseau()
  const aPourvoir = reseau ? reseau.equipe.filter((c) => c.fictif).length + reseau.magasins.filter((m) => m.statut !== 'avenir' && m.responsableARecruter).length : 0
  const compteurs: Record<string, string> = aPourvoir ? { '/equipe': `${aPourvoir} poste${aPourvoir > 1 ? 's' : ''} à pourvoir` } : {}
  const groupe = (titre: string | null, liste: Destination[]) => (
    <>
      {titre && <Box sx={{ mt: 3, mb: 1 }}><Typography component="h2" sx={cartouche}>{titre}</Typography></Box>}
      <Card>
        <List disablePadding>
          {liste.map((d) => (
            <ListItemButton key={d.chemin} onClick={() => naviguer(d.chemin)} sx={{ borderRadius: 0, py: 1, minHeight: 56 }}>
              <ListItemIcon sx={{ minWidth: 44 }}>{d.icone}</ListItemIcon>
              <ListItemText primary={d.libelle} slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
              {!!compteurs[d.chemin] && <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>{compteurs[d.chemin]}</Typography>}
              <ChevronRight sx={{ color: 'text.secondary' }} />
            </ListItemButton>
          ))}
        </List>
      </Card>
    </>
  )
  return (
    <>
      <PageHeader titre="Plus" />
      {groupe(null, [magasins, ...pourRole(secondaires, profil?.role)])}
      {!sansParametres && groupe('Paramètres', parametres)}
    </>
  )
}
