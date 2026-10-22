import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import GlobalStyles from '@mui/material/GlobalStyles'
import ArrowBack from '@mui/icons-material/ArrowBack'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { EnvoyerCompteRendu } from '../components/EnvoyerCompteRendu'
import { FeuilleCompteRendu } from '../components/FeuilleCompteRendu'

// À l'impression, seule la feuille du compte rendu reste visible (menu, barres et boutons masqués)
const styleImpression = (
  <GlobalStyles styles={{
    '@media print': {
      'header, nav, .MuiDrawer-root, .MuiBottomNavigation-root, .sans-impression': { display: 'none !important' },
      'body, main': { background: '#fff !important', padding: '0 !important', margin: '0 !important' },
      '.feuille': { boxShadow: 'none !important', border: '0 !important', margin: '0 !important', maxWidth: 'none !important' },
      '@page': { size: 'A4', margin: '14mm' },
    },
  }} />
)

export function CompteRendu() {
  const { id = '' } = useParams()
  const naviguer = useNavigate()
  return (
    <AvecReseau>
      {(reseau) => {
        const v = reseau.visites.find((x) => String(x.id) === id)
        if (!v) return <EmptyState icone={<EventNoteOutlined />} titre="Visite introuvable" texte="Cette visite a peut-être été supprimée." action={<Button variant="contained" onClick={() => naviguer('/visites?vue=historique')}>Voir les visites</Button>} />
        return (
          <>
            {styleImpression}
            <Box className="sans-impression" sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Button startIcon={<ArrowBack />} onClick={() => naviguer(-1)} sx={{ ml: -1, minHeight: 48 }}>Retour</Button>
              <Box sx={{ flex: 1 }} />
              <EnvoyerCompteRendu reseau={reseau} visite={v} />
              <Button variant="contained" startIcon={<PictureAsPdfOutlined />} onClick={() => window.print()} sx={{ minHeight: 48 }}>Télécharger en PDF</Button>
            </Box>
            <FeuilleCompteRendu reseau={reseau} v={v} />
          </>
        )
      }}
    </AvecReseau>
  )
}
