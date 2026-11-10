// Vue d'ensemble d'un magasin (refonte vague 3, Joseph 09/11/2026, 22A) : au centre, où en est le magasin.
// Quatre indicateurs de la caisse (dernier mois connu, comparé à la référence des alertes), les prochaines étapes
// (visite, tâches, budget, clôture du mois) et le dernier compte rendu. Les informations du magasin sont à gauche.
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined'
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined'
import { iconeEtape } from './BoutonVisite'
import { prochaineEtape } from '../data/ordreDuJour'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { Section } from './Section'
import { Indicateur as CarteIndicateur } from './Indicateur'
import { useTheme } from '@mui/material/styles'
import { ParcoursIntegration } from './ParcoursIntegration'
import { analyser, estVisite, formatEuros, formatKEuros, formatPourcent, libelleMois } from '../data/chiffres'
import { libelleTypeVisite, nomsVisiteurs, visiteFaite, type Magasin, type Reseau } from '../data/modele'
import { actionsDuMagasin, enRetard } from '../data/actions'
import { anneeDe, libellePasVu, lienCompteRendu, suiviRythme } from '../data/visites'
import { resumeCompteRendu } from '../data/resumeCompteRendu'
import { dateCourte, lienFiche } from '../lib/format'

// Vague 5 (53A) : la carte d'indicateur commune ; ton : couleur de l'écart
export function Indicateur({ libelle, valeur, detail, ton }: { libelle: string; valeur: string; detail?: string; ton?: 'bon' | 'mauvais' }) {
  const theme = useTheme()
  return <CarteIndicateur libelle={libelle} valeur={valeur} detail={detail} couleurDetail={ton === 'bon' ? theme.palette.success.dark : ton === 'mauvais' ? theme.palette.error.main : undefined} />
}

// Vague 7 (90A et retour de Joseph, 10/11/2026) : les prochaines étapes en tuiles cliquables, au lieu d'un tableau
function Tuile({ libelle, valeur, detail, lien, icone, alerte }: { libelle: string; valeur: string; detail?: string; lien: string; icone: ReactNode; alerte?: boolean }) {
  return (
    <ButtonBase component={RouterLink} to={lien} aria-label={`${libelle} : ${valeur}${detail ? `, ${detail}` : ''}`}
      sx={{ display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr)', columnGap: 1.25, alignItems: 'start', justifyItems: 'start', textAlign: 'left', p: 1.75, minHeight: 88,
        bgcolor: 'background.paper', border: '1px solid', borderColor: alerte ? 'error.light' : 'divider', borderRadius: 2, fontFamily: 'inherit', '&:hover': { borderColor: 'text.primary' } }}>
      <Box sx={{ color: alerte ? 'error.main' : 'text.secondary', mt: 0.25, display: 'flex' }}>{icone}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">{libelle}</Typography>
        <Typography sx={{ fontWeight: 700, lineHeight: 1.3 }}>{valeur}</Typography>
        {detail && <Typography variant="body2" sx={{ color: alerte ? 'error.main' : 'text.secondary' }}>{detail}</Typography>}
      </Box>
    </ButtonBase>
  )
}

export function SituationMagasin({ reseau, m, objectifs }: { reseau: Reseau; m: Magasin; objectifs?: ReactNode }) {
  const a = analyser(reseau, m.nom)
  const c = a?.chiffre
  const mois = a ? libelleMois(a.mois) : ''
  const rythme = suiviRythme(reseau, anneeDe(reseau.jour)).find((l) => l.magasin.nom === m.nom)
  const etape = prochaineEtape(reseau, m.nom)
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
      <Box component="section" aria-label="Prochaines étapes" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' } }}>
        <Tuile libelle="Visite" valeur={etape.libelle} detail={etape.etape === 'planifier' && rythme?.alerte ? libellePasVu(rythme) : etape.detail} lien={etape.lien} icone={iconeEtape[etape.etape]} alerte={etape.etape === 'planifier' && !!rythme?.alerte} />
        <Tuile libelle="Tâches" valeur={ouvertes.length ? `${ouvertes.length} en cours` : 'Aucune en cours'} detail={retards ? `${retards} en retard` : undefined} lien={`${lien}?vue=activite`} icone={<TaskAltOutlined />} alerte={retards > 0} />
        <Tuile libelle="Budget" valeur="Construire, relire, valider" lien={`${lien}?vue=budget`} icone={<AccountBalanceWalletOutlined />} />
        <Tuile libelle="Clôture du mois" valeur="Réel, stock, frais" lien={`${lien}?vue=chiffres&partie=cloture`} icone={<FactCheckOutlined />} />
      </Box>
      <ParcoursIntegration reseau={reseau} m={m} />
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
