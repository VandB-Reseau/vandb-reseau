import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import PushPinOutlined from '@mui/icons-material/PushPinOutlined'
import { LigneLecture } from '../components/LigneLecture'
import { PageHeader } from '../components/PageHeader'
import { Reactions } from '../components/Reactions'
import { EmptyState } from '../components/EmptyState'
import { Fenetre } from '../components/EditionEquipe'
import { ChampDicte } from '../components/SaisieCompteRendu'
import { ChampPieces, ListePieces } from '../components/Pieces'
import { RechercheFiltres } from '../components/RechercheFiltres'
import { BoutonAction, ChampRecherche } from '../components/Outils'
import { Initiales, Puces, TitreSection, useParTranches } from '../components/Social'
import { AlerteTaille, BanniereEntete, ChampCodeHtml, ChampEntete, ContenuMisEnForme, EditeurMiseEnForme } from '../components/MiseEnForme'
import { useAuth } from '../auth/AuthContext'
import { useReseau } from '../data/ReseauContext'
import { quand } from '../data/fil'
import { estImage, type Piece } from '../lib/pieces'
import { HTML_MAX, nettoyerHtml, texteDuHtml } from '../lib/html'
import { useSearchParams } from 'react-router-dom'
import {
  aLaUneDabord, basculerPouce, chargerCommunications, chargerLectures, commenter, communicationsConnues, mettreALaUne, noterLues, messageCommunication, publierCommunication, retenirCommunications, supprimerCommentaire, supprimerCommunication,
  type Communication, type Communications, type Lecture,
} from '../data/communications'
import { notifier, notifierContenu } from '../lib/notifications'

const aujourdhui = () => new Date().toLocaleDateString('sv-SE')
const roles: Record<string, string> = { directeur: 'Directeur de réseau', rr: 'Responsable Régional', coach: 'Coach', franchise: 'Franchisé' }

type Mode = 'texte' | 'forme' | 'code'
const modes: { v: Mode; libelle: string }[] = [{ v: 'texte', libelle: 'Texte' }, { v: 'forme', libelle: 'Mise en forme' }, { v: 'code', libelle: 'Code HTML' }]
const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Ce qu'il faut pour afficher tout de suite une communication publiée, avant la réponse de la base
interface Auteur { moi: string; nom: string; role: string; magasins: string[] | null }
interface Edition { c: Communication | null; brouillon?: Communication; erreur?: string }

// La fenêtre se ferme dès l'enregistrement : la page affiche le résultat et l'envoie à la base ;
// si la base refuse, la fenêtre revient avec ce qui avait été saisi
function DialogCommunication({ edition: { c, brouillon, erreur }, auteur, publier, retirer, onFermer }: {
  edition: Edition; auteur: Auteur; onFermer: () => void
  publier: (b: Communication, envoyer: () => Promise<void>) => void; retirer: (c: Communication) => void
}) {
  const depart = brouillon ?? c
  const [titre, setTitre] = useState(depart?.titre ?? '')
  const [texte, setTexte] = useState(depart?.texte ?? '')
  const [html, setHtml] = useState(depart?.html ?? '')
  const [mode, setMode] = useState<Mode>(depart?.html ? 'forme' : 'texte')
  const [entete, setEntete] = useState<Piece | null>(depart?.pieces.find((p) => p.chemin === depart.entete) ?? null)
  const [pieces, setPieces] = useState<Piece[]>(depart?.pieces.filter((p) => p.chemin !== depart.entete) ?? [])
  const [alerte, setAlerte] = useState('')
  const [une, setUne] = useState(depart?.aLaUne ?? '')
  const changerMode = (m: Mode) => {
    if (m === mode) return
    // Le texte simple devient des paragraphes ; la mise en forme redevient du texte simple
    if (m !== 'texte' && mode === 'texte' && !html.trim() && texte.trim()) setHtml(texte.trim().split(/\n{2,}/).map((b) => `<p>${echapper(b).replace(/\n/g, '<br>')}</p>`).join(''))
    if (m === 'texte' && mode !== 'texte' && html.trim()) setTexte(texteDuHtml(nettoyerHtml(html)).slice(0, 8000))
    setMode(m)
  }
  const propre = mode === 'texte' ? '' : nettoyerHtml(html)
  const tropLourd = propre.length > HTML_MAX
  const enregistrer = async () => {
    const toutes = entete ? [entete, ...pieces] : pieces
    const brut = mode === 'texte' ? texte.trim() : texteDuHtml(propre).slice(0, 8000)
    const b: Communication = {
      ...(c ?? { id: -Date.now(), magasins: auteur.magasins, auteur: auteur.moi, auteurNom: auteur.nom, auteurRole: auteur.role, creeLe: new Date().toISOString(), modifieLe: null, pouces: [], commentaires: [] }),
      titre: titre.trim(), texte: brut, pieces: toutes, html: propre || null, entete: entete?.chemin ?? null, aLaUne: une || null,
    }
    publier(b, async () => {
      const r = await publierCommunication(c?.id ?? null, b.titre, brut, toutes, b.html, b.entete) as { id?: number } | null
      const id = c?.id ?? r?.id
      if (id && une !== (c?.aLaUne ?? '')) {
        await mettreALaUne(id, une || null)
        // Première mise à la une d'une communication déjà publiée : les franchisés visés sont prévenus sur leur téléphone
        if (une && c && !c.aLaUne) notifier('une', [id])
      }
      // Nouvelle communication : les personnes concernées sont prévenues, à la une ou non
      if (id && !c) notifierContenu('communication', id)
    })
    return ''
  }
  return (
    <Fenetre large ouvert onFermer={onFermer} valide={!!titre.trim() && !tropLourd} titre={c ? 'Modifier la communication' : 'Nouvelle communication'}
      sansRechargement erreurInitiale={erreur} enregistrer={enregistrer}
      supprimer={c ? async () => { retirer(c); return '' } : undefined}
      libelleSuppression={c ? `Retirer « ${c.titre} » ? Les commentaires partent avec.` : undefined}>
      <TextField label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
      <ChampEntete piece={entete} changer={setEntete} signaler={setAlerte} />
      <Box>
        <Puces label="Format du message" valeur={mode} options={modes} onChange={changerMode} />
        {mode === 'texte' && <ChampDicte libelle="Message" valeur={texte} changer={setTexte} minRows={5} />}
        {mode === 'forme' && <EditeurMiseEnForme html={html} changer={setHtml} libelle="Message mis en forme" />}
        {mode === 'code' && <ChampCodeHtml html={html} changer={setHtml} />}
      </Box>
      <AlerteTaille visible={tropLourd} />
      <ChampPieces pieces={pieces} changer={setPieces} signaler={setAlerte} />
      <TextField type="date" label="À la une jusqu’au" value={une} onChange={(e) => setUne(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: aujourdhui() } }}
        helperText={une ? 'Reste en tête du fil des franchisés jusqu’à ce jour.' : ' '} />
      {alerte && <Typography color="error" variant="body2">{alerte}</Typography>}
    </Fenetre>
  )
}

// « J'aime » et commentaires d'une communication : sur sa page et dans le fil d'activité
export function ReactionsCommunication({ c, moi, jour, lectureSeule, apres, signaler }: {
  c: Communication; moi: string; jour: string; lectureSeule: boolean; apres: () => Promise<void>; signaler: (m: string) => void
}) {
  return (
    <Reactions titre={c.titre} pouces={c.pouces} commentaires={c.commentaires} moi={moi} jour={jour} lectureSeule={lectureSeule}
      basculer={() => basculerPouce(c.id)} commenter={(t) => commenter(c.id, t)} supprimer={supprimerCommentaire} message={messageCommunication} apres={apres} signaler={signaler} />
  )
}

// Communication épinglée en tête jusqu'à une date (Joseph, 21/10/2026)
export function MarqueUne({ jusquAu }: { jusquAu: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 2, pb: 1, color: 'warning.dark', fontWeight: 600, fontSize: '0.875rem' }}>
      <PushPinOutlined sx={{ fontSize: 18 }} />À la une jusqu’au {new Date(`${jusquAu}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
    </Box>
  )
}

// Une publication : auteur, titre, texte, pièces jointes, « J'aime » et commentaires
function CarteCommunication({ c, moi, jour, lectureSeule, modifier, apres, signaler, lecture }: {
  c: Communication; moi: string; jour: string; lectureSeule: boolean; modifier?: () => void; apres: () => Promise<void>; signaler: (m: string) => void; lecture?: Lecture
}) {
  const entete = c.entete ? c.pieces.find((p) => p.chemin === c.entete && estImage(p)) ?? null : null
  const cible = c.magasins === null ? 'Tout le réseau' : `${c.magasins.length} magasin${c.magasins.length > 1 ? 's' : ''}`
  return (
    <Card component="article" id={`communication-${c.id}`} aria-label={c.titre} sx={{ border: 0, scrollMarginTop: 88 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, pt: 1.5, pb: 1 }}>
        <Initiales nom={c.auteurNom} taille={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }} noWrap>{c.auteurNom}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>{[roles[c.auteurRole], quand(c.creeLe, jour), cible].filter(Boolean).join(' · ')}</Typography>
        </Box>
        {modifier && <Tooltip title="Modifier"><IconButton onClick={modifier} aria-label={`Modifier la communication ${c.titre}`} sx={{ width: 48, height: 48 }}><EditOutlined /></IconButton></Tooltip>}
      </Box>
      {c.aLaUne && <MarqueUne jusquAu={c.aLaUne} />}
      {entete && <Box sx={{ mb: 1.5 }}><BanniereEntete piece={entete} /></Box>}
      <Box sx={{ px: 2 }}>
        <Typography variant="h4" component="h2">{c.titre}</Typography>
        {c.html ? <Box sx={{ mt: 1 }}><ContenuMisEnForme html={c.html} /></Box>
          : c.texte && <Typography sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>{c.texte}</Typography>}
        <ListePieces pieces={c.pieces.filter((p) => p !== entete)} />
      </Box>
      {lecture && <LigneLecture l={lecture} />}
      <ReactionsCommunication c={c} moi={moi} jour={jour} lectureSeule={lectureSeule} apres={apres} signaler={signaler} />
    </Card>
  )
}

// Communications du réseau : le Directeur et les RR publient ; l'équipe et les franchisés lisent, commentent et réagissent.
// lectureSeule : aperçu de l'espace d'un franchisé par le Directeur
// entete : en-tête fourni par l'onglet Messages (canal « Réseau V and B »)
// filtre et integre : colonne de l'onglet Infos réseau, qui porte la recherche et les filtres communs
export function PageCommunications({ lectureSeule = false, entete, filtre, integre = false }: { lectureSeule?: boolean; entete?: ReactNode; filtre?: (c: Communication) => boolean; integre?: boolean }) {
  const { profil } = useAuth()
  const { reseau } = useReseau()
  const suitLectures = !lectureSeule && (profil?.role === 'directeur' || profil?.role === 'rr')
  // Dernière liste connue affichée aussitôt, la base la remplace dès sa réponse
  const [etat, setEtat] = useState<Communications | null | undefined>(() => communicationsConnues()?.communications ?? undefined)
  const [edition, setEdition] = useState<Edition | null>(null)
  const [recherche, setRecherche] = useState('')
  const [message, setMessage] = useState('')
  const [lectures, setLectures] = useState<Map<number, Lecture> | null>(() => (suitLectures ? communicationsConnues()?.lectures ?? null : null))
  const charger = useCallback(async () => {
    const [c, l] = await Promise.all([chargerCommunications(), suitLectures ? chargerLectures() : Promise.resolve(null)])
    setEtat(c); setLectures(l)
  }, [suitLectures])
  useEffect(() => { void charger() }, [charger])
  const changerListe = (f: (l: Communication[]) => Communication[]) => setEtat((e) => {
    if (!e) return e
    const n = { ...e, liste: f(e.liste) }
    retenirCommunications(n)
    return n
  })
  const remettre = (c: Communication) => changerListe((l) => [...l.filter((x) => x.id !== c.id), c].sort((a, b) => b.creeLe.localeCompare(a.creeLe)))
  const publier = (origine: Communication | null, b: Communication, envoyer: () => Promise<void>) => {
    changerListe((l) => (origine ? l.map((x) => (x.id === origine.id ? b : x)) : [b, ...l]))
    setEdition(null)
    envoyer().then(() => { setMessage(origine ? 'Communication mise à jour.' : 'Communication publiée.'); void charger() }, (e) => {
      if (origine) remettre(origine); else changerListe((l) => l.filter((x) => x.id !== b.id))
      setEdition({ c: origine, brouillon: b, erreur: messageCommunication(e) })
    })
  }
  const retirer = (c: Communication) => {
    changerListe((l) => l.filter((x) => x.id !== c.id))
    setEdition(null)
    supprimerCommunication(c.id).then(() => { setMessage('Communication retirée.'); void charger() }, (e) => { remettre(c); setMessage(messageCommunication(e)) })
  }
  // Arrivée depuis le fil d'activité : la communication citée est amenée à l'écran
  const [params] = useSearchParams()
  const cible = params.get('c')
  const pret = etat !== undefined
  // Arrivée depuis l'onglet Animation réseau : la fenêtre de publication s'ouvre
  const aPublier = params.get('publier') === '1' && !lectureSeule && (profil?.role === 'directeur' || profil?.role === 'rr')
  useEffect(() => { if (pret && etat && aPublier) setEdition({ c: null }) }, [pret, aPublier]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (pret && cible) document.getElementById(`communication-${cible}`)?.scrollIntoView({ block: 'start' }) }, [pret, cible])
  const peutPublier = !lectureSeule && (profil?.role === 'directeur' || profil?.role === 'rr')
  const jour = aujourdhui()
  const q = recherche.trim().toLowerCase()
  const liste = useMemo(() => aLaUneDabord(etat?.liste ?? []).filter((c) => (!q || `${c.titre} ${c.texte} ${c.auteurNom}`.toLowerCase().includes(q)) && (!filtre || filtre(c))), [etat, q, filtre])
  const { visibles, suite } = useParTranches(liste, q)
  const n = etat?.liste.length ?? 0
  // Un franchisé qui affiche les communications les a lues
  const affichees = visibles.map((c) => c.id).join(',')
  useEffect(() => {
    if (!lectureSeule && profil?.role === 'franchise' && affichees) void noterLues(affichees.split(',').map(Number)).catch(() => undefined)
  }, [affichees, lectureSeule, profil?.role])
  const carte = (c: Communication, moi: string) => (
    // Une publication pas encore enregistrée (numéro provisoire) ne se commente ni ne se modifie
    <CarteCommunication key={c.id} c={c} moi={moi} jour={jour} lectureSeule={lectureSeule || c.id < 0} apres={charger} signaler={setMessage} lecture={lectures?.get(c.id)}
      modifier={peutPublier && c.auteur === moi && c.id > 0 ? () => setEdition({ c }) : undefined} />
  )
  const fenetres = (
    <>
      {edition && etat && (
        <DialogCommunication key={edition.brouillon?.id ?? edition.c?.id ?? 0} edition={edition} onFermer={() => setEdition(null)}
          auteur={{ moi: etat.moi, role: etat.role || profil?.role || '', nom: etat.liste.find((x) => x.auteur === etat.moi)?.auteurNom || profil?.nom || '', magasins: profil?.role === 'rr' ? (reseau?.magasins ?? []).map((m) => m.nom) : null }}
          publier={(b, envoyer) => publier(edition.c, b, envoyer)} retirer={retirer} />
      )}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </>
  )
  return (
    <>
      {integre ? null : entete ?? <PageHeader titre="Communications" sousTitre={etat ? `${n} communication${n > 1 ? 's' : ''}` : undefined} />}
      {etat === null ? (
        <EmptyState icone={<CampaignOutlined />} titre="Communications pas encore activées" texte="Les communications du réseau apparaîtront ici dès leur activation dans la base." />
      ) : (
        <>
          {integre
            ? <TitreSection nombre={etat ? liste.length : undefined} action={peutPublier ? <BoutonAction libelle="Publier" onClick={() => setEdition({ c: null })} /> : undefined}>Communications</TitreSection>
            : <RechercheFiltres recherche={<ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher une communication" />}
              actions={peutPublier ? <BoutonAction libelle="Publier" onClick={() => setEdition({ c: null })} /> : undefined} />}
          {etat === undefined ? <Typography variant="body2" color="text.secondary">Chargement…</Typography>
            : !liste.length ? <EmptyState icone={<CampaignOutlined />} titre="Aucune communication" texte={n ? 'Aucune communication ne correspond à ces critères.' : 'Les annonces du réseau aux franchisés apparaîtront ici.'} />
            : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 720 }}>
                {visibles.map((c) => carte(c, etat.moi))}
                {suite}
              </Box>
            )}
        </>
      )}
      {fenetres}
    </>
  )
}
