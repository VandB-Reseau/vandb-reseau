import { useEffect, useState } from 'react'
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

export interface Pouce { userId: string; nom: string }
export interface Commentaire { id: number; auteur: string; auteurNom: string; auteurRole: string; texte: string; creeLe: string }

// « J'aime » et commentaires d'une publication (communication, bonne pratique) : sur sa page et dans le fil d'activité.
// autres : anciens « J'aime » enregistrés par nom, affichés avec les pouces
export function Reactions({ titre, pouces: initiaux, commentaires: tous, autres = [], moi, jour, lectureSeule, basculer, commenter, supprimer, message, apres, signaler }: {
  titre: string; pouces: Pouce[]; commentaires: Commentaire[]; autres?: string[]; moi: string; jour: string; lectureSeule: boolean
  basculer: () => Promise<unknown>; commenter: (texte: string) => Promise<unknown>; supprimer: (id: number) => Promise<unknown>
  message: (e: unknown) => string; apres: () => Promise<void>; signaler: (m: string) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [mesPouces, setPouces] = useState(initiaux)
  useEffect(() => setPouces(initiaux), [initiaux])
  // Commentaires écrits ou retirés ici, affichés sans attendre la relecture de la base
  const [ajoutes, setAjoutes] = useState<Commentaire[]>([])
  const [retires, setRetires] = useState<number[]>([])
  useEffect(() => { setAjoutes([]); setRetires([]) }, [tous])
  const aime = mesPouces.some((p) => p.userId === moi)
  const pouces = [...mesPouces, ...autres.filter((n) => !mesPouces.some((p) => p.nom === n)).map((nom) => ({ userId: '', nom }))]
  // La relecture de la base se fait en arrière-plan, le bouton se libère dès la réponse
  const agir = async (action: () => Promise<unknown>) => {
    setEnvoi(true)
    try { await action(); void apres(); return true } catch (e) { signaler(message(e)); return false } finally { setEnvoi(false) }
  }
  const reagir = async () => {
    setPouces(aime ? mesPouces.filter((p) => p.userId !== moi) : [...mesPouces, { userId: moi, nom: 'Moi' }])
    if (!(await agir(basculer))) setPouces(initiaux)
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, pt: 0.5 }}>
        <Button onClick={() => void reagir()} disabled={lectureSeule || envoi} aria-pressed={aime} startIcon={aime ? <ThumbUp /> : <ThumbUpOutlined />} color={aime ? 'secondary' : 'inherit'} sx={{ minHeight: 48, px: 1.5 }}>
          {pouces.length ? `J’aime · ${pouces.length}` : 'J’aime'}
        </Button>
        <Button onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert} startIcon={<ChatBubbleOutlineOutlined />} color="inherit" sx={{ minHeight: 48, px: 1.5 }}>
          {affiches.length ? `Commenter · ${affiches.length}` : 'Commenter'}
        </Button>
        {pouces.length > 0 && <Typography variant="body2" color="text.secondary" noWrap sx={{ minWidth: 0, display: { xs: 'none', sm: 'block' } }}>{pouces.slice(0, 3).map((p) => p.nom).join(', ')}{pouces.length > 3 ? ` et ${pouces.length - 3} autre${pouces.length > 4 ? 's' : ''}` : ''}</Typography>}
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

