import { VuesRapides } from '../components/VuesRapides'
// Onglet Messages (Joseph, 21/10/2026, séparé des Tâches le 22/10) : groupes des magasins, groupes libres,
// échanges à deux. Téléphone : la liste, puis la conversation en plein écran ; PC : la liste à gauche, la conversation à droite.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link as RouterLink, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import DialogActions from '@mui/material/DialogActions'
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
import EditOutlined from '@mui/icons-material/EditOutlined'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import LogoutOutlined from '@mui/icons-material/LogoutOutlined'
import MoreVert from '@mui/icons-material/MoreVert'
import PersonOutlined from '@mui/icons-material/PersonOutlined'
import PushPinOutlined from '@mui/icons-material/PushPinOutlined'
import PushPin from '@mui/icons-material/PushPin'
import PeopleOutlined from '@mui/icons-material/PeopleOutlined'
import AttachFileOutlined from '@mui/icons-material/AttachFileOutlined'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import OutboxOutlined from '@mui/icons-material/OutboxOutlined'
import SupportAgentOutlined from '@mui/icons-material/SupportAgentOutlined'
import { useAuth } from '../auth/AuthContext'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { Fenetre } from '../components/EditionEquipe'
import { FilMessages } from '../components/Messages'
import { BoutonOutil, Bulle, ChampRecherche } from '../components/Outils'
import { PageHeader } from '../components/PageHeader'
import { initialesDe } from '../components/Social'
import { useMessagerie } from '../data/MessagerieContext'
import { actionsDuMagasin } from '../data/actions'
import { basculerEpingle, useEpingles } from '../data/epingles'
import { magasinsDesEchanges } from '../data/echanges'
import {
  apercuDe, cleFil, conversations, creerGroupe, filDe, heureCourte, lienFil, mesCles, messagesDuFil, modifierGroupe, nomDe, participants, quitterGroupe, roleDeCle, sansPrives, supprimerGroupe,
  type Conversation, type Fil, type Groupe, type Message, type Messagerie, type Participant,
} from '../data/messagerie'
import { useBrouillons } from '../data/brouillons'
import { libelleStatutDemande, useDemandes, useMesDemandes, type Demande } from '../data/demandes'
import { useApercu } from '../auth/Apercu'
import { ContexteMagasin, DialogEnvois, DialogFichiers, DialogMembres, DialogPlusieursMagasins } from '../components/MessagesGestes'
import type { Reseau } from '../data/modele'
import { dateCourte, lienFiche } from '../lib/format'

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr')

// Avatar d'une conversation : carré noir et or pour un magasin, icône pour un groupe libre, rond pour une personne
function AvatarConversation({ c, taille = 48 }: { c: Pick<Conversation, 'genre' | 'titre'>; taille?: number }) {
  if (c.genre === 'groupe') return <Avatar variant="rounded" sx={{ width: taille, height: taille, borderRadius: 3, bgcolor: 'info.main', color: 'info.contrastText' }}><GroupsOutlined /></Avatar>
  if (c.genre === 'magasin') return <Avatar variant="rounded" sx={{ width: taille, height: taille, borderRadius: 3, bgcolor: '#1d1d1b', color: '#f8bb09', fontWeight: 700, fontSize: '1rem' }}>{initialesDe(c.titre)}</Avatar>
  return <Avatar sx={{ width: taille, height: taille, bgcolor: 'action.selected', color: 'text.primary', fontWeight: 600, fontSize: '1rem' }}>{initialesDe(c.titre)}</Avatar>
}

function Pastille({ n, fort }: { n: number; fort: boolean }) {
  return <Box aria-hidden sx={{ flexShrink: 0, minWidth: 22, height: 22, px: 0.75, borderRadius: 999, bgcolor: fort ? 'error.main' : 'action.selected', color: fort ? 'error.contrastText' : 'text.primary', fontSize: '0.75rem', fontWeight: 700, display: 'grid', placeItems: 'center' }}>{n > 99 ? '99+' : n}</Box>
}

function LigneEchange({ c, mg, actif, ouvrir, epingle, brouillon }: { c: Conversation; mg: Messagerie; actif: boolean; ouvrir: () => void; epingle?: boolean; brouillon?: string }) {
  const d = c.dernier
  const qui = d ? (d.auteur === mg.moi ? 'Moi : ' : c.genre === 'personne' ? '' : `${d.auteurNom.split(' ')[0]} : `) : ''
  const apercu = brouillon && !actif ? `Brouillon : ${brouillon.replace(/\s+/g, ' ')}` : d ? `${d.equipe ? 'Équipe · ' : ''}${qui}${apercuDe(d)}` : c.detail
  const fort = c.nonLus > 0
  return (
    <ListItemButton selected={actif} onClick={ouvrir} aria-current={actif ? 'true' : undefined}
      aria-label={`${c.titre}${fort ? ` : ${c.nonLus} message${c.nonLus > 1 ? 's' : ''} non lu${c.nonLus > 1 ? 's' : ''}` : ''}${c.mention ? ', on te cite' : ''}`}
      sx={{ borderRadius: 3, mx: 1, mb: 0.25, minHeight: 72, gap: 1.5, alignItems: 'center' }}>
      <AvatarConversation c={c} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="body1" sx={{ flex: 1, minWidth: 0, fontWeight: fort ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titre}</Typography>
          {epingle && <PushPinOutlined aria-label="Épinglée" sx={{ fontSize: 16, color: 'text.secondary', alignSelf: 'center' }} />}
          {d && <Typography variant="caption" color={c.pourMoi ? 'error.main' : 'text.secondary'} sx={{ flexShrink: 0, fontWeight: fort ? 600 : 400 }}>{heureCourte(d.creeLe)}</Typography>}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {c.mention && <AlternateEmail aria-label="On te cite" sx={{ fontSize: 18, color: 'error.main' }} />}
          <Typography variant="body2" color={brouillon && !actif ? 'error.main' : fort ? 'text.primary' : 'text.secondary'} sx={{ flex: 1, minWidth: 0, fontWeight: fort ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apercu}</Typography>
          {fort && <Pastille n={c.nonLus} fort={c.pourMoi > 0} />}
        </Box>
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
type Vue = 'tout' | 'nonLus' | 'mentions' | 'demandes'

// Recherche dans le texte des messages (63A) : extrait autour du mot trouvé
function extraitAutour(texte: string, q: string): string {
  const t = texte.replace(/\s+/g, ' ')
  const i = sansAccents(t).indexOf(q)
  if (i < 0) return t.slice(0, 120)
  const debut = Math.max(0, i - 40)
  return `${debut > 0 ? '…' : ''}${t.slice(debut, i + q.length + 80)}${i + q.length + 80 < t.length ? '…' : ''}`
}
const lienVersMessage = (lien: string, id: number) => `${lien}${lien.includes('?') ? '&' : '?'}message=${id}`

// Liste des conversations (vague 6, 71A) : vues en tête (Tout, Non lus, Mentions, Demandes), sections Magasins /
// Groupes / Personnes, résultats dans le texte des messages, brouillons annoncés. Alt + flèches pour passer d'une
// conversation à l'autre sur PC (72A).
function ListeDiscussions({ reseau, lignes, mg, actif, ouvrir, ecrire, peutCreerGroupe, magasins, signaler, demandes, equipe }: {
  reseau: Reseau; lignes: Conversation[]; mg: Messagerie; actif?: string; ouvrir: (lien: string) => void; ecrire: boolean; peutCreerGroupe: boolean; magasins: Reseau['magasins']; signaler: (m: string) => void
  demandes: Demande[] | null | undefined; equipe: boolean
}) {
  const [recherche, setRecherche] = useState('')
  const [vue, setVue] = useState<Vue>('tout')
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const [nouveau, setNouveau] = useState<'personne' | 'groupe' | 'plusieurs' | 'envois' | null>(null)
  const naviguer = useNavigate()
  const brouillon = useBrouillons()
  const q = sansAccents(recherche.trim())
  // Sans recherche : les conversations en cours (tout quand la liste est courte) ; avec recherche : tout, pour en démarrer une
  const toutes = lignes.length <= PETITE_LISTE
  const epingles = useEpingles()
  const affichees = lignes.filter((l) => (q ? sansAccents(l.recherche).includes(q) : toutes || !!l.dernier || l.genre === 'groupe' || epingles.includes(l.cle))
    && (vue !== 'nonLus' || l.nonLus > 0) && (vue !== 'mentions' || l.mention))
    .sort((a, b) => Number(epingles.includes(b.cle)) - Number(epingles.includes(a.cle)))
  const aLire = lignes.filter((l) => l.nonLus > 0).length
  const mentions = lignes.filter((l) => l.mention).length
  const v5 = mg.version >= 5
  const ouvertes = (demandes ?? []).filter((d) => d.statut !== 'resolue')
  const plusieurs = ecrire && equipe && v5
  // Messages dont le texte contient la recherche (3 lettres au moins), 20 au plus, du plus récent au plus ancien
  const trouves = useMemo(() => {
    if (q.length < 3 || vue === 'demandes') return []
    const r: { x: Message; c: Conversation }[] = []
    for (const x of [...mg.messages].reverse()) {
      if (!x.texte || !sansAccents(x.texte).includes(q)) continue
      const f = filDe(x, mg)
      const cle = f ? (f.genre === 'magasin' ? `magasin:${f.magasin}` : f.genre === 'groupe' ? `groupe:${f.id}` : `personne:${f.cle}`) : ''
      const c = lignes.find((l) => l.cle === cle)
      if (c && f) r.push({ x, c: { ...c, lien: lienFil(f) } })
      if (r.length >= 20) break
    }
    return r
  }, [q, vue, mg, lignes])
  // Sections : magasins, groupes, personnes (sans recherche ni vue particulière)
  const sections = vue === 'tout' && !q
    ? ([['Magasins', 'magasin'], ['Groupes', 'groupe'], ['Personnes', 'personne']] as const).map(([titre, genre]) => ({ titre, l: affichees.filter((c) => c.genre === genre) })).filter((x) => x.l.length)
    : [{ titre: '', l: affichees }]
  const ordre = sections.flatMap((x) => x.l)
  // Alt + flèche haut / bas : conversation précédente / suivante
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') || !ordre.length) return
      e.preventDefault()
      const i = ordre.findIndex((c) => c.cle === actif)
      const j = e.key === 'ArrowDown' ? Math.min(ordre.length - 1, i + 1) : Math.max(0, i - 1)
      if (ordre[j] && ordre[j].cle !== actif) ouvrir(ordre[j].lien)
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [ordre, actif, ouvrir])
  const vues: { v: Vue; libelle: string }[] = [
    { v: 'tout', libelle: 'Tout' },
    { v: 'nonLus', libelle: aLire ? `Non lus · ${aLire}` : 'Non lus' },
    { v: 'mentions', libelle: mentions ? `Mentions · ${mentions}` : 'Mentions' },
    ...(demandes ? [{ v: 'demandes' as Vue, libelle: ouvertes.length ? `Demandes · ${ouvertes.length}` : 'Demandes' }] : []),
  ]
  const lignesDemandes = (demandes ?? []).filter((d) => !q || sansAccents(`${d.titre} ${d.magasin} ${d.franchise}`).includes(q))
    .sort((a, b) => Number(a.statut === 'resolue') - Number(b.statut === 'resolue') || b.majLe.localeCompare(a.majLe))
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <Box sx={{ px: { xs: 0, md: 2 }, pt: { xs: 0, md: 2 }, pb: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 0, '& .MuiTextField-root': { width: '100%' } }}>
          <ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Magasin, personne, message" />
        </Box>
        {ecrire && <BoutonOutil libelle="Nouvelle conversation" icone={<EditOutlined />} onClick={(e) => (peutCreerGroupe || plusieurs ? setMenu(e.currentTarget) : setNouveau('personne'))} plein />}
      </Box>
      <Box sx={{ px: { xs: 0, md: 2 } }}><VuesRapides label="Vues des conversations" valeur={vue} onChange={setVue} options={vues} sx={{ mb: 0.5 }} /></Box>
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem onClick={() => { setMenu(null); setNouveau('personne') }} sx={{ minHeight: 48 }}><ListItemIcon><PersonOutlined /></ListItemIcon>Message à une personne</MenuItem>
        {peutCreerGroupe && <MenuItem onClick={() => { setMenu(null); setNouveau('groupe') }} sx={{ minHeight: 48 }}><ListItemIcon><GroupsOutlined /></ListItemIcon>Nouveau groupe</MenuItem>}
        {plusieurs && <MenuItem onClick={() => { setMenu(null); setNouveau('plusieurs') }} sx={{ minHeight: 48 }}><ListItemIcon><CampaignOutlined /></ListItemIcon>Message à plusieurs magasins</MenuItem>}
        {plusieurs && <MenuItem onClick={() => { setMenu(null); setNouveau('envois') }} sx={{ minHeight: 48 }}><ListItemIcon><OutboxOutlined /></ListItemIcon>Mes envois à plusieurs magasins</MenuItem>}
      </Menu>
      {nouveau === 'personne' && <NouveauMessage lignes={lignes} ouvrir={ouvrir} fermer={() => setNouveau(null)} />}
      {nouveau === 'groupe' && <DialogGroupe reseau={reseau} magasins={magasins} groupe={null} onFermer={(msg, id) => { setNouveau(null); if (msg) signaler(msg); if (id) ouvrir(`/echanges/groupe/${id}`) }} />}
      {nouveau === 'plusieurs' && <DialogPlusieursMagasins magasins={magasins} fermer={() => setNouveau(null)} signaler={signaler} />}
      {nouveau === 'envois' && <DialogEnvois magasins={magasins} fermer={() => setNouveau(null)} signaler={signaler} />}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: { md: 'auto' }, mx: { xs: -1, md: 0 }, pb: 1 }}>
        {vue === 'demandes' ? (
          lignesDemandes.length ? (
            <List aria-label="Demandes au siège" disablePadding>
              {lignesDemandes.map((d) => (
                <ListItemButton key={d.id} onClick={() => naviguer(`/demandes?demande=${d.id}`)} sx={{ borderRadius: 3, mx: 1, mb: 0.25, minHeight: 64, gap: 1.5 }}>
                  <Avatar sx={{ width: 40, height: 40, bgcolor: 'action.selected', color: 'text.primary' }}><SupportAgentOutlined /></Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: d.statut === 'resolue' ? 500 : 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.titre}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.magasin} · {libelleStatutDemande[d.statut]}</Typography>
                  </Box>
                </ListItemButton>
              ))}
            </List>
          ) : <EmptyState icone={<SupportAgentOutlined />} titre="Aucune demande" texte={equipe ? 'Un message du franchisé peut devenir une demande au siège : « Transformer en demande » sur le message.' : 'Tes questions au siège et leurs réponses arriveront ici.'} />
        ) : (
          <>
            <List aria-label="Conversations" disablePadding>
              {sections.map((sec) => [
                sec.titre && <Box component="li" key={`titre-${sec.titre}`} role="presentation"><Typography variant="caption" component="h3" sx={{ display: 'block', px: 3, pt: 1.5, pb: 0.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{sec.titre}</Typography></Box>,
                ...sec.l.map((l) => <LigneEchange key={l.cle} c={l} mg={mg} actif={l.cle === actif} ouvrir={() => ouvrir(l.lien)} epingle={epingles.includes(l.cle)} brouillon={brouillonPour(brouillon, mg, l)} />),
              ])}
            </List>
            {trouves.length > 0 && (
              <Box>
                <Typography variant="caption" component="h3" sx={{ display: 'block', px: 3, pt: 1.5, pb: 0.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Messages</Typography>
                <List aria-label="Messages trouvés" disablePadding>
                  {trouves.map(({ x, c }) => (
                    <ListItemButton key={x.id} onClick={() => ouvrir(lienVersMessage(c.lien, x.id))} sx={{ borderRadius: 3, mx: 1, mb: 0.25, minHeight: 64, display: 'block' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.titre} <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>· {x.auteurNom} · {heureCourte(x.creeLe)}</Box></Typography>
                      <Typography variant="body2" color="text.secondary">{extraitAutour(x.texte, q)}</Typography>
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            )}
          </>
        )}
        {vue !== 'demandes' && !affichees.length && !trouves.length && (q || vue !== 'tout') && (
          <EmptyState icone={<ForumOutlined />} titre={q ? 'Aucun résultat' : vue === 'mentions' ? 'Personne ne te cite' : 'Tout est lu'} texte={q ? 'Vérifie l’orthographe du nom ou du mot cherché.' : 'Le calme avant la prochaine visite.'} />
        )}
        {vue === 'tout' && !affichees.length && !q && (
          <EmptyState icone={<ForumOutlined />} titre="Aucune conversation en cours" texte="Tes échanges avec les franchisés et l’équipe arriveront ici."
            action={ecrire && <Button variant="contained" onClick={() => setNouveau('personne')} startIcon={<EditOutlined />} sx={{ minHeight: 48, borderRadius: 2, px: 3 }}>Nouveau message</Button>} />
        )}
      </Box>
    </Box>
  )
}

// Brouillon d'une conversation (les deux fils d'un magasin)
function brouillonPour(lire: (cle: string) => string, mg: Messagerie, c: Conversation): string {
  const fils: Fil[] = c.genre === 'magasin' && c.magasin ? [{ genre: 'magasin', magasin: c.magasin.nom, equipe: false }, { genre: 'magasin', magasin: c.magasin.nom, equipe: true }]
    : c.genre === 'groupe' && c.groupe ? [{ genre: 'groupe', id: c.groupe.id }]
    : c.contact ? [{ genre: 'personne', cle: c.contact.cle }] : []
  for (const f of fils) { const b = lire(`${mg.cle}|${cleFil(f)}`); if (b.trim()) return b }
  return ''
}

function EnTete({ titre, detail, retour, niveau, avatar, action }: { titre: string; detail: string; retour?: () => void; niveau: 'h1' | 'h2'; avatar?: ReactNode; action?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 64 }}>
      {retour && <Bulle titre="Messages"><IconButton onClick={retour} aria-label="Messages" sx={{ width: 48, height: 48, ml: -1 }}><ArrowBack /></IconButton></Bulle>}
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

function Contenu({ reseau, lectureSeule }: { reseau: Reseau; lectureSeule: boolean }) {
  const { genre, valeur } = useParams()
  const [params] = useSearchParams()
  const naviguer = useNavigate()
  const etat = useLocation().state as { confirmation?: string } | null
  const { profil } = useAuth()
  const { messagerie: brute, charge, recharger } = useMessagerie()
  const messagerie = useMemo(() => (brute && lectureSeule ? sansPrives(brute) : brute), [brute, lectureSeule])
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  // Message laissé par l'écran précédent (groupe quitté) : l'écran change d'adresse, donc repart de zéro
  const [confirmation, setConfirmation] = useState(etat?.confirmation ?? '')
  const epingles = useEpingles()
  const [edition, setEdition] = useState<Groupe | null>(null)
  const magasins = useMemo(() => magasinsDesEchanges(reseau, profil), [reseau, profil])
  const lignes = useMemo(() => (messagerie ? conversations(reseau, messagerie, profil, magasins) : []), [reseau, messagerie, profil, magasins])
  const franchise = profil?.role === 'franchise' || !!reseau.espace
  const { apercu } = useApercu()
  const { liste: demEquipe } = useDemandes(!franchise)
  const { liste: demFranchise } = useMesDemandes(apercu, franchise)
  const demandes = (franchise ? demFranchise : demEquipe) ?? []
  const [voir, setVoir] = useState<'' | 'fichiers' | 'membres' | 'raccourcis'>('')
  const fil = filDeAdresse(genre, valeur, !franchise && params.get('fil') === 'equipe')
  const conv = fil ? lignes.find((l) => l.cle === (fil.genre === 'magasin' ? `magasin:${fil.magasin}` : fil.genre === 'groupe' ? `groupe:${fil.id}` : `personne:${fil.cle}`)) : undefined
  const ouvrir = (lien: string) => naviguer(lien, { replace: surPC && !!fil })
  const retour = () => (window.history.length > 1 ? naviguer(-1) : naviguer('/echanges'))
  const message = <Snackbar open={!!confirmation} autoHideDuration={5000} onClose={() => setConfirmation('')} message={confirmation} />
  // Anciens liens vers les tâches de l'onglet Échanges : onglet Tâches
  if (!fil && params.get('vue') === 'taches') {
    const n = new URLSearchParams(params); n.delete('vue')
    return <Navigate to={`/taches${n.size ? `?${n}` : ''}`} replace />
  }
  if (!charge) return <><PageHeader titre="Messages" /><Typography variant="body2" color="text.secondary">Chargement des messages…</Typography></>
  if (!messagerie) return <><PageHeader titre="Messages" /><EmptyState icone={<ForumOutlined />} titre="Messagerie pas encore activée" texte="Les messages apparaîtront ici dès son activation dans la base." /></>
  if (fil && !conv) {
    return <EmptyState icone={<ForumOutlined />} titre="Conversation introuvable" texte="Elle ne fait pas partie de tes messages."
      action={<Button variant="contained" onClick={() => naviguer('/echanges')} sx={{ minHeight: 48 }}>Voir les messages</Button>} />
  }

  const g = conv?.groupe
  const peutModifier = !!g && !lectureSeule && (profil?.role === 'directeur' || (profil?.role === 'rr' && g.creePar === messagerie.moi))
  const membres: Participant[] = !fil || !conv ? []
    : fil.genre === 'groupe' ? (g?.membres ?? []).map((k) => ({ cle: k, nom: nomDe(reseau, k), role: roleDeCle(k) }))
    : fil.genre === 'magasin' && conv.magasin ? participants(reseau, conv.magasin).filter((p) => !(fil.equipe && p.cle.startsWith('franchise:')))
    : []
  const basculer = fil?.genre === 'magasin' && !franchise && !lectureSeule
    ? (e: boolean) => naviguer(`/echanges/magasin/${encodeURIComponent(fil.magasin)}${e ? '?fil=equipe' : ''}`, { replace: true }) : undefined
  const autresActions = g && !lectureSeule ? <MenuGroupe g={g} modifier={peutModifier ? () => setEdition(g) : undefined}
    quitter={() => { quitterGroupe(g.id).then(async () => { await recharger(); naviguer('/echanges', { replace: true, state: { confirmation: 'Tu as quitté le groupe.' } }) }, () => setConfirmation('Impossible de quitter le groupe pour le moment.')) }} />
    : fil?.genre === 'magasin' && !franchise ? <Button component={RouterLink} to={lienFiche(fil.magasin)} sx={{ minHeight: 48, display: { xs: 'none', sm: 'inline-flex' } }}>Fiche</Button> : undefined
  const epinglee = !!conv && epingles.includes(conv.cle)
  const actionEnTete = conv && fil && (
    <>
      <Bulle titre="Fichiers et photos">
        <IconButton aria-label="Fichiers et photos" onClick={() => setVoir('fichiers')} sx={{ width: 48, height: 48 }}><AttachFileOutlined /></IconButton>
      </Bulle>
      {membres.length > 0 && (
        <Bulle titre="Membres">
          <IconButton aria-label="Membres de la conversation" onClick={() => setVoir('membres')} sx={{ width: 48, height: 48, display: { lg: fil.genre === 'groupe' ? 'none' : 'inline-flex' } }}><PeopleOutlined /></IconButton>
        </Bulle>
      )}
      {surPC && (
        <Bulle titre="Raccourcis clavier">
          <IconButton aria-label="Raccourcis clavier" onClick={() => setVoir('raccourcis')} sx={{ width: 48, height: 48 }}><InfoOutlined /></IconButton>
        </Bulle>
      )}
      <Bulle titre={epinglee ? 'Retirer l’épingle' : 'Épingler en tête'}>
        <IconButton aria-label={epinglee ? 'Retirer l’épingle' : 'Épingler la conversation'} aria-pressed={epinglee} onClick={() => basculerEpingle(conv.cle)} sx={{ width: 48, height: 48 }}>
          {epinglee ? <PushPin /> : <PushPinOutlined />}
        </IconButton>
      </Bulle>
      {autresActions}
    </>
  )
  const detail = conv ? (fil?.genre === 'groupe' ? `${membres.length} membres` : conv.detail) : ''
  const filAffiche = (cadre: boolean) => fil && conv && (
    <FilMessages key={conv.cle + (fil.genre === 'magasin' && fil.equipe ? '|equipe' : '')} reseau={reseau} fil={fil} contact={conv.contact} signaler={setConfirmation} lectureSeule={lectureSeule} basculer={basculer}
      cadre={cadre} aLaFin={!cadre} fond={cadre ? 'background.paper' : 'background.default'} demandes={demandes} />
  )
  const liste = <ListeDiscussions reseau={reseau} lignes={lignes} mg={messagerie} actif={conv?.cle} ouvrir={ouvrir} ecrire={!lectureSeule} magasins={magasins} signaler={setConfirmation}
    peutCreerGroupe={!lectureSeule && (profil?.role === 'directeur' || profil?.role === 'rr')} demandes={demandes} equipe={!franchise} />
  const dialogue = <>
    {edition && <DialogGroupe reseau={reseau} magasins={magasins} groupe={edition} onFermer={(msg) => { setEdition(null); if (msg) setConfirmation(msg); if (msg === 'Groupe supprimé.') naviguer('/echanges') }} />}
    {voir === 'fichiers' && fil && <DialogFichiers messages={messagesDuFil(messagerie, fil)} fermer={() => setVoir('')} />}
    {voir === 'membres' && <DialogMembres membres={membres} fermer={() => setVoir('')} />}
    {voir === 'raccourcis' && <DialogRaccourcis fermer={() => setVoir('')} />}
  </>
  const magasinFil = fil?.genre === 'magasin' ? reseau.magasins.find((m) => m.nom === fil.magasin) : undefined

  if (!surPC) {
    if (!fil || !conv) return <><PageHeader titre="Messages" />{liste}{message}</>
    // Conversation en plein écran, calée sur la partie visible (clavier compris) : l'en-tête reste en haut,
    // la saisie tout en bas, seuls les messages défilent (Joseph, 22/10/2026)
    return (
      <ConversationTelephone>
        <Box sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <EnTete titre={conv.titre} detail={detail} niveau="h1" retour={retour} avatar={<AvatarConversation c={conv} taille={40} />} action={actionEnTete} />
        </Box>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <FilMessages key={conv.cle + (fil.genre === 'magasin' && fil.equipe ? '|equipe' : '')} reseau={reseau} fil={fil} contact={conv.contact} signaler={setConfirmation} lectureSeule={lectureSeule} basculer={basculer}
            cadre fond="background.default" demandes={demandes} />
        </Box>
        {dialogue}
        {message}
      </ConversationTelephone>
    )
  }

  // PC : la liste à gauche, la conversation au milieu, membres et tâches à droite sur grand écran ; sans choix, la plus récente
  const recente = lignes.find((l) => l.dernier)
  if (!fil && recente) return <Navigate to={recente.lien} replace state={etat} />
  return (
    <>
      <PageHeader titre="Messages" />
      <Box sx={{ display: 'grid', gridTemplateColumns: { md: '340px minmax(0, 1fr)', lg: fil && (magasinFil || membres.length) ? '340px minmax(0, 1fr) 280px' : '340px minmax(0, 1fr)' }, gap: 2, height: 'calc(100dvh - 64px - 84px)', minHeight: 480 }}>
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
        {magasinFil ? <ContexteMagasin reseau={reseau} m={magasinFil} demandes={demandes} equipe={!franchise} />
          : fil && membres.length > 0 && <Panneau reseau={reseau} fil={fil} membres={membres} />}
      </Box>
      {dialogue}
      {message}
    </>
  )
}

// Raccourcis de la messagerie sur PC, à la demande (63A)
function DialogRaccourcis({ fermer }: { fermer: () => void }) {
  const lignes: [string, string][] = [
    ['Alt + flèche haut ou bas', 'Conversation précédente ou suivante'],
    ['Entrée', 'Envoyer le message'],
    ['Maj + Entrée', 'Aller à la ligne'],
    ['Ctrl + K', 'Chercher un magasin, une personne, un message'],
    ['Échap', 'Fermer une fenêtre'],
  ]
  return (
    <Dialog open onClose={fermer} fullWidth maxWidth="xs" aria-labelledby="titre-raccourcis">
      <DialogTitle id="titre-raccourcis">Raccourcis clavier</DialogTitle>
      <DialogContent>
        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1.5 }}>
          {lignes.map(([t, d]) => (
            <Box key={t} sx={{ display: 'contents' }}>
              <Typography component="dt" variant="body2" sx={{ fontWeight: 700 }}>{t}</Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0 }}>{d}</Typography>
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions><Button onClick={fermer} sx={{ minHeight: 48 }}>Fermer</Button></DialogActions>
    </Dialog>
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

