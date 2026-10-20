import { useMemo, useState, type ReactElement } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
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
import { PageHeader } from '../components/PageHeader'
import { BoutonAction } from '../components/Outils'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { Fenetre } from '../components/EditionEquipe'
import { enregistrerConge, enregistrerEvenement, supprimerConge, supprimerEvenement } from '../data/chargement'
import { chargeA, magasinsDuCoach } from '../data/charge'
import { minutesMoyennes } from '../data/kilometrage'
import { positionCoach } from '../data/plan'
import { trajetEntre } from '../data/tournee'
import { lienFiche } from '../lib/format'
import { libelleTypeVisite, nomsVisiteurs, type Conge, type Evenement, type Reseau } from '../data/modele'
import { estVisite } from '../data/chiffres'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'

type Categorie = 'visite' | 'ouverture' | 'anniversaire' | 'evenement' | 'conge'
const categories: { id: Categorie; libelle: string; couleur: string; icone: ReactElement }[] = [
  { id: 'visite', libelle: 'Visites', couleur: '#1b6fce', icone: <EventAvailableOutlined fontSize="small" /> },
  { id: 'ouverture', libelle: 'Ouvertures', couleur: '#ef7d00', icone: <StorefrontOutlined fontSize="small" /> },
  { id: 'evenement', libelle: 'Événements', couleur: '#7c3aed', icone: <EventOutlined fontSize="small" /> },
  { id: 'conge', libelle: 'Congés', couleur: '#0f766e', icone: <BeachAccessOutlined fontSize="small" /> },
  { id: 'anniversaire', libelle: 'Anniversaires', couleur: '#c2185b', icone: <CakeOutlined fontSize="small" /> },
]

interface Element { cle: string; categorie: Categorie; debut: string; fin: string; titre: string; detail: string; lien?: string; conge?: Conge; evenement?: Evenement; couleur: string; magasin?: string }

const iso = (d: Date) => d.toISOString().slice(0, 10)
const jourUTC = (s: string) => new Date(`${s}T00:00:00Z`)
export const ajouterJours = (s: string, n: number) => { const d = jourUTC(s); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
const nomMois = (s: string) => jourUTC(s).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
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
    el.push({ cle: `v-${v.id ?? v.date}-${v.magasin}`, categorie: 'visite', debut: v.date, fin: v.date, titre: `Visite ${v.magasin}`, detail: [libelleTypeVisite(v.type), nomsVisiteurs(v)].filter(Boolean).join(' · '), lien: lienFiche(v.magasin), couleur: '#1b6fce', magasin: v.magasin })
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

function DialogConge({ reseau, conge, onFermer }: { reseau: Reseau; conge: Conge | null; onFermer: (m?: string) => void }) {
  const [personne, setPersonne] = useState(conge?.personne ?? '')
  const [debut, setDebut] = useState(conge?.debut ?? reseau.jour)
  const [fin, setFin] = useState(conge?.fin ?? reseau.jour)
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
function DialogEvenement({ reseau, evenement, onFermer }: { reseau: Reseau; evenement: Evenement | null; onFermer: (m?: string) => void }) {
  const [titre, setTitre] = useState(evenement?.titre ?? '')
  const [debut, setDebut] = useState(evenement?.debut ?? reseau.jour)
  const [fin, setFin] = useState(evenement?.fin ?? reseau.jour)
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

function Pastille({ e, onClick }: { e: Element; onClick?: () => void }) {
  const contenu = <Box component="span" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.titre}</Box>
  const sx = { display: 'block', width: '100%', textAlign: 'left' as const, fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.4, color: '#fff', bgcolor: e.couleur, borderRadius: 1, px: 0.75, py: 0.25, mb: 0.5, border: 0, cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit' }
  return (
    <Tooltip title={[e.titre, e.detail].filter(Boolean).join(' · ')}>
      {e.lien ? <Box component={RouterLink} to={e.lien} sx={sx}>{contenu}</Box> : <Box component="button" type="button" onClick={onClick} sx={sx}>{contenu}</Box>}
    </Tooltip>
  )
}

export function Agenda() {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [params, setParams] = useSearchParams()
  const [actives, setActives] = useState<Set<Categorie>>(new Set(['visite', 'ouverture', 'evenement', 'conge', 'anniversaire']))
  const [conge, setConge] = useState<Conge | null | undefined>(undefined)
  const [evenement, setEvenement] = useState<Evenement | null | undefined>(undefined)
  const [message, setMessage] = useState('')
  const fermer = (m?: string) => { setConge(undefined); setEvenement(undefined); if (m) setMessage(m) }
  return (
    <AvecReseau>
      {(reseau) => {
        const mois = params.get('mois') ?? reseau.jour.slice(0, 7)
        const debut = `${mois}-01`
        const fin = ajouterJours(iso(new Date(Date.UTC(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)), 1))), -1)
        const changerMois = (n: number) => { const d = new Date(Date.UTC(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)) - 1 + n, 1)); setParams({ mois: iso(d).slice(0, 7) }, { replace: true }) }
        return (
          <>
            <PageHeader titre="Agenda" sousTitre="Ouvertures, événements, absences et anniversaires"
              actions={<Box sx={{ display: 'flex', gap: 1 }}>
                <BoutonAction secondaire libelle="Absence" icone={<BeachAccessOutlined />} onClick={() => setConge(null)} />
                <BoutonAction libelle="Événement" icone={<EventOutlined />} onClick={() => setEvenement(null)} />
              </Box>} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <IconButton onClick={() => changerMois(-1)} aria-label="Mois précédent"><ChevronLeft /></IconButton>
              <Typography variant="h3" component="h2" sx={{ minWidth: 180, textAlign: 'center', textTransform: 'capitalize' }}>{nomMois(debut)}</Typography>
              <IconButton onClick={() => changerMois(1)} aria-label="Mois suivant"><ChevronRight /></IconButton>
              <Button onClick={() => setParams({}, { replace: true })} sx={{ minHeight: 48 }}>Aujourd’hui</Button>
              <Box sx={{ flex: 1 }} />
              {categories.map((c) => (
                <Chip key={c.id} icon={c.icone} label={c.libelle} clickable onClick={() => setActives((a) => { const n = new Set(a); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })}
                  variant={actives.has(c.id) ? 'filled' : 'outlined'} aria-pressed={actives.has(c.id)}
                  sx={{ minHeight: 40, ...(actives.has(c.id) && { bgcolor: c.couleur, color: '#fff', '& .MuiChip-icon': { color: '#fff' } }) }} />
              ))}
            </Box>
            <ContenuMois reseau={reseau} debut={debut} fin={fin} actives={actives} surPC={surPC} ouvrir={(e) => { if (e.conge) setConge(e.conge); if (e.evenement) setEvenement(e.evenement) }} />
            {conge !== undefined && <DialogConge reseau={reseau} conge={conge} onFermer={fermer} />}
            {evenement !== undefined && <DialogEvenement reseau={reseau} evenement={evenement} onFermer={fermer} />}
            <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
          </>
        )
      }}
    </AvecReseau>
  )
}

function ContenuMois({ reseau, debut, fin, actives, surPC, ouvrir }: { reseau: Reseau; debut: string; fin: string; actives: Set<Categorie>; surPC: boolean; ouvrir: (e: Element) => void }) {
  const elements = useMemo(() => elementsDuMois(reseau, debut, fin).filter((e) => actives.has(e.categorie)), [reseau, debut, fin, actives])
  const duJour = (j: string) => elements.filter((e) => e.debut <= j && e.fin >= j)
  if (surPC) {
    // Grille du lundi précédant le 1er au dimanche suivant la fin du mois
    const decalage = (jourUTC(debut).getUTCDay() + 6) % 7
    const premier = ajouterJours(debut, -decalage)
    const jours: string[] = []
    for (let j = premier; j <= fin || jours.length % 7 !== 0; j = ajouterJours(j, 1)) jours.push(j)
    return (
      <Card>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }} role="grid" aria-label="Calendrier du mois">
          {['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'].map((j) => <Typography key={j} variant="body2" color="text.secondary" sx={{ p: 1, fontWeight: 600, borderBottom: '1px solid', borderColor: 'divider' }}>{j}</Typography>)}
          {jours.map((j, i) => {
            const horsMois = j < debut || j > fin
            return (
              <Box key={j} role="gridcell" aria-label={jourLong(j)} sx={{ minHeight: 112, p: 0.75, borderRight: (i % 7) < 6 ? '1px solid' : 0, borderBottom: '1px solid', borderColor: 'divider', bgcolor: horsMois ? 'action.hover' : undefined, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: j === reseau.jour ? 800 : 500, color: horsMois ? 'text.secondary' : j === reseau.jour ? 'primary.main' : 'text.primary', mb: 0.5 }}>{Number(j.slice(8))}</Typography>
                {!horsMois && duJour(j).map((e) => <Pastille key={e.cle} e={e} onClick={() => ouvrir(e)} />)}
              </Box>
            )
          })}
        </Box>
      </Card>
    )
  }
  const premierJour = (e: Element) => (e.debut < debut ? debut : e.debut)
  const jours = [...new Set(elements.map(premierJour))].sort()
  if (!jours.length) return <EmptyState icone={<CalendarMonthOutlined />} titre="Rien de prévu ce mois-ci" texte="Ajoute un événement ou une absence, ou passe au mois suivant." />
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {jours.map((j) => (
        <Box key={j}>
          <Typography variant="subtitle2" component="h3" sx={{ mb: 1, textTransform: 'capitalize', color: j === reseau.jour ? 'primary.main' : 'text.primary' }}>{jourLong(j)}</Typography>
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
