import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import TrendingDown from '@mui/icons-material/TrendingDown'
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import PersonSearchOutlined from '@mui/icons-material/PersonSearchOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../auth/AuthContext'

// Ordre de priorité fixé par Joseph le 14/10/2026
const blocs = [
  { titre: 'Magasins qui sous-performent', texte: 'Écarts de CA, panier et fréquentation par rapport au mois précédent et à l’objectif.', icone: <TrendingDown /> },
  { titre: 'Magasins à visiter', texte: 'Magasins sans visite ce semestre, du plus en retard au plus récent.', icone: <EventBusyOutlined /> },
  { titre: 'Agenda de la semaine', texte: 'Ouvertures, événements, anniversaires et congés de l’équipe.', icone: <CalendarMonthOutlined /> },
  { titre: 'Coachs surchargés et postes vacants', texte: 'Charge au-delà du seuil, magasins sans Coach.', icone: <PersonSearchOutlined /> },
  { titre: 'Ouvertures à préparer', texte: 'Ouvertures des 6 prochains mois et ce qu’il leur manque.', icone: <StorefrontOutlined /> },
]

function salutation(): string {
  const h = new Date().getHours()
  return h < 18 ? 'Bonjour' : 'Bonsoir'
}

export function Accueil() {
  const { profil } = useAuth()
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <>
      <PageHeader titre={`${salutation()}${profil ? ` ${profil.nom}` : ''}`} sousTitre={date.charAt(0).toUpperCase() + date.slice(1)} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' } }}>
        {blocs.map((b, i) => (
          <Card key={b.titre} sx={{ gridColumn: { md: i === 0 ? 'span 2' : 'auto', xl: i === 0 ? 'span 2' : 'auto' } }}>
            <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', p: 3 }}>
              <Box sx={{ display: 'inline-flex', p: 1.25, borderRadius: 3, bgcolor: 'action.hover', color: 'text.primary' }}>{b.icone}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h4" component="h2">{b.titre}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{b.texte}</Typography>
                <Chip label="Arrive au sprint 4" size="small" sx={{ mt: 2, fontSize: '0.75rem' }} />
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </>
  )
}
