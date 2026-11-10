// Performance › Rapports (refonte vague 3, Joseph 09/11/2026, 29A) : le rapport du mois sur le périmètre choisi,
// à relire ou à télécharger en PDF. Une notification de la cloche l'annonce quand un mois de caisse arrive.
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import { AvecReseau } from '../components/EtatDonnees'
import { Section } from '../components/Section'
import { libelleTaux, useTauxRituels } from '../components/TenueRituels'
import { Indicateur } from '../components/SyntheseMagasin'
import { styleImpression } from '../components/Feuille'
import { useEtiquettePerimetre, useNomsPerimetre } from '../data/perimetreChoisi'
import { rapportDuMois } from '../data/rapport'
import { formatKEuros, formatPourcent, libelleMois } from '../data/chiffres'
import { libellePasVu } from '../data/visites'
import { libelleStatut, phraseObjectif } from '../data/objectifs'
import { lienFiche } from '../lib/format'
import { useChargement } from '../pilotage/data/useChargement'
import { anneeSuivi } from '../pilotage/data/annees'
import { chargerSuiviReseau } from '../pilotage/pages/Reseau'
import { totalReseau } from '../pilotage/moteur/suivi'
import { chargerExplicationsEcarts } from '../pilotage/data/pilotage'
import { causesDuMois, lireAncreEcart } from '../pilotage/moteur/causesEcarts'
import { MOIS_LONGS } from '../pilotage/lib/format'
import type { Reseau } from '../data/modele'

const MAX = 8

function Liste({ lignes, vide }: { lignes: { cle: string; magasin: string; detail: string; rouge?: boolean }[]; vide: string }) {
  if (!lignes.length) return <Typography variant="body2" color="text.secondary">{vide}</Typography>
  return (
    <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
      {lignes.slice(0, MAX).map((l) => (
        <Box component="li" key={l.cle} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 1, minHeight: 48, alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
          <Link component={RouterLink} to={lienFiche(l.magasin)} sx={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', minHeight: 48 }}>{l.magasin}</Link>
          <Typography variant="body2" sx={{ textAlign: 'right', color: l.rouge ? 'error.main' : 'text.secondary', fontWeight: l.rouge ? 700 : 400 }}>{l.detail}</Typography>
        </Box>
      ))}
      {lignes.length > MAX && <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>{`Et ${lignes.length - MAX} autre${lignes.length - MAX > 1 ? 's' : ''}`}</Typography>}
    </Box>
  )
}

// Écart au budget du périmètre, lu dans le pilotage ; rien s'il n'y a pas de budget dans l'app
function EcartBudget() {
  const annee = anneeSuivi()
  const noms = useNomsPerimetre()
  const { donnees, chargement } = useChargement(() => chargerSuiviReseau(annee).catch(() => null), [annee])
  // Vague 6 (77A) : les causes données par les magasins pour leurs écarts du dernier mois expliqué
  const explications = useChargement(() => chargerExplicationsEcarts(annee), [annee])
  if (chargement) return <Skeleton variant="rounded" height={104} aria-label="Lecture du budget" />
  const expl = (explications.donnees ?? []).filter((c) => !noms || noms.has(c.magasin))
  const dernier = Math.max(0, ...expl.map((c) => lireAncreEcart(c.ancre)?.mois ?? 0))
  const causes = dernier ? causesDuMois(expl, annee, dernier) : []
  const premiere = causes[0] ? ` · écarts de ${MOIS_LONGS[dernier - 1]} : ${causes.map((x) => `${x.libelle} ${x.n}`).slice(0, 3).join(', ')}` : ''
  const lignes = (donnees?.magasins ?? []).filter((m) => !noms || noms.has(m.magasin))
  const total = lignes.length ? totalReseau(lignes) : null
  const sous = lignes.filter((m) => m.ecartBudget !== null && m.ecartBudget < 0).length
  const avec = lignes.filter((m) => m.ecartBudget !== null).length
  return (
    <Indicateur libelle={`Face au budget ${annee}`} valeur={total?.ecartBudget != null ? formatPourcent(total.ecartBudget * 100) : '—'}
      detail={avec ? `${sous} magasin${sous > 1 ? 's' : ''} sous le budget sur ${avec}${premiere}` : 'Pas de budget dans l’app'}
      ton={total?.ecartBudget != null ? (total.ecartBudget >= 0 ? 'bon' : 'mauvais') : undefined} />
  )
}

function Rapport({ reseau }: { reseau: Reseau }) {
  const r = rapportDuMois(reseau)
  const etiquette = useEtiquettePerimetre()
  const taux = useTauxRituels(reseau)
  const enRetard = r.objectifs.filter((x) => x.statut === 'retard' || x.statut === 'manque')
  const surLaVoie = r.objectifs.filter((x) => x.statut === 'voie' || x.statut === 'atteint').length
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {styleImpression}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h3" component="h2">{r.mois ? `Rapport de ${libelleMois(r.mois)}` : 'Rapport du mois'}</Typography>
          <Typography variant="body2" color="text.secondary">{[etiquette?.libelle, `${r.magasins} magasin${r.magasins > 1 ? 's' : ''} ouvert${r.magasins > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}</Typography>
        </Box>
        <Button variant="outlined" className="sans-impression" startIcon={<PictureAsPdfOutlined />} onClick={() => window.print()} sx={{ minHeight: 48 }}>Télécharger en PDF</Button>
      </Box>
      <Box component="section" aria-label="Le mois en chiffres" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' } }}>
        <Indicateur libelle="CA à magasins comparables" valeur={r.ca !== null ? formatKEuros(r.ca) : '—'} detail={r.ecart !== null ? `${formatPourcent(r.ecart)} vs N-1` : 'Pas de comparaison'} ton={r.ecart !== null ? (r.ecart >= 0 ? 'bon' : 'mauvais') : undefined} />
        <EcartBudget />
        <Indicateur libelle={r.mois ? `Visites de ${libelleMois(r.mois).split(' ')[0]}` : 'Visites du mois'} valeur={String(r.visites)} detail={`Rythme nine box : ${r.visitesReference} par mois`} ton={r.visitesReference ? (r.visites >= r.visitesReference ? 'bon' : 'mauvais') : undefined} />
        <Indicateur libelle="Objectifs en cours" valeur={String(r.objectifs.length)} detail={r.objectifs.length ? `${surLaVoie} sur la bonne voie · ${enRetard.length} en retard` : 'Aucun objectif fixé'} ton={enRetard.length ? 'mauvais' : undefined} />
      </Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start' }}>
        <Section titre={`Magasins qui décrochent · ${r.decrochent.length}`}>
          <Liste vide="Aucun magasin ne décroche ce mois-ci." lignes={[...r.decrochent, ...r.surveiller].map((a) => ({ cle: a.magasin, magasin: a.magasin, detail: `${formatPourcent(a.ecart)} vs ${libelleMois(a.reference)}${a.statut === 'surveiller' ? ' · à surveiller' : ''}`, rouge: a.statut === 'decroche' }))} />
        </Section>
        <Section titre={`Pas vus depuis longtemps · ${r.pasVus.length}`}>
          <Liste vide="Tous les magasins sont vus à leur rythme." lignes={r.pasVus.map((l) => ({ cle: l.magasin.nom, magasin: l.magasin.nom, detail: `${libellePasVu(l)}${l.coach ? ` · ${l.coach}` : ''}`, rouge: true }))} />
        </Section>
        <Section titre={`Tâches en retard · ${r.totalRetards}`}>
          <Liste vide="Aucune tâche en retard." lignes={r.retards.map((x) => ({ cle: x.magasin, magasin: x.magasin, detail: `${x.nombre} en retard`, rouge: true }))} />
        </Section>
        {!!taux?.length && (
          <Section titre="Tenue des rituels">
            {taux.map((t) => (
              <Box key={t.rituel.type} sx={{ display: 'flex', gap: 1, py: 0.75, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                <Typography variant="body2" sx={{ flex: 1 }}>{t.rituel.libelle}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{libelleTaux(t)}</Typography>
              </Box>
            ))}
          </Section>
        )}
        <Section titre={`Objectifs en retard · ${enRetard.length}`}>
          <Liste vide={r.objectifs.length ? 'Tous les objectifs avancent au rythme prévu.' : 'Aucun objectif chiffré fixé sur le périmètre.'} lignes={enRetard.map((x) => ({ cle: `${x.magasin}:${x.o.id}`, magasin: x.magasin, detail: `${phraseObjectif(x.o)} · ${libelleStatut[x.statut].toLowerCase()}`, rouge: true }))} />
        </Section>
      </Box>
    </Box>
  )
}

export function RapportMois() {
  return <AvecReseau>{(reseau) => <Rapport reseau={reseau} />}</AvecReseau>
}
