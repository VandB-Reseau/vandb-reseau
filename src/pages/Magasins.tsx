import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import SearchOff from '@mui/icons-material/SearchOff'
import TableRowsOutlined from '@mui/icons-material/TableRowsOutlined'
import MapOutlined from '@mui/icons-material/MapOutlined'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { AvecReseau } from '../components/EtatDonnees'
import { BarreFiltres } from '../components/BarreFiltres'
import { TableMagasins } from '../components/TableMagasins'
import { ListeMagasins } from '../components/ListeMagasins'
import { filtrer, filtresDepuisUrl, filtresVersUrl, type Filtres } from '../data/filtres'

const CarteMagasins = lazy(() => import('../components/CarteMagasins').then((m) => ({ default: m.CarteMagasins })))

export function Magasins({ vueInitiale = 'liste' }: { vueInitiale?: 'liste' | 'carte' }) {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [params, setParams] = useSearchParams()
  const filtres = filtresDepuisUrl(params)
  const vue = (params.get('vue') as 'liste' | 'carte' | null) ?? vueInitiale
  const changerFiltres = (f: Filtres) => setParams(filtresVersUrl(f, params), { replace: true })
  const changerVue = (v: 'liste' | 'carte') => { const p = new URLSearchParams(params); p.set('vue', v); setParams(p, { replace: true }) }

  return (
    <AvecReseau>
      {(reseau) => {
        const resultats = filtrer(reseau.magasins, filtres)
        const total = reseau.magasins.length
        return (
          <>
            <PageHeader
              titre="Magasins"
              sousTitre={resultats.length === total ? `${total} magasins dans le réseau` : `${resultats.length} sur ${total} magasins`}
            />
            <Tabs value={vue} onChange={(_e, v) => changerVue(v)} sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }} aria-label="Affichage">
              <Tab value="liste" label="Liste" icon={<TableRowsOutlined />} iconPosition="start" sx={{ minHeight: 48 }} />
              <Tab value="carte" label="Carte" icon={<MapOutlined />} iconPosition="start" sx={{ minHeight: 48 }} />
            </Tabs>
            <BarreFiltres reseau={reseau} filtres={filtres} onChange={changerFiltres} />
            {resultats.length === 0 ? (
              <EmptyState icone={<SearchOff />} titre="Aucun magasin ne correspond" texte="Modifie la recherche ou retire un filtre pour voir plus de magasins." />
            ) : vue === 'carte' ? (
              <Suspense fallback={<Skeleton variant="rounded" height={600} />}>
                <CarteMagasins magasins={resultats} rrs={reseau.rrs} hauteur={surPC ? 'max(560px, calc(100dvh - 290px))' : 'max(420px, calc(100dvh - 360px))'} />
              </Suspense>
            ) : surPC ? (
              <TableMagasins magasins={resultats} />
            ) : (
              <ListeMagasins magasins={resultats} />
            )}
            {vue === 'liste' && <Box sx={{ mt: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Pour modifier un magasin, utilise encore l’ancienne application. La modification arrive dans un prochain sprint.
              </Typography>
            </Box>}
          </>
        )
      }}
    </AvecReseau>
  )
}
