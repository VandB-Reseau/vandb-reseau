import { Suspense, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DialogMagasin } from '../components/EditionMagasin'
import { lienFiche } from '../lib/format'
import { libelleCleCoach } from '../data/charge'
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
import ToggleButton from '@mui/material/ToggleButton'
import MonitorHeartOutlined from '@mui/icons-material/MonitorHeartOutlined'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import TimelineOutlined from '@mui/icons-material/TimelineOutlined'
import { MagasinsSuivis, TableauMagasins } from '../components/TableauMagasins'
import { perimetreDuProfil } from '../data/perimetre'
import { useAuth } from '../auth/AuthContext'
import { ListeMagasins, trisColonnes, type TriMagasins } from '../components/ListeMagasins'
import { useReseau } from '../data/ReseauContext'
import { magasinsSuivis, useSuivis } from '../lib/suivis'
import { filtrer, filtresDepuisUrl, filtresVersUrl, libellesAlerte, type Alerte, type Filtres } from '../data/filtres'
import { VuesMagasins } from '../components/VuesMagasins'
import { analyser } from '../data/chiffres'
import { anneeDe, suiviRythme } from '../data/visites'
import { libelleParc, statutLibelle, type Reseau } from '../data/modele'
import { leviersDuMagasin, libellesLevier, useReperesReseau, type Levier } from '../data/leviers'

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
  const tri = (trisColonnes.find((t) => t.v === params.get('tri'))?.v ?? 'nom') as TriMagasins
  const changerFiltres = (f: Filtres) => setParams(filtresVersUrl(f, params), { replace: true })
  const [ajout, setAjout] = useState(false)
  const [emplacementBoutons, setEmplacementBoutons] = useState<HTMLElement | null>(null)
  const naviguer = useNavigate()
  const { complet, reseau: visible } = useReseau()
  // Leviers du CA : repères du réseau pour le dernier mois des magasins visibles, un appel par session
  const reperes = useReperesReseau(useMemo(() => (visible?.magasins ?? []).filter((m) => m.statut !== 'avenir').map((m) => m.nom), [visible]))
  const lev = useMemo(() => {
    const r = complet ?? visible
    return reperes && r ? new Map<string, Levier | null>(r.magasins.map((m) => [m.nom, leviersDuMagasin(r, m.nom, reperes)?.levier ?? null])) : null
  }, [reperes, complet, visible])
  const suivis = useSuivis()
  // Calculées une fois par réseau chargé (analyse des chiffres et rythme de visite de chaque magasin)
  const memo = useMemo(() => new WeakMap<Reseau, Map<string, Alerte[]>>(), [])
  const alertesDe = (r: Reseau) => { let a = memo.get(r); if (!a) { a = alertesDuReseau(r); memo.set(r, a) } return a }
  const trier = (v: TriMagasins) => { const p = new URLSearchParams(params); if (v === 'nom') p.delete('tri'); else p.set('tri', v); setParams(p, { replace: true }) }
  const changerVue = (v: 'liste' | 'carte') => { const p = new URLSearchParams(params); p.set('vue', v); setParams(p, { replace: true }) }
  const { profil } = useAuth()
  const voitEvolution = !perimetreDuProfil(profil)
  // Bascule de vue : au bout de la barre de filtres sur PC (vague 4, 39A), dans l'en-tête sur téléphone (la recherche reste collée)
  const bascule = (
    <ToggleButtonGroup exclusive size="small" value={vue} onChange={(_e, v: 'liste' | 'carte' | 'sante' | null) => { if (v === 'liste' || v === 'carte') changerVue(v) }} aria-label="Affichage"
                  sx={{ '& .MuiToggleButton-root': { minHeight: { xs: 48, md: 40 }, px: 1.5, gap: 0.75, textTransform: 'none', fontWeight: 600 } }}>
                  <ToggleButton value="liste" aria-label="Liste"><TableRowsOutlined fontSize="small" />{surPC ? 'Tableau' : 'Liste'}</ToggleButton>
                  <ToggleButton value="carte" aria-label="Carte"><MapOutlined fontSize="small" />Carte</ToggleButton>
                  {/* Refonte vague 5 (51A) : la santé du parc est une vue des magasins */}
                  <ToggleButton value="sante" aria-label="Santé du parc" onClick={() => naviguer('/plus/sante')}><MonitorHeartOutlined fontSize="small" />{surPC && 'Santé'}</ToggleButton>
                </ToggleButtonGroup>
  )

  return (
    <AvecReseau>
      {(perimetre) => {
        // La carte montre tout le réseau, même à un Coach ou un RR ; la liste, ses magasins seulement
        const reseau = vue === 'carte' && complet ? complet : perimetre
        const restreint = reseau.magasins.length !== perimetre.magasins.length
        const alertes = alertesDe(reseau)
        const parAlerte = (nom: string) => alertes.get(nom) ?? []
        const parLevier = lev ? (nom: string) => lev.get(nom) ?? null : undefined
        const resultats = filtrer(reseau.magasins, filtres, parAlerte, parLevier)
        // Nom proposé pour enregistrer la vue : ses filtres mis bout à bout
        const nomPropose = [filtres.texte, ...filtres.alertes.map((a) => libellesAlerte[a]), ...filtres.leviers.map((l) => libellesLevier[l]), ...filtres.statuts.map((s) => statutLibelle[s]),
          ...filtres.types.map((t) => (t === 'franchise' ? 'Franchisés' : 'Intégrés')), ...filtres.rrs.map((r) => reseau.rrs.find((x) => x.id === r)?.nom ?? 'Sans RR'),
          ...filtres.coachs.map(libelleCleCoach)].filter(Boolean).join(' · ').slice(0, 40)
        const total = reseau.magasins.length
        const parNom = new Map(reseau.magasins.map((m) => [m.nom, m]))
        const s = magasinsSuivis(suivis, new Set(parNom.keys()))
        const enTete = resultats.length === total && (s.favoris.length || s.recents.length)
          ? { favoris: s.favoris.map((n) => parNom.get(n)!), recents: s.recents.map((n) => parNom.get(n)!) } : undefined
        return (
          <>
            <PageHeader
              titre="Magasins"
              sousTitre={resultats.length === total ? `${restreint ? 'Tout le réseau : ' : ''}${libelleParc(reseau.magasins)}` : `${resultats.length} sur ${total} magasins`}
              autres={voitEvolution && surPC ? [{ libelle: 'Évolution du parc', icone: <TimelineOutlined />, onClick: () => naviguer('/performance?vue=evolution') }] : undefined}
              actions={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
                {/* Refonte vague 4 (39A) : l'action principale à droite du titre, la bascule de vue au bout de la barre ;
                    vague 8 (104A) : les actions secondaires dans « ⋯ » */}
                {/* Vague 6 (Joseph, 10/11/2026) : sur téléphone, un seul « + », celui de l'en-tête ; l'ajout d'un magasin se fait sur PC */}
                {vue === 'liste' && surPC && <BoutonAction libelle="Ajouter un magasin" onClick={() => setAjout(true)} />}
                {!surPC && bascule}
              </Box>}
            />
            <BarreFiltres reseau={reseau} filtres={filtres} onChange={changerFiltres} alertesDe={parAlerte} levierDe={parLevier}
              actions={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{vue === 'carte' && <Box ref={setEmplacementBoutons} sx={{ display: 'flex' }} />}
{surPC && bascule}</Box>} />
            <VuesMagasins params={params} appliquer={(p) => setParams(p, { replace: true })} nomPropose={nomPropose} pretes={vue === 'carte' ? [] : [
              { nom: 'Tous', adresse: '', nombre: total },
              { nom: 'À surveiller', adresse: 'alerte=decroche%7Csurveiller', nombre: reseau.magasins.filter((m) => parAlerte(m.nom).some((a) => a !== 'visite')).length },
              { nom: 'À voir', adresse: 'alerte=visite', nombre: reseau.magasins.filter((m) => parAlerte(m.nom).includes('visite')).length },
            ]} />
            {ajout && <DialogMagasin reseau={reseau} magasin={null} onFermer={(msg, nom) => { setAjout(false); if (msg && nom) naviguer(lienFiche(nom)) }} />}
            {resultats.length === 0 ? (
              <EmptyState icone={<SearchOff />} titre="Personne à cette adresse" texte="Essaie un autre nom ou retire un filtre." />
            ) : vue === 'carte' ? (
              <Suspense fallback={<Skeleton variant="rounded" height={600} />}>
                <CarteMagasins magasins={resultats} rrs={reseau.rrs} equipe={reseau.equipe} personnes={reseau.personnes} restreindre={resultats.length !== total} margeBas={surPC ? 40 : 96} emplacementBoutons={emplacementBoutons}
                  ouvrables={restreint ? new Set(perimetre.magasins.map((m) => m.nom)) : undefined} />
              </Suspense>
            ) : (
              <>
                {surPC ? <><MagasinsSuivis suivis={enTete} /><TableauMagasins magasins={resultats} tri={tri} trier={trier} /></> : <ListeMagasins magasins={resultats} tri={tri} suivis={enTete} trier={trier} />}
              </>
            )}
          </>
        )
      }}
    </AvecReseau>
  )
}
