import { useNavigate } from 'react-router-dom'
import Card from '@mui/material/Card'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ChevronRight from '@mui/icons-material/ChevronRight'
import { PageHeader } from '../components/PageHeader'
import Typography from '@mui/material/Typography'
import { barreTelephone, parametres, principales, secondaires, type Destination } from '../navigation/destinations'
import { useAuth } from '../auth/AuthContext'
import { perimetreDuProfil } from '../data/perimetre'

export function Plus() {
  const naviguer = useNavigate()
  const { profil } = useAuth()
  const sansParametres = !!perimetreDuProfil(profil)
  const groupe = (titre: string | null, liste: Destination[]) => (
    <>
      {titre && <Typography variant="overline" component="h2" color="text.secondary" sx={{ display: 'block', mt: 3, mb: 1, fontWeight: 600 }}>{titre}</Typography>}
      <Card>
        <List disablePadding>
          {liste.map((d) => (
            <ListItemButton key={d.chemin} onClick={() => naviguer(d.chemin)} sx={{ borderRadius: 0, py: 1.5, minHeight: 64 }}>
              <ListItemIcon sx={{ minWidth: 44 }}>{d.icone}</ListItemIcon>
              <ListItemText primary={d.libelle} secondary={d.description} slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
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
      {groupe(null, [...principales.filter((d) => !barreTelephone.includes(d)), ...secondaires])}
      {!sansParametres && groupe('Paramètres', parametres)}
    </>
  )
}
