// Vue d'ensemble d'un magasin (refonte vague 3, Joseph 09/11/2026, 22A) : au centre, où en est le magasin.
// Quatre indicateurs de la caisse (dernier mois connu, comparé à la référence des alertes), les prochaines étapes
// (visite, tâches, budget, clôture du mois) et le dernier compte rendu. Les informations du magasin sont à gauche.
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { Section } from './Section'
import { analyser, estVisite, formatEuros, formatKEuros, formatPourcent, libelleMois } from '../data/chiffres'
import { libelleTypeVisite, nomsVisiteurs, visiteFaite, type Magasin, type Reseau } from '../data/modele'
import { actionsDuMagasin, enRetard } from '../data/actions'
import { anneeDe, libellePasVu, lienCompteRendu, lienVisite, suiviRythme } from '../data/visites'
import { resumeCompteRendu } from '../data/resumeCompteRendu'
import { dateCourte, dateLongue, lienFiche } from '../lib/format'

function Indicateur({ libelle, valeur, detail, ton }: { libelle: string; valeur: string; detail?: string; ton?: 'bon' | 'mauvais' }) {
  return (
    <Card sx={{ minWidth: 0 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="body2" color="text.secondary">{libelle}</Typography>
        <Typography sx={{ fontSize: '1.375rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>{valeur}</Typography>
        {detail && <Typography variant="body2" sx={{ color: ton === 'bon' ? 'success.main' : ton === 'mauvais' ? 'error.main' : 'text.secondary', fontWeight: ton ? 700 : 400 }}>{detail}</Typography>}
      </CardContent>
    </Card>
  )
}

function Etape({ libelle, valeur, action }: { libelle: string; valeur: ReactNode; action?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minHeight: 48, py: 0.5, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: { xs: 96, sm: 150 }, flexShrink: 0 }}>{libelle}</Typography>
      <Box sx={{ flex: 1, minWidth: 0, typography: 'body2', fontWeight: 600 }}>{valeur}</Box>
      {action}
    </Box>
  )
}

export function SituationMagasin({ reseau, m, planifier, objectifs }: { reseau: Reseau; m: Magasin; planifier: () => void; objectifs?: ReactNode }) {
  const a = analyser(reseau, m.nom)
  const c = a?.chiffre
  const mois = a ? libelleMois(a.mois) : ''
  const rythme = suiviRythme(reseau, anneeDe(reseau.jour)).find((l) => l.magasin.nom === m.nom)
  const prevue = reseau.visites.filter((v) => v.magasin === m.nom && v.date > reseau.jour && estVisite(v)).sort((x, y) => x.date.localeCompare(y.date))[0]
  const ouvertes = actionsDuMagasin(reseau, m.nom).filter((x) => !x.a.faite)
  const retards = ouvertes.filter((x) => enRetard(x.a, reseau.jour)).length
  const derniere = reseau.visites.filter((v) => v.magasin === m.nom && visiteFaite(v, reseau.jour) && estVisite(v)).sort((x, y) => y.date.localeCompare(x.date))[0]
  const resume = derniere ? resumeCompteRendu(derniere) : null
  const lien = lienFiche(m.nom)
  return (
    <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <Box component="section" aria-label="Indicateurs du magasin" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' } }}>
        <Indicateur libelle={a ? `CA de ${mois}` : 'Chiffre d’affaires'} valeur={a?.ca != null ? formatKEuros(a.ca) : '—'}
          detail={a?.ecart != null ? `${formatPourcent(a.ecart)} vs ${libelleMois(a.reference)}` : a ? 'Pas de comparaison' : 'Pas encore de chiffres'} ton={a?.ecart != null ? (a.ecart >= 0 ? 'bon' : 'mauvais') : undefined} />
        <Indicateur libelle="Tickets du mois" valeur={c?.tickets != null ? c.tickets.toLocaleString('fr-FR') : '—'} detail={c?.fluxCave != null || c?.fluxBar != null ? `Cave ${c?.fluxCave ?? '—'} · Bar ${c?.fluxBar ?? '—'}` : undefined} />
        <Indicateur libelle="Panier moyen HT" valeur={c?.panier != null ? formatEuros(c.panier) : '—'} detail={c?.pmCave != null ? `Cave ${formatEuros(c.pmCave)}` : undefined} />
        <Indicateur libelle="Taux de marge" valeur={c?.marge != null ? `${c.marge.toLocaleString('fr-FR')} %` : '—'} />
      </Box>
      <Section titre="Prochaines étapes">
        <Etape libelle="Visite" valeur={prevue ? `${dateLongue(prevue.date)} · ${libelleTypeVisite(prevue.type)}${prevue.visiteurs.length ? ` · ${nomsVisiteurs(prevue)}` : ''}`
          : <Box component="span" sx={{ color: rythme?.alerte ? 'error.main' : 'text.secondary' }}>{rythme?.alerte ? `${libellePasVu(rythme)} · à planifier` : 'Pas de visite prévue'}</Box>}
          action={!prevue ? <Button onClick={planifier} sx={{ minHeight: 48, flexShrink: 0 }}>Planifier</Button> : <Button component={RouterLink} to={lienVisite(prevue)} sx={{ minHeight: 48, flexShrink: 0 }}>Ouvrir</Button>} />
        <Etape libelle="Tâches ouvertes" valeur={ouvertes.length ? <>{ouvertes.length}{retards ? <Box component="span" sx={{ color: 'error.main' }}>{` · ${retards} en retard`}</Box> : null}</> : 'Aucune'}
          action={<Button component={RouterLink} to={`${lien}?vue=activite`} sx={{ minHeight: 48 }}>Voir</Button>} />
        <Etape libelle="Budget" valeur="Construire, relire, valider" action={<Button component={RouterLink} to={`${lien}?vue=budget`} sx={{ minHeight: 48 }}>Ouvrir</Button>} />
        <Etape libelle="Clôture du mois" valeur="Réel, stock, frais" action={<Button component={RouterLink} to={`${lien}?vue=chiffres&partie=cloture`} sx={{ minHeight: 48 }}>Ouvrir</Button>} />
      </Section>
      {objectifs}
      <Section titre="Dernier compte rendu">
        {!derniere ? <Typography variant="body2" color="text.secondary">Aucune visite enregistrée.</Typography> : (
          <Box sx={{ display: 'grid', gap: 0.5 }}>
            <Typography variant="body2" color="text.secondary">{[dateCourte(derniere.date), libelleTypeVisite(derniere.type), nomsVisiteurs(derniere)].filter(Boolean).join(' · ')}</Typography>
            {resume?.phrase && <Typography sx={{ fontWeight: 700 }}>{resume.phrase}</Typography>}
            {resume?.faits && <Typography variant="body2">{resume.faits}</Typography>}
            {derniere.id !== null && <Link component={RouterLink} to={lienCompteRendu(derniere)} sx={{ fontWeight: 600, mt: 0.5, minHeight: 48, display: 'inline-flex', alignItems: 'center', width: 'fit-content' }}>Ouvrir le compte rendu</Link>}
          </Box>
        )}
      </Section>
    </Box>
  )
}
