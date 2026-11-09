import { useLocation, useNavigate } from 'react-router-dom'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import InsightsOutlined from '@mui/icons-material/InsightsOutlined'
import { Onglets } from './Onglets'
import { useAuth } from '../auth/AuthContext'

// Refonte (Joseph, 09/11/2026, choix 2A) : Animation réseau devient un onglet de Messages, pour le Directeur et les
// Responsables Régionaux qui créent ces contenus ; les autres ne voient pas d'onglet
export function OngletsMessages() {
  const { profil } = useAuth()
  const { pathname } = useLocation()
  const naviguer = useNavigate()
  if (!profil || !['directeur', 'rr'].includes(profil.role)) return null
  const vue = pathname.startsWith('/animation') ? 'animation' : 'conversations'
  return (
    <Onglets libres valeur={vue} onChange={(v) => naviguer(v === 'animation' ? '/animation' : '/echanges')} libelle="Messages et animation" rubriques={[
      { vue: 'conversations', libelle: 'Conversations', icone: <ForumOutlined /> },
      { vue: 'animation', libelle: 'Animation réseau', court: 'Animation', icone: <InsightsOutlined /> },
    ]} />
  )
}
