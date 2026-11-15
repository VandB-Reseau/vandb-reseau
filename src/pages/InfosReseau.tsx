// Animation (choix 212-217, Joseph 15/11/2026) : Actualités et Campagnes ne font plus qu'une page. L'Accueil porte seul le
// fil d'actualité ; ici on publie et on suit : Communications, Campagnes (campagnes, déploiements, challenges), Bonnes
// pratiques et, pour le Directeur et les RR, Sondages (on y répond depuis l'Accueil). Le suivi (lectures, réponses,
// exécution) s'affiche sur chaque contenu. Franchisé : la page devient « Bonnes pratiques » ; ses communications restent
// ouvrables par leur lien (À la une, fil, notifications).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import FlagOutlined from '@mui/icons-material/FlagOutlined'
import { EnvoyerAuReseau } from './Animation'
import { RubriqueCampagnes, TYPES_CAMPAGNES, type TypeCampagne } from './SanteParc'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { RechercheFiltres } from '../components/RechercheFiltres'
import { FiltreMenu } from '../components/FiltreMenu'
import { BoutonAction, ChampRecherche } from '../components/Outils'
import { Onglets } from '../components/Onglets'
import { DialogPratique, VuePratiques } from '../components/BonnesPratiques'
import { PageCommunications } from './Communications'
import type { BonnePratique } from '../data/bonnesPratiques'
import type { Communication } from '../data/communications'
import type { Reseau } from '../data/modele'
import { noterPratiquesVues } from '../data/infosVues'
import { noterReseauVu } from '../data/echanges'
import { MesPropositions, PropositionsARelire } from '../components/Propositions'
import { useApercu } from '../auth/Apercu'
import { useAuth } from '../auth/AuthContext'
import { SectionSondages } from '../components/Questions'
import QuizOutlined from '@mui/icons-material/QuizOutlined'

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr')
type Periode = 'tout' | '3' | '12'
const periodes: { valeur: Periode; libelle: string }[] = [{ valeur: 'tout', libelle: 'Toute période' }, { valeur: '3', libelle: '3 derniers mois' }, { valeur: '12', libelle: '12 derniers mois' }]
const depuis = (p: Periode) => {
  if (p === 'tout') return ''
  const d = new Date(); d.setMonth(d.getMonth() - Number(p))
  return d.toISOString().slice(0, 10)
}
type Vue = 'communications' | 'campagnes' | 'pratiques' | 'sondages'

function Contenu({ reseau }: { reseau: Reseau }) {
  const [params, setParams] = useSearchParams()
  const { profil } = useAuth()
  const poseSondages = profil?.role === 'directeur' || profil?.role === 'rr'
  const { apercu } = useApercu()
  const franchise = profil?.role === 'franchise' || !!reseau.espace
  const demandee = params.get('vue') ?? ''
  const typeCampagne: TypeCampagne = (TYPES_CAMPAGNES as readonly string[]).includes(demandee) ? demandee as TypeCampagne : 'campagnes'
  const vueDemandee: Vue = demandee === 'pratiques' ? 'pratiques'
    : (demandee === 'sondages' || demandee === 'questions') && poseSondages ? 'sondages'
    : (TYPES_CAMPAGNES as readonly string[]).includes(demandee) && !franchise ? 'campagnes'
    : demandee === 'communications' || params.get('c') ? 'communications'
    : franchise ? 'pratiques' : 'communications'
  const [vue, setVueLocale] = useState<Vue>(vueDemandee)
  // Un lien vers une autre partie (notification, fil) change l'onglet même si la page est déjà ouverte
  useEffect(() => { setVueLocale(vueDemandee) }, [vueDemandee])
  const setVue = (v: Vue) => { setVueLocale(v); setParams({ vue: v }, { replace: true }) }
  const choisirCampagne = (t: TypeCampagne) => setParams({ vue: t }, { replace: true })
  const [versionSondages, setVersionSondages] = useState(0)
  const [recherche, setRecherche] = useState('')
  const [magasins, setMagasins] = useState<string[]>([])
  const [themes, setThemes] = useState<string[]>([])
  const [periode, setPeriode] = useState<Periode>('tout')
  const [pratique, setPratique] = useState<BonnePratique | null | undefined>(undefined)
  // Depuis « Partager » du fil : la fenêtre d'une nouvelle bonne pratique s'ouvre d'elle-même
  const ajouter = params.get('ajouter') === '1' && !franchise && !apercu
  useEffect(() => { if (ajouter) setPratique(null) }, [ajouter])
  const [message, setMessage] = useState('')
  // Ouvrir l'onglet vaut lecture : le nombre de l'en-tête retombe à zéro
  useEffect(() => { if (!apercu) noterReseauVu() }, [apercu])
  useEffect(() => { if (!apercu) noterPratiquesVues(reseau.pratiques.map((p) => p.id)) }, [reseau, apercu])
  const q = sansAccents(recherche.trim())
  const debut = depuis(periode)
  const actifs = (magasins.length ? 1 : 0) + (themes.length ? 1 : 0) + (periode !== 'tout' ? 1 : 0)
  // Une communication à tout le réseau concerne chaque magasin
  const filtreCommunication = useCallback((c: Communication) => (!q || sansAccents(`${c.titre} ${c.texte} ${c.auteurNom}`).includes(q))
    && (!magasins.length || c.magasins === null || c.magasins.some((m) => magasins.includes(m)))
    && (!debut || c.creeLe.slice(0, 10) >= debut), [q, magasins, debut])
  const filtrePratique = useCallback((p: BonnePratique) => (!q || sansAccents(`${p.titre} ${p.magasin} ${p.texte} ${p.par} ${p.theme}`).includes(q))
    && (!magasins.length || magasins.includes(p.magasin) || p.reprises.some((m) => magasins.includes(m)))
    && (!themes.length || themes.includes(p.theme))
    && (!debut || p.date >= debut), [q, magasins, themes, debut])
  // Franchisé : ses magasins et ceux des bonnes pratiques du réseau
  const optionsMagasins = useMemo(() => [...new Set([...reseau.magasins.map((m) => m.nom), ...(franchise ? reseau.pratiques.map((p) => p.magasin) : [])])]
    .sort((a, b) => a.localeCompare(b, 'fr')).map((n) => ({ valeur: n, libelle: n })), [reseau, franchise])
  const optionsThemes = useMemo(() => [...new Set(reseau.pratiques.map((p) => p.theme).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')).map((t) => ({ valeur: t, libelle: t })), [reseau])
  const effacer = () => { setRecherche(''); setMagasins([]); setThemes([]); setPeriode('tout') }

  const communications = <PageCommunications integre filtre={filtreCommunication} lectureSeule={!!apercu} />
  const pratiques = franchise ? <>
    {!apercu && <MesPropositions reseau={reseau} ouvrir={params.get('proposer') === '1'} />}
    <VuePratiques integre reseau={reseau} filtre={filtrePratique} />
  </> : <>
    <PropositionsARelire reseau={reseau} signaler={setMessage} />
    <VuePratiques integre reseau={reseau} filtre={filtrePratique} modifier={setPratique}
      actions={<BoutonAction libelle="Ajouter une bonne pratique" onClick={() => setPratique(null)} />} />
  </>
  // Choix 212 : l'ancien onglet « Fil » renvoie à l'Accueil
  if (demandee === 'fil') return <Navigate to="/" replace />
  const titre = franchise ? (vue === 'communications' ? 'Communications' : 'Bonnes pratiques') : 'Animation'
  return (
    <>
      <PageHeader titre={titre} actions={poseSondages && !apercu && !franchise ? <EnvoyerAuReseau reseau={reseau} apres={() => setVersionSondages((n) => n + 1)} /> : undefined} />
      {!franchise && <Onglets valeur={vue} onChange={setVue} libelle="Animation" rubriques={[
        { vue: 'communications', libelle: 'Communications', icone: <CampaignOutlined /> },
        { vue: 'campagnes', libelle: 'Campagnes', icone: <FlagOutlined /> },
        { vue: 'pratiques', libelle: 'Bonnes pratiques', icone: <TipsAndUpdatesOutlined /> },
        ...(poseSondages ? [{ vue: 'sondages' as const, libelle: 'Sondages', icone: <QuizOutlined /> }] : []),
      ]} />}
      {(vue === 'communications' || vue === 'pratiques') && (
        <RechercheFiltres actifs={actifs} recherche={<ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Titre, texte, magasin, auteur" libelle={vue === 'communications' ? 'Rechercher une communication' : 'Rechercher une bonne pratique'} />}>
          <FiltreMenu libelle="Magasin" choisis={magasins} onChange={setMagasins} options={optionsMagasins} />
          {vue === 'pratiques' && <FiltreMenu libelle="Thème" choisis={themes} onChange={setThemes} options={optionsThemes} />}
          <FiltreMenu libelle="Période" unique choisis={[periode]} onChange={(v) => setPeriode((v[0] as Periode) ?? 'tout')} options={periodes} />
          {(actifs > 0 || recherche) && <Button onClick={effacer} sx={{ minHeight: 36 }}>Retirer les filtres</Button>}
        </RechercheFiltres>
      )}
      {vue === 'campagnes' && <RubriqueCampagnes reseau={reseau} type={typeCampagne} choisir={choisirCampagne} />}
      <Box sx={{ maxWidth: 760 }}>
        {vue === 'sondages' && poseSondages && <SectionSondages key={versionSondages} reseau={reseau} />}
        {vue === 'communications' && <Box component="section" aria-label="Communications">{communications}</Box>}
        {vue === 'pratiques' && <Box component="section" aria-label="Bonnes pratiques">{pratiques}</Box>}
      </Box>
      {pratique !== undefined && <DialogPratique reseau={reseau} pratique={pratique} onFermer={(m) => { setPratique(undefined); if (m) setMessage(m) }} />}
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

export function InfosReseau() {
  return <AvecReseau>{(reseau) => <Contenu reseau={reseau} />}</AvecReseau>
}
