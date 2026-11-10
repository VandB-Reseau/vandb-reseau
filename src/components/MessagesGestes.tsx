// Messagerie, refonte vague 6 (Joseph, 10/11/2026) : gestes sur un message (60A : répondre en citant, réactions,
// modifier, épingler), demande née d'un message (57A), fichiers d'une conversation (63A), message à plusieurs magasins
// et suivi des réponses (62A), contexte du magasin à droite de la conversation (71A).
import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import DoneAllOutlined from '@mui/icons-material/DoneAllOutlined'
import FavoriteBorderOutlined from '@mui/icons-material/FavoriteBorderOutlined'
import PushPin from '@mui/icons-material/PushPin'
import ReplyOutlined from '@mui/icons-material/ReplyOutlined'
import SupportAgentOutlined from '@mui/icons-material/SupportAgentOutlined'
import ThumbUpOutlined from '@mui/icons-material/ThumbUpOutlined'
import { useMessagerie } from '../data/MessagerieContext'
import {
  apercuDe, demandeDepuisMessage, envoisAPlusieurs, envoyerAuxMagasins, libelleReaction, modifierMessage, type GenreReaction, type Message, type Participant,
} from '../data/messagerie'
import { libelleStatutDemande, themesDemande, type Demande, type ThemeDemande } from '../data/demandes'
import { actionsDuMagasin } from '../data/actions'
import { analyser, formatKEuros, formatPourcent, libelleMois } from '../data/chiffres'
import { prochaineVisite } from '../data/motFranchise'
import { visitesDuMagasin } from '../data/visites'
import { visiteFaite, type Magasin, type Reseau } from '../data/modele'
import { suiviEtRR } from '../data/charge'
import { dateCourte, lienFiche } from '../lib/format'
import { ListePieces } from './Pieces'

export const iconeReaction: Record<GenreReaction, typeof DoneAllOutlined> = { vu: DoneAllOutlined, merci: FavoriteBorderOutlined, accord: ThumbUpOutlined }
const extrait = (x: Message, n = 90) => { const t = apercuDe(x).replace(/\s+/g, ' '); return t.length > n ? `${t.slice(0, n - 1)}…` : t }

// Message cité au-dessus du texte d'une réponse ; un clic ramène au message d'origine
export function Citation({ cite, clair, aller }: { cite: Message | undefined; clair: boolean; aller?: () => void }) {
  const contenu = (
    <Box sx={{ borderLeft: '3px solid', borderColor: clair ? 'primary.contrastText' : 'secondary.main', pl: 1, mb: 0.5, opacity: 0.9, textAlign: 'left' }}>
      <Typography variant="caption" component="span" sx={{ display: 'block', fontWeight: 700 }}>{cite ? `Réponse à ${cite.auteurNom}` : 'Réponse à un message supprimé'}</Typography>
      {cite && <Typography variant="body2" component="span" sx={{ display: 'block' }}>{extrait(cite)}</Typography>}
    </Box>
  )
  return cite && aller
    ? <ButtonBase component="span" onClick={(e) => { e.stopPropagation(); aller() }} aria-label={`Voir le message cité de ${cite.auteurNom}`} sx={{ display: 'block', borderRadius: 1 }}>{contenu}</ButtonBase>
    : contenu
}

// Réactions sous la bulle : une puce par réaction, avec le nombre ; un clic pose ou retire la sienne
export function LigneReactions({ x, droite, reagir }: { x: Message; droite: boolean; reagir?: (r: GenreReaction) => void }) {
  if (!x.reactions.length) return null
  const genres = (['vu', 'merci', 'accord'] as GenreReaction[]).filter((g) => x.reactions.some((r) => r.reaction === g))
  return (
    <Box role="group" aria-label="Réactions" sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5, px: 0.5, justifyContent: droite ? 'flex-end' : 'flex-start' }}>
      {genres.map((g) => {
        const l = x.reactions.filter((r) => r.reaction === g)
        const moi = l.some((r) => r.moi)
        const Icone = iconeReaction[g]
        return (
          <Chip key={g} size="small" icon={<Icone sx={{ fontSize: 16 }} />} label={`${libelleReaction[g]} · ${l.length}`} title={l.map((r) => r.nom).join(', ')}
            aria-label={`${libelleReaction[g]} : ${l.map((r) => r.nom).join(', ')}`} aria-pressed={reagir ? moi : undefined}
            onClick={reagir ? () => reagir(g) : undefined} variant={moi ? 'filled' : 'outlined'} color={moi ? 'secondary' : 'default'}
            sx={{ height: 32, fontSize: '0.75rem', bgcolor: moi ? undefined : 'background.paper' }} />
        )
      })}
    </Box>
  )
}

// Bande « Réponse à… » au-dessus de la saisie
export function ReponseEnCours({ x, annuler }: { x: Message; annuler: () => void }) {
  return (
    <Box role="status" aria-label={`Réponse à ${x.auteurNom}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.5, mb: 1, borderLeft: '3px solid', borderColor: 'secondary.main', bgcolor: 'action.hover', borderRadius: 1 }}>
      <ReplyOutlined sx={{ color: 'text.secondary' }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>Réponse à {x.auteurNom}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{extrait(x, 140)}</Typography>
      </Box>
      <IconButton onClick={annuler} aria-label="Ne plus répondre à ce message" sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton>
    </Box>
  )
}

// Messages épinglés en tête de la conversation (les trois plus récents)
export function BandeEpingles({ messages, aller, retirer }: { messages: Message[]; aller: (x: Message) => void; retirer?: (x: Message) => void }) {
  const l = messages.filter((x) => x.epingleLe).sort((a, b) => b.epingleLe.localeCompare(a.epingleLe)).slice(0, 3)
  if (!l.length) return null
  return (
    <Box component="section" aria-label="Messages épinglés" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 1 }}>
      {l.map((x) => (
        <Box key={x.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, borderRadius: 2, bgcolor: 'action.hover', minHeight: 48 }}>
          <PushPin sx={{ fontSize: 18, color: 'secondary.dark' }} />
          <ButtonBase onClick={() => aller(x)} sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', textAlign: 'left', minHeight: 48 }} aria-label={`Message épinglé de ${x.auteurNom} : ${extrait(x, 60)}`}>
            <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <Box component="span" sx={{ fontWeight: 700 }}>{x.auteurNom} : </Box>{extrait(x, 140)}
            </Typography>
          </ButtonBase>
          {retirer && <IconButton onClick={() => retirer(x)} aria-label={`Retirer l’épingle du message de ${x.auteurNom}`} sx={{ width: 48, height: 48 }}><CloseOutlined fontSize="small" /></IconButton>}
        </Box>
      ))}
    </Box>
  )
}

// Modifier son message (15 minutes après l'envoi)
export function DialogModifier({ x, fermer, signaler }: { x: Message; fermer: () => void; signaler: (m: string) => void }) {
  const { signalerChangement } = useMessagerie()
  const [texte, setTexte] = useState(x.texte)
  const [envoi, setEnvoi] = useState(false)
  const valider = async () => {
    setEnvoi(true)
    try { await modifierMessage(x.id, texte.trim()); await signalerChangement(); signaler('Message modifié.'); fermer() }
    catch (e) { signaler(String((e as Error).message).includes('trop_tard') ? 'Ce message ne peut plus être modifié : 15 minutes sont passées.' : 'Modification impossible pour le moment. Réessaie dans un instant.'); setEnvoi(false) }
  }
  return (
    <Dialog open onClose={fermer} fullWidth maxWidth="xs" aria-labelledby="titre-modifier-message">
      <DialogTitle id="titre-modifier-message">Modifier mon message</DialogTitle>
      <DialogContent sx={{ '& .MuiTextField-root': { width: '100%' } }}>
        <TextField label="Message" value={texte} onChange={(e) => setTexte(e.target.value)} multiline minRows={3} autoFocus sx={{ mt: 1 }} slotProps={{ htmlInput: { maxLength: 4000 } }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={fermer} sx={{ minHeight: 48 }}>Annuler</Button>
        <Button variant="contained" onClick={() => void valider()} disabled={envoi || (!texte.trim() && !x.pieces.length) || texte.trim() === x.texte} sx={{ minHeight: 48 }}>Enregistrer</Button>
      </DialogActions>
    </Dialog>
  )
}

// 57A : transformer un message du franchisé en demande au siège (thème, titre)
export function DialogDemande({ x, fermer, signaler }: { x: Message; fermer: (cree?: boolean) => void; signaler: (m: string) => void }) {
  const { signalerChangement } = useMessagerie()
  const [theme, setTheme] = useState<ThemeDemande | ''>('')
  const [titre, setTitre] = useState(() => extrait(x, 80))
  const [envoi, setEnvoi] = useState(false)
  const valider = async () => {
    if (!theme) return
    setEnvoi(true)
    try { await demandeDepuisMessage(x.id, theme, titre.trim()); await signalerChangement(); signaler('Demande créée : elle est suivie dans Demandes.'); fermer(true) }
    catch { signaler('La demande n’a pas pu être créée. Réessaie dans un instant.'); setEnvoi(false) }
  }
  return (
    <Dialog open onClose={() => fermer()} fullWidth maxWidth="xs" aria-labelledby="titre-demande-message">
      <DialogTitle id="titre-demande-message">Transformer en demande</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, '& .MuiTextField-root': { width: '100%' } }}>
        <Typography variant="body2" color="text.secondary">{x.auteurNom} · {x.magasins[0] ?? ''}</Typography>
        <TextField select label="Thème" value={theme} onChange={(e) => setTheme(e.target.value as ThemeDemande)}>
          {themesDemande.map((t) => <MenuItem key={t.v} value={t.v} sx={{ minHeight: 48 }}>{t.libelle}</MenuItem>)}
        </TextField>
        <TextField label="Demande en une ligne" value={titre} onChange={(e) => setTitre(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => fermer()} sx={{ minHeight: 48 }}>Annuler</Button>
        <Button variant="contained" onClick={() => void valider()} disabled={envoi || !theme || !titre.trim()} sx={{ minHeight: 48 }}>Créer la demande</Button>
      </DialogActions>
    </Dialog>
  )
}

// Puce « Demande » sous un message relié à une demande
export function PuceDemande({ d, id }: { d: Demande | undefined; id: number }) {
  return (
    <Chip component={RouterLink} to={`/demandes?demande=${id}`} clickable size="small" icon={<SupportAgentOutlined sx={{ fontSize: 16 }} />}
      label={d ? `Demande · ${libelleStatutDemande[d.statut]}` : 'Demande au siège'} aria-label={d ? `Demande : ${d.titre}, ${libelleStatutDemande[d.statut]}` : 'Voir la demande'}
      sx={{ height: 32, fontSize: '0.75rem', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }} />
  )
}

// 63A : photos et fichiers d'une conversation, du plus récent au plus ancien
export function DialogFichiers({ messages, fermer }: { messages: Message[]; fermer: () => void }) {
  const avec = [...messages].filter((x) => x.pieces.length).reverse()
  return (
    <Dialog open onClose={fermer} fullWidth maxWidth="sm" aria-labelledby="titre-fichiers">
      <DialogTitle id="titre-fichiers" sx={{ display: 'flex', alignItems: 'center' }}>
        <Box component="span" sx={{ flex: 1 }}>Fichiers et photos</Box>
        <IconButton onClick={fermer} aria-label="Fermer" sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton>
      </DialogTitle>
      <DialogContent>
        {!avec.length
          ? <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Aucune photo ni aucun fichier dans cette conversation.</Typography>
          : (
            <Box component="ul" aria-label="Fichiers et photos" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {avec.map((x) => (
                <Box component="li" key={x.id}>
                  <Typography variant="caption" color="text.secondary">{x.auteurNom} · {dateCourte(x.creeLe.slice(0, 10))}</Typography>
                  <ListePieces pieces={x.pieces} />
                </Box>
              ))}
            </Box>
          )}
      </DialogContent>
    </Dialog>
  )
}

// Membres d'une conversation (dans le menu de l'en-tête depuis 71A)
export function DialogMembres({ membres, fermer }: { membres: Participant[]; fermer: () => void }) {
  return (
    <Dialog open onClose={fermer} fullWidth maxWidth="xs" aria-labelledby="titre-membres">
      <DialogTitle id="titre-membres" sx={{ display: 'flex', alignItems: 'center' }}>
        <Box component="span" sx={{ flex: 1 }}>Membres · {membres.length}</Box>
        <IconButton onClick={fermer} aria-label="Fermer" sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Box component="ul" aria-label="Membres" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {membres.map((p) => (
            <Box component="li" key={p.cle}><Typography sx={{ fontWeight: 600 }}>{p.nom}</Typography><Typography variant="body2" color="text.secondary">{p.role}</Typography></Box>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  )
}

// 62A : message à plusieurs magasins, dans le fil « Avec le franchisé » de chacun ; « {prénom} » remplacé par la base
export function DialogPlusieursMagasins({ magasins, initiaux = [], texteInitial = '', fermer, signaler }: {
  magasins: Magasin[]; initiaux?: string[]; texteInitial?: string; fermer: () => void; signaler: (m: string) => void
}) {
  const { signalerChangement } = useMessagerie()
  const [choisis, setChoisis] = useState<Magasin[]>(() => magasins.filter((m) => initiaux.includes(m.nom)))
  const [texte, setTexte] = useState(texteInitial)
  const [envoi, setEnvoi] = useState(false)
  const valider = async () => {
    setEnvoi(true)
    try {
      await envoyerAuxMagasins(choisis.map((m) => m.nom), texte.trim())
      await signalerChangement()
      signaler(`Message envoyé à ${choisis.length} magasin${choisis.length > 1 ? 's' : ''}.`)
      fermer()
    } catch { signaler('Message non envoyé. Réessaie dans un instant.'); setEnvoi(false) }
  }
  return (
    <Dialog open onClose={fermer} fullWidth maxWidth="sm" aria-labelledby="titre-plusieurs-magasins">
      <DialogTitle id="titre-plusieurs-magasins">Message à plusieurs magasins</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, '& .MuiTextField-root': { width: '100%' } }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', pt: 1 }}>
          <Button variant="outlined" onClick={() => setChoisis(magasins)} sx={{ minHeight: 48 }}>Tous mes magasins · {magasins.length}</Button>
          {choisis.length > 0 && <Button onClick={() => setChoisis([])} sx={{ minHeight: 48 }}>Tout retirer</Button>}
        </Box>
        <Autocomplete multiple options={magasins} value={choisis} onChange={(_e, v) => setChoisis(v)} getOptionLabel={(m) => m.nom} isOptionEqualToValue={(a, b) => a.nom === b.nom}
          filterSelectedOptions disableCloseOnSelect limitTags={8} renderInput={(p) => <TextField {...p} label={`Magasins · ${choisis.length}`} />} />
        <TextField label="Message" value={texte} onChange={(e) => setTexte(e.target.value)} multiline minRows={4} slotProps={{ htmlInput: { maxLength: 4000 } }} />
        <Box><Button onClick={() => setTexte((t) => `${t}${t && !/\s$/.test(t) ? ' ' : ''}{prénom}`)} sx={{ minHeight: 48 }}>Insérer le prénom du franchisé</Button></Box>
        <Typography variant="body2" color="text.secondary">Chaque franchisé reçoit le message dans la conversation de son magasin et y répond.</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={fermer} sx={{ minHeight: 48 }}>Annuler</Button>
        <Button variant="contained" onClick={() => void valider()} disabled={envoi || !choisis.length || !texte.trim()} sx={{ minHeight: 48 }}>
          {choisis.length ? `Envoyer à ${choisis.length} magasin${choisis.length > 1 ? 's' : ''}` : 'Envoyer'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// 62A : suivi des envois à plusieurs magasins (qui a répondu), relance des autres
export function DialogEnvois({ magasins, fermer, signaler }: { magasins: Magasin[]; fermer: () => void; signaler: (m: string) => void }) {
  const { messagerie } = useMessagerie()
  const envois = useMemo(() => (messagerie ? envoisAPlusieurs(messagerie) : []), [messagerie])
  const [relance, setRelance] = useState<{ magasins: string[]; texte: string } | null>(null)
  if (relance) return <DialogPlusieursMagasins magasins={magasins} initiaux={relance.magasins} texteInitial={relance.texte} fermer={fermer} signaler={signaler} />
  return (
    <Dialog open onClose={fermer} fullWidth maxWidth="sm" aria-labelledby="titre-envois">
      <DialogTitle id="titre-envois" sx={{ display: 'flex', alignItems: 'center' }}>
        <Box component="span" sx={{ flex: 1 }}>Mes envois à plusieurs magasins</Box>
        <IconButton onClick={fermer} aria-label="Fermer" sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton>
      </DialogTitle>
      <DialogContent>
        {!envois.length
          ? <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Aucun envoi à plusieurs magasins pour le moment.</Typography>
          : (
            <Box component="ul" aria-label="Envois" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {envois.map((e) => {
                const attente = e.magasins.filter((n) => !e.repondu.includes(n))
                return (
                  <Box component="li" key={e.lot} aria-label={`Envoi du ${dateCourte(e.message.creeLe.slice(0, 10))}`} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">{dateCourte(e.message.creeLe.slice(0, 10))}</Typography>
                    <Typography variant="body2">{extrait(e.message, 160)}</Typography>
                    <Typography sx={{ fontWeight: 700 }}>Répondu : {e.repondu.length} sur {e.magasins.length}</Typography>
                    {attente.length > 0 && <Typography variant="body2" color="text.secondary">Sans réponse : {attente.join(', ')}</Typography>}
                    {attente.length > 0 && (
                      <Box><Button variant="outlined" onClick={() => setRelance({ magasins: attente, texte: '' })} sx={{ minHeight: 48 }}>
                        Relancer les {attente.length} sans réponse
                      </Button></Box>
                    )}
                  </Box>
                )
              })}
            </Box>
          )}
      </DialogContent>
    </Dialog>
  )
}

function Ligne({ libelle, valeur, couleur }: { libelle: string; valeur: string; couleur?: string }) {
  return (
    <Box component="li" sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary">{libelle}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, color: couleur, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{valeur}</Typography>
    </Box>
  )
}

// 71A : à droite de la conversation d'un magasin, ce qui aide à répondre (jamais de comparaison au réseau)
export function ContexteMagasin({ reseau, m, demandes, equipe }: { reseau: Reseau; m: Magasin; demandes: Demande[]; equipe: boolean }) {
  const a = analyser(reseau, m.nom)
  const derniere = visitesDuMagasin(reseau, m.nom).find((v) => visiteFaite(v, reseau.jour) && !['appel', 'point'].includes(v.type))
  const prochaine = prochaineVisite(reseau, m.nom)
  const taches = actionsDuMagasin(reseau, m.nom).filter((x) => !x.a.faite && (equipe || x.libre?.fil !== 'equipe')).length
  const ouvertes = demandes.filter((d) => d.magasin === m.nom && d.statut !== 'resolue').length
  return (
    <Card component="aside" aria-label={`Contexte : ${m.nom}`} sx={{ p: 2, display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', gap: 1, overflowY: 'auto', minHeight: 0 }}>
      <Typography variant="h3" component="h3" sx={{ fontSize: '1.125rem' }}>{m.nom}</Typography>
      <Typography variant="body2" color="text.secondary">{suiviEtRR(m)}</Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {a && a.ca !== null && <Ligne libelle={`CA ${libelleMois(a.mois)}`} valeur={formatKEuros(a.ca)} />}
        {a && a.ecart !== null && <Ligne libelle="Face à l’an dernier" valeur={formatPourcent(a.ecart)} couleur={a.ecart < 0 ? 'error.main' : undefined} />}
        <Ligne libelle="Dernière visite" valeur={derniere ? dateCourte(derniere.date) : 'Aucune'} />
        <Ligne libelle="Prochaine visite" valeur={prochaine ? dateCourte(prochaine.date) : 'Pas encore prévue'} />
        <Ligne libelle="Tâches ouvertes" valeur={String(taches)} />
        <Ligne libelle="Demandes ouvertes" valeur={String(ouvertes)} />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
        <Button component={RouterLink} to={lienFiche(m.nom)} variant="outlined" sx={{ minHeight: 48 }}>Ouvrir la fiche</Button>
        {ouvertes > 0 && <Button component={RouterLink} to={`/demandes?q=${encodeURIComponent(m.nom)}`} sx={{ minHeight: 48 }}>Voir les demandes</Button>}
      </Box>
    </Card>
  )
}
