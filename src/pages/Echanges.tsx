// Onglet Échanges (Joseph, 21/10/2026) : Discussions (canal Réseau, groupes des magasins, groupes libres, échanges à deux)
// et Mes tâches. Téléphone : la liste, puis la conversation en plein écran ; PC : la liste à gauche, la conversation à droite.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link as RouterLink, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AlternateEmail from '@mui/icons-material/AlternateEmail'
import ArrowBack from '@mui/icons-material/ArrowBack'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import LogoutOutlined from '@mui/icons-material/LogoutOutlined'
import MoreVert from '@mui/icons-material/MoreVert'
import PersonOutlined from '@mui/icons-material/PersonOutlined'
import PushPinOutlined from '@mui/icons-material/PushPinOutlined'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import { DialogPratique, VuePratiques } from '../components/BonnesPratiques'
import type { BonnePratique } from '../data/bonnesPratiques'
import { useAuth } from '../auth/AuthContext'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { Fenetre } from '../components/EditionEquipe'
import { FilMessages } from '../components/Messages'
import { BoutonAction, BoutonOutil, Bulle, ChampRecherche } from '../components/Outils'
import { PageHeader } from '../components/PageHeader'
import { initialesDe } from '../components/Social'
import { useMessagerie } from '../data/MessagerieContext'
import { actionsDuMagasin, actionsDes, monNomPorteur, portePar } from '../data/actions'
import { communicationsNonVues, magasinsDesEchanges, noterReseauVu, useReseauVu } from '../data/echanges'
import { useCommunicationsDuFil } from '../data/communications'
import {
  apercuDe, conversations, creerGroupe, heureCourte, mesCles, modifierGroupe, nomDe, participants, quitterGroupe, roleDeCle, sansPrives, supprimerGroupe,
  type Conversation, type Fil, type Groupe, type Messagerie, type Participant,
} from '../data/messagerie'
import type { Reseau } from '../data/modele'
import { dateCourte, lienFiche } from '../lib/format'
import { PageCommunications } from './Communications'
import { PageTaches } from './Taches'

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr')

// Avatar d'une conversation : carré noir et or pour un magasin, icône pour un groupe libre, rond pour une personne
function AvatarConversation({ c, taille = 48 }: { c: Pick<Conversation, 'genre' | 'titre'>; taille?: number }) {
  if (c.genre === 'groupe') return <Avatar variant="rounded" sx={{ width: taille, height: taille, borderRadius: 3, bgcolor: 'info.main', color: 'info.contrastText' }}><GroupsOutlined /></Avatar>
  if (c.genre === 'magasin') return <Avatar variant="rounded" sx={{ width: taille, height: taille, borderRadius: 3, bgcolor: '#1b1b1f', color: '#eaa400', fontWeight: 700, fontSize: '0.9375rem' }}>{initialesDe(c.titre)}</Avatar>
  return <Avatar sx={{ width: taille, height: taille, bgcolor: 'action.selected', color: 'text.primary', fontWeight: 600, fontSize: '0.9375rem' }}>{initialesDe(c.titre)}</Avatar>
}

function Pastille({ n, fort }: { n: number; fort: boolean }) {
  return <Box aria-hidden sx={{ flexShrink: 0, minWidth: 22, height: 22, px: 0.75, borderRadius: 999, bgcolor: fort ? 'error.main' : 'action.selected', color: fort ? 'error.contrastText' : 'text.primary', fontSize: '0.75rem', fontWeight: 700, display: 'grid', placeItems: 'center' }}>{n > 99 ? '99+' : n}</Box>
}

function LigneEchange({ c, mg, actif, ouvrir }: { c: Conversation; mg: Messagerie; actif: boolean; ouvrir: () => void }) {
  const d = c.dernier
  const qui = d ? (d.auteur === mg.moi ? 'Moi : ' : c.genre === 'personne' ? '' : `${d.auteurNom.split(' ')[0]} : `) : ''
  const apercu = d ? `${d.equipe ? 'Équipe · ' : ''}${qui}${apercuDe(d)}` : c.detail
  const fort = c.nonLus > 0
  return (
    <ListItemButton selected={actif} onClick={ouvrir} aria-current={actif ? 'true' : undefined}
      aria-label={`${c.titre}${fort ? ` : ${c.nonLus} message${c.nonLus > 1 ? 's' : ''} non lu${c.nonLus > 1 ? 's' : ''}` : ''}${c.mention ? ', on te cite' : ''}`}
      sx={{ borderRadius: 3, mx: 1, mb: 0.25, minHeight: 72, gap: 1.5, alignItems: 'center' }}>
      <AvatarConversation c={c} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="body1" sx={{ flex: 1, minWidth: 0, fontWeight: fort ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titre}</Typography>
          {d && <Typography variant="caption" color={c.pourMoi ? 'error.main' : 'text.secondary'} sx={{ flexShrink: 0, fontWeight: fort ? 600 : 400 }}>{heureCourte(d.creeLe)}</Typography>}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {c.mention && <AlternateEmail aria-label="On te cite" sx={{ fontSize: 18, color: 'error.main' }} />}
          <Typography variant="body2" color={fort ? 'text.primary' : 'text.secondary'} sx={{ flex: 1, minWidth: 0, fontWeight: fort ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apercu}</Typography>
          {fort && <Pastille n={c.nonLus} fort={c.pourMoi > 0} />}
        </Box>
      </Box>
    </ListItemButton>
  )
}

// Canal « Réseau V and B » épinglé en tête : les communications du réseau
function LigneReseau({ actif, ouvrir, nonVues, dernier }: { actif: boolean; ouvrir: () => void; nonVues: number; dernier?: { titre: string; creeLe: string } }) {
  return (
    <ListItemButton selected={actif} onClick={ouvrir} aria-label={`Réseau V and B${nonVues ? ` : ${nonVues} nouvelle${nonVues > 1 ? 's' : ''} communication${nonVues > 1 ? 's' : ''}` : ''}`}
      sx={{ borderRadius: 3, mx: 1, mb: 0.25, minHeight: 72, gap: 1.5, alignItems: 'center', bgcolor: actif ? undefined : 'action.hover' }}>
      <Avatar variant="rounded" sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: '#ef7d00', color: '#1b1b1f' }}><CampaignOutlined /></Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography variant="body1" sx={{ fontWeight: nonVues ? 700 : 600 }}>Réseau V and B</Typography>
          <PushPinOutlined aria-label="Épinglé" sx={{ fontSize: 16, color: 'text.secondary' }} />
          {dernier && <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', flexShrink: 0 }}>{heureCourte(dernier.creeLe)}</Typography>}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color={nonVues ? 'text.primary' : 'text.secondary'} sx={{ flex: 1, minWidth: 0, fontWeight: nonVues ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dernier?.titre ?? 'Communications du réseau'}</Typography>
          {nonVues > 0 && <Pastille n={nonVues} fort />}
        </Box>
      </Box>
    </ListItemButton>
  )
}

// Canal « Bonnes pratiques » épinglé sous le Réseau : les initiatives réussies de tout le réseau (équipe seulement)
function LignePratiques({ actif, ouvrir, derniere }: { actif: boolean; ouvrir: () => void; derniere?: BonnePratique }) {
  return (
    <ListItemButton selected={actif} onClick={ouvrir} aria-label="Bonnes pratiques"
      sx={{ borderRadius: 3, mx: 1, mb: 0.25, minHeight: 72, gap: 1.5, alignItems: 'center', bgcolor: actif ? undefined : 'action.hover' }}>
      <Avatar variant="rounded" sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: '#8bc34a', color: '#1b1b1f' }}><TipsAndUpdatesOutlined /></Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>Bonnes pratiques</Typography>
          <PushPinOutlined aria-label="Épinglé" sx={{ fontSize: 16, color: 'text.secondary' }} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {derniere ? `${derniere.titre} · ${derniere.magasin}` : 'Initiatives réussies des magasins'}
        </Typography>
      </Box>
    </ListItemButton>
  )
}

// Personnes qu'on peut ajouter à un groupe libre : l'équipe, et les franchisés de ses magasins
function invitables(reseau: Reseau, magasins: Reseau['magasins'], moi: string[]): Participant[] {
  const l = new Map<string, Participant>()
  const ajouter = (p: Participant) => { if (p.nom.trim() && !moi.includes(p.cle) && !l.has(p.cle)) l.set(p.cle, p) }
  if (reseau.directeur?.nom) ajouter({ cle: 'directeur', nom: reseau.directeur.nom, role: 'Directeur de réseau' })
  for (const r of reseau.rrs) ajouter({ cle: `rr:${r.id}`, nom: r.nom, role: r.integres ? 'Responsable Magasins Intégrés' : 'Responsable Régional' })
  const coachs = new Set([...Object.keys(reseau.coachs ?? {}), ...reseau.magasins.map((m) => m.coach).filter((c): c is string => !!c)])
  for (const c of coachs) ajouter({ cle: `coach:${c}`, nom: c, role: 'Coach' })
  for (const m of magasins) for (const p of participants(reseau, m)) if (p.cle.startsWith('franchise:')) ajouter({ ...p, role: 'Franchisé' })
  return [...l.values()].sort((a, b) => a.role.localeCompare(b.role, 'fr') || a.nom.localeCompare(b.nom, 'fr'))
}

function DialogGroupe({ reseau, magasins, groupe, onFermer }: { reseau: Reseau; magasins: Reseau['magasins']; groupe: Groupe | null; onFermer: (msg?: string, id?: number) => void }) {
  const { profil } = useAuth()
  const { messagerie, recharger } = useMessagerie()
  const moi = mesCles(profil)
  const moiCle = moi.join('|')
  const options = useMemo(() => {
    const l = invitables(reseau, magasins, moi)
    // Membres déjà présents qu'on ne pourrait plus inviter : gardés
    for (const k of groupe?.membres ?? []) if (!moi.includes(k) && !l.some((p) => p.cle === k)) l.push({ cle: k, nom: nomDe(reseau, k), role: roleDeCle(k) })
    return l
  }, [reseau, magasins, groupe, moiCle]) // eslint-disable-line react-hooks/exhaustive-deps
  const [nom, setNom] = useState(groupe?.nom ?? '')
  const [membres, setMembres] = useState<Participant[]>(() => options.filter((p) => groupe?.membres.includes(p.cle)))
  // Lu à la fermeture, après l'enregistrement : une référence, pas un état
  const cree = useRef<number | undefined>(undefined)
  const garderMoi = groupe ? groupe.membres.filter((k) => moi.includes(k)) : []
  return (
    <Fenetre titre={groupe ? 'Modifier le groupe' : 'Nouveau groupe'} ouvert sansRechargement onFermer={(msg) => onFermer(msg, cree.current)}
      valide={!!nom.trim() && membres.length > 0}
      enregistrer={async () => {
        if (groupe) await modifierGroupe(groupe.id, nom.trim(), [...garderMoi, ...membres.map((p) => p.cle)])
        else cree.current = await creerGroupe(nom.trim(), membres.map((p) => p.cle))
        await recharger()
        return groupe ? 'Groupe mis à jour.' : 'Groupe créé.'
      }}
      supprimer={groupe && messagerie ? async () => { await supprimerGroupe(groupe.id); await recharger(); return 'Groupe supprimé.' } : undefined}
      libelleSuppression={groupe ? `Supprimer le groupe « ${groupe.nom} » et ses messages ?` : undefined}>
      <TextField label="Nom du groupe" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus={!groupe} slotProps={{ htmlInput: { maxLength: 80 } }} />
      <Autocomplete multiple options={options} value={membres} onChange={(_e, v) => setMembres(v)} groupBy={(p) => p.role}
        getOptionLabel={(p) => p.nom} isOptionEqualToValue={(a, b) => a.cle === b.cle} filterSelectedOptions disableCloseOnSelect
        renderInput={(p) => <TextField {...p} label="Membres" />} />
    </Fenetre>
  )
}

// Nouveau message à une personne : cherchée par nom ou magasin
function NouveauMessage({ lignes, ouvrir, fermer }: { lignes: Conversation[]; ouvrir: (lien: string) => void; fermer: () => void }) {
  const [recherche, setRecherche] = useState('')
  const q = sansAccents(recherche.trim())
  const trouvees = lignes.filter((l) => l.genre === 'personne' && (!q || sansAccents(l.recherche).includes(q))).sort((a, b) => a.titre.localeCompare(b.titre, 'fr'))
  return (
    <Dialog open onClose={fermer} aria-labelledby="titre-nouveau-message" fullWidth maxWidth="xs">
      <DialogTitle id="titre-nouveau-message">Message à une personne</DialogTitle>
      <DialogContent sx={{ px: 2, pb: 2, '& .MuiTextField-root': { width: '100%' } }}>
        <ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Personne ou magasin" />
        {trouvees.length
          ? <List aria-label="Personnes" disablePadding sx={{ mt: 1, mx: -1 }}>{trouvees.map((l) => (
            <ListItemButton key={l.cle} onClick={() => { fermer(); ouvrir(l.lien) }} sx={{ borderRadius: 3, minHeight: 64, gap: 1.5 }}>
              <AvatarConversation c={l} taille={40} />
              <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 600 }}>{l.titre}</Typography><Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.detail}</Typography></Box>
            </ListItemButton>
          ))}</List>
          : <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Personne ne correspond à cette recherche.</Typography>}
      </DialogContent>
    </Dialog>
  )
}

const PETITE_LISTE = 30

function ListeDiscussions({ reseau, lignes, mg, actif, ouvrir, ecrire, peutCreerGroupe, magasins, signaler, pratiques }: {
  reseau: Reseau; lignes: Conversation[]; mg: Messagerie; actif?: string; ouvrir: (lien: string) => void; ecrire: boolean; peutCreerGroupe: boolean; magasins: Reseau['magasins']; signaler: (m: string) => void; pratiques: boolean
}) {
  const [recherche, setRecherche] = useState('')
  const [nonLus, setNonLus] = useState(false)
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const [nouveau, setNouveau] = useState<'personne' | 'groupe' | null>(null)
  const communications = useCommunicationsDuFil()
  const vu = useReseauVu()
  const nonVues = communicationsNonVues(communications.liste, communications.moi, vu)
  const q = sansAccents(recherche.trim())
  // Sans recherche : les conversations en cours (tout quand la liste est courte) ; avec recherche : tout, pour en démarrer une
  const toutes = lignes.length <= PETITE_LISTE
  const affichees = lignes.filter((l) => (q ? sansAccents(l.recherche).includes(q) : toutes || !!l.dernier || l.genre === 'groupe') && (!nonLus || l.nonLus > 0))
  const aLire = lignes.filter((l) => l.nonLus > 0).length
  const dernier = communications.liste[0]
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <Box sx={{ px: { xs: 0, md: 2 }, pt: { xs: 0, md: 2 }, pb: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 0, '& .MuiTextField-root': { width: '100%' } }}>
          <ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Magasin, personne, groupe" />
        </Box>
        <Chip label={aLire ? `Non lus · ${aLire}` : 'Non lus'} onClick={() => setNonLus((v) => !v)} aria-pressed={nonLus}
          color={nonLus ? 'primary' : 'default'} variant={nonLus ? 'filled' : 'outlined'} sx={{ height: 48, borderRadius: 999, fontSize: '0.875rem' }} />
        {ecrire && <BoutonOutil libelle="Nouvelle conversation" icone={<EditOutlined />} onClick={(e) => (peutCreerGroupe ? setMenu(e.currentTarget) : setNouveau('personne'))} plein />}
      </Box>
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem onClick={() => { setMenu(null); setNouveau('personne') }} sx={{ minHeight: 48 }}><ListItemIcon><PersonOutlined /></ListItemIcon>Message à une personne</MenuItem>
        <MenuItem onClick={() => { setMenu(null); setNouveau('groupe') }} sx={{ minHeight: 48 }}><ListItemIcon><GroupsOutlined /></ListItemIcon>Nouveau groupe</MenuItem>
      </Menu>
      {nouveau === 'personne' && <NouveauMessage lignes={lignes} ouvrir={ouvrir} fermer={() => setNouveau(null)} />}
      {nouveau === 'groupe' && <DialogGroupe reseau={reseau} magasins={magasins} groupe={null} onFermer={(msg, id) => { setNouveau(null); if (msg) signaler(msg); if (id) ouvrir(`/echanges/groupe/${id}`) }} />}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: { md: 'auto' }, mx: { xs: -1, md: 0 }, pb: 1 }}>
        <List aria-label="Conversations" disablePadding>
          {!q && !nonLus && <LigneReseau actif={actif === 'reseau'} ouvrir={() => ouvrir('/echanges/reseau')} nonVues={nonVues} dernier={dernier} />}
          {!q && nonLus && nonVues > 0 && <LigneReseau actif={actif === 'reseau'} ouvrir={() => ouvrir('/echanges/reseau')} nonVues={nonVues} dernier={dernier} />}
          {!q && !nonLus && pratiques && <LignePratiques actif={false} ouvrir={() => ouvrir('/echanges/pratiques')} derniere={reseau.pratiques.reduce<BonnePratique | undefined>((d, p) => (!d || p.date > d.date ? p : d), undefined)} />}
          {affichees.map((l) => <LigneEchange key={l.cle} c={l} mg={mg} actif={l.cle === actif} ouvrir={() => ouvrir(l.lien)} />)}
        </List>
        {!affichees.length && (q || nonLus) && (
          <EmptyState icone={<ForumOutlined />} titre={q ? 'Aucun résultat' : 'Tout est lu'} texte={q ? 'Vérifie l’orthographe du nom.' : 'Aucun message en attente.'} />
        )}
      </Box>
    </Box>
  )
}

function EnTete({ titre, detail, retour, niveau, avatar, action }: { titre: string; detail: string; retour?: () => void; niveau: 'h1' | 'h2'; avatar?: ReactNode; action?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 64 }}>
      {retour && <Bulle titre="Échanges"><IconButton onClick={retour} aria-label="Échanges" sx={{ width: 48, height: 48, ml: -1 }}><ArrowBack /></IconButton></Bulle>}
      {avatar}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h3" component={niveau} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titre}</Typography>
        {detail && <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</Typography>}
      </Box>
      {action}
    </Box>
  )
}

// Menu d'un groupe libre : modifier (son créateur ou le Directeur), quitter
function MenuGroupe({ g, modifier, quitter }: { g: Groupe; modifier?: () => void; quitter: () => void }) {
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  return (
    <>
      <Bulle titre="Autres actions"><IconButton aria-label={`Autres actions sur ${g.nom}`} onClick={(e) => setAncre(e.currentTarget)} sx={{ width: 48, height: 48 }}><MoreVert /></IconButton></Bulle>
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {modifier && <MenuItem onClick={() => { setAncre(null); modifier() }} sx={{ minHeight: 48 }}><ListItemIcon><EditOutlined /></ListItemIcon>Modifier le groupe</MenuItem>}
        <MenuItem onClick={() => { setAncre(null); quitter() }} sx={{ minHeight: 48 }}><ListItemIcon><LogoutOutlined /></ListItemIcon>Quitter le groupe</MenuItem>
      </Menu>
    </>
  )
}

// PC large : membres du fil et tâches ouvertes du magasin
function Panneau({ reseau, fil, membres }: { reseau: Reseau; fil: Fil; membres: Participant[] }) {
  const ouvertes = fil.genre === 'magasin' ? actionsDuMagasin(reseau, fil.magasin).filter((x) => !x.a.faite && (x.libre?.fil === 'equipe') === fil.equipe) : []
  return (
    <Card component="aside" aria-label="Membres et tâches" sx={{ p: 2, display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', gap: 3, overflowY: 'auto', minHeight: 0 }}>
      <Box>
        <Typography variant="overline" component="h3" sx={{ fontWeight: 700 }}>Membres</Typography>
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {membres.map((p) => (
            <Box component="li" key={p.cle} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Avatar sx={{ width: 32, height: 32, fontSize: '0.75rem', fontWeight: 600, bgcolor: 'action.selected', color: 'text.primary' }}>{initialesDe(p.nom)}</Avatar>
              <Box sx={{ minWidth: 0 }}><Typography variant="body2" sx={{ fontWeight: 600 }}>{p.nom}</Typography><Typography variant="caption" color="text.secondary">{p.role}</Typography></Box>
            </Box>
          ))}
        </Box>
      </Box>
      {fil.genre === 'magasin' && (
        <Box>
          <Typography variant="overline" component="h3" sx={{ fontWeight: 700 }}>Tâches ouvertes · {ouvertes.length}</Typography>
          {!ouvertes.length ? <Typography variant="body2" color="text.secondary">Aucune tâche en cours.</Typography> : (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {ouvertes.slice(0, 8).map((x) => (
                <Box component="li" key={x.cle}>
                  <Typography variant="body2">{x.a.action}</Typography>
                  <Typography variant="caption" color="text.secondary">{[x.a.porteur, x.a.echeance && /^\d{4}/.test(x.a.echeance) ? dateCourte(x.a.echeance) : ''].filter(Boolean).join(' · ')}</Typography>
                </Box>
              ))}
            </Box>
          )}
          <Button component={RouterLink} to={`${lienFiche(fil.magasin)}`} sx={{ mt: 1, minHeight: 48, px: 0 }}>Fiche du magasin</Button>
        </Box>
      )}
    </Card>
  )
}

// Fil choisi d'après l'adresse : /echanges/magasin/<nom>[?fil=equipe], /echanges/groupe/<id>, /echanges/personne/<clé>
function filDeAdresse(genre: string | undefined, valeur: string | undefined, equipe: boolean): Fil | null {
  if (!genre || !valeur) return null
  if (genre === 'magasin') return { genre: 'magasin', magasin: valeur, equipe }
  if (genre === 'groupe' && /^\d+$/.test(valeur)) return { genre: 'groupe', id: Number(valeur) }
  if (genre === 'personne') return { genre: 'personne', cle: valeur }
  return null
}

function Segment({ vue, changer, nTaches, nDiscussions }: { vue: 'discussions' | 'taches'; changer: (v: 'discussions' | 'taches') => void; nTaches: number; nDiscussions: number }) {
  const options = [{ v: 'discussions' as const, libelle: nDiscussions ? `Discussions · ${nDiscussions}` : 'Discussions' }, { v: 'taches' as const, libelle: nTaches ? `Mes tâches · ${nTaches}` : 'Mes tâches' }]
  return (
    <Box role="tablist" aria-label="Échanges" sx={{ display: 'flex', p: 0.25, borderRadius: 999, bgcolor: 'action.hover', mb: 2, maxWidth: 480 }}>
      {options.map((o) => (
        <ButtonBase key={o.v} role="tab" aria-selected={vue === o.v} onClick={() => changer(o.v)}
          sx={{ fontFamily: 'inherit', flex: 1, minHeight: 48, borderRadius: 999, fontWeight: 600, fontSize: '0.9375rem', color: vue === o.v ? 'text.primary' : 'text.secondary', ...(vue === o.v ? { bgcolor: 'background.paper', boxShadow: 1 } : {}) }}>
          {o.libelle}
        </ButtonBase>
      ))}
    </Box>
  )
}

function Contenu({ reseau, lectureSeule }: { reseau: Reseau; lectureSeule: boolean }) {
  const { genre, valeur } = useParams()
  const [params] = useSearchParams()
  const naviguer = useNavigate()
  const { profil } = useAuth()
  const { messagerie: brute, charge } = useMessagerie()
  const messagerie = useMemo(() => (brute && lectureSeule ? sansPrives(brute) : brute), [brute, lectureSeule])
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const [confirmation, setConfirmation] = useState('')
  const [edition, setEdition] = useState<Groupe | null>(null)
  const magasins = useMemo(() => magasinsDesEchanges(reseau, profil), [reseau, profil])
  const lignes = useMemo(() => (messagerie ? conversations(reseau, messagerie, profil, magasins) : []), [reseau, messagerie, profil, magasins])
  const franchise = profil?.role === 'franchise' || !!reseau.espace
  const fil = filDeAdresse(genre, valeur, !franchise && params.get('fil') === 'equipe')
  const conv = fil ? lignes.find((l) => l.cle === (fil.genre === 'magasin' ? `magasin:${fil.magasin}` : fil.genre === 'groupe' ? `groupe:${fil.id}` : `personne:${fil.cle}`)) : undefined
  const vue = params.get('vue') === 'taches' ? 'taches' : 'discussions'
  const moi = monNomPorteur(reseau, profil)
  const nTaches = moi ? actionsDes(reseau, null).filter((x) => !x.a.faite && portePar(x.a, moi)).length : 0
  const nDiscussions = lignes.reduce((t, l) => t + l.pourMoi, 0)
  const ouvrir = (lien: string) => naviguer(lien, { replace: surPC && !!fil })
  const retour = () => (window.history.length > 1 ? naviguer(-1) : naviguer('/echanges'))
  const message = <Snackbar open={!!confirmation} autoHideDuration={5000} onClose={() => setConfirmation('')} message={confirmation} />
  // Sur PC une conversation est toujours ouverte : « Mes tâches » repart de /echanges, sinon la conversation reste affichée
  const segment = <Segment vue={vue} nTaches={nTaches} nDiscussions={nDiscussions}
    changer={(v) => naviguer(v === 'taches' ? '/echanges?vue=taches' : '/echanges', { replace: true })} />

  if (!fil && vue === 'taches') return <PageTaches entete={(titre) => <><PageHeader titre={titre ?? 'Échanges'} />{segment}</>} />
  if (!charge) return <><PageHeader titre="Échanges" /><Typography variant="body2" color="text.secondary">Chargement des échanges…</Typography></>
  if (!messagerie) return <><PageHeader titre="Échanges" />{segment}<EmptyState icone={<ForumOutlined />} titre="Messagerie pas encore activée" texte="Les échanges apparaîtront ici dès son activation dans la base." /></>
  if (fil && !conv) {
    return <EmptyState icone={<ForumOutlined />} titre="Conversation introuvable" texte="Elle ne fait pas partie de tes échanges."
      action={<Button variant="contained" onClick={() => naviguer('/echanges')} sx={{ minHeight: 48 }}>Voir les échanges</Button>} />
  }

  const g = conv?.groupe
  const peutModifier = !!g && !lectureSeule && (profil?.role === 'directeur' || (profil?.role === 'rr' && g.creePar === messagerie.moi))
  const membres: Participant[] = !fil || !conv ? []
    : fil.genre === 'groupe' ? (g?.membres ?? []).map((k) => ({ cle: k, nom: nomDe(reseau, k), role: roleDeCle(k) }))
    : fil.genre === 'magasin' && conv.magasin ? participants(reseau, conv.magasin).filter((p) => !(fil.equipe && p.cle.startsWith('franchise:')))
    : []
  const basculer = fil?.genre === 'magasin' && !franchise && !lectureSeule
    ? (e: boolean) => naviguer(`/echanges/magasin/${encodeURIComponent(fil.magasin)}${e ? '?fil=equipe' : ''}`, { replace: true }) : undefined
  const actionEnTete = g && !lectureSeule ? <MenuGroupe g={g} modifier={peutModifier ? () => setEdition(g) : undefined}
    quitter={() => { quitterGroupe(g.id).then(async () => { naviguer('/echanges'); setConfirmation('Tu as quitté le groupe.') }, () => setConfirmation('Impossible de quitter le groupe pour le moment.')) }} />
    : fil?.genre === 'magasin' && !franchise ? <Button component={RouterLink} to={lienFiche(fil.magasin)} sx={{ minHeight: 48, display: { xs: 'none', sm: 'inline-flex' } }}>Fiche</Button> : undefined
  const detail = conv ? (fil?.genre === 'groupe' ? `${membres.length} membres` : conv.detail) : ''
  const filAffiche = (cadre: boolean) => fil && conv && (
    <FilMessages key={conv.cle + (fil.genre === 'magasin' && fil.equipe ? '|equipe' : '')} reseau={reseau} fil={fil} contact={conv.contact} signaler={setConfirmation} lectureSeule={lectureSeule} basculer={basculer}
      cadre={cadre} aLaFin={!cadre} fond={cadre ? 'background.paper' : 'background.default'} />
  )
  const liste = <ListeDiscussions reseau={reseau} lignes={lignes} mg={messagerie} actif={conv?.cle} ouvrir={ouvrir} ecrire={!lectureSeule} magasins={magasins} signaler={setConfirmation} pratiques={!franchise}
    peutCreerGroupe={!lectureSeule && (profil?.role === 'directeur' || profil?.role === 'rr')} />
  const dialogue = edition && <DialogGroupe reseau={reseau} magasins={magasins} groupe={edition} onFermer={(msg) => { setEdition(null); if (msg) setConfirmation(msg); if (msg === 'Groupe supprimé.') naviguer('/echanges') }} />

  if (!surPC) {
    if (!fil || !conv) return <><PageHeader titre="Échanges" />{segment}{liste}{message}</>
    // Conversation en plein écran, calée sur la partie visible (clavier compris) : l'en-tête reste en haut,
    // la saisie tout en bas, seuls les messages défilent (Joseph, 22/10/2026)
    return (
      <ConversationTelephone>
        <Box sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <EnTete titre={conv.titre} detail={detail} niveau="h1" retour={retour} avatar={<AvatarConversation c={conv} taille={40} />} action={actionEnTete} />
        </Box>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <FilMessages key={conv.cle + (fil.genre === 'magasin' && fil.equipe ? '|equipe' : '')} reseau={reseau} fil={fil} contact={conv.contact} signaler={setConfirmation} lectureSeule={lectureSeule} basculer={basculer}
            cadre fond="background.default" />
        </Box>
        {dialogue}
        {message}
      </ConversationTelephone>
    )
  }

  // PC : la liste à gauche, la conversation au milieu, membres et tâches à droite sur grand écran ; sans choix, la plus récente
  const recente = lignes.find((l) => l.dernier)
  if (!fil && recente) return <Navigate to={recente.lien} replace />
  return (
    <>
      <PageHeader titre="Échanges" />
      {segment}
      <Box sx={{ display: 'grid', gridTemplateColumns: { md: '340px minmax(0, 1fr)', lg: fil && membres.length ? '340px minmax(0, 1fr) 260px' : '340px minmax(0, 1fr)' }, gap: 2, height: 'calc(100dvh - 72px - 64px - 84px - 64px)', minHeight: 480 }}>
        <Card sx={{ minHeight: 0 }}>{liste}</Card>
        <Card sx={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {fil && conv
            ? <>
              <Box sx={{ px: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <EnTete titre={conv.titre} detail={detail} niveau="h2" avatar={<AvatarConversation c={conv} taille={40} />} action={actionEnTete} />
                    </Box>
              <Box sx={{ flex: 1, minHeight: 0 }}>{filAffiche(true)}</Box>
            </>
            : <EmptyState icone={<ForumOutlined />} titre="Aucune conversation" texte="Choisis un magasin, un groupe ou une personne pour écrire." />}
        </Card>
        {fil && membres.length > 0 && <Panneau reseau={reseau} fil={fil} membres={membres} />}
      </Box>
      {dialogue}
      {message}
    </>
  )
}

// Partie de l'écran réellement visible : le clavier du téléphone la réduit, et le navigateur peut la décaler
function useZoneVisible() {
  const lire = () => {
    const v = window.visualViewport
    return { haut: v?.offsetTop ?? 0, hauteur: v?.height ?? window.innerHeight, clavier: !!v && window.innerHeight - v.height > 120 }
  }
  const [zone, setZone] = useState(lire)
  useEffect(() => {
    const v = window.visualViewport
    if (!v) return
    const suivre = () => setZone(lire())
    v.addEventListener('resize', suivre)
    v.addEventListener('scroll', suivre)
    return () => { v.removeEventListener('resize', suivre); v.removeEventListener('scroll', suivre) }
  }, [])
  return zone
}

function ConversationTelephone({ children }: { children: ReactNode }) {
  const { haut, hauteur, clavier } = useZoneVisible()
  // Sous l'en-tête de l'app (64 px) ; si le navigateur fait glisser la page vers le haut, on suit la partie visible
  const top = Math.max(64, haut)
  return (
    <Box sx={{
      position: 'fixed', left: 0, right: 0, top, height: haut + hauteur - top, zIndex: 3, display: 'flex', flexDirection: 'column', bgcolor: 'background.default',
      // Hors clavier, la saisie s'écarte de la barre d'accueil de l'iPhone
      '& [data-composeur]': { pb: clavier ? 1 : 'calc(8px + env(safe-area-inset-bottom))' },
    }}>
      {children}
    </Box>
  )
}

export function Echanges({ lectureSeule = false }: { lectureSeule?: boolean }) {
  return <AvecReseau>{(reseau) => <Contenu reseau={reseau} lectureSeule={lectureSeule} />}</AvecReseau>
}

// Canal « Réseau V and B » : les communications du réseau, vues dès l'ouverture
export function CanalReseau({ lectureSeule = false }: { lectureSeule?: boolean }) {
  const naviguer = useNavigate()
  useEffect(() => { noterReseauVu() }, [])
  return (
    <PageCommunications lectureSeule={lectureSeule} entete={
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Bulle titre="Échanges"><IconButton onClick={() => (window.history.length > 1 ? naviguer(-1) : naviguer('/echanges'))} aria-label="Échanges" sx={{ width: 48, height: 48, ml: -1 }}><ArrowBack /></IconButton></Bulle>
        <Avatar variant="rounded" sx={{ width: 40, height: 40, borderRadius: 3, bgcolor: '#ef7d00', color: '#1b1b1f' }}><CampaignOutlined /></Avatar>
        <Typography variant="h1" sx={{ flex: 1, fontSize: { xs: '1.375rem', md: '1.75rem' } }}>Réseau V and B</Typography>
      </Box>
    } />
  )
}

// Canal « Bonnes pratiques » : les initiatives réussies de tout le réseau ; chacun ajoute celles de ses magasins
export function CanalPratiques() {
  const naviguer = useNavigate()
  const [pratique, setPratique] = useState<BonnePratique | null | undefined>(undefined)
  const [message, setMessage] = useState('')
  return (
    <AvecReseau>
      {(reseau) => (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Bulle titre="Échanges"><IconButton onClick={() => (window.history.length > 1 ? naviguer(-1) : naviguer('/echanges'))} aria-label="Échanges" sx={{ width: 48, height: 48, ml: -1 }}><ArrowBack /></IconButton></Bulle>
            <Avatar variant="rounded" sx={{ width: 40, height: 40, borderRadius: 3, bgcolor: '#8bc34a', color: '#1b1b1f' }}><TipsAndUpdatesOutlined /></Avatar>
            <Typography variant="h1" sx={{ flex: 1, fontSize: { xs: '1.375rem', md: '1.75rem' } }}>Bonnes pratiques</Typography>
          </Box>
          <VuePratiques reseau={reseau} modifier={setPratique} actions={<BoutonAction libelle="Ajouter une bonne pratique" onClick={() => setPratique(null)} />} />
          {pratique !== undefined && <DialogPratique reseau={reseau} pratique={pratique} onFermer={(m) => { setPratique(undefined); if (m) setMessage(m) }} />}
          <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
        </>
      )}
    </AvecReseau>
  )
}
