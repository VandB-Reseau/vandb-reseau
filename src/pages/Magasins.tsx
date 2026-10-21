import { Suspense, useMemo, useState } from 'react'
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
import { ListeMagasins, trisMagasins, type TriMagasins } from '../components/ListeMagasins'
import { Puces } from '../components/Social'
import { useReseau } from '../data/ReseauContext'
import { magasinsSuivis, useSuivis } from '../lib/suivis'
import { filtrer, filtresDepuisUrl, filtresVersUrl, libellesAlerte, type Alerte, type Filtres } from '../data/filtres'
import { VuesMagasins } from '../components/VuesMagasins'
import { analyser } from '../data/chiffres'
import { anneeDe, suiviRythme } from '../data/visites'
import { statutLibelle, type Magasin, type Reseau } from '../data/modele'
import { BoutonExporter } from '../components/Exporter'

// Alertes de chaque magasin : chiffres (décroche, à surveiller) et visite attendue
function alertesDuReseau(reseau: Reseau): Map<string, Alerte[]> {
  const res = new Map<string, Alerte[]>()
  const ajouter = (nom: string, a: Alerte) => res.set(nom, [...(res.get(nom) ?? []), a])
  for (const m of reseau.magasins) {
    const s = analyser(reseau, m.nom)?.statut
    if (s === 'decroche' || s === 'surveiller') ajouter(m.nom, s)
  }
  for (const l of suiviRythme(reseau, anneeDe(reseau.jour))) if (l.alerte) ajouter(l.magasin.nom, 'visite')
  return res
}

const CarteMagasins = chargementDiffere(() => import('../components/CarteMagasins').then((m) => ({ default: m.CarteMagasins })))

export function Magasins({ vueInitiale = 'liste' }: { vueInitiale?: 'liste' | 'carte' }) {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [params, setParams] = useSearchParams()
  const filtres = filtresDepuisUrl(params)
  const vue = (params.get('vue') as 'liste' | 'carte' | null) ?? vueInitiale
  const tri = (trisMagasins.find((t) => t.v === params.get('tri'))?.v ?? 'nom') as TriMagasins
  const changerFiltres = (f: Filtres) => setParams(filtresVersUrl(f, params), { replace: true })
  const [ajout, setAjout] = useState(false)
  const [emplacementBoutons, setEmplacementBoutons] = useState<HTMLElement | null>(null)
  const naviguer = useNavigate()
  const { complet } = useReseau()
  const suivis = useSuivis()
  // Calculées une fois par réseau chargé (analyse des chiffres et rythme de visite de chaque magasin)
  const memo = useMemo(() => new WeakMap<Reseau, Map<string, Alerte[]>>(), [])
  const alertesDe = (r: Reseau) => { let a = memo.get(r); if (!a) { a = alertesDuReseau(r); memo.set(r, a) } return a }
  const changerVue = (v: 'liste' | 'carte') => { const p = new URLSearchParams(params); p.set('vue', v); setParams(p, { replace: true }) }

  return (
    <AvecReseau>
      {(perimetre) => {
        // La carte montre tout le réseau, même à un Coach ou un RR ; la liste, ses magasins seulement
        const reseau = vue === 'carte' && complet ? complet : perimetre
        const restreint = reseau.magasins.length !== perimetre.magasins.length
        const alertes = alertesDe(reseau)
        const parAlerte = (nom: string) => alertes.get(nom) ?? []
        const resultats = filtrer(reseau.magasins, filtres, parAlerte)
        // Nom proposé pour enregistrer la vue : ses filtres mis bout à bout
        const nomPropose = [filtres.texte, ...filtres.alertes.map((a) => libellesAlerte[a]), ...filtres.statuts.map((s) => statutLibelle[s]),
          ...filtres.types.map((t) => (t === 'franchise' ? 'Franchisés' : 'Intégrés')), ...filtres.rrs.map((r) => reseau.rrs.find((x) => x.id === r)?.nom ?? 'Sans RR'),
          ...filtres.coachs.map((c) => (c === '__aucun__' ? 'Sans Coach' : c))].filter(Boolean).join(' · ').slice(0, 40)
        const total = reseau.magasins.length
        const parNom = new Map(reseau.magasins.map((m) => [m.nom, m]))
        const s = magasinsSuivis(suivis, new Set(parNom.keys()))
        const enTete = resultats.length === total && (s.favoris.length || s.recents.length)
          ? { favoris: s.favoris.map((n) => parNom.get(n)!), recents: s.recents.map((n) => parNom.get(n)!) } : undefined
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
            <BarreFiltres reseau={reseau} filtres={filtres} onChange={changerFiltres} alertesDe={parAlerte}
              actions={vue === 'carte' ? <Box ref={setEmplacementBoutons} sx={{ display: 'flex' }} /> : <BoutonAction libelle="Ajouter un magasin" onClick={() => setAjout(true)} />} />
            <VuesMagasins params={params} appliquer={(p) => setParams(p, { replace: true })} nomPropose={nomPropose} />
            {ajout && <DialogMagasin reseau={reseau} magasin={null} onFermer={(msg, nom) => { setAjout(false); if (msg && nom) naviguer(lienFiche(nom)) }} />}
            {resultats.length === 0 ? (
              <EmptyState icone={<SearchOff />} titre="Aucun magasin ne correspond" texte="Modifie la recherche ou retire un filtre pour voir plus de magasins." />
            ) : vue === 'carte' ? (
              <Suspense fallback={<Skeleton variant="rounded" height={600} />}>
                <CarteMagasins magasins={resultats} rrs={reseau.rrs} equipe={reseau.equipe} personnes={reseau.personnes} restreindre={resultats.length !== total} margeBas={surPC ? 40 : 96} emplacementBoutons={emplacementBoutons}
                  ouvrables={restreint ? new Set(perimetre.magasins.map((m) => m.nom)) : undefined} />
              </Suspense>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Puces label="Trier par" valeur={tri} options={trisMagasins} onChange={(v) => { const p = new URLSearchParams(params); if (v === 'nom') p.delete('tri'); else p.set('tri', v); setParams(p, { replace: true }) }} />
                  </Box>
                  <BoutonExporter lignes={resultats} fichier="Magasins" feuille="Magasins" colonnes={[
                    { entete: 'Magasin', valeur: (m: Magasin) => m.nom, largeur: 22 }, { entete: 'Code', valeur: (m: Magasin) => m.code },
                    { entete: 'Ville', valeur: (m: Magasin) => m.ville }, { entete: 'Département', valeur: (m: Magasin) => m.departement },
                    { entete: 'Statut', valeur: (m: Magasin) => statutLibelle[m.statut] }, { entete: 'Type', valeur: (m: Magasin) => (m.franchise ? 'Franchisé' : 'Intégré') },
                    { entete: 'Coach', valeur: (m: Magasin) => m.coach, largeur: 20 }, { entete: 'Responsable Régional', valeur: (m: Magasin) => m.rr?.nom, largeur: 22 },
                    { entete: 'Franchisé', valeur: (m: Magasin) => (m.franchise ? m.responsable?.nom : ''), largeur: 22 },
                    { entete: 'Ouverture', valeur: (m: Magasin) => (m.ouvertureConnue ? m.ouverture : '') },
                    { entete: 'Alertes', valeur: (m: Magasin) => parAlerte(m.nom).map((a) => libellesAlerte[a]).join(', '), largeur: 30 },
                  ]} />
                </Box>
                <ListeMagasins magasins={resultats} tri={tri} suivis={enTete} />
              </>
            )}
          </>
        )
      }}
    </AvecReseau>
  )
}
