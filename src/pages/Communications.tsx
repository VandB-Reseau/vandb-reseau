import { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import SendOutlined from '@mui/icons-material/SendOutlined'
import ThumbUp from '@mui/icons-material/ThumbUp'
import ThumbUpOutlined from '@mui/icons-material/ThumbUpOutlined'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { Fenetre } from '../components/EditionEquipe'
import { ChampDicte } from '../components/SaisieCompteRendu'
import { ChampPieces, ListePieces } from '../components/Pieces'
import { RechercheFiltres } from '../components/RechercheFiltres'
import { BoutonAction, ChampRecherche } from '../components/Outils'
import { Initiales, useParTranches } from '../components/Social'
import { useAuth } from '../auth/AuthContext'
import { ErreurAction } from '../data/espaceFranchise'
import { quand } from '../data/fil'
import type { Piece } from '../lib/pieces'
import {
  basculerPouce, chargerCommunications, commenter, messageCommunication, publierCommunication, supprimerCommentaire, supprimerCommunication,
  type Communication, type Communications,
} from '../data/communications'

const aujourdhui = () => new Date().toLocaleDateString('sv-SE')
const roles: Record<string, string> = { directeur: 'Directeur de réseau', rr: 'Responsable Régional', coach: 'Coach', franchise: 'Franchisé' }

function DialogCommunication({ c, onFermer }: { c: Communication | null; onFermer: (m?: string) => void }) {
  const [titre, setTitre] = useState(c?.titre ?? '')
  const [texte, setTexte] = useState(c?.texte ?? '')
  const [pieces, setPieces] = useState<Piece[]>(c?.pieces ?? [])
  const [alerte, setAlerte] = useState('')
  const agir = async (action: () => Promise<unknown>, ok: string) => {
    try { await action() } catch (e) { throw new ErreurAction(messageCommunication(e)) }
    return ok
  }
  return (
    <Fenetre large ouvert onFermer={onFermer} valide={!!titre.trim()} titre={c ? 'Modifier la communication' : 'Nouvelle communication'}
      enregistrer={() => agir(() => publierCommunication(c?.id ?? null, titre.trim(), texte.trim(), pieces), c ? 'Communication mise à jour.' : 'Communication publiée.')}
      supprimer={c ? () => agir(() => supprimerCommunication(c.id), 'Communication retirée.') : undefined}
      libelleSuppression={c ? `Retirer « ${c.titre} » ? Les commentaires partent avec.` : undefined}>
      <TextField label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
      <ChampDicte libelle="Message" valeur={texte} changer={setTexte} minRows={5} />
      <ChampPieces pieces={pieces} changer={setPieces} signaler={setAlerte} />
      {alerte && <Typography color="error" variant="body2">{alerte}</Typography>}
    </Fenetre>
  )
}

// Une publication : auteur, titre, texte, pièces jointes, « J'aime » et commentaires
function CarteCommunication({ c, moi, jour, lectureSeule, modifier, apres, signaler }: {
  c: Communication; moi: string; jour: string; lectureSeule: boolean; modifier?: () => void; apres: () => Promise<void>; signaler: (m: string) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [pouces, setPouces] = useState(c.pouces)
  useEffect(() => setPouces(c.pouces), [c.pouces])
  const aime = pouces.some((p) => p.userId === moi)
  const agir = async (action: () => Promise<unknown>) => {
    setEnvoi(true)
    try { await action(); await apres(); return true } catch (e) { signaler(messageCommunication(e)); return false } finally { setEnvoi(false) }
  }
  const reagir = async () => {
    setPouces(aime ? pouces.filter((p) => p.userId !== moi) : [...pouces, { userId: moi, nom: 'Moi' }])
    if (!(await agir(() => basculerPouce(c.id)))) setPouces(c.pouces)
  }
  const envoyer = () => { if (texte.trim()) void agir(async () => { await commenter(c.id, texte.trim()); setTexte('') }) }
  // Repliés : les deux derniers commentaires seulement
  const commentaires = ouvert ? c.commentaires : c.commentaires.slice(-2)
  const cible = c.magasins === null ? 'Tout le réseau' : `${c.magasins.length} magasin${c.magasins.length > 1 ? 's' : ''}`
  return (
    <Card component="article" aria-label={c.titre} sx={{ border: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, pt: 1.5, pb: 1 }}>
        <Initiales nom={c.auteurNom} taille={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }} noWrap>{c.auteurNom}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>{[roles[c.auteurRole], quand(c.creeLe, jour), cible].filter(Boolean).join(' · ')}</Typography>
        </Box>
        {modifier && <Tooltip title="Modifier"><IconButton onClick={modifier} aria-label={`Modifier la communication ${c.titre}`} sx={{ width: 48, height: 48 }}><EditOutlined /></IconButton></Tooltip>}
      </Box>
      <Box sx={{ px: 2 }}>
        <Typography variant="h4" component="h2">{c.titre}</Typography>
        {c.texte && <Typography sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>{c.texte}</Typography>}
        <ListePieces pieces={c.pieces} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, pt: 0.5 }}>
        <Button onClick={() => void reagir()} disabled={lectureSeule || envoi} aria-pressed={aime} startIcon={aime ? <ThumbUp /> : <ThumbUpOutlined />} color={aime ? 'secondary' : 'inherit'} sx={{ minHeight: 48, px: 1.5 }}>
          {pouces.length ? `J’aime · ${pouces.length}` : 'J’aime'}
        </Button>
        <Button onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert} startIcon={<ChatBubbleOutlineOutlined />} color="inherit" sx={{ minHeight: 48, px: 1.5 }}>
          {c.commentaires.length ? `Commenter · ${c.commentaires.length}` : 'Commenter'}
        </Button>
        {pouces.length > 0 && <Typography variant="body2" color="text.secondary" noWrap sx={{ minWidth: 0, display: { xs: 'none', sm: 'block' } }}>{pouces.slice(0, 3).map((p) => p.nom).join(', ')}{pouces.length > 3 ? ` et ${pouces.length - 3} autre${pouces.length > 4 ? 's' : ''}` : ''}</Typography>}
      </Box>
      {(commentaires.length > 0 || ouvert) && (
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {!ouvert && c.commentaires.length > 2 && (
            <Button onClick={() => setOuvert(true)} sx={{ alignSelf: 'flex-start', minHeight: 48, ml: -1 }}>Voir les {c.commentaires.length} commentaires</Button>
          )}
          <Box component="ul" aria-label="Commentaires" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {commentaires.map((k) => (
              <Box component="li" key={k.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Initiales nom={k.auteurNom} taille={32} />
                <Box sx={{ flex: 1, minWidth: 0, bgcolor: 'action.hover', borderRadius: 3, px: 1.5, py: 0.75 }}>
                  <Typography variant="body2"><b>{k.auteurNom}</b> <Box component="span" sx={{ color: 'text.secondary' }}>· {quand(k.creeLe, jour)}</Box></Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{k.texte}</Typography>
                </Box>
                {k.auteur === moi && !lectureSeule && (
                  <Tooltip title="Retirer"><IconButton onClick={() => void agir(() => supprimerCommentaire(k.id))} disabled={envoi} aria-label={`Retirer mon commentaire du ${quand(k.creeLe, jour)}`} sx={{ width: 48, height: 48, mt: -0.5 }}><DeleteOutlined fontSize="small" /></IconButton></Tooltip>
                )}
              </Box>
            ))}
          </Box>
          {ouvert && !lectureSeule && (
            <Box component="form" onSubmit={(e) => { e.preventDefault(); envoyer() }} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField size="small" fullWidth multiline maxRows={4} placeholder="Écrire un commentaire" value={texte} onChange={(e) => setTexte(e.target.value)}
                slotProps={{ htmlInput: { 'aria-label': `Commentaire sur ${c.titre}`, maxLength: 2000 } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, minHeight: 48 } }} />
              <IconButton type="submit" disabled={!texte.trim() || envoi} aria-label="Envoyer le commentaire" sx={{ width: 48, height: 48 }}><SendOutlined /></IconButton>
            </Box>
          )}
        </Box>
      )}
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
