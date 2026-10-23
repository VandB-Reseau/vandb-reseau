import { useMemo, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import ArrowBack from '@mui/icons-material/ArrowBack'
import CallOutlined from '@mui/icons-material/CallOutlined'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { Bulle } from './Outils'
import { CarteLignes, ChoixAffichage, Initiales, LigneCompacte, Pastille, TitreSection, useAffichage, type Ton } from './Social'
import { useAuth } from '../auth/AuthContext'
import { formatPourcent } from '../data/chiffres'
import { magasinsDuCoach } from '../data/charge'
import { magasinsDu } from '../data/perimetre'
import { portefeuilleDe, tonEcart, type Portefeuille, type Sens } from '../data/portefeuille'
import { anneeDe, suiviRythme } from '../data/visites'
import { lienCoach, lienRR, telLien } from '../lib/format'
import type { Reseau } from '../data/modele'

// ── Haut de fiche façon profil, pour un Coach ou un Responsable Régional ──
// Picto de l'en-tête : 48 px, sans fond
export const rond = { width: 48, height: 48 } as const

export interface Compteur { valeur: ReactNode; libelle: string; couleur?: string }

// PC : grande pastille, compteurs en colonnes. Téléphone : en-tête bas (petite pastille, lignes sur une ligne,
// compteurs en texte, flèche de retour à la place de la pastille) pour laisser la place aux onglets.
// À côté du nom, en pictos : Appeler, Message, puis actions et icones (boutons ronds), puis Modifier ; detail : ligne en plus.
export function ProfilPersonne({ nom, avatar, lignes, pastille, compteurs, telephone, libelleAppel = 'Appeler', lienMessage, modifier, actions, icones, detail, retour }: {
  nom: string; avatar?: (taille: number) => ReactNode; lignes: string[]; pastille?: { ton: Ton; libelle: string } | null; compteurs: Compteur[]
  telephone?: string; libelleAppel?: string; lienMessage?: string; modifier?: () => void; actions?: ReactNode; icones?: ReactNode; detail?: ReactNode
  retour?: { libelle: string; aller: () => void }
}) {
  const appel = libelleAppel === 'Appeler' ? 'Appeler' : `Appeler ${libelleAppel === 'Coach' ? 'mon Coach' : libelleAppel}`
  const surPC = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true })
  const uneLigne = surPC ? {} : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const
  return (
    <Card sx={{ border: 0, p: { xs: 1.5, md: 2 }, mb: { xs: 1.5, md: 2 } }}>
      {/* Sur PC, les compteurs se rangent sur la ligne du nom, entre les infos et les pictos ; les pictos passent dessous quand la ligne est trop étroite */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: { xs: 1.5, md: 2 }, rowGap: { xs: 0, md: 1 }, alignItems: 'center' }}>
        {!surPC && retour
          ? <IconButton onClick={retour.aller} aria-label={retour.libelle} sx={{ width: 48, height: 48, ml: -1, mr: -1, flexShrink: 0 }}><ArrowBack /></IconButton>
          : avatar ? avatar(surPC ? 56 : 44) : <Initiales nom={nom} taille={surPC ? 56 : 44} />}
        <Box sx={{ flex: '1 1 140px', minWidth: 0 }}>
          <Typography variant="h1" sx={{ fontSize: { xs: '1.125rem', md: '1.5rem' }, ...uneLigne }}>{nom}</Typography>
          {lignes.filter(Boolean).map((l) => <Typography key={l} variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8125rem', md: undefined }, ...uneLigne }}>{l}</Typography>)}
          {surPC && (pastille || detail) && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.5, rowGap: 0.5, mt: 0.5 }}>
              {pastille && <Pastille ton={pastille.ton}>{pastille.libelle}</Pastille>}
              {detail && <Typography variant="body2">{detail}</Typography>}
            </Box>
          )}
        </Box>
        {surPC && (
          <Box sx={{ display: 'flex', flexShrink: 0, '& > * + *': { borderLeft: '1px solid', borderColor: 'divider' } }} role="group" aria-label="En bref">
            {compteurs.map((c) => (
              <Box key={c.libelle} sx={{ width: 120, textAlign: 'center', px: 1 }}>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2, color: c.couleur, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.valeur}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.libelle}</Typography>
              </Box>
            ))}
          </Box>
        )}
        <Box sx={{ display: 'flex', flexShrink: 0, alignSelf: { xs: 'flex-start', md: 'center' }, ml: 'auto', mr: { xs: -1, md: 0 } }}>
          <Bulle titre={telephone ? `${appel} · ${telephone}` : appel}>
            {telephone
              ? <IconButton href={telLien(telephone)} aria-label={appel} sx={rond}><CallOutlined /></IconButton>
              : <span><IconButton disabled aria-label={appel} sx={rond}><CallOutlined /></IconButton></span>}
          </Bulle>
          {lienMessage && <Bulle titre="Message"><IconButton component={RouterLink} to={lienMessage} aria-label="Écrire un message" sx={rond}><ChatBubbleOutlineOutlined /></IconButton></Bulle>}
          {actions}
          {icones}
          {modifier && <Tooltip title="Modifier"><IconButton onClick={modifier} aria-label="Modifier" sx={rond}><EditOutlined /></IconButton></Tooltip>}
        </Box>
      </Box>
      {!surPC && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.5, rowGap: 0.5, mt: 1 }} role="group" aria-label="En bref">
          {pastille && <Pastille ton={pastille.ton}>{pastille.libelle}</Pastille>}
          {compteurs.map((c) => (
            <Typography key={c.libelle} variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
              <Box component="b" sx={{ color: c.couleur ?? 'text.primary' }}>{c.valeur}</Box> {c.libelle}
            </Typography>
          ))}
          {detail && <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>{detail}</Typography>}
        </Box>
      )}
    </Card>
  )
}

// ── Indicateurs du portefeuille ──
const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n)} %`)
const points = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))} pt${Math.abs(Math.round(n)) > 1 ? 's' : ''}`
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

interface Indicateur {
  id: string; libelle: string; valeur: (p: Portefeuille) => number | null; affiche: (p: Portefeuille) => string
  detail: (p: Portefeuille) => string; sens: Sens; seuil: number; ecart: (d: number) => string
}

export const indicateurs: Indicateur[] = [
  { id: 'decroche', libelle: 'En Décroche', valeur: (p) => p.partDecroche, affiche: (p) => String(p.decroche), sens: -1, seuil: 5, ecart: points,
    detail: (p) => (p.avecChiffres ? `${pct(p.partDecroche)} sur ${pluriel(p.avecChiffres, 'magasin')} suivi${p.avecChiffres > 1 ? 's' : ''} au chiffre` : 'Aucun chiffre comparable') },
  { id: 'ca', libelle: 'Évolution du CA', valeur: (p) => p.evolutionCA, affiche: (p) => formatPourcent(p.evolutionCA), sens: 1, seuil: 2, ecart: points,
    detail: () => 'Dernier mois connu vs l’an dernier' },
  { id: 'audit', libelle: 'Note d’audit moyenne', valeur: (p) => p.audit, affiche: (p) => pct(p.audit), sens: 1, seuil: 3, ecart: points,
    detail: (p) => (p.audites ? pluriel(p.audites, 'magasin') + ` audité${p.audites > 1 ? 's' : ''}` : 'Aucun audit noté') },
  { id: 'ninebox', libelle: 'Nine box à surveiller', valeur: (p) => (p.classes ? (p.aSurveiller / p.classes) * 100 : null), affiche: (p) => String(p.aSurveiller), sens: -1, seuil: 5, ecart: points,
    detail: (p) => (p.classes ? `${pct((p.aSurveiller / p.classes) * 100)} sur ${pluriel(p.classes, 'magasin')} classé${p.classes > 1 ? 's' : ''}` : 'Aucun magasin classé') },
]

// Référence de comparaison : tout le réseau pour le Directeur, la région pour un Responsable Régional ; rien pour un Coach
export function useReference(reseau: Reseau): { libelle: string; p: Portefeuille } | null {
  const { profil } = useAuth()
  return useMemo(() => {
    if (profil?.role === 'directeur') return { libelle: 'réseau', p: portefeuilleDe(reseau, reseau.magasins.filter((m) => m.statut !== 'avenir')) }
    if (profil?.role === 'rr' && profil.perimetre.rr?.[0]) return { libelle: 'région', p: portefeuilleDe(reseau, magasinsDu(reseau, { type: 'rr', id: profil.perimetre.rr[0] }).filter((m) => m.statut !== 'avenir')) }
    return null
  }, [reseau, profil])
}

const couleurTon = { mieux: 'success.main', moins: 'error.main', egal: undefined }

export function BlocPortefeuille({ reseau, p }: { reseau: Reseau; p: Portefeuille }) {
  const ref = useReference(reseau)
  return (
    <Box component="section" sx={{ maxWidth: 760 }}>
      <TitreSection nombre={p.magasins}>{ref ? `Portefeuille comparé ${ref.libelle === 'réseau' ? 'au réseau' : 'à la région'}` : 'Portefeuille'}</TitreSection>
      <CarteLignes label="Portefeuille">
        {indicateurs.map((i) => {
          const v = i.valeur(p), r = ref ? i.valeur(ref.p) : null
          const ton = tonEcart(v, r, i.sens, i.seuil)
          return (
            <LigneCompacte key={i.id} titre={i.libelle}
              detail={[i.detail(p), ref && r !== null && `${ref.libelle} ${i.id === 'ca' ? formatPourcent(r) : pct(r)}`].filter(Boolean).join(' · ')}
              fin={
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: ton ? couleurTon[ton] : undefined }}>{i.affiche(p)}</Typography>
                  {ton && ton !== 'egal' && v !== null && r !== null && <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: couleurTon[ton] }}>{i.ecart(v - r)}</Typography>}
                </Box>
              } />
          )
        })}
      </CarteLignes>
    </Box>
  )
}

// ── Tous les portefeuilles côte à côte (onglet de la page Équipe) ──
interface LignePortefeuille { cle: string; nom: string; lien: string; detail: string; p: Portefeuille }

export function VuePortefeuilles({ reseau }: { reseau: Reseau }) {
  const theme = useTheme()
  const surPC = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [affichage, setAffichage] = useAffichage('portefeuilles')
  const ref = useReference(reseau)
  const { coachs, rrs } = useMemo(() => {
    const rythme = suiviRythme(reseau, anneeDe(reseau.jour))
    const actifs = (l: ReturnType<typeof magasinsDuCoach>) => l.filter((m) => m.statut !== 'avenir')
    const coachs: LignePortefeuille[] = reseau.equipe.filter((c) => !c.fictif).map((c) => ({ c, ms: actifs(magasinsDuCoach(reseau, c.nom)) })).filter((x) => x.ms.length)
      .map(({ c, ms }) => ({ cle: `c:${c.nom}`, nom: c.nom, lien: lienCoach(c.nom), detail: [pluriel(ms.length, 'magasin'), c.rr?.nom].filter(Boolean).join(' · '), p: portefeuilleDe(reseau, ms, rythme) }))
    const rrs: LignePortefeuille[] = reseau.rrs.map((r) => ({ r, ms: actifs(magasinsDu(reseau, { type: 'rr', id: r.id })) })).filter((x) => x.ms.length)
      .map(({ r, ms }) => ({ cle: `r:${r.id}`, nom: r.nom, lien: lienRR(r.id), detail: pluriel(ms.length, 'magasin'), p: portefeuilleDe(reseau, ms, rythme) }))
    return { coachs, rrs }
  }, [reseau])
  const sous = (p: Portefeuille) => (ref ? indicateurs.filter((i) => tonEcart(i.valeur(p), i.valeur(ref.p), i.sens, i.seuil) === 'moins').length : 0)
  const tries = (l: LignePortefeuille[]) => [...l].sort((a, b) => sous(b.p) - sous(a.p) || a.nom.localeCompare(b.nom, 'fr'))
  const groupe = (titre: string, liste: LignePortefeuille[], avecChoix: boolean) => !liste.length ? null : (
    <Box sx={{ mb: 3 }}>
      <TitreSection nombre={liste.length} action={avecChoix && surPC ? <ChoixAffichage valeur={affichage} onChange={setAffichage} /> : undefined}>{titre}</TitreSection>
      {surPC && affichage === 'tableau' ? (
        <Card>
          <TableContainer>
            <Table size="small" aria-label={titre} className="colonne-fixe">
              <TableHead>
                <TableRow>
                  <TableCell>Nom</TableCell><TableCell align="right">Magasins</TableCell>
                  {indicateurs.map((i) => <TableCell key={i.id} align="right">{i.libelle}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {ref && (
                  <TableRow sx={{ '& td': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                    <TableCell>{ref.libelle === 'réseau' ? 'Réseau' : 'Région'}</TableCell><TableCell align="right">{ref.p.magasins}</TableCell>
                    {indicateurs.map((i) => <TableCell key={i.id} align="right">{i.affiche(ref.p)}</TableCell>)}
                  </TableRow>
                )}
                {tries(liste).map((l) => (
                  <TableRow key={l.cle} hover>
                    <TableCell><Link component={RouterLink} to={l.lien} sx={{ fontWeight: 600 }}>{l.nom}</Link></TableCell>
                    <TableCell align="right">{l.p.magasins}</TableCell>
                    {indicateurs.map((i) => {
                      const ton = ref ? tonEcart(i.valeur(l.p), i.valeur(ref.p), i.sens, i.seuil) : null
                      return <TableCell key={i.id} align="right" sx={{ fontWeight: ton && ton !== 'egal' ? 600 : undefined, color: ton ? couleurTon[ton] : undefined }}>{i.affiche(l.p)}</TableCell>
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      ) : (
        <CarteLignes label={titre}>
          {tries(liste).map((l) => {
            const n = sous(l.p)
            return (
              <LigneCompacte key={l.cle} lien={l.lien} avatar={<Initiales nom={l.nom} />} titre={l.nom}
                detail={[l.detail, `${pluriel(l.p.visitesFaites, 'visite')}`, `${l.p.decroche} en Décroche`, `CA ${formatPourcent(l.p.evolutionCA)}`, `audit ${pct(l.p.audit)}`].join(' · ')}
                fin={ref ? (n ? <Pastille ton="orange">{`${n} sous ${ref.libelle === 'réseau' ? 'le réseau' : 'la région'}`}</Pastille> : <Pastille ton="gris">Au niveau</Pastille>) : undefined} />
            )
          })}
        </CarteLignes>
      )}
    </Box>
  )
  if (!coachs.length && !rrs.length) return <Typography variant="body2" color="text.secondary">Aucun magasin affecté à un Coach ou à un Responsable Régional.</Typography>
  return (
    <>
      {groupe('Coachs', coachs, true)}
      {groupe('Responsables Régionaux', rrs, !coachs.length)}
    </>
  )
}
