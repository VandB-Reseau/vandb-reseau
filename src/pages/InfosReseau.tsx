// Onglet Infos réseau (Joseph, 22/10/2026) : toutes les communications et toutes les bonnes pratiques réunies,
// avec une recherche et des filtres communs. PC : deux colonnes côte à côte ; téléphone : deux onglets.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
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
import { SectionQuestions } from '../components/Questions'
import { PropositionsARelire } from '../components/Propositions'
import { useAuth } from '../auth/AuthContext'
import QuizOutlined from '@mui/icons-material/QuizOutlined'

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr')
type Periode = 'tout' | '3' | '12'
const periodes: { valeur: Periode; libelle: string }[] = [{ valeur: 'tout', libelle: 'Toute période' }, { valeur: '3', libelle: '3 derniers mois' }, { valeur: '12', libelle: '12 derniers mois' }]
const depuis = (p: Periode) => {
  if (p === 'tout') return ''
  const d = new Date(); d.setMonth(d.getMonth() - Number(p))
  return d.toISOString().slice(0, 10)
}
type Vue = 'communications' | 'pratiques' | 'questions'

function Contenu({ reseau }: { reseau: Reseau }) {
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [params] = useSearchParams()
  const [vue, setVue] = useState<Vue>(params.get('vue') === 'pratiques' ? 'pratiques' : 'communications')
  // Questions éclair (sprint 22, A3) : Directeur et RR
  const { profil } = useAuth()
  const questions = profil?.role === 'directeur' || profil?.role === 'rr'
  const [recherche, setRecherche] = useState('')
  const [magasins, setMagasins] = useState<string[]>([])
  const [themes, setThemes] = useState<string[]>([])
  const [periode, setPeriode] = useState<Periode>('tout')
  const [pratique, setPratique] = useState<BonnePratique | null | undefined>(undefined)
  const [message, setMessage] = useState('')
  // Ouvrir l'onglet vaut lecture : le nombre de l'en-tête retombe à zéro
  useEffect(() => { noterReseauVu() }, [])
  useEffect(() => { noterPratiquesVues(reseau.pratiques.map((p) => p.id)) }, [reseau])
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
  const optionsMagasins = useMemo(() => reseau.magasins.map((m) => m.nom).sort((a, b) => a.localeCompare(b, 'fr')).map((n) => ({ valeur: n, libelle: n })), [reseau])
  const optionsThemes = useMemo(() => [...new Set(reseau.pratiques.map((p) => p.theme).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')).map((t) => ({ valeur: t, libelle: t })), [reseau])
  const effacer = () => { setRecherche(''); setMagasins([]); setThemes([]); setPeriode('tout') }

  const communications = <PageCommunications integre filtre={filtreCommunication} />
  const pratiques = <>
    <PropositionsARelire reseau={reseau} signaler={setMessage} />
    <VuePratiques integre reseau={reseau} filtre={filtrePratique} modifier={setPratique}
      actions={<BoutonAction libelle="Ajouter une bonne pratique" onClick={() => setPratique(null)} />} />
  </>
  return (
    <>
      <PageHeader titre="Infos réseau" />
      {!surPC && <Onglets valeur={vue} onChange={setVue} libelle="Infos réseau" rubriques={[
        { vue: 'communications', libelle: 'Communications', icone: <CampaignOutlined /> },
        { vue: 'pratiques', libelle: 'Bonnes pratiques', icone: <TipsAndUpdatesOutlined /> },
        ...(questions ? [{ vue: 'questions' as const, libelle: 'Questions', icone: <QuizOutlined /> }] : []),
      ]} />}
      <RechercheFiltres actifs={actifs} recherche={<ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Titre, texte, magasin, auteur" libelle="Rechercher une communication ou une pratique" />}>
        <FiltreMenu libelle="Magasin" choisis={magasins} onChange={setMagasins} options={optionsMagasins} />
        <FiltreMenu libelle="Thème" choisis={themes} onChange={setThemes} options={optionsThemes} />
        <FiltreMenu libelle="Période" unique choisis={[periode]} onChange={(v) => setPeriode((v[0] as Periode) ?? 'tout')} options={periodes} />
        {(actifs > 0 || recherche) && <Button onClick={effacer} sx={{ minHeight: 36 }}>Effacer les filtres</Button>}
      </RechercheFiltres>
      {surPC && questions && <Box sx={{ mb: 3 }}><SectionQuestions reseau={reseau} /></Box>}
      {surPC ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 3, alignItems: 'start' }}>
          <Box component="section" aria-label="Communications" sx={{ minWidth: 0 }}>{communications}</Box>
          <Box component="section" aria-label="Bonnes pratiques" sx={{ minWidth: 0 }}>{pratiques}</Box>
        </Box>
      ) : (
        vue === 'questions' ? <SectionQuestions reseau={reseau} />
          : <Box component="section" aria-label={vue === 'communications' ? 'Communications' : 'Bonnes pratiques'}>{vue === 'communications' ? communications : pratiques}</Box>
      )}
      {pratique !== undefined && <DialogPratique reseau={reseau} pratique={pratique} onFermer={(m) => { setPratique(undefined); if (m) setMessage(m) }} />}
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

export function InfosReseau() {
  return <AvecReseau>{(reseau) => <Contenu reseau={reseau} />}</AvecReseau>
}
