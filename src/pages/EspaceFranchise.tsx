import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ArrowBack from '@mui/icons-material/ArrowBack'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import QueryStatsOutlined from '@mui/icons-material/QueryStatsOutlined'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined'
import CallOutlined from '@mui/icons-material/CallOutlined'
import MailOutlined from '@mui/icons-material/MailOutlined'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'
import { CarteLignes, GrillePhotos, Initiales, LigneCompacte, MiniCourbe, Pastille, Puces, TitreSection, type Ton } from '../components/Social'
import { ProfilPersonne, rond } from '../components/Portefeuille'
import { FilActivite } from './Accueil'
import { filDu, type ElementFil } from '../data/fil'
import { useCommunicationsDuFil, type Communication } from '../data/communications'
import { useReactionsPratiques } from '../data/reactionsPratiques'
import { useReactionsVisites } from '../data/reactionsVisites'
import { brand } from '../theme/theme'
import Snackbar from '@mui/material/Snackbar'
import { lienFil } from '../data/messagerie'
import { useMessagerie } from '../data/MessagerieContext'
import { AvecReseau } from '../components/EtatDonnees'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { ContenuOnglet, Onglets, type Rubrique } from '../components/Onglets'
import { GraphiqueCA } from '../components/Chiffres'
import { CartePratique } from '../components/BonnesPratiques'
import { Contact, Ligne, Section } from '../components/Section'
import { useApercu } from '../auth/Apercu'
import { SectionReunionsFranchise } from '../components/Reunions'
import { SondagesARepondre } from '../components/Questions'
import { SectionChallengesFranchise } from '../components/Challenges'
import { dateCourte, dateLongue, lienFiche, telLien } from '../lib/format'
import { actionsDes, echeanceDate, enRetard } from '../data/actions'
import { analyser, caDe, chiffresDuMagasin, decalerMois, dernierAudit, formatEuros, formatKEuros, formatPourcent, formatValeur, libelleAudit, libelleMois, type ChampChiffre } from '../data/chiffres'
import { campagnesDuMagasin, executionMagasin, libellesExecution, magasinsConcernes, phase, libellesPhase, type Execution } from '../data/campagnes'
import { associesEnPlace, mandatActuel } from '../data/associes'
import { lienCompteRendu, visitesDuMagasin } from '../data/visites'
import { libelleTypeVisite, nomsVisiteurs, statutLibelle, visiteFaite, type Magasin, type Personne, type Reseau } from '../data/modele'
import type { IndicateurRepere } from '../data/espaceFranchise'
import { Blason } from '../components/Blason'
import { Fenetre } from '../components/EditionEquipe'
import { TexteDicte } from '../components/Dictee'
import { ErreurAction } from '../data/espaceFranchise'
import { ecrireMotFranchise, ErreurMot, motDe, partiesMot, prochaineVisite, type ContenuMot } from '../data/motFranchise'

const couleurExecution: Record<Execution, 'success' | 'warning' | 'error' | 'default'> = { fait: 'success', partiel: 'warning', non: 'error', aConstater: 'default' }
const pastille = { fontSize: 12, fontWeight: 600 }


// ── Bandeau de l'aperçu (Directeur de réseau) ──
export function BandeauApercu() {
  const { apercu, quitter } = useApercu()
  const naviguer = useNavigate()
  if (!apercu) return null
  return (
    <Box role="region" aria-label="Aperçu" sx={{ bgcolor: 'secondary.main', color: 'secondary.contrastText', px: { xs: 2, md: 5 }, py: 1, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
      <VisibilityOutlined />
      <Typography variant="body1" sx={{ flex: 1, fontWeight: 600, minWidth: 0 }}>Espace de {apercu.franchise}</Typography>
      <Button variant="outlined" color="inherit" onClick={() => { const nom = apercu.franchise; quitter(); naviguer(`/equipe/franchise/${encodeURIComponent(nom)}`, { replace: true }) }} sx={{ minHeight: 48 }}>Quitter l’aperçu</Button>
    </Box>
  )
}

// ── Petits éléments ──
function LigneSimple({ titre, detail, fin, lien }: { titre: ReactNode; detail?: ReactNode; fin?: ReactNode; lien?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {lien ? <Link component={RouterLink} to={lien} variant="body1" sx={{ fontWeight: 500 }}>{titre}</Link> : <Typography variant="body1" sx={{ fontWeight: 500 }}>{titre}</Typography>}
        {detail && <Typography variant="body2" color="text.secondary">{detail}</Typography>}
      </Box>
      {fin}
    </Box>
  )
}
const Vide = ({ children }: { children: ReactNode }) => <CarteLignes><LigneCompacte titre={children} /></CarteLignes>

// Coachs et Responsables Régionaux des magasins, sans doublon
function contacts(reseau: Reseau, magasins: Magasin[]): { role: string; p: Personne }[] {
  const vus = new Set<string>()
  const res: { role: string; p: Personne }[] = []
  for (const m of magasins) {
    if (m.coach && !vus.has(`c:${m.coach}`)) { vus.add(`c:${m.coach}`); res.push({ role: 'Coach', p: reseau.coachs[m.coach] ?? { nom: m.coach } }) }
    if (m.rr && !vus.has(`r:${m.rr.id}`)) { vus.add(`r:${m.rr.id}`); res.push({ role: m.rr.integres ? 'Responsable Magasins Intégrés' : 'Responsable Régional', p: m.rr }) }
  }
  return res
}

// Les douze derniers mois de CA, pour la mini-courbe
function douzeMois(reseau: Reseau, magasin: string, mois: string): (number | null)[] {
  const liste = chiffresDuMagasin(reseau, magasin)
  return Array.from({ length: 12 }, (_v, i) => caDe(liste.find((c) => c.mois === decalerMois(mois, i - 11))))
}
const couleurEcart = (e: number | null) => (e === null ? 'text.secondary' : e < 0 ? 'error.main' : 'success.main')

// ── Repères réseau ──
const libellesReperes: Record<IndicateurRepere, string> = {
  evolution: 'Évolution du CA vs N-1', pmCave: 'Panier moyen HT cave', pmBar: 'Panier moyen HT bar',
  fluxCave: 'Flux cave', fluxBar: 'Flux bar', panier: 'Panier moyen', marge: 'Marge',
}
const ordreReperes: IndicateurRepere[] = ['evolution', 'pmCave', 'pmBar', 'fluxCave', 'fluxBar', 'panier', 'marge']
const formatRepere = (i: IndicateurRepere, n: number | null) => (i === 'evolution' ? formatPourcent(n) : formatValeur(i as ChampChiffre, n))

function valeurRepere(reseau: Reseau, magasin: string, mois: string, i: IndicateurRepere): number | null {
  const liste = chiffresDuMagasin(reseau, magasin)
  const c = liste.find((x) => x.mois === mois)
  if (i !== 'evolution') return c?.[i] ?? null
  const ca = caDe(c), ref = caDe(liste.find((x) => x.mois === decalerMois(mois, -12)))
  return ca !== null && ref ? ((ca - ref) / ref) * 100 : null
}

const positionDe = (v: number, mediane: number, quartHaut: number): [string, Ton] =>
  v >= quartHaut ? ['Quart supérieur', 'vert'] : v >= mediane ? ['Au-dessus de la médiane', 'bleu'] : ['Sous la médiane', 'orange']
function Position({ v, mediane, quartHaut }: { v: number | null; mediane: number; quartHaut: number }) {
  if (v === null) return null
  const [libelle, ton] = positionDe(v, mediane, quartHaut)
  return <Pastille ton={ton}>{libelle}</Pastille>
}

// Tuiles carrées comme sur l'accueil de l'équipe (Joseph, 23/10/2026) : deux par ligne sur téléphone, quatre sur PC
const grilleTuiles = { display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: { xs: 1, md: 1.5 } } as const
// large : toute la largeur ; largeTelephone : toute la largeur sur téléphone seulement
function Tuile({ libelle, valeur, detail, couleur, lien, large = false, largeTelephone = false, fin, children }: {
  libelle: string; valeur: ReactNode; detail?: ReactNode; couleur?: string; lien?: string; large?: boolean; largeTelephone?: boolean; fin?: ReactNode; children?: ReactNode
}) {
  const sx = { display: 'block', minWidth: 0, textAlign: 'left', px: { xs: 1.5, md: 2 }, py: { xs: 1.25, md: 1.75 }, borderRadius: '14px', bgcolor: 'background.paper', color: 'text.primary', fontFamily: 'inherit', textDecoration: 'none',
    ...(large ? { gridColumn: '1 / -1' } : largeTelephone ? { gridColumn: { xs: '1 / -1', md: 'auto' } } : {}), ...(lien ? { '@media (hover: hover)': { '&:hover': { bgcolor: 'action.hover' } } } : {}) } as const
  const contenu = (
    <>
      <Typography color="text.secondary" sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' }, lineHeight: 1.35 }}>{libelle}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: large ? { xs: '1.75rem', md: '2rem' } : { xs: '1.25rem', md: '1.5rem' }, fontWeight: 700, lineHeight: 1.25, color: couleur }}>{valeur}</Typography>
          {detail && <Typography color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>{detail}</Typography>}
        </Box>
        {fin}
      </Box>
      {children}
    </>
  )
  return lien
    ? <ButtonBase component={RouterLink} to={lien} sx={sx}>{contenu}</ButtonBase>
    : <Box role="group" aria-label={libelle} sx={sx}>{contenu}</Box>
}

function SectionReperes({ reseau, magasins }: { reseau: Reseau; magasins: Magasin[] }) {
  const r = reseau.espace?.reperes
  const indicateurs = r ? ordreReperes.filter((i) => r.indicateurs[i]) : []
  const seul = magasins.length === 1
  return (
    <Box component="section" aria-label="Repères réseau">
      <TitreSection>{r ? `Repères réseau · ${libelleMois(r.mois)}` : 'Repères réseau'}</TitreSection>
      {!indicateurs.length ? <Vide>Pas encore assez de magasins avec des chiffres ce mois-ci pour comparer.</Vide> : (
        <Box sx={grilleTuiles}>
          {indicateurs.map((i) => {
            const x = r!.indicateurs[i]!
            const valeurs = magasins.map((m) => ({ m, v: valeurRepere(reseau, m.nom, r!.mois, i) }))
            const v = valeurs[0]?.v ?? null
            const pos = seul && v !== null ? positionDe(v, x.mediane, x.quartHaut) : null
            return (
              <Tuile key={i} largeTelephone={!seul} libelle={libellesReperes[i]} valeur={seul ? formatRepere(i, v) : `${formatRepere(i, x.mediane)}`}
                couleur={pos ? (pos[1] === 'orange' ? 'warning.dark' : pos[1] === 'vert' ? 'success.dark' : 'info.dark') : undefined}
                detail={seul ? `Médiane ${formatRepere(i, x.mediane)} · quart sup. ${formatRepere(i, x.quartHaut)}` : `Médiane du réseau · quart sup. ${formatRepere(i, x.quartHaut)}`}>
                {seul ? pos && <Box sx={{ mt: 0.75 }}><Pastille ton={pos[1]}>{pos[0]}</Pastille></Box> : valeurs.map(({ m, v: w }) => (
                  <Box key={m.nom} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>{`${m.nom} : ${formatRepere(i, w)}`}</Typography>
                    <Position v={w} mediane={x.mediane} quartHaut={x.quartHaut} />
                  </Box>
                ))}
              </Tuile>
            )
          })}
        </Box>
      )}
    </Box>
  )
}

// ── Chiffres : le CA du mois en grande tuile avec la courbe des douze derniers mois, puis paniers, flux et marge ──
function SectionChiffresDuMois({ reseau, magasins }: { reseau: Reseau; magasins: Magasin[] }) {
  if (magasins.length > 1) {
    return (
      <Box component="section" aria-label="Mes chiffres">
        <TitreSection>Mes chiffres</TitreSection>
        <Box sx={grilleTuiles}>
          {magasins.map((m) => {
            const a = analyser(reseau, m.nom)
            return (
              <Tuile key={m.nom} lien={`${lienFiche(m.nom)}?vue=chiffres`} libelle={m.nom} valeur={a ? formatKEuros(a.ca) : '—'}
                detail={a ? <><Box component="span" sx={{ fontWeight: 600, color: couleurEcart(a.ecart) }}>{formatPourcent(a.ecart)}</Box> · {libelleMois(a.mois)}</> : 'Aucun chiffre enregistré'}>
                {a && <Box aria-hidden sx={{ mt: 0.75 }}><MiniCourbe valeurs={douzeMois(reseau, m.nom, a.mois)} couleur={brand.vertFonce} largeur={96} hauteur={28} /></Box>}
              </Tuile>
            )
          })}
        </Box>
      </Box>
    )
  }
  const m = magasins[0]
  const a = analyser(reseau, m.nom)
  if (!a) return <Box component="section" aria-label="Mes chiffres"><TitreSection>Mes chiffres</TitreSection><Vide>Aucun chiffre enregistré pour ce magasin.</Vide></Box>
  const c = a.chiffre
  const tuiles: [string, string, string?][] = [
    ['Panier moyen HT cave', formatValeur('pmCave', c.pmCave)], ['Panier moyen HT bar', formatValeur('pmBar', c.pmBar)],
    ['Flux cumulé', formatValeur('tickets', c.tickets), c.fluxCave !== null || c.fluxBar !== null ? `cave ${formatValeur('fluxCave', c.fluxCave)} · bar ${formatValeur('fluxBar', c.fluxBar)}` : undefined],
    ['Marge', formatValeur('marge', c.marge)],
  ]
  return (
    <Box component="section" aria-label="Mes chiffres">
      <TitreSection>{`Mes chiffres · ${libelleMois(a.mois)}`}</TitreSection>
      <Box sx={grilleTuiles}>
        <Tuile large libelle="CA cumulé" valeur={formatEuros(a.ca)}
          detail={<><Box component="span" sx={{ fontWeight: 600, color: couleurEcart(a.ecart) }}>{formatPourcent(a.ecart)}</Box> vs {libelleMois(a.reference)}</>}
          fin={<MiniCourbe valeurs={douzeMois(reseau, m.nom, a.mois)} couleur={brand.vertFonce} largeur={120} hauteur={48} label="CA des douze derniers mois" />} />
        {tuiles.map(([l, v, d]) => <Tuile key={l} libelle={l} valeur={v} detail={d} />)}
      </Box>
    </Box>
  )
}

// ── Tâches en cours ──
function SectionTaches({ reseau, magasins }: { reseau: Reseau; magasins: Magasin[] }) {
  const ouvertes = actionsDes(reseau, new Set(magasins.map((m) => m.nom))).filter((x) => !x.a.faite)
    .sort((x, y) => Number(enRetard(y.a, reseau.jour)) - Number(enRetard(x.a, reseau.jour)) || (echeanceDate(x.a) || '9999').localeCompare(echeanceDate(y.a) || '9999'))
  return (
    <Box component="section" aria-label="Mes tâches">
      <TitreSection nombre={ouvertes.length}>Mes tâches</TitreSection>
      {!ouvertes.length ? <Vide>Aucune tâche en cours.</Vide> : (
        <Card component="ul" aria-label="Tâches en cours" sx={{ listStyle: 'none', m: 0, p: 0, border: 0, overflow: 'hidden', '& > li + li': { borderTop: '1px solid', borderColor: 'divider' } }}>
          {ouvertes.map((x) => (
            <Box component="li" key={x.cle}>
              <LigneCompacte lien="/taches" avatar={<Initiales nom={x.a.action} icone={<TaskAltOutlined />} />} titre={x.a.action}
                detail={[magasins.length > 1 && x.magasin, x.a.porteur, echeanceDate(x.a) ? `pour le ${dateCourte(echeanceDate(x.a))}` : x.a.echeance].filter(Boolean).join(' · ')}
                fin={enRetard(x.a, reseau.jour) ? <Pastille ton="rouge">En retard</Pastille> : undefined} />
            </Box>
          ))}
        </Card>
      )}
    </Box>
  )
}

// ── Visites et audits ──
function SectionVisitesAudits({ reseau, magasins }: { reseau: Reseau; magasins: Magasin[] }) {
  return (
    <Box component="section" aria-label="Visites et audits">
      <TitreSection>Visites et audits</TitreSection>
      <CarteLignes>
        {magasins.flatMap((m) => {
          const vs = visitesDuMagasin(reseau, m.nom)
          const faite = vs.find((v) => visiteFaite(v, reseau.jour))
          const prevue = vs.filter((v) => v.date > reseau.jour).at(-1)
          const audits = (['hygiene', 'excellence'] as const).map((t) => [t, dernierAudit(reseau, m.nom, t)] as const)
          const ou = magasins.length > 1 ? ` · ${m.nom}` : ''
          return [
            <LigneCompacte key={`d-${m.nom}`} lien={faite?.id !== null && faite ? lienCompteRendu(faite) : undefined} label={faite ? `Compte rendu du ${dateCourte(faite.date)}` : undefined}
              avatar={<Initiales nom="visite" icone={<EventNoteOutlined />} />} titre={`Dernière visite${ou}`}
              detail={faite ? [dateCourte(faite.date), libelleTypeVisite(faite.type), nomsVisiteurs(faite)].filter(Boolean).join(' · ') : 'Aucune visite enregistrée'} />,
            <LigneCompacte key={`p-${m.nom}`} avatar={<Initiales nom="prochaine" icone={<EventAvailableOutlined />} />} titre={`Prochaine visite${ou}`}
              detail={prevue ? [dateLongue(prevue.date), nomsVisiteurs(prevue)].filter(Boolean).join(' · ') : 'Pas encore fixée'} />,
            ...(magasins.length > 1 ? [] : audits).map(([t, r]) => (
              <LigneCompacte key={`${t}-${m.nom}`} avatar={<Initiales nom={t} icone={<FactCheckOutlined />} />} titre={`${t === 'hygiene' ? 'Dernier audit hygiène' : 'Dernier audit excellence'}${ou}`}
                detail={r ? `${libelleAudit(r)} · ${dateCourte(r.date)}` : 'Aucun audit noté'} />
            )),
          ]
        })}
      </CarteLignes>
    </Box>
  )
}

// ── Le mot du franchisé avant la visite (sprint 27, F4) : ce qui marche, ce qui bloque, ce dont il a besoin ──
function SectionMotAvantVisite({ reseau, magasins, signaler }: { reseau: Reseau; magasins: Magasin[]; signaler: (msg: string) => void }) {
  const { apercu } = useApercu()
  const [edition, setEdition] = useState<{ m: Magasin; visite: number } | null>(null)
  const lignes = magasins.flatMap((m) => { const v = prochaineVisite(reseau, m.nom); return v && v.id !== null ? [{ m, v, mot: motDe(reseau, m.nom, v.id) }] : [] })
  if (!lignes.length) return null
  return (
    <Box component="section" aria-label="Avant la visite">
      <TitreSection>Avant la visite</TitreSection>
      <Box sx={{ display: 'grid', gap: 1 }}>
        {lignes.map(({ m, v, mot }) => (
          <Card key={m.nom} sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 700 }}>{`${nomsVisiteurs(v) || 'L’équipe V and B'} · ${dateLongue(v.date)}`}</Typography>
            {magasins.length > 1 && <Typography variant="body2" color="text.secondary">{m.nom}</Typography>}
            {mot ? partiesMot.filter((p) => mot[p.cle]).map((p) => (
              <Box key={p.cle} sx={{ mt: 1 }}>
                <Typography variant="body2" color="text.secondary">{p.libelle}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{mot[p.cle]}</Typography>
              </Box>
            )) : null}
            {!apercu && <Button variant={mot ? 'text' : 'contained'} onClick={() => setEdition({ m, visite: v.id! })} sx={{ minHeight: 48, mt: 1, ...(mot ? { ml: -1 } : {}) }}>{mot ? 'Modifier mon mot' : 'Écrire mon mot'}</Button>}
          </Card>
        ))}
      </Box>
      {edition && <DialogMot reseau={reseau} m={edition.m} visite={edition.visite} onFermer={(msg) => { setEdition(null); if (msg) signaler(msg) }} />}
    </Box>
  )
}

function DialogMot({ reseau, m, visite, onFermer }: { reseau: Reseau; m: Magasin; visite: number; onFermer: (msg?: string) => void }) {
  const ancien = motDe(reseau, m.nom, visite)
  const [mot, setMot] = useState<ContenuMot>({ marche: ancien?.marche ?? '', bloque: ancien?.bloque ?? '', besoin: ancien?.besoin ?? '' })
  const envoyer = async (contenu: ContenuMot) => {
    try { await ecrireMotFranchise(m.nom, visite, contenu) } catch (e) { throw e instanceof ErreurMot ? new ErreurAction(e.message) : e }
  }
  return (
    <Fenetre titre="Mon mot avant la visite" ouvert onFermer={onFermer} valide={partiesMot.some((p) => mot[p.cle].trim())}
      enregistrer={async () => { await envoyer(mot); return 'Ton mot est envoyé à l’équipe.' }}
      supprimer={ancien ? async () => { await envoyer({ marche: '', bloque: '', besoin: '' }); return 'Ton mot est retiré.' } : undefined}
      libelleSuppression="Retirer ton mot pour cette visite ?">
      {partiesMot.map((p) => (
        <TexteDicte key={p.cle} label={p.libelle} libelleDictee={p.libelle} valeur={mot[p.cle]} multiline minRows={2} fullWidth
          changer={(f) => setMot((x) => ({ ...x, [p.cle]: f(x[p.cle]) }))} slotProps={{ htmlInput: { maxLength: 2000 } }} />
      ))}
    </Fenetre>
  )
}

const tonExecution: Record<Execution, Ton> = { fait: 'vert', partiel: 'orange', non: 'rouge', aConstater: 'gris' }

function SectionCampagnesEnCours({ reseau, magasins }: { reseau: Reseau; magasins: Magasin[] }) {
  const lignes = magasins.flatMap((m) => campagnesDuMagasin(reseau, m.nom, reseau.jour).map((c) => ({ m, c, e: executionMagasin(reseau.campagnes, c, m.nom) })))
  return (
    <Box component="section" aria-label="Campagnes en cours">
      <TitreSection nombre={lignes.length || undefined}>Campagnes en cours</TitreSection>
      {!lignes.length ? <Vide>Aucune campagne en cours.</Vide> : (
        <CarteLignes>
          {lignes.map(({ m, c, e }) => (
            <LigneCompacte key={`${c.id}|${m.nom}`} lien={`${lienFiche(m.nom)}?vue=campagnes`} avatar={<Initiales nom={c.nom} icone={<CampaignOutlined />} />} titre={c.nom}
              detail={`${magasins.length > 1 ? `${m.nom} · ` : ''}Jusqu’au ${dateCourte(c.fin)}`} fin={<Pastille ton={tonExecution[e]}>{libellesExecution[e]}</Pastille>} />
          ))}
        </CarteLignes>
      )}
    </Box>
  )
}

function LigneContact({ role, p }: { role: string; p: Personne }) {
  return (
    <LigneCompacte avatar={<Initiales nom={p.nom} />} titre={p.nom} detail={role}
      actions={<>
        {p.telephone && <Tooltip title={p.telephone}><IconButton href={telLien(p.telephone)} aria-label={`Appeler ${p.nom}`} sx={{ width: 48, height: 48 }}><CallOutlined /></IconButton></Tooltip>}
        {p.email && <Tooltip title={p.email}><IconButton href={`mailto:${p.email}`} aria-label={`Écrire à ${p.nom}`} sx={{ width: 48, height: 48 }}><MailOutlined /></IconButton></Tooltip>}
      </>} />
  )
}

function SectionContacts({ reseau, magasins }: { reseau: Reseau; magasins: Magasin[] }) {
  const l = contacts(reseau, magasins)
  return (
    <Box component="section" aria-label="Mon équipe V and B">
      <TitreSection>Mon équipe V and B</TitreSection>
      {!l.length ? <Vide>Aucun Coach affecté à ce jour.</Vide> : <CarteLignes>{l.map((x) => <LigneContact key={`${x.role}|${x.p.nom}`} role={x.role} p={x.p} />)}</CarteLignes>}
    </Box>
  )
}

// Fil des magasins du franchisé : les liens restent dans son espace
function useFilFranchise(reseau: Reseau, noms: string[], jours = 120, communications: Communication[] = [], pratiquesReseau = false, actualites = false): ElementFil[] {
  const { messagerie } = useMessagerie()
  const cle = noms.join('|')
  return useMemo(() => filDu(reseau, new Set(cle.split('|')), messagerie, jours, communications, pratiquesReseau, actualites)
    .map((e) => (e.genre === 'tache' ? { ...e, lien: '/taches' } : e.genre === 'pratique' ? { ...e, lien: '/infos?vue=pratiques' } : e)), [reseau, cle, messagerie, jours, communications, pratiquesReseau, actualites])
}

// ── Accueil du franchisé ──
export function TableauFranchise() {
  return (
    <AvecReseau>
      {(reseau) => <AccueilFranchise reseau={reseau} />}
    </AvecReseau>
  )
}

function AccueilFranchise({ reseau }: { reseau: Reseau }) {
  const { apercu } = useApercu()
  const [choix, setChoix] = useState('')
  const tous = reseau.magasins
  const magasins = choix ? tous.filter((m) => m.nom === choix) : tous
  const communications = useCommunicationsDuFil()
  const reactionsPratiques = useReactionsPratiques()
  const reactionsVisites = useReactionsVisites()
  const fil = useFilFranchise(reseau, magasins.map((m) => m.nom), 120, communications.liste, true, true)
  const [message, setMessage] = useState('')
  if (!tous.length) return <><PageHeader titre="Accueil" /><EmptyState icone={<StorefrontOutlined />} titre="Aucun magasin rattaché" texte="Ton Coach ou ton Responsable Régional peut rattacher tes magasins à ton accès." /></>
  return (
    <>
      <PageHeader titre="Accueil" sousTitre={tous.length === 1 ? tous[0].nom : `${tous.length} magasins`} />
      {tous.length > 1 && <Puces label="Magasins affichés" valeur={choix} onChange={setChoix} options={[{ v: '', libelle: 'Tous mes magasins' }, ...tous.map((m) => ({ v: m.nom, libelle: m.nom }))]} />}
      <Box sx={{ display: 'grid', gap: { xs: 2, md: 4 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 380px' }, alignItems: 'start' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <SectionChiffresDuMois reseau={reseau} magasins={magasins} />
          <SectionReperes reseau={reseau} magasins={magasins} />
          <FilActivite elements={fil} jour={reseau.jour} sansMagasin={magasins.length === 1} titre="Actualités" communications={communications} reactionsPratiques={reactionsPratiques} reactionsVisites={reactionsVisites} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {!apercu && <SectionChallengesFranchise />}
          {!apercu && <SondagesARepondre />}
          {!apercu && <SectionReunionsFranchise jour={reseau.jour} />}
          <SectionMotAvantVisite reseau={reseau} magasins={magasins} signaler={setMessage} />
          <SectionTaches reseau={reseau} magasins={magasins} />
          <SectionVisitesAudits reseau={reseau} magasins={magasins} />
          <SectionCampagnesEnCours reseau={reseau} magasins={magasins} />
          <SectionContacts reseau={reseau} magasins={magasins} />
        </Box>
      </Box>
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </>
  )
}

// ── Mes magasins ── un seul magasin : sa fiche directement (Joseph, 23/10/2026)
export function MagasinsFranchise() {
  return (
    <AvecReseau>
      {(reseau) => reseau.magasins.length === 1 ? <Navigate to={lienFiche(reseau.magasins[0].nom)} replace /> : <>
        <PageHeader titre="Mes magasins" />
        {!reseau.magasins.length
          ? <EmptyState icone={<StorefrontOutlined />} titre="Aucun magasin rattaché" texte="Ton Coach ou ton Responsable Régional peut rattacher tes magasins à ton accès." />
          : (
            <CarteLignes label="Mes magasins">
              {reseau.magasins.map((m) => {
                const a = analyser(reseau, m.nom)
                return (
                  <LigneCompacte key={m.nom} lien={lienFiche(m.nom)} label={m.nom} avatar={<Blason magasin={m} />}
                    titre={<Box component="span" role="heading" aria-level={2}>{m.nom}</Box>}
                    detail={[m.ville, m.coach && `Coach ${m.coach}`].filter(Boolean).join(' · ')}
                    fin={a ? (
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography sx={{ fontWeight: 700 }}>{formatKEuros(a.ca)}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: couleurEcart(a.ecart) }}>{formatPourcent(a.ecart)}</Typography>
                      </Box>
                    ) : m.statut !== 'ouvert' ? <Pastille ton={m.statut === 'nouveau' ? 'bleu' : 'gris'}>{statutLibelle[m.statut]}</Pastille> : undefined} />
                )
              })}
            </CarteLignes>
          )}
      </>}
    </AvecReseau>
  )
}

// ── Fiche magasin du franchisé : lecture seule ; plus de fil, redondant avec les onglets (Joseph, 22/10/2026) ;
// comme pour l'équipe (Joseph, 23/10/2026), plus d'onglet Messages : le picto message ouvre le groupe du magasin dans
// Messages ; les bonnes pratiques du magasin ont leur onglet
type VueFiche = 'fiche' | 'chiffres' | 'visites' | 'campagnes' | 'pratiques'
const rubriques: Rubrique<VueFiche>[] = [
  { vue: 'fiche', libelle: 'Fiche', icone: <StorefrontOutlined /> },
  { vue: 'chiffres', libelle: 'Chiffres', icone: <QueryStatsOutlined /> },
  { vue: 'visites', libelle: 'Visites', icone: <EventNoteOutlined /> },
  { vue: 'campagnes', libelle: 'Campagnes', icone: <CampaignOutlined /> },
  { vue: 'pratiques', libelle: 'Bonnes pratiques', court: 'Pratiques', icone: <TipsAndUpdatesOutlined /> },
]

function OngletFiche({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const adresse = [m.adresse || [m.codePostal, m.ville].filter(Boolean).join(' '), m.pays].filter(Boolean).join(', ')
  const associes = associesEnPlace(reseau, m)
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
      <Section titre="Mon équipe V and B">
        {contacts(reseau, [m]).map((x) => <Contact key={x.role} role={x.role} p={x.p} />)}
        {!m.coach && <Contact role="Coach" p={null} sousTitre="Aucun Coach affecté à ce jour" />}
      </Section>
      <Section titre="Magasin">
        <Ligne libelle="Ouverture">{m.ouvertureConnue ? dateLongue(m.ouverture) : null}</Ligne>
        <Ligne libelle="Adresse">{adresse}</Ligne>
        <Ligne libelle="Téléphone">{m.telephone && <Link href={telLien(m.telephone)}>{m.telephone}</Link>}</Ligne>
        <Ligne libelle="Email">{m.email && <Link href={`mailto:${m.email}`}>{m.email}</Link>}</Ligne>
        {m.franchise && associes.map((a) => {
          const mandat = mandatActuel(a, reseau.jour)
          return <Ligne key={a.id} libelle="Franchisé associé">{`${a.nom}${mandat?.fin ? ` · mandat jusqu’au ${dateCourte(mandat.fin)}` : ''}`}</Ligne>
        })}
      </Section>
    </Box>
  )
}

function OngletChiffres({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const [tous, setTous] = useState(false)
  const liste = [...chiffresDuMagasin(reseau, m.nom)].reverse()
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <SectionChiffresDuMois reseau={reseau} magasins={[m]} />
        {liste.length > 1 && <Section titre="Évolution du CA"><GraphiqueCA liste={chiffresDuMagasin(reseau, m.nom)} /></Section>}
      </Box>
      <SectionReperes reseau={reseau} magasins={[m]} />
      {liste.length > 0 && (
        <Section titre="Mois enregistrés">
          {(tous ? liste : liste.slice(0, 12)).map((c) => (
            <LigneSimple key={c.mois} titre={libelleMois(c.mois)}
              detail={[`CA ${formatEuros(caDe(c))}`, c.tickets !== null && `Flux ${formatValeur('tickets', c.tickets)}`, c.panier !== null && `Panier ${formatValeur('panier', c.panier)}`, c.marge !== null && `Marge ${formatValeur('marge', c.marge)}`].filter(Boolean).join(' · ')} />
          ))}
          {liste.length > 12 && <Button onClick={() => setTous((v) => !v)} sx={{ minHeight: 48, mt: 0.5 }}>{tous ? 'Afficher moins' : `Voir les ${liste.length} mois`}</Button>}
        </Section>
      )}
    </Box>
  )
}

function OngletVisites({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const vs = visitesDuMagasin(reseau, m.nom)
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '1fr 1fr' }, alignItems: 'start' }}>
      <Box component="section" aria-label="Visites">
        <TitreSection nombre={vs.length}>Visites</TitreSection>
        {!vs.length ? <Vide>Aucune visite enregistrée.</Vide> : (
          <CarteLignes>
            {vs.map((v) => {
              const faites = v.plan.filter((x) => x.faite).length
              const avenir = !!v.prevue || v.date > reseau.jour
              return (
                <Box key={v.id ?? v.date}>
                  <LigneCompacte avatar={<Initiales nom={v.type} icone={avenir ? <EventAvailableOutlined /> : <EventNoteOutlined />} />}
                    titre={`${dateCourte(v.date)} · ${libelleTypeVisite(v.type)}`}
                    detail={[nomsVisiteurs(v), v.plan.length > 0 && `${v.plan.length} tâche${v.plan.length > 1 ? 's' : ''} au plan · ${faites} faite${faites > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                    fin={avenir ? <Pastille ton="bleu">Prévue</Pastille> : undefined}
                    actions={!avenir && v.id !== null ? <Tooltip title="Compte rendu"><IconButton component={RouterLink} to={lienCompteRendu(v)} aria-label={`Compte rendu du ${dateCourte(v.date)}`} sx={{ width: 48, height: 48 }}><PictureAsPdfOutlined /></IconButton></Tooltip> : undefined} />
                  {!!v.photos?.length && <Box sx={{ px: 2, pb: 1.5 }}><GrillePhotos photos={v.photos} /></Box>}
                </Box>
              )
            })}
          </CarteLignes>
        )}
      </Box>
      <SectionTaches reseau={reseau} magasins={[m]} />
    </Box>
  )
}

// Bonnes pratiques du magasin et celles d'autres magasins qu'il a reprises : lire, aimer, commenter
function OngletPratiques({ reseau, m, signaler }: { reseau: Reseau; m: Magasin; signaler: (msg: string) => void }) {
  const { apercu } = useApercu()
  const reactions = useReactionsPratiques()
  const siennes = reseau.pratiques.filter((p) => p.magasin === m.nom)
  const reprises = reseau.pratiques.filter((p) => p.reprises.includes(m.nom))
  if (!siennes.length && !reprises.length) {
    return <Section titre="Bonnes pratiques"><Vide>Aucune bonne pratique pour ce magasin.</Vide></Section>
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 640 }}>
      {siennes.map((p) => <CartePratique key={p.id} p={p} sansMagasin reactions={reactions} lectureSeule={!!apercu} signaler={signaler} />)}
      {reprises.length > 0 && (
        <Section titre="Reprises d’autres magasins">
          {reprises.map((p) => <LigneSimple key={p.id} titre={p.titre} detail={p.magasin} lien="/infos?vue=pratiques" />)}
        </Section>
      )}
    </Box>
  )
}

function OngletCampagnes({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const liste = reseau.campagnes.liste.filter((c) => phase(c, reseau.jour) !== 'avenir' && magasinsConcernes(reseau, c).some((x) => x.nom === m.nom))
    .sort((a, b) => b.debut.localeCompare(a.debut))
  if (!liste.length) return <Section titre="Campagnes"><Vide>Aucune campagne ne concerne ce magasin.</Vide></Section>
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
      {liste.map((c) => {
        const e = executionMagasin(reseau.campagnes, c, m.nom)
        const k = reseau.campagnes.constats[c.id]?.[m.nom] ?? {}
        return (
          <Section key={c.id} titre={c.nom} action={<Chip size="small" color={couleurExecution[e]} label={libellesExecution[e]} sx={pastille} />}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{libellesPhase[phase(c, reseau.jour)]} · du {dateCourte(c.debut)} au {dateCourte(c.fin)}</Typography>
            {c.points.map((p) => {
              const x = k[p.id]
              return <LigneSimple key={p.id} titre={p.libelle} detail={x?.date ? `Constaté le ${dateCourte(x.date)}` : undefined}
                fin={<Chip size="small" variant={x ? 'filled' : 'outlined'} color={!x ? 'default' : x.fait ? 'success' : 'error'} label={!x ? 'À constater' : x.fait ? 'Fait' : 'Pas fait'} sx={pastille} />} />
            })}
          </Section>
        )
      })}
    </Box>
  )
}

// Haut de fiche façon profil : CA du mois, écart, tâches en cours ; appeler son Coach, écrire, voir les visites
function ProfilFranchise({ reseau, m, message, retour }: { reseau: Reseau; m: Magasin; message: () => void; retour?: { libelle: string; aller: () => void } }) {
  const a = analyser(reseau, m.nom)
  const ouvertes = actionsDes(reseau, new Set([m.nom])).filter((x) => !x.a.faite)
  const retard = ouvertes.filter((x) => enRetard(x.a, reseau.jour)).length
  const coach = m.coach ? reseau.coachs[m.coach] ?? { nom: m.coach } : null
  return (
    <ProfilPersonne nom={m.nom} retour={retour} avatar={(taille) => <Blason magasin={m} taille={taille} />}
      lignes={[[m.franchise ? 'Franchisé' : 'Intégré', [m.ville, m.departement && `(${m.departement})`].filter(Boolean).join(' ')].filter(Boolean).join(' · '), [m.coach && `Coach ${m.coach}`, m.rr?.nom].filter(Boolean).join(' · ')]}
      pastille={retard ? { ton: 'rouge', libelle: `${retard} tâche${retard > 1 ? 's' : ''} en retard` } : m.statut !== 'ouvert' ? { ton: m.statut === 'nouveau' ? 'bleu' : 'gris', libelle: statutLibelle[m.statut] } : null}
      compteurs={[
        { valeur: a ? formatKEuros(a.ca) : '—', libelle: a ? `CA ${libelleMois(a.mois).split(' ')[0]}` : 'CA du mois' },
        { valeur: a ? formatPourcent(a.ecart) : '—', libelle: 'vs l’an dernier', couleur: a?.ecart !== null && a?.ecart !== undefined && a.ecart < 0 ? 'error.main' : undefined },
        { valeur: ouvertes.length, libelle: ouvertes.length > 1 ? 'tâches en cours' : 'tâche en cours' },
      ]}
      telephone={coach?.telephone} libelleAppel="Coach"
      actions={<Tooltip title="Message"><IconButton onClick={message} aria-label="Écrire un message" sx={rond}><ChatBubbleOutlineOutlined /></IconButton></Tooltip>} />
  )
}

// Ouvrir l'onglet Visites lit les nouveaux comptes rendus (pas pendant l'aperçu du Directeur de réseau)
function LireVisites({ magasin }: { magasin: string }) {
  const { apercu } = useApercu()
  const { marquerLu, messagerie } = useMessagerie()
  const pret = !!messagerie
  useEffect(() => { if (pret && !apercu) marquerLu(magasin, 'visites') }, [pret, apercu, marquerLu, magasin])
  return null
}

export function FicheMagasinFranchise() {
  const { nom = '' } = useParams()
  const naviguer = useNavigate()
  const [confirmation, setConfirmation] = useState('')
  const [params, setParams] = useSearchParams()
  const vue = (rubriques.find((r) => r.vue === params.get('vue'))?.vue ?? 'fiche') as VueFiche
  const changerVue = (v: VueFiche) => setParams((p) => { const n = new URLSearchParams(p); if (v === 'fiche') n.delete('vue'); else n.set('vue', v); return n }, { replace: true })
  const groupe = lienFil({ genre: 'magasin', magasin: nom, equipe: false })
  // Anciens liens vers l'onglet Messages : le groupe du magasin
  if (params.get('vue') === 'messages') return <Navigate to={groupe} replace />
  return (
    <AvecReseau>
      {(reseau) => {
        const m = reseau.magasins.find((x) => x.nom === nom)
        if (!m) return <EmptyState icone={<StorefrontOutlined />} titre="Magasin introuvable" texte="Ce magasin ne fait pas partie de tes magasins." action={<Button variant="contained" onClick={() => naviguer('/magasins')}>Voir mes magasins</Button>} />
        return (
          <>
            {reseau.magasins.length > 1 && <Button startIcon={<ArrowBack />} onClick={() => naviguer('/magasins')} sx={{ mb: 2, ml: -1, minHeight: 48, display: { xs: 'none', md: 'inline-flex' } }}>Mes magasins</Button>}
            <ProfilFranchise retour={reseau.magasins.length > 1 ? { libelle: 'Mes magasins', aller: () => naviguer('/magasins') } : undefined} reseau={reseau} m={m} message={() => naviguer(groupe)} />
            <Onglets valeur={vue} onChange={changerVue} rubriques={rubriques} libelle={`Rubriques de ${m.nom}`} fiche />
            <ContenuOnglet>
              {vue === 'fiche' && <OngletFiche reseau={reseau} m={m} />}
              {vue === 'chiffres' && <OngletChiffres reseau={reseau} m={m} />}
              {vue === 'visites' && <><LireVisites magasin={m.nom} /><OngletVisites reseau={reseau} m={m} /></>}
              {vue === 'campagnes' && <OngletCampagnes reseau={reseau} m={m} />}
              {vue === 'pratiques' && <OngletPratiques reseau={reseau} m={m} signaler={setConfirmation} />}
              <Snackbar open={!!confirmation} autoHideDuration={5000} onClose={() => setConfirmation('')} message={confirmation} />
            </ContenuOnglet>
          </>
        )
      }}
    </AvecReseau>
  )
}
