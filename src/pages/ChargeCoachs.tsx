import type { ReactElement } from 'react'
import { useSearchParams } from 'react-router-dom'
import BalanceOutlined from '@mui/icons-material/BalanceOutlined'
import AutoFixHighOutlined from '@mui/icons-material/AutoFixHighOutlined'
import { PageHeader } from '../components/PageHeader'
import { Onglets } from '../components/Onglets'
import { AvecReseau } from '../components/EtatDonnees'
import { VueCharge } from './VueCharge'
import { VuePlan } from './VuePlan'

// Paramètres > Charge des Coachs : la charge de chacun et les répartitions à évaluer, réservées au Directeur
type Vue = 'charge' | 'repartition'

const rubriques: { vue: Vue; libelle: string; court: string; icone: ReactElement }[] = [
  { vue: 'charge', libelle: 'Charge et simulation', court: 'Charge', icone: <BalanceOutlined /> },
  { vue: 'repartition', libelle: 'Répartition proposée', court: 'Répartition', icone: <AutoFixHighOutlined /> },
]

export function ChargeCoachs() {
  const [params, setParams] = useSearchParams()
  const vue: Vue = params.get('vue') === 'repartition' ? 'repartition' : 'charge'
  const changerVue = (v: Vue) => setParams({ vue: v }, { replace: true })
  return (
    <AvecReseau>
      {(reseau) => (
        <>
          <PageHeader titre="Charge des Coachs" sousTitre={`${reseau.equipe.filter((c) => !c.fictif).length} Coachs · maximum ${reseau.parametres.maxUnits} unités`} />
          <Onglets valeur={vue} onChange={changerVue} rubriques={rubriques} libelle="Rubriques de la charge" />
          {vue === 'repartition' ? <VuePlan reseau={reseau} /> : <VueCharge reseau={reseau} versRepartition={() => changerVue('repartition')} />}
        </>
      )}
    </AvecReseau>
  )
}
