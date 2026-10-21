import { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { PageHeader } from '../components/PageHeader'
import { Reactions } from '../components/Reactions'
import { EmptyState } from '../components/EmptyState'
import { Fenetre } from '../components/EditionEquipe'
import { ChampDicte } from '../components/SaisieCompteRendu'
import { ChampPieces, ListePieces } from '../components/Pieces'
import { RechercheFiltres } from '../components/RechercheFiltres'
import { BoutonAction, ChampRecherche } from '../components/Outils'
import { Initiales, Puces, useParTranches } from '../components/Social'
import { AlerteTaille, BanniereEntete, ChampCodeHtml, ChampEntete, ContenuMisEnForme, EditeurMiseEnForme } from '../components/MiseEnForme'
import { useAuth } from '../auth/AuthContext'
import { ErreurAction } from '../data/espaceFranchise'
import { quand } from '../data/fil'
import { estImage, type Piece } from '../lib/pieces'
import { HTML_MAX, nettoyerHtml, texteDuHtml } from '../lib/html'
import { useSearchParams } from 'react-router-dom'
import {
  basculerPouce, chargerCommunications, commenter, messageCommunication, publierCommunication, supprimerCommentaire, supprimerCommunication,
  type Communication, type Communications,
} from '../data/communications'

const aujourdhui = () => new Date().toLocaleDateString('sv-SE')
const roles: Record<string, string> = { directeur: 'Directeur de réseau', rr: 'Responsable Régional', coach: 'Coach', franchise: 'Franchisé' }

type Mode = 'texte' | 'forme' | 'code'
const modes: { v: Mode; libelle: string }[] = [{ v: 'texte', libelle: 'Texte' }, { v: 'forme', libelle: 'Mise en forme' }, { v: 'code', libelle: 'Code HTML' }]
const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function DialogCommunication({ c, onFermer }: { c: Communication | null; onFermer: (m?: string) => void }) {
  const [titre, setTitre] = useState(c?.titre ?? '')
  const [texte, setTexte] = useState(c?.texte ?? '')
  const [html, setHtml] = useState(c?.html ?? '')
  const [mode, setMode] = useState<Mode>(c?.html ? 'forme' : 'texte')
  const [entete, setEntete] = useState<Piece | null>(c?.pieces.find((p) => p.chemin === c.entete) ?? null)
  const [pieces, setPieces] = useState<Piece[]>(c?.pieces.filter((p) => p.chemin !== c.entete) ?? [])
  const [alerte, setAlerte] = useState('')
  const changerMode = (m: Mode) => {
    if (m === mode) return
    // Le texte simple devient des paragraphes ; la mise en forme redevient du texte simple
    if (m !== 'texte' && mode === 'texte' && !html.trim() && texte.trim()) setHtml(texte.trim().split(/\n{2,}/).map((b) => `<p>${echapper(b).replace(/\n/g, '<br>')}</p>`).join(''))
    if (m === 'texte' && mode !== 'texte' && html.trim()) setTexte(texteDuHtml(nettoyerHtml(html)).slice(0, 8000))
    setMode(m)
  }
  const propre = mode === 'texte' ? '' : nettoyerHtml(html)
  const tropLourd = propre.length > HTML_MAX
  const agir = async (action: () => Promise<unknown>, ok: string) => {
    try { await action() } catch (e) { throw new ErreurAction(messageCommunication(e)) }
    return ok
  }
  const enregistrer = () => {
    const toutes = entete ? [entete, ...pieces] : pieces
    const brut = mode === 'texte' ? texte.trim() : texteDuHtml(propre).slice(0, 8000)
    return publierCommunication(c?.id ?? null, titre.trim(), brut, toutes, propre || null, entete?.chemin ?? null)
  }
  return (
    <Fenetre large ouvert onFermer={onFermer} valide={!!titre.trim() && !tropLourd} titre={c ? 'Modifier la communication' : 'Nouvelle communication'}
      enregistrer={() => agir(enregistrer, c ? 'Communication mise à jour.' : 'Communication publiée.')}
      supprimer={c ? () => agir(() => supprimerCommunication(c.id), 'Communication retirée.') : undefined}
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

// Une publication : auteur, titre, texte, pièces jointes, « J'aime » et commentaires
function CarteCommunication({ c, moi, jour, lectureSeule, modifier, apres, signaler }: {
  c: Communication; moi: string; jour: string; lectureSeule: boolean; modifier?: () => void; apres: () => Promise<void>; signaler: (m: string) => void
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
      {entete && <Box sx={{ mb: 1.5 }}><BanniereEntete piece={entete} /></Box>}
      <Box sx={{ px: 2 }}>
        <Typography variant="h4" component="h2">{c.titre}</Typography>
        {c.html ? <Box sx={{ mt: 1 }}><ContenuMisEnForme html={c.html} /></Box>
          : c.texte && <Typography sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>{c.texte}</Typography>}
        <ListePieces pieces={c.pieces.filter((p) => p !== entete)} />
      </Box>
      <ReactionsCommunication c={c} moi={moi} jour={jour} lectureSeule={lectureSeule} apres={apres} signaler={signaler} />
    </Card>
  )
}

// Communications du réseau : le Directeur et les RR publient ; l'équipe et les franchisés lisent, commentent et réagissent.
// lectureSeule : aperçu de l'espace d'un franchisé par le Directeur
export function PageCommunications({ lectureSeule = false }: { lectureSeule?: boolean }) {
  const { profil } = useAuth()
  const [etat, setEtat] = useState<Communications | null | undefined>(undefined)
  const [edition, setEdition] = useState<Communication | null | undefined>(undefined)
  const [recherche, setRecherche] = useState('')
  const [message, setMessage] = useState('')
  const charger = useCallback(async () => { setEtat(await chargerCommunications()) }, [])
  useEffect(() => { void charger() }, [charger])
  // Arrivée depuis le fil d'activité : la communication citée est amenée à l'écran
  const [params] = useSearchParams()
  const cible = params.get('c')
  const pret = etat !== undefined
  useEffect(() => { if (pret && cible) document.getElementById(`communication-${cible}`)?.scrollIntoView({ block: 'start' }) }, [pret, cible])
  const peutPublier = !lectureSeule && (profil?.role === 'directeur' || profil?.role === 'rr')
  const jour = aujourdhui()
  const q = recherche.trim().toLowerCase()
  const liste = useMemo(() => (etat?.liste ?? []).filter((c) => !q || `${c.titre} ${c.texte} ${c.auteurNom}`.toLowerCase().includes(q)), [etat, q])
  const { visibles, suite } = useParTranches(liste, q)
  const n = etat?.liste.length ?? 0
  return (
    <>
      <PageHeader titre="Communications" sousTitre={etat ? `${n} communication${n > 1 ? 's' : ''}` : undefined} />
      {etat === null ? (
        <EmptyState icone={<CampaignOutlined />} titre="Communications pas encore activées" texte="Les communications du réseau apparaîtront ici dès leur activation dans la base." />
      ) : (
        <>
          <RechercheFiltres recherche={<ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher une communication" />}
            actions={peutPublier ? <BoutonAction libelle="Publier" onClick={() => setEdition(null)} /> : undefined} />
          {etat === undefined ? <Typography variant="body2" color="text.secondary">Chargement…</Typography>
            : !liste.length ? <EmptyState icone={<CampaignOutlined />} titre="Aucune communication" texte={n ? 'Aucune communication ne correspond à cette recherche.' : 'Les annonces du réseau aux franchisés apparaîtront ici.'} />
            : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 720 }}>
                {visibles.map((c) => (
                  <CarteCommunication key={c.id} c={c} moi={etat.moi} jour={jour} lectureSeule={lectureSeule} apres={charger} signaler={setMessage}
                    modifier={peutPublier && c.auteur === etat.moi ? () => setEdition(c) : undefined} />
                ))}
                {suite}
              </Box>
            )}
        </>
      )}
      {edition !== undefined && <DialogCommunication c={edition} onFermer={(m) => { setEdition(undefined); if (m) { setMessage(m); void charger() } }} />}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </>
  )
}
