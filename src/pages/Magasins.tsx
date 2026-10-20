import { Suspense, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DialogMagasin } from '../components/EditionMagasin'
import { lienFiche } from '../lib/format'
import { chargementDiffere } from '../lib/chargementDiffere'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import SearchOff from '@mui/icons-material/SearchOff'
import TableRowsOutlined from '@mui/icons-material/TableRowsOutlined'
import MapOutlined from '@mui/icons-material/MapOutlined'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { AvecReseau } from '../components/EtatDonnees'
import { BarreFiltres } from '../components/BarreFiltres'
import { BoutonAction } from '../components/Outils'
import { Onglets } from '../components/Onglets'
import { ListeMagasins } from '../components/ListeMagasins'
import { useReseau } from '../data/ReseauContext'
import { filtrer, filtresDepuisUrl, filtresVersUrl, type Filtres } from '../data/filtres'

const CarteMagasins = chargementDiffere(() => import('../components/CarteMagasins').then((m) => ({ default: m.CarteMagasins })))

export function Magasins({ vueInitiale = 'carte' }: { vueInitiale?: 'liste' | 'carte' }) {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [params, setParams] = useSearchParams()
  const filtres = filtresDepuisUrl(params)
  const vue = (params.get('vue') as 'liste' | 'carte' | null) ?? vueInitiale
  const changerFiltres = (f: Filtres) => setParams(filtresVersUrl(f, params), { replace: true })
  const [ajout, setAjout] = useState(false)
  const [emplacementBoutons, setEmplacementBoutons] = useState<HTMLElement | null>(null)
  const naviguer = useNavigate()
  const { complet } = useReseau()
  const changerVue = (v: 'liste' | 'carte') => { const p = new URLSearchParams(params); p.set('vue', v); setParams(p, { replace: true }) }

  return (
    <AvecReseau>
      {(perimetre) => {
        // La carte montre tout le réseau, même à un Coach ou un RR ; la liste, ses magasins seulement
        const reseau = vue === 'carte' && complet ? complet : perimetre
        const restreint = reseau.magasins.length !== perimetre.magasins.length
        const resultats = filtrer(reseau.magasins, filtres)
        const total = reseau.magasins.length
        return (
          <>
            <PageHeader
              titre="Magasins"
              sousTitre={resultats.length === total ? `${total} magasins${reseau === complet ? ' dans le réseau' : ''}` : `${resultats.length} sur ${total} magasins`}
            />
            <Onglets valeur={vue} onChange={changerVue} libelle="Affichage" rubriques={[
              { vue: 'liste', libelle: 'Liste', icone: <TableRowsOutlined /> },
              { vue: 'carte', libelle: 'Carte', icone: <MapOutlined /> },
            ]} />
            <BarreFiltres reseau={reseau} filtres={filtres} onChange={changerFiltres}
              actions={vue === 'carte' ? <Box ref={setEmplacementBoutons} sx={{ display: 'flex' }} /> : <BoutonAction libelle="Ajouter un magasin" onClick={() => setAjout(true)} />} />
            {ajout && <DialogMagasin reseau={reseau} magasin={null} onFermer={(msg, nom) => { setAjout(false); if (msg && nom) naviguer(lienFiche(nom)) }} />}
            {resultats.length === 0 ? (
              <EmptyState icone={<SearchOff />} titre="Aucun magasin ne correspond" texte="Modifie la recherche ou retire un filtre pour voir plus de magasins." />
            ) : vue === 'carte' ? (
              <Suspense fallback={<Skeleton variant="rounded" height={600} />}>
                <CarteMagasins magasins={resultats} rrs={reseau.rrs} equipe={reseau.equipe} personnes={reseau.personnes} restreindre={resultats.length !== total} margeBas={surPC ? 40 : 96} emplacementBoutons={emplacementBoutons}
                  ouvrables={restreint ? new Set(perimetre.magasins.map((m) => m.nom)) : undefined} />
              </Suspense>
            ) : (
              <ListeMagasins magasins={resultats} />
            )}
          </>
        )
      }}
    </AvecReseau>
  )
}
