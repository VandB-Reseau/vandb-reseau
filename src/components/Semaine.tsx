import { useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined'
import EditCalendarOutlined from '@mui/icons-material/EditCalendarOutlined'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import RouteOutlined from '@mui/icons-material/RouteOutlined'
import RateReviewOutlined from '@mui/icons-material/RateReviewOutlined'
import { useAuth } from '../auth/AuthContext'
import { BoutonAction } from './Outils'
import { DialogPlanifier } from './DialogPlanifier'
import { DialogVisite } from './DialogVisite'
import { RechercheFiltres } from './RechercheFiltres'
import { FiltreMenu } from './FiltreMenu'
import { EmptyState } from './EmptyState'
import { CarteLignes, Initiales, LigneCompacte, Pastille, TitreSection } from './Social'
import { coachA } from '../data/charge'
import { magasinsDu, perimetreDuProfil } from '../data/perimetre'
import { jourPropose, preparationDe, semaineDu, type LigneSemaine } from '../data/semaine'
import { duree } from '../data/tournee'
import { libellePasVu } from '../data/visites'
import { motDe } from '../data/motFranchise'
import { lienFiche, lienPreparation } from '../lib/format'
import type { Reseau, Visite } from '../data/modele'

const jourCourt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

// Coachs que la personne connectée peut suivre : elle-même pour un Coach, ceux de son périmètre sinon
function coachsSuivis(reseau: Reseau, profil: ReturnType<typeof useAuth>['profil']): string[] {
  const p = perimetreDuProfil(profil)
  if (p?.type === 'coach') return [p.nom]
  const noms = new Set(magasinsDu(reseau, p ?? { type: 'reseau' }).map((m) => coachA(m, reseau.jour)).filter(Boolean))
  return reseau.equipe.filter((c) => !c.fictif && noms.has(c.nom)).map((c) => c.nom).sort((a, b) => a.localeCompare(b, 'fr'))
}

// Une case du résumé : le chiffre, ce qu'il compte, un signal éventuel
function Chiffre({ valeur, libelle, detail }: { valeur: ReactNode; libelle: string; detail?: ReactNode }) {
  return (
    <Card sx={{ border: 0, px: 1.5, py: 1.25, minWidth: 0 }}>
      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{valeur}</Typography>
      <Typography variant="body2" color="text.secondary">{libelle}</Typography>
      {detail && <Box sx={{ mt: 0.5 }}>{detail}</Box>}
    </Card>
  )
}

export function VueSemaine({ reseau, surPC, onMessage }: { reseau: Reseau; surPC: boolean; onMessage: (m: string) => void }) {
  const { profil } = useAuth()
  const coachs = useMemo(() => coachsSuivis(reseau, profil), [reseau, profil])
  const [choisi, setChoisi] = useState('')
  const coach = coachs.includes(choisi) ? choisi : coachs[0] ?? ''
  const s = useMemo(() => (coach ? semaineDu(reseau, coach) : null), [reseau, coach])
  const [planif, setPlanif] = useState<{ magasins: string[]; date: string; visite: Visite | null } | null>(null)
  const planifier = (magasins: string[], date: string, visite: Visite | null = null) => setPlanif({ magasins, date, visite })
  const [compteRendu, setCompteRendu] = useState<Visite | null>(null)
  const unSeul = coachs.length <= 1
  const actions = s && <>
    {s.aPlanifier.length > 1 && (surPC ? <BoutonAction secondaire libelle="Planifier la tournée" icone={<RouteOutlined />} onClick={() => planifier(s.aPlanifier.map((x) => x.l.magasin.nom), reseau.jour)} />
      : <Button variant="outlined" startIcon={<RouteOutlined />} onClick={() => planifier(s.aPlanifier.map((x) => x.l.magasin.nom), reseau.jour)} aria-label="Planifier la tournée" sx={{ minHeight: 48, flexShrink: 0 }}>Tournée</Button>)}
    {surPC ? <BoutonAction libelle="Planifier une visite" icone={<EventAvailableOutlined />} onClick={() => planifier([], reseau.jour)} />
      : <Button variant="contained" startIcon={<EventAvailableOutlined />} onClick={() => planifier([], reseau.jour)} aria-label="Planifier une visite" sx={{ minHeight: 48, flexShrink: 0 }}>Visite</Button>}
  </>
  const barre = (
    <RechercheFiltres actions={actions}
      recherche={!unSeul ? <FiltreMenu unique libelle="Coach" choisis={[coach]} onChange={(v) => setChoisi(v[0])} options={coachs.map((c) => ({ valeur: c, libelle: c }))} /> : null} />
  )
  if (!s) return <EmptyState icone={<EventNoteOutlined />} titre="Aucun Coach" texte="Aucun Coach n’a de magasin à suivre aujourd’hui." />
  const signales = s.lignes.filter((x) => x.l.alerte && !x.prevue).length
  const prevues = s.lignes.filter((x) => x.prevue)
  const ligne = (x: LigneSemaine, i: number | null) => {
    const { l, prevue } = x
    const detail = [
      l.case?.libelle ?? 'Non classé',
      l.derniere ? `vu le ${jourCourt(l.derniere.date)}` : l.alerte && !prevue ? null : 'jamais visité',
      prevue || l.alerte || !l.echeance ? null : `alerte le ${jourCourt(l.echeance)}`,
      l.dernierContact ? `appel le ${jourCourt(l.dernierContact.date)}` : null,
      preparationDe(reseau, l.magasin.nom)?.notes ? 'préparée' : null,
      prevue && motDe(reseau, l.magasin.nom, prevue.id) ? 'mot du franchisé reçu' : null,
    ].filter(Boolean).join(' · ')
    const planifierCe = () => planifier([l.magasin.nom], prevue?.date ?? jourPropose(reseau, l), prevue)
    // Téléphone : Préparer, Planifier et Compte rendu en mots sous le magasin (sprint 24, S1) ; PC : pictos en bout de ligne
    if (!surPC) {
      const bouton = { minHeight: 48, px: 1.5, bgcolor: 'background.paper' } as const
      return (
        <Box key={l.magasin.nom}>
          <LigneCompacte lien={lienFiche(l.magasin.nom)} label={l.magasin.nom}
            avatar={<Initiales nom={l.magasin.nom} icone={i !== null ? <Typography component="span" sx={{ fontWeight: 700 }}>{i + 1}</Typography> : <EventAvailableOutlined />} />}
            titre={l.magasin.nom} detail={detail}
            fin={prevue ? <Pastille ton="bleu">{jourCourt(prevue.date)}</Pastille> : l.alerte ? <Pastille ton="orange">{libellePasVu(l)}</Pastille> : undefined} />
          <Box role="group" aria-label={`Actions pour ${l.magasin.nom}`} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, pl: 8.5, pr: 2, pb: 1.5, mt: -0.5 }}>
            <Button variant="outlined" size="small" component={RouterLink} to={lienPreparation(l.magasin.nom)} startIcon={<AssignmentOutlined />} aria-label={`Préparer la visite de ${l.magasin.nom}`} sx={bouton}>Préparer</Button>
            {prevue && prevue.date <= reseau.jour
              ? <Button variant="outlined" size="small" onClick={() => setCompteRendu(prevue)} startIcon={<RateReviewOutlined />} aria-label={`Faire le compte rendu de ${l.magasin.nom}`} sx={bouton}>Compte rendu</Button>
              : <Button variant="outlined" size="small" onClick={planifierCe} startIcon={prevue ? <EditCalendarOutlined /> : <EventAvailableOutlined />} aria-label={`Planifier la visite de ${l.magasin.nom}`} sx={bouton}>{prevue ? 'Déplacer' : 'Planifier'}</Button>}
          </Box>
        </Box>
      )
    }
    return (
      <LigneCompacte key={l.magasin.nom} lien={lienFiche(l.magasin.nom)} label={l.magasin.nom}
        avatar={<Initiales nom={l.magasin.nom} icone={i !== null ? <Typography component="span" sx={{ fontWeight: 700 }}>{i + 1}</Typography> : <EventAvailableOutlined />} />}
        titre={l.magasin.nom} detail={detail}
        fin={prevue ? <Pastille ton="bleu">{jourCourt(prevue.date)}</Pastille> : l.alerte ? <Pastille ton="orange">{libellePasVu(l)}</Pastille> : undefined}
        actions={<>
          <Tooltip title="Préparer la visite"><IconButton component={RouterLink} to={lienPreparation(l.magasin.nom)} aria-label={`Préparer la visite de ${l.magasin.nom}`}><AssignmentOutlined /></IconButton></Tooltip>
          {prevue && prevue.date <= reseau.jour && <Tooltip title="Faire le compte rendu"><IconButton onClick={() => setCompteRendu(prevue)} aria-label={`Faire le compte rendu de ${l.magasin.nom}`} sx={{ width: 48, height: 48 }}><RateReviewOutlined /></IconButton></Tooltip>}
          <Tooltip title="Planifier la visite"><IconButton onClick={planifierCe} aria-label={`Planifier la visite de ${l.magasin.nom}`} sx={{ width: 48, height: 48 }}>{prevue ? <EditCalendarOutlined /> : <EventAvailableOutlined />}</IconButton></Tooltip>
        </>} />
    )
  }
  return (
    <>
      {planif && <DialogPlanifier reseau={reseau} coach={coach} magasins={planif.magasins} dateInitiale={planif.date} visite={planif.visite}
        onFermer={(m) => { setPlanif(null); if (m) onMessage(m) }} />}
      {compteRendu && <DialogVisite reseau={reseau} visite={compteRendu} onFermer={(m) => { setCompteRendu(null); if (m) onMessage(m) }} />}
      {barre}
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, mb: 1 }}>
        {[!unSeul && coach, `jusqu’au ${jourCourt(s.fin)}`].filter(Boolean).join(' · ')}
      </Typography>
      <Box role="group" aria-label="Résumé de la semaine" sx={{ display: 'grid', gridTemplateColumns: `repeat(${s.tournee.etapes > 0 ? 3 : 2}, minmax(0, 1fr))`, gap: 1, mb: 2 }}>
        <Chiffre valeur={s.lignes.length} libelle="à voir"
          detail={signales > 0 ? <Pastille ton="orange">{`${signales} pas vu${signales > 1 ? 's' : ''}`}</Pastille> : null} />
        <Chiffre valeur={prevues.length} libelle={prevues.length > 1 ? 'prévues' : 'prévue'}
          detail={s.lignes.length > 0 && !s.aPlanifier.length ? <Pastille ton="vert">Planifiée</Pastille> : null} />
        {s.tournee.etapes > 0 && <Chiffre valeur={`${s.tournee.complete ? '' : '≥ '}${duree(s.tournee.minutes)}`} libelle="de route" detail={<Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{`${Math.round(s.tournee.km).toLocaleString('fr-FR')} km`}</Typography>} />}
      </Box>
      {!s.lignes.length ? (
        <EmptyState icone={<EventAvailableOutlined />} titre="Semaine libre" texte={`Aucune urgence d’ici le ${jourCourt(s.fin)}. Une bonne occasion de passer dire bonjour.`} />
      ) : (
        <>
          {s.aPlanifier.length > 0 && <>
            <TitreSection nombre={s.aPlanifier.length}>À planifier</TitreSection>
            <CarteLignes label="Visites à planifier">{s.aPlanifier.map((x, i) => ligne(x, i))}</CarteLignes>
          </>}
          {prevues.length > 0 && <Box sx={{ mt: 2 }}>
            <TitreSection nombre={prevues.length}>Prévues</TitreSection>
            <CarteLignes label="Visites prévues">{[...prevues].sort((a, b) => a.prevue!.date.localeCompare(b.prevue!.date)).map((x) => ligne(x, null))}</CarteLignes>
          </Box>}
        </>
      )}
    </>
  )
}
