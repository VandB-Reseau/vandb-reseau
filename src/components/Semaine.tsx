import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined'
import EditCalendarOutlined from '@mui/icons-material/EditCalendarOutlined'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import RouteOutlined from '@mui/icons-material/RouteOutlined'
import { useAuth } from '../auth/AuthContext'
import { BoutonAction } from './Outils'
import { DialogPlanifier } from './DialogPlanifier'
import { RechercheFiltres } from './RechercheFiltres'
import { FiltreMenu } from './FiltreMenu'
import { EmptyState } from './EmptyState'
import { CarteLignes, Initiales, LigneCompacte, Pastille, TitreSection } from './Social'
import { coachA } from '../data/charge'
import { magasinsDu, perimetreDuProfil } from '../data/perimetre'
import { jourPropose, preparationDe, semaineDu, type LigneSemaine } from '../data/semaine'
import { duree } from '../data/tournee'
import { lienFiche, lienPreparation } from '../lib/format'
import type { Reseau, Visite } from '../data/modele'

const jourCourt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

// Coachs que la personne connectée peut suivre : elle-même pour un Coach, ceux de son périmètre sinon
function coachsSuivis(reseau: Reseau, profil: ReturnType<typeof useAuth>['profil']): string[] {
  const p = perimetreDuProfil(profil)
  if (p?.type === 'coach') return [p.nom]
  const noms = new Set(magasinsDu(reseau, p ?? { type: 'reseau' }).map((m) => coachA(m, reseau.jour)).filter(Boolean))
  return reseau.equipe.filter((c) => !c.fictif && noms.has(c.nom)).map((c) => c.nom).sort((a, b) => a.localeCompare(b, 'fr'))
}

export function VueSemaine({ reseau, surPC, onMessage }: { reseau: Reseau; surPC: boolean; onMessage: (m: string) => void }) {
  const { profil } = useAuth()
  const coachs = useMemo(() => coachsSuivis(reseau, profil), [reseau, profil])
  const [choisi, setChoisi] = useState('')
  const coach = coachs.includes(choisi) ? choisi : coachs[0] ?? ''
  const s = useMemo(() => (coach ? semaineDu(reseau, coach) : null), [reseau, coach])
  const [planif, setPlanif] = useState<{ magasins: string[]; date: string; visite: Visite | null } | null>(null)
  const planifier = (magasins: string[], date: string, visite: Visite | null = null) => setPlanif({ magasins, date, visite })
  const unSeul = coachs.length <= 1
  const actions = s && <>
    {s.aPlanifier.length > 1 && <BoutonAction secondaire libelle="Planifier la tournée" court="Tournée" icone={<RouteOutlined />} onClick={() => planifier(s.aPlanifier.map((x) => x.l.magasin.nom), reseau.jour)} />}
    <BoutonAction libelle="Planifier une visite" court="Planifier" icone={<EventAvailableOutlined />} onClick={() => planifier([], reseau.jour)} />
  </>
  const barre = (
    <RechercheFiltres actions={actions}
      recherche={!unSeul ? <FiltreMenu unique libelle="Coach" choisis={[coach]} onChange={(v) => setChoisi(v[0])} options={coachs.map((c) => ({ valeur: c, libelle: c }))} /> : null} />
  )
  if (!s) return <EmptyState icone={<EventNoteOutlined />} titre="Aucun Coach" texte="Aucun Coach n’a de magasin à suivre aujourd’hui." />
  const retards = s.lignes.filter((x) => x.l.retard > 0 && !x.prevue).length
  const prevues = s.lignes.filter((x) => x.prevue)
  const ligne = (x: LigneSemaine, i: number | null) => {
    const { l, prevue } = x
    const detail = [
      l.case?.libelle ?? 'Non classé',
      prevue ? null : l.retard > 0 ? `due depuis le ${jourCourt(l.prochaine)}` : `due le ${jourCourt(l.prochaine)}`,
      l.derniere ? `vue le ${jourCourt(l.derniere.date)}` : 'jamais visité',
      preparationDe(reseau, l.magasin.nom)?.notes ? 'préparée' : null,
    ].filter(Boolean).join(' · ')
    const heure = preparationDe(reseau, l.magasin.nom)?.heure
    return (
      <LigneCompacte key={l.magasin.nom} lien={lienFiche(l.magasin.nom)} label={l.magasin.nom}
        avatar={<Initiales nom={l.magasin.nom} icone={i !== null ? <Typography component="span" sx={{ fontWeight: 700 }}>{i + 1}</Typography> : <EventAvailableOutlined />} />}
        titre={l.magasin.nom} detail={detail}
        fin={prevue ? <Pastille ton="bleu">{`${jourCourt(prevue.date)}${heure ? ` · ${heure.replace(':', 'h')}` : ''}`}</Pastille> : l.retard > 0 ? <Pastille ton="orange">{`${l.retard} j de retard`}</Pastille> : undefined}
        actions={<>
          {surPC && <Tooltip title="Préparer la visite"><IconButton component={RouterLink} to={lienPreparation(l.magasin.nom)} aria-label={`Préparer la visite de ${l.magasin.nom}`}><AssignmentOutlined /></IconButton></Tooltip>}
          <Tooltip title="Planifier la visite"><IconButton onClick={() => planifier([l.magasin.nom], prevue?.date ?? jourPropose(reseau, l), prevue)} aria-label={`Planifier la visite de ${l.magasin.nom}`} sx={{ width: 48, height: 48 }}>{prevue ? <EditCalendarOutlined /> : <EventAvailableOutlined />}</IconButton></Tooltip>
        </>} />
    )
  }
  return (
    <>
      {planif && <DialogPlanifier reseau={reseau} coach={coach} magasins={planif.magasins} dateInitiale={planif.date} visite={planif.visite}
        onFermer={(m) => { setPlanif(null); if (m) onMessage(m) }} />}
      {barre}
      <Card sx={{ mb: 2, border: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.2 }}>{s.lignes.length}</Typography>
              <Typography variant="body2" color="text.secondary">{s.lignes.length > 1 ? 'magasins' : 'magasin'} à voir d’ici le {jourCourt(s.fin)}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {[!unSeul && coach, pluriel(prevues.length, 'visite') + ` prévue${prevues.length > 1 ? 's' : ''}`,
                s.tournee.etapes > 0 && `trajets ${s.tournee.complete ? '' : 'd’au moins '}${duree(s.tournee.minutes)} · ${Math.round(s.tournee.km)} km`].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          {retards > 0 ? <Pastille ton="orange">{`${retards} en retard`}</Pastille> : s.lignes.length > 0 && !s.aPlanifier.length ? <Pastille ton="vert">Planifiée</Pastille> : null}
        </Box>
      </Card>
      {!s.lignes.length ? (
        <EmptyState icone={<EventAvailableOutlined />} titre="Semaine libre" texte={`Aucune visite n’est due d’ici le ${jourCourt(s.fin)}.`} />
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
