import type { ReactElement } from 'react'
import { useSearchParams } from 'react-router-dom'
import Typography from '@mui/material/Typography'
import { FilAriane } from '../components/FilAriane'
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

// Retour au sommaire des Paramètres, dont Charge des Coachs et Import et export sont des rubriques.
// 304 (Joseph, 18/11/2026) : le fil d'Ariane, comme partout ailleurs (flèche de retour sur téléphone)
export function RetourParametres({ ici }: { ici: string }) {
  return <FilAriane etapes={[{ libelle: 'Paramètres', lien: '/parametres/reglages' }]} ici={ici} />
}

// integre : dans le panneau de droite des Paramètres sur PC (354), sans fil d'Ariane ni titre de page
export function ChargeCoachs({ integre = false }: { integre?: boolean }) {
  const [params, setParams] = useSearchParams()
  const vue: Vue = params.get('vue') === 'repartition' ? 'repartition' : 'charge'
  const changerVue = (v: Vue) => { const n = new URLSearchParams(params); n.set('vue', v); setParams(n, { replace: true }) }
  return (
    <AvecReseau>
      {(reseau) => (
        <>
          {!integre && <RetourParametres ici="Charge des Coachs" />}
          {integre
            ? <Typography component="h2" variant="h2" sx={{ mb: 1 }}>Charge des Coachs</Typography>
            : <PageHeader titre="Charge des Coachs" sousTitre={`${reseau.equipe.filter((c) => !c.fictif).length} Coachs · maximum ${reseau.parametres.maxUnits} unités`} />}
          <Onglets valeur={vue} onChange={changerVue} rubriques={rubriques} libelle="Rubriques de la charge" />
          {vue === 'repartition' ? <VuePlan reseau={reseau} /> : <VueCharge reseau={reseau} versRepartition={() => changerVue('repartition')} />}
        </>
      )}
    </AvecReseau>
  )
}
