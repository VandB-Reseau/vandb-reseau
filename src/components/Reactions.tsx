import { useEffect, useRef, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import SendOutlined from '@mui/icons-material/SendOutlined'
import ThumbUp from '@mui/icons-material/ThumbUp'
import ThumbUpOutlined from '@mui/icons-material/ThumbUpOutlined'
import { Initiales } from './Social'
import { quand } from '../data/fil'
import { BoutonDictee } from './Dictee'

const DELAI_JAIME = 15000

export interface Pouce { userId: string; nom: string }
export interface Commentaire { id: number; auteur: string; auteurNom: string; auteurRole: string; texte: string; creeLe: string }

// « J'aime » et commentaires d'une publication (communication, bonne pratique) : sur sa page et dans le fil d'activité.
// autres : anciens « J'aime » enregistrés par nom, affichés avec les pouces
// Barre façon réseau social (206A, Joseph 15/11/2026) : le décompte au-dessus (« 3 J'aime · 2 commentaires »), puis des
// boutons simples de même largeur ; extra : un troisième geste propre à la publication (prise de connaissance)
export function Reactions({ titre, pouces: initiaux, commentaires: tous, autres = [], moi, jour, lectureSeule, basculer, commenter, supprimer, message, apres, signaler, extra }: {
  titre: string; pouces: Pouce[]; commentaires: Commentaire[]; autres?: string[]; moi: string; jour: string; lectureSeule: boolean; extra?: ReactNode
  basculer: () => Promise<unknown>; commenter: (texte: string) => Promise<unknown>; supprimer: (id: number) => Promise<unknown>
  message: (e: unknown) => string; apres: () => Promise<void>; signaler: (m: string) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)
  // « J'aime » (bug du J'aime retiré, Joseph 17/11/2026) : le bouton ne se grise plus pendant l'envoi. Il change tout de
  // suite ; les gestes rapides se rattrapent par une seule file d'envois vers l'état voulu, et une réponse qui ne vient pas
  // (réseau du téléphone) libère le bouton au bout de 15 s au lieu de le laisser bloqué.
  const aimeBase = initiaux.some((p) => p.userId === moi)
  const [aimeVoulu, setAimeVoulu] = useState<boolean | null>(null)
  const voulu = useRef(false)
  const enCours = useRef(false)
  // État connu de la base entre la fin des envois et sa relecture (null : la base relue fait foi)
  const serveur = useRef<boolean | null>(null)
  const aime = aimeVoulu ?? aimeBase
  const mesPouces = aime === aimeBase ? initiaux : aime ? [...initiaux, { userId: moi, nom: 'Moi' }] : initiaux.filter((p) => p.userId !== moi)
  const pouces = [...mesPouces, ...autres.filter((n) => !mesPouces.some((p) => p.nom === n)).map((nom) => ({ userId: '', nom }))]
  const reagir = async () => {
    voulu.current = !aime
    setAimeVoulu(voulu.current)
    if (enCours.current) return
    enCours.current = true
    let etat = serveur.current ?? aimeBase
    try {
      while (etat !== voulu.current) {
        const r = await Promise.race([basculer(), new Promise((_, non) => setTimeout(() => non(new Error('delai')), DELAI_JAIME))])
        etat = typeof r === 'boolean' ? r : !etat
      }
      serveur.current = etat
    } catch (e) { serveur.current = null; signaler(message(e)) }
    enCours.current = false
    // La base relue fait foi ; un nouveau geste pendant la relecture garde la main
    await apres().catch(() => undefined)
    if (!enCours.current) { serveur.current = null; setAimeVoulu(null) }
  }
  // Commentaires écrits ou retirés ici, affichés sans attendre la relecture de la base
  const [ajoutes, setAjoutes] = useState<Commentaire[]>([])
  const [retires, setRetires] = useState<number[]>([])
  useEffect(() => { setAjoutes([]); setRetires([]) }, [tous])
  // La relecture de la base se fait en arrière-plan, le bouton se libère dès la réponse
  const agir = async (action: () => Promise<unknown>) => {
    setEnvoi(true)
    try { await action(); void apres(); return true } catch (e) { signaler(message(e)); return false } finally { setEnvoi(false) }
  }
  const envoyer = () => {
    const t = texte.trim()
    if (t) void agir(async () => { await commenter(t); setTexte(''); setAjoutes((a) => [...a, { id: -Date.now(), auteur: moi, auteurNom: 'Moi', auteurRole: '', texte: t, creeLe: new Date().toISOString() }]) })
  }
  const retirer = (id: number) => {
    setRetires((r) => [...r, id])
    void agir(() => supprimer(id)).then((ok) => { if (!ok) setRetires((r) => r.filter((x) => x !== id)) })
  }
  const affiches = [...tous, ...ajoutes].filter((k) => !retires.includes(k.id))
  // Repliés : les deux derniers commentaires seulement
  const commentaires = ouvert ? affiches : affiches.slice(-2)
  return (
    <>
      {(pouces.length > 0 || affiches.length > 0) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1, minWidth: 0 }}>
          {pouces.length > 0 && (
            <Typography variant="body2" color="text.secondary" noWrap title={pouces.map((p) => p.nom).join(', ')} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1 }}>
              <Box component="span" sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: 'secondary.main', color: 'secondary.contrastText', display: 'inline-grid', placeItems: 'center', flexShrink: 0 }}><ThumbUp sx={{ fontSize: 12 }} /></Box>
              {pouces.length} J’aime
            </Typography>
          )}
          {affiches.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto', whiteSpace: 'nowrap' }}>{affiches.length} commentaire{affiches.length > 1 ? 's' : ''}</Typography>
          )}
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'stretch', mx: 1, mt: 0.5, borderTop: '1px solid', borderColor: 'divider', '& > *': { flex: 1, minHeight: 48 } }}>
        <Button onClick={() => void reagir()} disabled={lectureSeule} aria-pressed={aime} startIcon={aime ? <ThumbUp /> : <ThumbUpOutlined />} color={aime ? 'secondary' : 'inherit'} sx={{ px: 1, minHeight: 48 }}>
          J’aime
        </Button>
        <Button onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert} startIcon={<ChatBubbleOutlineOutlined />} color="inherit" sx={{ px: 1, minHeight: 48 }}>
          Commenter
        </Button>
        {extra}
      </Box>
      {(commentaires.length > 0 || ouvert) && (
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {!ouvert && affiches.length > 2 && (
            <Button onClick={() => setOuvert(true)} sx={{ alignSelf: 'flex-start', minHeight: 48, ml: -1 }}>Voir les {affiches.length} commentaires</Button>
          )}
          <Box component="ul" aria-label="Commentaires" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {commentaires.map((k) => (
              <Box component="li" key={k.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Initiales nom={k.auteurNom} taille={32} />
                <Box sx={{ flex: 1, minWidth: 0, bgcolor: 'action.hover', borderRadius: 3, px: 1.5, py: 0.75 }}>
                  <Typography variant="body2"><b>{k.auteurNom}</b> <Box component="span" sx={{ color: 'text.secondary' }}>· {quand(k.creeLe, jour)}</Box></Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{k.texte}</Typography>
                </Box>
                {k.auteur === moi && !lectureSeule && k.id > 0 && (
                  <Tooltip title="Retirer"><IconButton onClick={() => retirer(k.id)} disabled={envoi} aria-label={`Retirer mon commentaire du ${quand(k.creeLe, jour)}`} sx={{ width: 48, height: 48, mt: -0.5 }}><DeleteOutlined fontSize="small" /></IconButton></Tooltip>
                )}
              </Box>
            ))}
          </Box>
          {ouvert && !lectureSeule && (
            <Box component="form" onSubmit={(e) => { e.preventDefault(); envoyer() }} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField size="small" fullWidth multiline maxRows={4} placeholder="Écrire un commentaire" value={texte} onChange={(e) => setTexte(e.target.value)}
                slotProps={{ htmlInput: { 'aria-label': `Commentaire sur ${titre}`, maxLength: 2000 }, input: { endAdornment: <BoutonDictee libelle="Commentaire" changer={setTexte} /> } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, minHeight: 48 } }} />
              <IconButton type="submit" disabled={!texte.trim() || envoi} aria-label="Envoyer le commentaire" sx={{ width: 48, height: 48 }}><SendOutlined /></IconButton>
            </Box>
          )}
        </Box>
      )}
    </>
  )
}


// Pendant la lecture des « J'aime » (Joseph, 24/11/2026) : la carte du fil montre déjà sa barre « J'aime » / « Commenter »,
// inactive, au lieu d'un autre bouton remplacé une seconde plus tard
export function ReactionsEnAttente() {
  return (
    <Box aria-busy="true" sx={{ display: 'flex', alignItems: 'stretch', mx: 1, mt: 0.5, borderTop: '1px solid', borderColor: 'divider', '& > *': { flex: 1, minHeight: 48 } }}>
      <Button disabled startIcon={<ThumbUpOutlined />} sx={{ px: 1, minHeight: 48 }}>J’aime</Button>
      <Button disabled startIcon={<ChatBubbleOutlineOutlined />} sx={{ px: 1, minHeight: 48 }}>Commenter</Button>
    </Box>
  )
}
