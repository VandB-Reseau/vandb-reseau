import { useNavigate } from 'react-router-dom'
import Card from '@mui/material/Card'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ChevronRight from '@mui/icons-material/ChevronRight'
import { PageHeader } from '../components/PageHeader'
import { secondaires } from '../navigation/destinations'

export function Plus() {
  const naviguer = useNavigate()
  return (
    <>
      <PageHeader titre="Plus" sousTitre="Pilotage et paramètres" />
      <Card>
        <List disablePadding>
          {secondaires.map((d) => (
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
}
