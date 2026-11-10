// Actualités (refonte vague 5, Joseph 10/11/2026, 45A ; avant « Infos réseau ») : un seul fil typé (visites, bonnes
// pratiques, communications, temps forts et campagnes) avec ses filtres, puis les communications, la bibliothèque des
// bonnes pratiques et, pour l'équipe, les sondages. Mêmes onglets sur PC et sur téléphone.
// Même onglet pour le franchisé (Joseph, 23/10/2026), en lecture : il aime, commente et propose ses bonnes pratiques ;
// ses sondages restent sur son accueil.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { noterReseauVu } from '../data/echanges'
import { noterPratiquesVues } from '../data/infosVues'
import { SectionSondages, SondagesARepondre } from '../components/Questions'
import { MesPropositions, PropositionsARelire } from '../components/Propositions'
import { useApercu } from '../auth/Apercu'
import { useAuth } from '../auth/AuthContext'
import QuizOutlined from '@mui/icons-material/QuizOutlined'
import DynamicFeedOutlined from '@mui/icons-material/DynamicFeedOutlined'
import { FilActivite } from './Accueil'
import { filDu } from '../data/fil'
import { useCommunicationsDuFil } from '../data/communications'
import { useReactionsPratiques } from '../data/reactionsPratiques'
import { useReactionsVisites } from '../data/reactionsVisites'
import { magasinsDu, perimetreDuProfil } from '../data/perimetre'
import { lienFiche } from '../lib/format'

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr')
type Periode = 'tout' | '3' | '12'
const periodes: { valeur: Periode; libelle: string }[] = [{ valeur: 'tout', libelle: 'Toute période' }, { valeur: '3', libelle: '3 derniers mois' }, { valeur: '12', libelle: '12 derniers mois' }]
const depuis = (p: Periode) => {
  if (p === 'tout') return ''
  const d = new Date(); d.setMonth(d.getMonth() - Number(p))
  return d.toISOString().slice(0, 10)
}
type Vue = 'fil' | 'communications' | 'pratiques' | 'questions'

function Contenu({ reseau }: { reseau: Reseau }) {
  const [params] = useSearchParams()
  const demandee = params.get('vue')
  const [vue, setVue] = useState<Vue>(demandee === 'pratiques' ? 'pratiques' : demandee === 'sondages' ? 'questions' : demandee === 'communications' || params.get('c') ? 'communications' : 'fil')
  // Sondages (sprint 22, A3, puis 23/10/2026) : toute l'équipe y répond, le Directeur et les RR en posent
  const { profil } = useAuth()
  const poseSondages = profil?.role === 'directeur' || profil?.role === 'rr'
  const { apercu } = useApercu()
  const franchise = profil?.role === 'franchise' || !!reseau.espace
  const sondages = <>
    <SondagesARepondre equipe titre="Sondages à remplir" />
    {poseSondages && <SectionSondages reseau={reseau} />}
  </>
  const [recherche, setRecherche] = useState('')
  const [magasins, setMagasins] = useState<string[]>([])
  const [themes, setThemes] = useState<string[]>([])
  const [periode, setPeriode] = useState<Periode>('tout')
  const [pratique, setPratique] = useState<BonnePratique | null | undefined>(undefined)
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
  // Le fil : les magasins suivis (le franchisé, les siens), les liens restent dans son espace
  const duFil = useCommunicationsDuFil()
  const reactionsPratiques = useReactionsPratiques()
  const reactionsVisites = useReactionsVisites()
  const elements = useMemo(() => {
    const suivis = franchise ? reseau.magasins : magasinsDu(reseau, perimetreDuProfil(profil) ?? { type: 'reseau' as const })
    const l = filDu(reseau, new Set(suivis.map((m) => m.nom)), null, 120, duFil.liste, true, true, !franchise)
    return franchise ? l.map((e) => (e.genre === 'pratique' ? { ...e, lien: '/infos?vue=pratiques' } : e.genre === 'animation' ? { ...e, lien: suivis[0] ? `${lienFiche(suivis[0].nom)}?vue=campagnes` : '/' } : e)) : l
  }, [reseau, franchise, profil, duFil.liste])
  const fil = <FilActivite elements={elements} jour={reseau.jour} sansMagasin={franchise && reseau.magasins.length === 1} titre="Fil du réseau" communications={duFil}
    reactionsPratiques={reactionsPratiques} reactionsVisites={reactionsVisites} />
  const pratiques = franchise ? <>
    {!apercu && <MesPropositions reseau={reseau} />}
    <VuePratiques integre reseau={reseau} filtre={filtrePratique} />
  </> : <>
    <PropositionsARelire reseau={reseau} signaler={setMessage} />
    <VuePratiques integre reseau={reseau} filtre={filtrePratique} modifier={setPratique}
      actions={<BoutonAction libelle="Ajouter une bonne pratique" onClick={() => setPratique(null)} />} />
  </>
  return (
    <>
      <PageHeader titre="Actualités" />
      <Onglets valeur={vue} onChange={setVue} libelle="Actualités" rubriques={[
        { vue: 'fil', libelle: 'Fil', icone: <DynamicFeedOutlined /> },
        { vue: 'communications', libelle: 'Communications', icone: <CampaignOutlined /> },
        { vue: 'pratiques', libelle: 'Bonnes pratiques', icone: <TipsAndUpdatesOutlined /> },
        ...(franchise ? [] : [{ vue: 'questions' as const, libelle: 'Sondages', icone: <QuizOutlined /> }]),
      ]} />
      {(vue === 'communications' || vue === 'pratiques') && (
        <RechercheFiltres actifs={actifs} recherche={<ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Titre, texte, magasin, auteur" libelle={vue === 'communications' ? 'Rechercher une communication' : 'Rechercher une bonne pratique'} />}>
          <FiltreMenu libelle="Magasin" choisis={magasins} onChange={setMagasins} options={optionsMagasins} />
          {vue === 'pratiques' && <FiltreMenu libelle="Thème" choisis={themes} onChange={setThemes} options={optionsThemes} />}
          <FiltreMenu libelle="Période" unique choisis={[periode]} onChange={(v) => setPeriode((v[0] as Periode) ?? 'tout')} options={periodes} />
          {(actifs > 0 || recherche) && <Button onClick={effacer} sx={{ minHeight: 36 }}>Effacer les filtres</Button>}
        </RechercheFiltres>
      )}
      <Box sx={{ maxWidth: 760 }}>
        {vue === 'fil' && fil}
        {vue === 'questions' && !franchise && sondages}
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
