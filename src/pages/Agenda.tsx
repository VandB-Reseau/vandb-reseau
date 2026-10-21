import { useEffect, useMemo, useRef, useState, type PointerEvent as EvenementPointeur, type ReactElement } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListSubheader from '@mui/material/ListSubheader'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import EventOutlined from '@mui/icons-material/EventOutlined'
import BeachAccessOutlined from '@mui/icons-material/BeachAccessOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import CakeOutlined from '@mui/icons-material/CakeOutlined'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import AddOutlined from '@mui/icons-material/AddOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import { PageHeader } from '../components/PageHeader'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { Fenetre, messageErreur } from '../components/EditionEquipe'
import { DialogVisite } from '../components/DialogVisite'
import { DialogPlanifier } from '../components/DialogPlanifier'
import { deplacerVisite, enregistrerConge, enregistrerEvenement, supprimerConge, supprimerEvenement } from '../data/chargement'
import { useReseau } from '../data/ReseauContext'
import { libellePerimetre, magasinsConcernes } from '../data/campagnes'
import { chargeA, magasinsDuCoach } from '../data/charge'
import { minutesMoyennes } from '../data/kilometrage'
import { positionCoach } from '../data/plan'
import { trajetEntre } from '../data/tournee'
import { lienFiche } from '../lib/format'
import { libelleTypeVisite, nomsVisiteurs, type Conge, type Evenement, type Reseau, type Visite } from '../data/modele'
import { estVisite } from '../data/chiffres'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import { BandeCollante } from '../components/Collant'

type Categorie = 'visite' | 'campagne' | 'ouverture' | 'anniversaire' | 'evenement' | 'conge'
const categories: { id: Categorie; libelle: string; couleur: string; icone: ReactElement }[] = [
  { id: 'visite', libelle: 'Visites', couleur: '#1b6fce', icone: <EventAvailableOutlined fontSize="small" /> },
  { id: 'campagne', libelle: 'Campagnes', couleur: '#a15c00', icone: <CampaignOutlined fontSize="small" /> },
  { id: 'ouverture', libelle: 'Ouvertures', couleur: '#ef7d00', icone: <StorefrontOutlined fontSize="small" /> },
  { id: 'evenement', libelle: 'Événements', couleur: '#7c3aed', icone: <EventOutlined fontSize="small" /> },
  { id: 'conge', libelle: 'Congés', couleur: '#0f766e', icone: <BeachAccessOutlined fontSize="small" /> },
  { id: 'anniversaire', libelle: 'Anniversaires', couleur: '#c2185b', icone: <CakeOutlined fontSize="small" /> },
]

interface Element { cle: string; categorie: Categorie; debut: string; fin: string; titre: string; detail: string; lien?: string; conge?: Conge; evenement?: Evenement; visite?: Visite; couleur: string; magasin?: string }

const iso = (d: Date) => d.toISOString().slice(0, 10)
const jourUTC = (s: string) => new Date(`${s}T00:00:00Z`)
export const ajouterJours = (s: string, n: number) => { const d = jourUTC(s); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
const nomMois = (s: string) => jourUTC(s).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const ecartJours = (a: string, b: string) => Math.round((jourUTC(b).getTime() - jourUTC(a).getTime()) / 86400000)
export const jourLong = (s: string) => jourUTC(s).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

// Coach le plus proche par la route des magasins de l'absent, présent sur toute la période et le moins chargé, pour couvrir une absence
export function remplacantSuggere(reseau: Reseau, c: Conge): string | null {
  const absent = reseau.equipe.find((x) => x.nom === c.personne)
  if (!absent) return null
  const presents = reseau.equipe.filter((x) => x.nom !== absent.nom && !x.fictif
    && !reseau.conges.some((l) => l.personne === x.nom && l.debut <= c.fin && l.fin >= c.debut))
  const sesMagasins = magasinsDuCoach(reseau, absent.nom, c.debut)
  const chez = positionCoach(reseau, absent, c.debut)
  const tries = presents.map((x) => {
    const ici = positionCoach(reseau, x, c.debut)
    const d = minutesMoyennes(ici, sesMagasins) ?? (ici && chez ? trajetEntre(ici, chez).minutes : 99999)
    return { nom: x.nom, d, charge: chargeA(reseau, x.nom, c.debut) }
  })
    .sort((a, b) => a.d - b.d || a.charge - b.charge)
  return tries[0]?.nom ?? null
}

export function elementsDuMois(reseau: Reseau, debut: string, fin: string): Element[] {
  const el: Element[] = []
  // Visites faites et prévues (pas les appels ni les points)
  for (const v of reseau.visites) if (v.date >= debut && v.date <= fin && estVisite(v)) {
    el.push({ cle: `v-${v.id ?? v.date}-${v.magasin}`, categorie: 'visite', debut: v.date, fin: v.date, titre: `Visite ${v.magasin}`, detail: [libelleTypeVisite(v.type), nomsVisiteurs(v)].filter(Boolean).join(' · '), lien: lienFiche(v.magasin), couleur: '#1b6fce', magasin: v.magasin, visite: v })
  }
  // Campagnes datées qui concernent au moins un magasin visible du compte
  for (const c of reseau.campagnes.liste) {
    const d = c.debut || c.fin, f = c.fin || c.debut
    if (d && d <= fin && f >= debut && magasinsConcernes(reseau, c).length) el.push({ cle: `cp-${c.id}`, categorie: 'campagne', debut: d, fin: f, titre: c.nom, detail: ['Campagne', libellePerimetre(c)].filter(Boolean).join(' · '), lien: `/visites?vue=campagnes&campagne=${encodeURIComponent(c.id)}`, couleur: '#a15c00' })
  }
  for (const m of reseau.magasins) {
    if (m.ouvertureConnue && m.ouverture >= debut && m.ouverture <= fin) el.push({ cle: `o-${m.nom}`, categorie: 'ouverture', debut: m.ouverture, fin: m.ouverture, titre: `Ouverture ${m.nom}`, detail: m.coach ? `Coach ${m.coach}` : 'Sans Coach', lien: lienFiche(m.nom), couleur: '#ef7d00' })
  }
  for (const e of reseau.evenements) if (e.debut <= fin && e.fin >= debut) el.push({ cle: `e-${e.id}`, categorie: 'evenement', debut: e.debut, fin: e.fin, titre: e.titre, detail: e.notes, evenement: e, couleur: e.couleur })
  for (const c of reseau.conges) if (c.debut <= fin && c.fin >= debut) {
    const r = remplacantSuggere(reseau, c)
    el.push({ cle: `c-${c.id}`, categorie: 'conge', debut: c.debut, fin: c.fin, titre: `${c.personne} absent`, detail: [c.notes, r && `remplaçant suggéré : ${r}`].filter(Boolean).join(' · '), conge: c, couleur: '#0f766e' })
  }
  const annee = debut.slice(0, 4)
  for (const a of reseau.anniversaires) {
    const jour = `${annee}-${a.date.slice(5)}`
    const ans = Number(annee) - Number(a.date.slice(0, 4))
    if (jour >= debut && jour <= fin && ans > 0) el.push({ cle: `a-${a.nom}-${a.nature}`, categorie: 'anniversaire', debut: jour, fin: jour, titre: a.nature === 'naissance' ? `Anniversaire de ${a.nom}` : `${a.nom} : ${ans} an${ans > 1 ? 's' : ''} chez V and B`, detail: a.role, couleur: '#c2185b' })
  }
  return el.sort((a, b) => a.debut.localeCompare(b.debut) || a.titre.localeCompare(b.titre, 'fr'))
}

export function DialogConge({ reseau, conge, jourInitial, onFermer }: { reseau: Reseau; conge: Conge | null; jourInitial?: string; onFermer: (m?: string) => void }) {
  const [personne, setPersonne] = useState(conge?.personne ?? '')
  const [debut, setDebut] = useState(conge?.debut ?? jourInitial ?? reseau.jour)
  const [fin, setFin] = useState(conge?.fin ?? jourInitial ?? reseau.jour)
  const [notes, setNotes] = useState(conge?.notes ?? '')
  const personnes = [...reseau.equipe.filter((c) => !c.fictif).map((c) => ({ nom: c.nom, role: 'cs' })), ...reseau.rrs.map((r) => ({ nom: r.nom, role: 'dr' })), ...reseau.techniciens.map((t) => ({ nom: t.nom, role: 'tech' }))]
  const ordre = debut && fin && fin >= debut
  const brouillon: Conge = { id: conge?.id ?? null, personne, role: personnes.find((p) => p.nom === personne)?.role ?? 'cs', debut, fin, notes }
  const r = personne && ordre ? remplacantSuggere(reseau, brouillon) : null
  return (
    <Fenetre titre={conge ? `Modifier l’absence de ${conge.personne}` : 'Ajouter une absence'} ouvert onFermer={onFermer} valide={!!personne && !!ordre}
      enregistrer={async () => { await enregistrerConge(brouillon); return 'Absence enregistrée.' }}
      supprimer={conge?.id ? async () => { await supprimerConge(conge.id!); return 'Absence supprimée.' } : undefined}
      libelleSuppression={conge ? `Supprimer l’absence de ${conge.personne} ?` : undefined}>
      <TextField select label="Personne" value={personne} onChange={(e) => setPersonne(e.target.value)}>
        {personnes.map((p) => <MenuItem key={p.nom} value={p.nom}>{p.nom}</MenuItem>)}
      </TextField>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
        <TextField type="date" label="Du" value={debut} onChange={(e) => setDebut(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="date" label="Au" value={fin} onChange={(e) => setFin(e.target.value)} error={!ordre} helperText={ordre ? ' ' : 'La fin doit suivre le début.'} slotProps={{ inputLabel: { shrink: true } }} />
      </Box>
      <TextField label="Motif ou remarque (facultatif)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {r && <Typography variant="body2" color="text.secondary">Remplaçant suggéré : <strong>{r}</strong> (le plus proche, présent sur toute la période).</Typography>}
    </Fenetre>
  )
}

const COULEURS_EV = ['#7c3aed', '#1b6fce', '#ef7d00', '#2e7d32', '#c2185b']
export function DialogEvenement({ reseau, evenement, jourInitial, onFermer }: { reseau: Reseau; evenement: Evenement | null; jourInitial?: string; onFermer: (m?: string) => void }) {
  const [titre, setTitre] = useState(evenement?.titre ?? '')
  const [debut, setDebut] = useState(evenement?.debut ?? jourInitial ?? reseau.jour)
  const [fin, setFin] = useState(evenement?.fin ?? jourInitial ?? reseau.jour)
  const [notes, setNotes] = useState(evenement?.notes ?? '')
  const [couleur, setCouleur] = useState(evenement?.couleur ?? COULEURS_EV[0])
  const ordre = debut && fin && fin >= debut
  return (
    <Fenetre titre={evenement ? `Modifier ${evenement.titre}` : 'Ajouter un événement'} ouvert onFermer={onFermer} valide={!!titre.trim() && !!ordre}
      enregistrer={async () => { await enregistrerEvenement({ id: evenement?.id ?? null, titre: titre.trim(), type: evenement?.type ?? 'event', debut, fin, notes: notes.trim(), couleur }); return 'Événement enregistré.' }}
      supprimer={evenement?.id ? async () => { await supprimerEvenement(evenement.id!); return 'Événement supprimé.' } : undefined}
      libelleSuppression={evenement ? `Supprimer « ${evenement.titre} » ?` : undefined}>
      <TextField label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} autoFocus placeholder="Par exemple : séminaire des Coachs" />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
        <TextField type="date" label="Du" value={debut} onChange={(e) => setDebut(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="date" label="Au" value={fin} onChange={(e) => setFin(e.target.value)} error={!ordre} helperText={ordre ? ' ' : 'La fin doit suivre le début.'} slotProps={{ inputLabel: { shrink: true } }} />
      </Box>
      <TextField label="Détails (facultatif)" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} />
      <Box sx={{ display: 'flex', gap: 1 }} role="radiogroup" aria-label="Couleur">
        {COULEURS_EV.map((c) => <Box key={c} component="button" type="button" role="radio" aria-checked={couleur === c} aria-label={`Couleur ${c}`} onClick={() => setCouleur(c)} sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: c, cursor: 'pointer', border: '3px solid', borderColor: couleur === c ? 'text.primary' : 'transparent' }} />)}
      </Box>
    </Fenetre>
  )
}


// Ce qui se déplace dans l'agenda : événements, absences, visites prévues ; ce qui s'étire : événements et absences
const deplacable = (e: Element, jour: string) => !!e.evenement?.id || !!e.conge?.id || (!!e.visite?.id && e.visite.date >= jour)
const etirable = (e: Element) => !!e.evenement?.id || !!e.conge?.id
type Mode = 'deplacer' | 'etirer'
interface Glisse { e: Element; mode: Mode; depart: string; cible: string }
type Dates = { debut: string; fin: string }
const datesApres = (g: Glisse): Dates => {
  if (g.mode === 'etirer') return { debut: g.e.debut, fin: g.cible < g.e.debut ? g.e.debut : g.cible }
  const n = ecartJours(g.depart, g.cible)
  return { debut: ajouterJours(g.e.debut, n), fin: ajouterJours(g.e.fin, n) }
}
type Ajout = 'visite' | 'absence' | 'evenement'
interface Ancre { jour: string; x: number; y: number }

function Pastille({ e, onClick, glissement, poignee, actif }: { e: Element; onClick?: () => void; glissement?: (ev: EvenementPointeur, mode: Mode) => void; poignee?: boolean; actif?: boolean }) {
  const contenu = <Box component="span" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.titre}</Box>
  const sx = { position: 'relative' as const, display: 'block', width: '100%', textAlign: 'left' as const, fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.4, color: '#fff', bgcolor: e.couleur, borderRadius: 1, px: 0.75, pr: poignee ? 1.5 : 0.75, py: 0.25, mb: 0.5, border: 0, cursor: glissement ? 'grab' : 'pointer', textDecoration: 'none', fontFamily: 'inherit', userSelect: 'none' as const, touchAction: glissement ? 'none' : undefined, opacity: actif ? 0.7 : 1, outline: actif ? '2px solid' : 0, outlineColor: 'text.primary' }
  const proprietes = { draggable: false, 'data-cle': e.cle, onPointerDown: glissement ? (ev: EvenementPointeur) => glissement(ev, 'deplacer') : undefined }
  const bord = poignee && glissement && (
    <Box component="span" aria-hidden onPointerDown={(ev: EvenementPointeur) => { ev.stopPropagation(); glissement(ev, 'etirer') }}
      sx={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 10, cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', '&::after': { content: '""', width: 2, height: '60%', borderRadius: 1, bgcolor: 'rgba(255,255,255,0.8)' } }} />
  )
  return (
    <Tooltip title={actif ? '' : [e.titre, e.detail].filter(Boolean).join(' · ')}>
      {e.lien
        ? <Box component={RouterLink} to={e.lien} sx={sx} {...proprietes}>{contenu}{bord}</Box>
        : <Box component="button" type="button" onClick={onClick} sx={sx} {...proprietes}>{contenu}{bord}</Box>}
    </Tooltip>
  )
}

function MenuAjout({ ancre, onChoisir, onFermer }: { ancre: Ancre | null; onChoisir: (a: Ajout, jour: string) => void; onFermer: () => void }) {
  const choix: { id: Ajout; libelle: string; icone: ReactElement }[] = [
    { id: 'visite', libelle: 'Visite', icone: <EventNoteOutlined fontSize="small" /> },
    { id: 'absence', libelle: 'Absence', icone: <BeachAccessOutlined fontSize="small" /> },
    { id: 'evenement', libelle: 'Événement', icone: <EventOutlined fontSize="small" /> },
  ]
  return (
    <Menu open={!!ancre} onClose={onFermer} anchorReference="anchorPosition" anchorPosition={ancre ? { top: ancre.y, left: ancre.x } : undefined}
      slotProps={{ list: { 'aria-label': ancre ? `Ajouter le ${jourLong(ancre.jour)}` : undefined } }}>
      {ancre && <ListSubheader sx={{ lineHeight: '40px', textTransform: 'capitalize' }}>{jourLong(ancre.jour)}</ListSubheader>}
      {choix.map((c) => (
        <MenuItem key={c.id} onClick={() => { if (ancre) onChoisir(c.id, ancre.jour) }} sx={{ minHeight: 48 }}>
          <ListItemIcon>{c.icone}</ListItemIcon>{c.libelle}
        </MenuItem>
      ))}
    </Menu>
  )
}

export function Agenda() {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const { recharger } = useReseau()
  const [params, setParams] = useSearchParams()
  const [actives, setActives] = useState<Set<Categorie>>(new Set(['visite', 'campagne', 'ouverture', 'evenement', 'conge', 'anniversaire']))
  const [conge, setConge] = useState<Conge | null | undefined>(undefined)
  const [evenement, setEvenement] = useState<Evenement | null | undefined>(undefined)
  const [ancre, setAncre] = useState<Ancre | null>(null)
  const [ajout, setAjout] = useState<{ type: Ajout; jour: string } | null>(null)
  // Dates posées par glisser-déposer, montrées tant que le réseau n'a pas été relu
  const [modifs, setModifs] = useState<{ pour: Reseau | null; dates: Record<string, Dates> }>({ pour: null, dates: {} })
  const [message, setMessage] = useState('')
  const fermer = (m?: string) => { setConge(undefined); setEvenement(undefined); setAjout(null); if (m) setMessage(m) }
  const deplacer = async (reseau: Reseau, e: Element, d: Dates) => {
    if (d.debut === e.debut && d.fin === e.fin) return
    if (e.visite && d.debut < reseau.jour) { setMessage('Une visite prévue reste à aujourd’hui ou après.'); return }
    setModifs((m) => ({ pour: reseau, dates: { ...(m.pour === reseau ? m.dates : {}), [e.cle]: d } }))
    try {
      if (e.evenement) await enregistrerEvenement({ ...e.evenement, debut: d.debut, fin: d.fin })
      else if (e.conge) await enregistrerConge({ ...e.conge, debut: d.debut, fin: d.fin })
      else if (e.visite?.id) await deplacerVisite(e.visite.id, d.debut)
      setMessage(`${e.titre} : ${d.debut === d.fin ? `le ${jourLong(d.debut)}` : `du ${jourLong(d.debut)} au ${jourLong(d.fin)}`}.`)
      await recharger()
    } catch (err) {
      setModifs((m) => { const dates = { ...m.dates }; delete dates[e.cle]; return { ...m, dates } })
      setMessage(messageErreur(err))
    }
  }
  return (
    <AvecReseau>
      {(reseau) => {
        const mois = params.get('mois') ?? reseau.jour.slice(0, 7)
        const debut = `${mois}-01`
        const fin = ajouterJours(iso(new Date(Date.UTC(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)), 1))), -1)
        const changerMois = (n: number) => { const d = new Date(Date.UTC(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)) - 1 + n, 1)); setParams({ mois: iso(d).slice(0, 7) }, { replace: true }) }
        return (
          <>
            <PageHeader titre="Agenda" sousTitre="Visites, campagnes, absences et événements" />
            {/* Le mois et les catégories restent sous la barre du haut quand la page défile */}
            <BandeCollante>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0, sm: 1 }, flexWrap: { sm: 'wrap' }, mb: 0.5 }}>
              <IconButton onClick={() => changerMois(-1)} aria-label="Mois précédent"><ChevronLeft /></IconButton>
              <Typography variant="h3" component="h2" sx={{ minWidth: { sm: 180 }, flex: { xs: 1, sm: 'none' }, textAlign: 'center', textTransform: 'capitalize' }}>{nomMois(debut)}</Typography>
              <IconButton onClick={() => changerMois(1)} aria-label="Mois suivant"><ChevronRight /></IconButton>
              <Button onClick={() => setParams({}, { replace: true })} sx={{ minHeight: 48 }}>Aujourd’hui</Button>
            </Box>
            {/* Catégories en puces neutres avec un point de couleur, sur une ligne qui défile (Joseph, 21/10/2026) */}
            <Box role="group" aria-label="Catégories affichées" sx={{ display: 'flex', gap: 1, overflowX: 'auto', mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, scrollbarWidth: 'none' }}>
              {categories.map((c) => {
                const actif = actives.has(c.id)
                return (
                  <ButtonBase key={c.id} aria-pressed={actif} onClick={() => setActives((a) => { const n = new Set(a); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })}
                    sx={{ flexShrink: 0, minHeight: 48, fontFamily: 'inherit', '& > span': { display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, height: 36, borderRadius: 999, border: '1px solid', borderColor: actif ? 'text.primary' : 'divider', bgcolor: actif ? 'action.selected' : 'background.paper', color: actif ? 'text.primary' : 'text.secondary', fontSize: '0.875rem', fontWeight: actif ? 600 : 500 } }}>
                    <span><Box component="i" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.couleur, opacity: actif ? 1 : 0.4 }} />{c.libelle}</span>
                  </ButtonBase>
                )
              })}
            </Box>
            </BandeCollante>
            <ContenuMois reseau={reseau} debut={debut} fin={fin} actives={actives} surPC={surPC} modifs={modifs.pour === reseau ? modifs.dates : {}}
              ouvrir={(e) => { if (e.conge) setConge(e.conge); if (e.evenement) setEvenement(e.evenement) }}
              ajouter={setAncre} deplacer={(e, d) => void deplacer(reseau, e, d)} />
            <MenuAjout ancre={ancre} onFermer={() => setAncre(null)} onChoisir={(type, jour) => { setAncre(null); setAjout({ type, jour }) }} />
            {conge !== undefined && <DialogConge reseau={reseau} conge={conge} onFermer={fermer} />}
            {evenement !== undefined && <DialogEvenement reseau={reseau} evenement={evenement} onFermer={fermer} />}
            {ajout?.type === 'absence' && <DialogConge reseau={reseau} conge={null} jourInitial={ajout.jour} onFermer={fermer} />}
            {ajout?.type === 'evenement' && <DialogEvenement reseau={reseau} evenement={null} jourInitial={ajout.jour} onFermer={fermer} />}
            {/* Visite à venir : on la planifie ; visite passée : on en saisit le compte rendu */}
            {ajout?.type === 'visite' && (ajout.jour >= reseau.jour
              ? <DialogPlanifier reseau={reseau} magasins={[]} dateInitiale={ajout.jour} onFermer={fermer} />
              : <DialogVisite reseau={reseau} visite={null} dateInitiale={ajout.jour} onFermer={fermer} />)}
            <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
          </>
        )
      }}
    </AvecReseau>
  )
}

function ContenuMois({ reseau, debut, fin, actives, surPC, modifs, ouvrir, ajouter, deplacer }: {
  reseau: Reseau; debut: string; fin: string; actives: Set<Categorie>; surPC: boolean; modifs: Record<string, Dates>
  ouvrir: (e: Element) => void; ajouter: (a: Ancre) => void; deplacer: (e: Element, d: Dates) => void
}) {
  const [glisse, setGlisse] = useState<Glisse | null>(null)
  const enCours = useRef<{ g: Glisse; x: number; y: number; bouge: boolean } | null>(null)
  const ignorerClic = useRef(false)
  const nettoyer = useRef<() => void>(() => {})
  useEffect(() => () => nettoyer.current(), [])
  const tous = useMemo(() => elementsDuMois(reseau, debut, fin).filter((e) => actives.has(e.categorie)).map((e) => (modifs[e.cle] ? { ...e, ...modifs[e.cle] } : e)), [reseau, debut, fin, actives, modifs])
  const elements = glisse ? tous.map((e) => (e.cle === glisse.e.cle ? { ...e, ...datesApres(glisse) } : e)) : tous
  const duJour = (j: string) => elements.filter((e) => e.debut <= j && e.fin >= j)
  const ancreDe = (jour: string, n: HTMLElement) => { const r = n.getBoundingClientRect(); return { jour, x: r.left + r.width / 2, y: r.top + r.height / 2 } }

  // Glisser à la souris (ou au doigt sur tablette) : la case sous le pointeur devient la nouvelle date
  const commencer = (ev: EvenementPointeur, e: Element, jour: string, mode: Mode) => {
    if (ev.button !== 0) return
    if (ev.pointerType === 'mouse') ev.preventDefault()
    enCours.current = { g: { e, mode, depart: jour, cible: jour }, x: ev.clientX, y: ev.clientY, bouge: false }
    const bouger = (m: PointerEvent) => {
      const c = enCours.current
      if (!c) return
      if (!c.bouge && Math.hypot(m.clientX - c.x, m.clientY - c.y) < 5) return
      c.bouge = true
      const cible = document.elementFromPoint(m.clientX, m.clientY)?.closest<HTMLElement>('[data-jour]')?.dataset.jour
      if (cible) c.g = { ...c.g, cible }
      setGlisse(c.g)
    }
    const lacher = () => {
      const c = enCours.current
      nettoyer.current()
      // Le clic qui suit le lâcher n'ouvre rien ; s'il ne vient pas (pastille redessinée ailleurs), on oublie aussitôt
      if (c?.bouge) { ignorerClic.current = true; setTimeout(() => { ignorerClic.current = false }, 0); deplacer(c.g.e, datesApres(c.g)) }
    }
    nettoyer.current = () => {
      window.removeEventListener('pointermove', bouger); window.removeEventListener('pointerup', lacher); window.removeEventListener('pointercancel', lacher)
      enCours.current = null; setGlisse(null)
    }
    window.addEventListener('pointermove', bouger); window.addEventListener('pointerup', lacher); window.addEventListener('pointercancel', lacher)
  }

  if (surPC) {
    // Grille du lundi précédant le 1er au dimanche suivant la fin du mois
    const decalage = (jourUTC(debut).getUTCDay() + 6) % 7
    const premier = ajouterJours(debut, -decalage)
    const jours: string[] = []
    for (let j = premier; j <= fin || jours.length % 7 !== 0; j = ajouterJours(j, 1)) jours.push(j)
    return (
      <Card>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }} role="grid" aria-label="Calendrier du mois"
          onClickCapture={(ev) => { if (ignorerClic.current) { ev.preventDefault(); ev.stopPropagation() } }}>
          {['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'].map((j) => <Typography key={j} variant="body2" color="text.secondary" sx={{ p: 1, fontWeight: 600, borderBottom: '1px solid', borderColor: 'divider' }}>{j}</Typography>)}
          {jours.map((j, i) => {
            const horsMois = j < debut || j > fin
            const cible = glisse && (glisse.mode === 'etirer' ? j === datesApres(glisse).fin : j === glisse.cible)
            return (
              <Box key={j} role="gridcell" aria-label={jourLong(j)} data-jour={j}
                onClick={(ev) => { if (!(ev.target as HTMLElement).closest('a,button')) ajouter({ jour: j, x: ev.clientX, y: ev.clientY }) }}
                sx={{ position: 'relative', minHeight: 112, p: 0.75, cursor: 'pointer', borderRight: (i % 7) < 6 ? '1px solid' : 0, borderBottom: '1px solid', borderColor: 'divider', bgcolor: cible ? 'action.selected' : horsMois ? 'action.hover' : undefined, minWidth: 0, '&:hover .ajout-jour, & .ajout-jour:focus-visible': { opacity: 1 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: j === reseau.jour ? 800 : 500, color: horsMois ? 'text.secondary' : j === reseau.jour ? 'primary.main' : 'text.primary' }}>{Number(j.slice(8))}</Typography>
                  <IconButton className="ajout-jour" size="small" aria-label={`Ajouter le ${jourLong(j)}`} onClick={(ev) => ajouter(ancreDe(j, ev.currentTarget))} sx={{ opacity: 0, p: 0.25, m: -0.25 }}><AddOutlined fontSize="small" /></IconButton>
                </Box>
                {!horsMois && duJour(j).map((e) => {
                  const mobile = deplacable(e, reseau.jour)
                  return <Pastille key={e.cle} e={e} onClick={() => ouvrir(e)} actif={glisse?.e.cle === e.cle}
                    glissement={mobile ? (ev, mode) => commencer(ev, e, j, mode) : undefined} poignee={etirable(e) && j === e.fin} />
                })}
              </Box>
            )
          })}
        </Box>
      </Card>
    )
  }
  const premierJour = (e: Element) => (e.debut < debut ? debut : e.debut)
  const jours = [...new Set(elements.map(premierJour))].sort()
  const boutonAjout = (j: string) => (
    <IconButton aria-label={`Ajouter le ${jourLong(j)}`} onClick={(ev) => ajouter(ancreDe(j, ev.currentTarget))} sx={{ width: 48, height: 48, my: -1.5 }}><AddOutlined /></IconButton>
  )
  // Bande des jours du mois qu'on fait glisser ; un point les jours occupés. Toucher un jour occupé y amène, un jour libre propose d'y ajouter
  const tousLesJours: string[] = []
  for (let j = debut; j <= fin; j = ajouterJours(j, 1)) tousLesJours.push(j)
  const bande = (
    <Box ref={(n: HTMLDivElement | null) => { const a = n?.querySelector<HTMLElement>('[aria-current="date"]'); if (n && a) n.scrollLeft = a.offsetLeft - n.clientWidth / 2 + a.clientWidth / 2 }}
      role="group" aria-label="Jours du mois" sx={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', mx: -2, px: 1, mb: 2, scrollbarWidth: 'none' }}>
      {tousLesJours.map((j) => {
        const occupe = jours.includes(j), aujourdhui = j === reseau.jour
        return (
          <ButtonBase key={j} aria-label={jourLong(j)} aria-current={aujourdhui ? 'date' : undefined}
            onClick={(ev) => { if (occupe) document.getElementById(`jour-${j}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); else ajouter(ancreDe(j, ev.currentTarget)) }}
            sx={{ flexShrink: 0, width: 48, minHeight: 64, scrollSnapAlign: 'center', flexDirection: 'column', gap: 0.25, fontFamily: 'inherit', borderRadius: 3, bgcolor: aujourdhui ? 'text.primary' : undefined, color: aujourdhui ? 'background.paper' : occupe ? 'text.primary' : 'text.secondary' }}>
            <Box component="span" sx={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>{jourUTC(j).toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' }).slice(0, 3)}</Box>
            <Box component="span" sx={{ fontWeight: 700 }}>{Number(j.slice(8))}</Box>
            <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: duJour(j).length ? (aujourdhui ? 'background.paper' : 'primary.main') : 'transparent' }} />
          </ButtonBase>
        )
      })}
    </Box>
  )
  if (!jours.length) return <>{bande}<EmptyState icone={<CalendarMonthOutlined />} titre="Rien de prévu ce mois-ci" texte="Ajoute un événement ou une absence, ou passe au mois suivant." /></>
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {bande}
      {jours.map((j) => (
        <Box key={j} id={`jour-${j}`} sx={{ scrollMarginTop: 72 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" component="h3" sx={{ textTransform: 'capitalize', color: j === reseau.jour ? 'primary.main' : 'text.primary' }}>{jourLong(j)}</Typography>
            {boutonAjout(j)}
          </Box>
          <Card>
            {elements.filter((e) => premierJour(e) === j).map((e) => (
              <Box key={e.cle} component={e.lien ? RouterLink : 'button'} {...(e.lien ? { to: e.lien } : { type: 'button', onClick: () => ouvrir(e) })}
                sx={{ display: 'flex', gap: 1.5, alignItems: 'center', width: '100%', textAlign: 'left', px: 2, py: 1.5, minHeight: 56, border: 0, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'transparent', color: 'text.primary', textDecoration: 'none', font: 'inherit', cursor: 'pointer' }}>
                <Box sx={{ width: 6, alignSelf: 'stretch', borderRadius: 3, bgcolor: e.couleur, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{e.titre}</Typography>
                  <Typography variant="body2" color="text.secondary">{[e.debut !== e.fin && `jusqu’au ${jourLong(e.fin)}`, e.detail].filter(Boolean).join(' · ')}</Typography>
                </Box>
              </Box>
            ))}
          </Card>
        </Box>
      ))}
    </Box>
  )
}
