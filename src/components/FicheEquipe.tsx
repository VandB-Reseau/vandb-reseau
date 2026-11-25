// Fiche d'un Coach ou d'un Responsable Régional plus visuelle (Joseph, 24/11/2026, choix 413 à 420), dans le style des
// écrans à graphes (#254 à #260) : phrase de lecture, cartes chiffrées, répartition en 4 tons, jauges de rythme, tableau en
// couleurs face à la médiane, graphe des visites par mois. Tout se calcule une fois par jeu de données (useMemo).
import { useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import DoneAllOutlined from '@mui/icons-material/DoneAllOutlined'
import DonutLargeOutlined from '@mui/icons-material/DonutLargeOutlined'
import { ton } from '../theme/theme'
import { BarreRepartition, BarresEmpilees, CarteGraphe } from './Graphes'
import { Indicateur, grilleIndicateurs, sensDe } from './Indicateur'
import { BoutonCouleurs, Lecture, fondEcart, fondsMediane, mediane } from './Visuel'
import { Entete, LigneSansResultat, useTableau, type ColonneTri } from './TableauTri'
import { Initiales } from './Social'
import { PastilleCase, tonParcDe, tonsParc } from './Sante'
import { useReference } from './Portefeuille'
import { analyser, formatPourcent } from '../data/chiffres'
import { caseDe } from '../data/sante'
import { coachA, suivi } from '../data/charge'
import { enRetard, type ActionSuivie } from '../data/actions'
import { anneeDe, libellePasVu, partEcoulee, type LigneRythme } from '../data/visites'
import { typesVisite, type Magasin, type Reseau, type Visite } from '../data/modele'
import type { Portefeuille } from '../data/portefeuille'
import { lienFiche } from '../lib/format'

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
const moisCourt = (mo: string) => new Date(`${mo}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
export const libelleMoisAnnee = (mo: string) => new Date(`${mo}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

// ── Jauges ──
// Couleur du rythme de visite selon l'avance sur ce qui est attendu à date (mêmes seuils que Rythme par Coach, #254)
export function couleurRythme(faites: number, reference: number, part: number): string {
  if (!reference) return ton.neutre
  const attendu = reference * part
  const avance = attendu > 0 ? faites / attendu : 1
  return avance < 0.5 ? ton.agir : avance < 0.8 ? ton.surveiller : ton.bon
}

// Jauge horizontale : remplissage coloré, dépassement plus clair, trait « à date » facultatif
export function Jauge({ valeur, max, couleur, repere, libelle, texte, repereTitre }: { valeur: number; max: number; couleur: string; repere?: number | null; libelle: string; texte: string; repereTitre?: string }) {
  const taux = max > 0 ? valeur / max : 0
  const echelle = Math.max(1, Math.min(taux, 1.5))
  const pct = (x: number) => `${Math.round((x / echelle) * 1000) / 10}%`
  return (
    <Box role="meter" aria-label={libelle} aria-valuemin={0} aria-valuemax={max} aria-valuenow={valeur} aria-valuetext={texte}
      sx={{ position: 'relative', height: 8, borderRadius: 4, bgcolor: 'action.hover', flex: 1, minWidth: 0 }}>
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4, width: pct(Math.min(taux, 1)), bgcolor: couleur }} />
      {taux > 1 && <Box data-depassement sx={{ position: 'absolute', top: 0, bottom: 0, left: pct(1), width: pct(Math.min(taux, echelle) - 1), borderRadius: '0 4px 4px 0', bgcolor: couleur, opacity: 0.4 }} />}
      {repere != null && repere > 0 && repere < 1 && (
        <Tooltip title={repereTitre ?? ''}>
          <Box data-attendu sx={{ position: 'absolute', top: -4, bottom: -4, left: pct(repere), width: 2, ml: '-1px', bgcolor: 'text.primary', borderRadius: 1 }} />
        </Tooltip>
      )}
    </Box>
  )
}

// ── 413 à 416 : Vue d'ensemble ──
export function EnsembleEquipe({ reseau, magasins, rythme, p, carte }: { reseau: Reseau; magasins: Magasin[]; rythme: LigneRythme[]; p: Portefeuille; carte: ReactNode }) {
  const ref = useReference(reseau)
  const a = anneeDe(reseau.jour)
  const part = partEcoulee(a, reseau.jour)
  const repartition = useMemo(() => {
    const v = [0, 0, 0, 0]
    for (const m of magasins) if (m.statut !== 'avenir') v[tonParcDe(caseDe(reseau.evaluations[m.nom])?.id)]++
    return v
  }, [reseau, magasins])
  const nbPasVus = rythme.filter((l) => l.alerte).length
  const attendu = Math.round(p.visitesReference * part)
  const tauxDate = attendu > 0 ? Math.round((p.visitesFaites / attendu) * 100) : null
  const couleur = couleurRythme(p.visitesFaites, p.visitesReference, part)
  // 416 : la phrase de lecture, à partir des mêmes chiffres que les cartes
  const lecture = p.magasins === 0 ? null : `${pluriel(p.magasins, 'magasin')} : ${[
    p.evolutionCA !== null ? `CA ${formatPourcent(p.evolutionCA)} sur un an${ref && ref.p.evolutionCA !== null ? ` (${ref.libelle} ${formatPourcent(ref.p.evolutionCA)})` : ''}` : null,
    p.avecChiffres ? `${p.decroche} en Décroche` : null,
    nbPasVus ? `${nbPasVus} pas vu${nbPasVus > 1 ? 's' : ''} dans le délai` : 'tous vus dans le délai',
    tauxDate !== null ? `visites à ${tauxDate} % du rythme attendu à date` : null,
  ].filter(Boolean).join(', ')}.`
  return (
    <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <Lecture texte={lecture} />
      {carte}
      <Box sx={{ display: 'grid', gap: { xs: 1, md: 1.5 }, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' } }}>
        <CarteGraphe titre="Santé des magasins" sousTitre="Classement nine box du jour">
          <BarreRepartition label="Répartition des magasins" parts={tonsParc.map((t, i) => ({ libelle: t.libelle, valeur: repartition[i], couleur: t.couleur }))} />
        </CarteGraphe>
        <CarteGraphe titre={`Rythme de visite ${a.court}`} sousTitre="Visites faites sur la référence nine box">
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 22, color: couleur, fontVariantNumeric: 'tabular-nums' }}>{p.visitesReference ? `${Math.round((p.visitesFaites / p.visitesReference) * 100)} %` : '—'}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{`${p.visitesFaites} / ${p.visitesReference}`}</Typography>
          </Box>
          <Jauge valeur={p.visitesFaites} max={p.visitesReference} couleur={couleur} repere={part} libelle="Rythme de visite de l’année"
            texte={`${p.visitesFaites} sur ${p.visitesReference}`} repereTitre={`À date : ${attendu} visites attendues`} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {p.visitesReference ? `À date : ${attendu} attendue${attendu > 1 ? 's' : ''}` : 'Aucune référence : magasins non classés'}{nbPasVus ? ` · ${nbPasVus} magasin${nbPasVus > 1 ? 's' : ''} pas vu${nbPasVus > 1 ? 's' : ''} dans le délai` : ''}
          </Typography>
        </CarteGraphe>
      </Box>
    </Box>
  )
}

// ── 417 : magasins en tableau de couleurs (PC) ──
interface LigneMagasin { m: Magasin; coach: string; caseLibelle: string | null; ecart: number | null; face: number | null; depuis: number | null; alerte: boolean; taches: number }
const colonnesMagasins = (avecCoach: boolean): ColonneTri<LigneMagasin>[] => [
  { cle: 'nom', libelle: 'Magasin', valeur: (l) => l.m.nom },
  ...(avecCoach ? [{ cle: 'coach', libelle: 'Coach', valeur: (l: LigneMagasin) => l.coach || 'Sans Coach' }] : []),
  { cle: 'case', libelle: 'Nine box', valeur: (l) => l.caseLibelle, texte: (l) => l.caseLibelle ?? 'Non classé' },
  { cle: 'ecart', libelle: 'CA vs N-1', valeur: (l) => l.ecart, unite: '%', premier: 'asc' },
  { cle: 'face', libelle: 'Face à la médiane', valeur: (l) => l.face, unite: 'pt', premier: 'asc' },
  { cle: 'depuis', libelle: 'Dernière visite', valeur: (l) => l.depuis, unite: 'j', premier: 'desc' },
  { cle: 'taches', libelle: 'Tâches en cours', valeur: (l) => l.taches, premier: 'desc' },
]
const points = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pt${Math.abs(n) >= 2 ? 's' : ''}`

export function TableauMagasinsEquipe({ reseau, magasins, rythme, actions, avecCoach = false }: { reseau: Reseau; magasins: Magasin[]; rythme: LigneRythme[]; actions: ActionSuivie[]; avecCoach?: boolean }) {
  const [couleurs, setCouleurs] = useState(() => { try { return localStorage.getItem('vandb-couleurs-fiche-equipe') !== 'non' } catch { return true } })
  const basculer = () => { setCouleurs(!couleurs); try { localStorage.setItem('vandb-couleurs-fiche-equipe', couleurs ? 'non' : 'oui') } catch { /* stockage indisponible */ } }
  const lignes = useMemo(() => {
    const parMagasin = new Map(rythme.map((l) => [l.magasin.nom, l]))
    const taches = new Map<string, number>()
    for (const x of actions) if (!x.a.faite) taches.set(x.magasin, (taches.get(x.magasin) ?? 0) + 1)
    const base = magasins.map((m) => {
      const l = parMagasin.get(m.nom)
      return { m, coach: suivi(m, coachA(m, reseau.jour)), caseLibelle: caseDe(reseau.evaluations[m.nom])?.libelle ?? null, ecart: analyser(reseau, m.nom)?.ecart ?? null,
        depuis: l?.derniere ? l.depuis ?? 0 : null, alerte: !!l?.alerte, taches: taches.get(m.nom) ?? 0 }
    })
    const med = mediane(base.flatMap((x) => (x.ecart !== null ? [x.ecart] : [])))
    return { med, liste: base.map((x): LigneMagasin => ({ ...x, face: med !== null && x.ecart !== null ? x.ecart - med : null })) }
  }, [reseau, magasins, rythme, actions])
  const colonnes = useMemo(() => colonnesMagasins(avecCoach), [avecCoach])
  const t = useTableau(lignes.liste, colonnes, { memoire: `fiche-equipe-magasins:${avecCoach ? 'rr' : 'coach'}` })
  const fonds = useMemo(() => {
    if (!couleurs) return null
    const visites = fondsMediane(t.lignes.map((l) => l.depuis), true)
    return new Map(t.lignes.map((l, k) => [l.m.nom, { ecart: fondEcart(l.ecart, 15), face: fondEcart(l.face, 10), depuis: l.alerte ? visites[k] ?? fondEcart(-1, 2) : visites[k] }]))
  }, [couleurs, t.lignes])
  const med = (f: (l: LigneMagasin) => number | null) => mediane(lignes.liste.flatMap((l) => { const v = f(l); return v === null ? [] : [v] }))
  const medDepuis = med((l) => l.depuis), medTaches = med((l) => l.taches)
  return (
    <Box component="section" aria-label="Liste des magasins" sx={{ display: 'grid', gap: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><BoutonCouleurs actif={couleurs} basculer={basculer} /></Box>
      <TableContainer component={Paper}>
        <Table size="small" aria-label="Tableau des magasins du portefeuille">
          <TableHead><TableRow>{colonnes.map((c) => <Entete key={c.cle} t={t} cle={c.cle} align={c.cle === 'nom' || c.cle === 'coach' || c.cle === 'case' ? undefined : 'right'} />)}</TableRow></TableHead>
          <TableBody>
            <TableRow data-mediane sx={{ '& td': { fontWeight: 600, bgcolor: 'action.hover' } }}>
              <TableCell>Médiane de ses magasins</TableCell>
              {avecCoach && <TableCell />}
              <TableCell />
              <TableCell align="right">{lignes.med === null ? '—' : formatPourcent(lignes.med)}</TableCell>
              <TableCell align="right">—</TableCell>
              <TableCell align="right">{medDepuis === null ? '—' : `${Math.round(medDepuis)} j`}</TableCell>
              <TableCell align="right">{medTaches === null ? '—' : String(Math.round(medTaches))}</TableCell>
            </TableRow>
            <LigneSansResultat t={t} colSpan={colonnes.length} quoi="Aucun magasin ne correspond" />
            {t.lignes.map((l) => {
              const f = fonds?.get(l.m.nom)
              return (
                <TableRow key={l.m.nom} hover>
                  <TableCell><Link component={RouterLink} to={lienFiche(l.m.nom)} sx={{ fontWeight: 600 }}>{l.m.nom}</Link></TableCell>
                  {avecCoach && <TableCell>{l.coach || 'Sans Coach'}</TableCell>}
                  <TableCell><PastilleCase c={caseDe(reseau.evaluations[l.m.nom])} /></TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', bgcolor: f?.ecart }}>{l.ecart === null ? '—' : formatPourcent(l.ecart)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', bgcolor: f?.face }}>{l.face === null ? '—' : points(l.face)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', bgcolor: f?.depuis, color: l.alerte ? 'warning.dark' : undefined, fontWeight: l.alerte ? 600 : undefined }}>{l.depuis === null ? 'Jamais' : `${l.depuis} j`}</TableCell>
                  <TableCell align="right">{l.taches || ''}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

// ── 418 : Coachs d'un RR en lignes à deux jauges (charge, rythme de visite) ──
export interface LigneCoachEquipe { nom: string; lien: string; magasins: number; charge: number; faites: number; reference: number }
export function LignesCoachs({ reseau, coachs }: { reseau: Reseau; coachs: LigneCoachEquipe[] }) {
  const part = partEcoulee(anneeDe(reseau.jour), reseau.jour)
  const max = reseau.parametres.maxUnits
  return (
    <Box role="list" aria-label="Coachs rattachés" sx={{ mx: { xs: -2, md: -3 }, '& > * + *': { borderTop: '1px solid', borderColor: 'divider' } }}>
      {coachs.map((c) => {
        const couleurCharge = c.charge > max ? ton.agir : c.charge > max * 0.9 ? ton.surveiller : ton.bon
        const couleurVisites = couleurRythme(c.faites, c.reference, part)
        const taux = c.reference ? `${Math.round((c.faites / c.reference) * 100)} %` : '—'
        return (
          <Box role="listitem" key={c.nom} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 2, md: 3 }, py: 1, minHeight: 48 }}>
            <Initiales nom={c.nom} taille={32} />
            <Box sx={{ flex: 1, minWidth: 0, display: 'grid', gap: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Link component={RouterLink} to={c.lien} sx={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', py: 0.5 }}>{c.nom}</Link>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{pluriel(c.magasins, 'magasin')}</Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) 72px', alignItems: 'center', columnGap: 1, rowGap: 0.5 }}>
                <Typography variant="body2" color="text.secondary">Charge</Typography>
                <Jauge valeur={c.charge} max={max} couleur={couleurCharge} libelle={`Charge de ${c.nom}`} texte={`${c.charge} sur ${max}`} />
                <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right', color: couleurCharge, fontVariantNumeric: 'tabular-nums' }}>{`${c.charge}/${max}`}</Typography>
                <Typography variant="body2" color="text.secondary">Visites</Typography>
                <Jauge valeur={c.faites} max={c.reference} couleur={couleurVisites} repere={part} libelle={`Visites de ${c.nom}`} texte={`${c.faites} sur ${c.reference}, ${taux}`}
                  repereTitre={`À date : ${Math.round(c.reference * part)} visites attendues`} />
                <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right', color: couleurVisites, fontVariantNumeric: 'tabular-nums' }}>{taux}</Typography>
              </Box>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

// ── 419 : tâches en cartes chiffrées, avec la barre d'avancement de l'année ──
const decalerMois = (mo: string, n: number) => { const [a, m] = mo.split('-').map(Number); return new Date(Date.UTC(a, m - 1 + n, 15)).toISOString().slice(0, 7) }
export function CartesTachesEquipe({ reseau, actions }: { reseau: Reseau; actions: ActionSuivie[] }) {
  const c = useMemo(() => {
    const mois = reseau.jour.slice(0, 7), avant = decalerMois(mois, -1), an = reseau.jour.slice(0, 4)
    const ouvertes = actions.filter((x) => !x.a.faite)
    const faiteLe = (x: ActionSuivie) => (x.a.faite ?? '').slice(0, 7)
    const del = actions.filter((x) => x.date.startsWith(an))
    return {
      ouvertes: ouvertes.length, enCours: ouvertes.filter((x) => x.a.statut === 'en_cours').length,
      retard: ouvertes.filter((x) => enRetard(x.a, reseau.jour)).length,
      ceMois: actions.filter((x) => faiteLe(x) === mois).length, moisAvant: actions.filter((x) => faiteLe(x) === avant).length,
      an, totalAn: del.length, faitesAn: del.filter((x) => x.a.faite).length,
    }
  }, [reseau, actions])
  const ecart = c.ceMois - c.moisAvant
  const avancement = c.totalAn ? Math.round((c.faitesAn / c.totalAn) * 100) : null
  return (
    <Box role="group" aria-label="Tâches en chiffres" sx={grilleIndicateurs}>
      <Indicateur icone={<TaskAltOutlined />} libelle="À faire" valeur={String(c.ouvertes)} detail={c.ouvertes ? `dont ${c.enCours} en cours` : 'Rien en attente'} />
      <Indicateur icone={<ScheduleOutlined />} libelle="En retard" valeur={String(c.retard)} couleur={c.retard ? 'error.main' : undefined} detail={c.ouvertes ? `${Math.round((c.retard / c.ouvertes) * 100)} % des tâches à faire` : '—'} />
      <Indicateur icone={<DoneAllOutlined />} libelle="Faites ce mois" valeur={String(c.ceMois)}
        evolution={c.ceMois || c.moisAvant ? { texte: `${ecart > 0 ? '+' : ''}${ecart}`, sens: sensDe(ecart, 0.5), reference: `vs ${c.moisAvant} le mois d’avant` } : null} />
      <Indicateur icone={<DonutLargeOutlined />} libelle={`Avancement ${c.an}`} valeur={avancement === null ? '—' : `${avancement} %`} detail={c.totalAn ? `${c.faitesAn} faites sur ${c.totalAn} créées` : 'Aucune tâche cette année'}>
        {avancement !== null && <Box sx={{ mt: 1, height: 8, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden' }}><Box sx={{ height: '100%', width: `${avancement}%`, bgcolor: ton.bon, borderRadius: 4 }} /></Box>}
      </Indicateur>
    </Box>
  )
}

// ── 419 : visites des 12 derniers mois par type (6 sur téléphone) ; un clic sur un mois filtre la liste ──
export function GrapheVisitesEquipe({ reseau, visites, larges, moisChoisi, choisir }: { reseau: Reseau; visites: Visite[]; larges: boolean; moisChoisi: string | null; choisir: (m: string | null) => void }) {
  const colonnes = useMemo(() => {
    const courant = reseau.jour.slice(0, 7)
    const mois = Array.from({ length: 12 }, (_x, i) => decalerMois(courant, i - 11))
    const compte = new Map<string, number[]>(mois.map((m) => [m, typesVisite.map(() => 0)]))
    for (const v of visites) {
      const c = compte.get(v.date.slice(0, 7)), k = typesVisite.findIndex((t) => t.id === v.type)
      if (c && k >= 0) c[k]++
    }
    return mois.map((m) => ({ cle: m, libelle: moisCourt(m), valeurs: compte.get(m)! }))
  }, [reseau.jour, visites])
  return (
    <CarteGraphe titre={`Visites des ${larges ? 12 : 6} derniers mois`} sousTitre={moisChoisi ? `Liste limitée à ${libelleMoisAnnee(moisChoisi)}` : 'Par type de visite'}
      fin={moisChoisi ? <Button onClick={() => choisir(null)} sx={{ minHeight: 40 }}>Tous les mois</Button> : undefined}>
      <BarresEmpilees colonnes={larges ? colonnes : colonnes.slice(-6)} series={typesVisite.map((t) => ({ libelle: t.libelle, couleur: t.couleur }))} label="Visites par mois et par type"
        actif={moisChoisi} ouvrir={(k) => choisir(moisChoisi === k ? null : k)} libelleOuvrir={(c) => `${libelleMoisAnnee(c.cle)} : ${c.valeurs.reduce((a, v) => a + v, 0)} visites`} />
    </CarteGraphe>
  )
}

// ── 420 : magasins pas vus dans le délai, avec une barre du retard au-delà du délai de leur case ──
export function LignesPasVus({ lignes }: { lignes: LigneRythme[] }) {
  const retardDe = (l: LigneRythme) => (l.depuis === null ? null : Math.max(0, l.depuis - l.delai))
  const max = Math.max(1, ...lignes.map((l) => retardDe(l) ?? 0))
  return (
    <Box role="list" aria-label="Magasins pas vus dans le délai" sx={{ display: 'grid' }}>
      {lignes.map((l) => {
        const r = retardDe(l)
        const fort = r === null || r >= l.delai
        const couleur = fort ? ton.agir : ton.surveiller
        return (
          <Box role="listitem" key={l.magasin.nom} sx={{ display: 'grid', gap: 0.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Link component={RouterLink} to={lienFiche(l.magasin.nom)} sx={{ fontWeight: 600, flex: 1, minWidth: 0, py: 0.5 }}>{l.magasin.nom}</Link>
              <Typography variant="body2" sx={{ fontWeight: 700, color: couleur, whiteSpace: 'nowrap' }}>{libellePasVu(l)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box role="img" aria-label={r === null ? 'Jamais visité' : `${r} jours au-delà du délai de ${l.delai} jours`} sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden' }}>
                <Box sx={{ height: '100%', width: `${r === null ? 100 : Math.max(4, (r / max) * 100)}%`, bgcolor: couleur, borderRadius: 4 }} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{r === null ? 'jamais' : `+${r} j`}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">{[l.case?.libelle ?? 'Non classé', `délai ${l.delai} j`, l.dernierContact && `appel le ${new Date(`${l.dernierContact.date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`].filter(Boolean).join(' · ')}</Typography>
          </Box>
        )
      })}
    </Box>
  )
}
