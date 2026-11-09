import { Navigate, useSearchParams } from 'react-router-dom'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import QueryStatsOutlined from '@mui/icons-material/QueryStatsOutlined'
import RequestQuoteOutlined from '@mui/icons-material/RequestQuoteOutlined'
import TimelineOutlined from '@mui/icons-material/TimelineOutlined'
import { PageHeader } from '../components/PageHeader'
import { Onglets, type Rubrique } from '../components/Onglets'
import { AvecReseau } from '../components/EtatDonnees'
import { useAuth } from '../auth/AuthContext'
import { perimetreDuProfil } from '../data/perimetre'
import { VueChiffres } from './SanteParc'
import { Evolution } from './Evolution'
import { ZonePilotage } from '../pilotage/Pilotage'
import { Reseau as SuiviBudgets } from '../pilotage/pages/Reseau'

// Refonte vague 2 (Joseph, 09/11/2026, 15A) : les chiffres du réseau en une seule page, sous Finances.
// Réunit les chiffres des magasins (ancien onglet Chiffres de Santé du parc), le suivi face au budget (ancien onglet
// « Suivi » de Budgets) et l'évolution du parc (ancienne vue de Magasins). Santé du parc garde le qualitatif.
// Le franchisé ne la voit jamais : médianes et comparaisons du réseau ne lui arrivent pas.
type Vue = 'magasins' | 'budget' | 'evolution'

export function Performance() {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const { profil } = useAuth()
  const [params, setParams] = useSearchParams()
  if (profil?.role === 'franchise') return <Navigate to="/" replace />
  const voitEvolution = !perimetreDuProfil(profil)
  const rubriques: Rubrique<Vue>[] = [
    { vue: 'magasins', libelle: 'Chiffres des magasins', court: 'Magasins', icone: <QueryStatsOutlined /> },
    { vue: 'budget', libelle: 'Face au budget', court: 'Budget', icone: <RequestQuoteOutlined /> },
    ...(voitEvolution ? [{ vue: 'evolution' as const, libelle: 'Évolution du parc', court: 'Évolution', icone: <TimelineOutlined /> }] : []),
  ]
  const demandee = params.get('vue') as Vue | null
  const vue: Vue = rubriques.some((r) => r.vue === demandee) ? demandee! : 'magasins'
  return (
    <>
      <PageHeader titre="Performance" />
      <Onglets valeur={vue} onChange={(v) => setParams({ vue: v }, { replace: true })} libelle="Parties de la performance" rubriques={rubriques} />
      {vue === 'magasins' && <AvecReseau>{(reseau) => <VueChiffres reseau={reseau} surPC={surPC} />}</AvecReseau>}
      {vue === 'budget' && <ZonePilotage>{() => <SuiviBudgets integre />}</ZonePilotage>}
      {vue === 'evolution' && <Evolution integre />}
    </>
  )
}
