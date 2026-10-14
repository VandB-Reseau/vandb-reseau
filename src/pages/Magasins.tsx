import { lazy, Suspense, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import AddOutlined from '@mui/icons-material/AddOutlined'
import { DialogMagasin } from '../components/EditionMagasin'
import { lienFiche } from '../lib/format'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
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
  const [ajout, setAjout] = useState(false)
  const naviguer = useNavigate()
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
              actions={
                <Tabs value={vue} onChange={(_e, v) => changerVue(v)} sx={{ bgcolor: 'action.hover', borderRadius: 6, p: 0.5, minHeight: 48, '& .MuiTabs-indicator': { height: '100%', borderRadius: 6, zIndex: 0 }, '& .MuiTab-root.Mui-selected': { color: 'primary.contrastText' } }} aria-label="Affichage">
                  <Tab value="liste" label="Liste" icon={<TableRowsOutlined />} iconPosition="start" sx={{ minHeight: 48, position: 'relative', zIndex: 1, borderRadius: 6, px: 2.5 }} />
                  <Tab value="carte" label="Carte" icon={<MapOutlined />} iconPosition="start" sx={{ minHeight: 48, position: 'relative', zIndex: 1, borderRadius: 6, px: 2.5 }} />
                </Tabs>
              }
            />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}><BarreFiltres reseau={reseau} filtres={filtres} onChange={changerFiltres} /></Box>
              {surPC
                ? <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setAjout(true)} sx={{ minHeight: 48, mb: 2 }}>Ajouter un magasin</Button>
                : <IconButton onClick={() => setAjout(true)} aria-label="Ajouter un magasin" sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}><AddOutlined /></IconButton>}
            </Box>
            {ajout && <DialogMagasin reseau={reseau} magasin={null} onFermer={(msg, nom) => { setAjout(false); if (msg && nom) naviguer(lienFiche(nom)) }} />}
            {resultats.length === 0 ? (
              <EmptyState icone={<SearchOff />} titre="Aucun magasin ne correspond" texte="Modifie la recherche ou retire un filtre pour voir plus de magasins." />
            ) : vue === 'carte' ? (
              <Suspense fallback={<Skeleton variant="rounded" height={600} />}>
                <CarteMagasins magasins={resultats} rrs={reseau.rrs} equipe={reseau.equipe} margeBas={surPC ? 40 : 96} />
              </Suspense>
            ) : surPC ? (
              <TableMagasins magasins={resultats} />
            ) : (
              <ListeMagasins magasins={resultats} />
            )}
          </>
        )
      }}
    </AvecReseau>
  )
}
