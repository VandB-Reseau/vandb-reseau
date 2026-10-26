import { useMemo, useState } from 'react'
import { suiviEtRR } from '../data/charge'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import ButtonBase from '@mui/material/ButtonBase'
import useMediaQuery from '@mui/material/useMediaQuery'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import { CarteLignes, LigneCompacte, Pastille, type Ton } from './Social'
import { lienFiche } from '../lib/format'
import { statutLibelle, type Magasin, type Reseau } from '../data/modele'
import { useReseau } from '../data/ReseauContext'
import { analyser, formatPourcent } from '../data/chiffres'
import { caseDe, visitesParAn } from '../data/sante'
import { actionsEnCours } from '../data/actions'
import { anneeDe, suiviRythme } from '../data/visites'
import { sousBandes } from './Collant'
import { Blason } from './Blason'

const PAS = 50

// Une seule info à droite : décrochage en rouge, sinon la dernière visite (orange si l'alerte de visite est passée), sinon le statut
function pastillesDe(reseau: Reseau | null): Map<string, { ton: Ton; libelle: string }> {
  const res = new Map<string, { ton: Ton; libelle: string }>()
  if (!reseau) return res
  const rythme = new Map(suiviRythme(reseau, anneeDe(reseau.jour)).map((l) => [l.magasin.nom, l]))
  for (const m of reseau.magasins) {
    const a = analyser(reseau, m.nom)
    const l = rythme.get(m.nom)
    if (a?.statut === 'decroche') res.set(m.nom, { ton: 'rouge', libelle: 'Décroche' })
    else if (a?.statut === 'surveiller') res.set(m.nom, { ton: 'orange', libelle: 'À surveiller' })
    else if (l && (l.derniere || l.alerte)) res.set(m.nom, { ton: l.alerte ? 'orange' : 'gris', libelle: l.derniere ? `vu il y a ${l.depuis} j` : 'jamais vu' })
    else if (m.statut !== 'ouvert') res.set(m.nom, { ton: m.statut === 'nouveau' ? 'bleu' : 'gris', libelle: statutLibelle[m.statut] })
  }
  return res
}

export type TriMagasins = 'nom' | 'visite' | 'ca' | 'case' | 'taches'
export const trisMagasins: { v: TriMagasins; libelle: string }[] = [{ v: 'nom', libelle: 'Nom' }, { v: 'visite', libelle: 'Dernière visite' }, { v: 'ca', libelle: 'Évolution du CA' }]
// Sur PC large, les titres des colonnes trient aussi par case nine box et par tâches en cours
export const trisColonnes: { v: TriMagasins; libelle: string }[] = [...trisMagasins, { v: 'case', libelle: 'Case' }, { v: 'taches', libelle: 'Tâches' }]

// Colonnes de la liste sur PC large (Joseph, sprint 21 D2) : CA vs N-1, case nine box, dernière visite, tâches en cours
interface InfosMagasin { ecart: number | null; caseLibelle: string; rang: number; depuis: number | null; alerteVisite: boolean; taches: number }
function infosDe(reseau: Reseau | null): Map<string, InfosMagasin> {
  const res = new Map<string, InfosMagasin>()
  if (!reseau) return res
  const rythme = new Map(suiviRythme(reseau, anneeDe(reseau.jour)).map((l) => [l.magasin.nom, l]))
  const taches = new Map<string, number>()
  for (const x of actionsEnCours(reseau, null)) taches.set(x.magasin, (taches.get(x.magasin) ?? 0) + 1)
  for (const m of reseau.magasins) {
    const c = caseDe(reseau.evaluations[m.nom])
    const l = rythme.get(m.nom)
    res.set(m.nom, { ecart: analyser(reseau, m.nom)?.ecart ?? null, caseLibelle: c?.libelle ?? '', rang: c ? visitesParAn(c) : 0,
      depuis: l?.derniere ? l.depuis ?? 0 : null, alerteVisite: !!l?.alerte, taches: taches.get(m.nom) ?? 0 })
  }
  return res
}
const colonnes: { v: TriMagasins; libelle: string; largeur: number }[] = [
  { v: 'ca', libelle: 'CA vs N-1', largeur: 96 }, { v: 'case', libelle: 'Case', largeur: 176 }, { v: 'visite', libelle: 'Vu', largeur: 88 }, { v: 'taches', libelle: 'Tâches', largeur: 64 },
]
const lettreDe = (nom: string) => { const l = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase(); return /[A-Z]/.test(l) ? l : '#' }

// Magasins en lignes compactes (PC et téléphone) : initiales, nom, Coach et Responsable Régional, une info à droite.
// Triés par nom : intertitres A, B, C… collants (rangée de lettres retirée, Joseph, 21/10/2026).
// suivis : favoris et fiches ouvertes récemment, en tête de la liste quand aucun filtre n'est posé
export function ListeMagasins({ magasins, tri = 'nom', suivis, trier }: { magasins: Magasin[]; tri?: TriMagasins; suivis?: { favoris: Magasin[]; recents: Magasin[] }; trier?: (t: TriMagasins) => void }) {
  const { reseau } = useReseau()
  const [nb, setNb] = useState(PAS)
  const large = useMediaQuery('(min-width:1100px)', { noSsr: true })
  const pastilles = useMemo(() => pastillesDe(reseau), [reseau])
  const infos = useMemo(() => infosDe(reseau), [reseau])
  const tries = useMemo(() => {
    if (!reseau || tri === 'nom') return [...magasins].sort((x, y) => x.nom.localeCompare(y.nom, 'fr'))
    if (tri === 'visite') {
      const depuis = new Map(suiviRythme(reseau, anneeDe(reseau.jour)).map((l) => [l.magasin.nom, l.derniere ? l.depuis ?? 0 : Infinity]))
      return [...magasins].sort((x, y) => (depuis.get(y.nom) ?? -1) - (depuis.get(x.nom) ?? -1) || x.nom.localeCompare(y.nom, 'fr'))
    }
    if (tri === 'case') return [...magasins].sort((x, y) => (infos.get(y.nom)?.rang ?? 0) - (infos.get(x.nom)?.rang ?? 0) || x.nom.localeCompare(y.nom, 'fr'))
    if (tri === 'taches') return [...magasins].sort((x, y) => (infos.get(y.nom)?.taches ?? 0) - (infos.get(x.nom)?.taches ?? 0) || x.nom.localeCompare(y.nom, 'fr'))
    const ecart = new Map(magasins.map((m) => [m.nom, analyser(reseau, m.nom)?.ecart ?? null]))
    const v = (m: Magasin) => ecart.get(m.nom) ?? Infinity
    return [...magasins].sort((x, y) => v(x) - v(y) || x.nom.localeCompare(y.nom, 'fr'))
  }, [magasins, reseau, tri, infos])
  const visibles = tries.slice(0, nb)
  const colonnesDe = (m: Magasin) => {
    const i = infos.get(m.nom)
    const p = pastilles.get(m.nom)
    const alerte = p && (p.ton === 'rouge' || p.libelle === 'À surveiller' || m.statut !== 'ouvert') ? p : null
    const cellule = (largeur: number, contenu: string, couleur?: string) => (
      <Typography variant="body2" sx={{ width: largeur, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: couleur ?? 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contenu}</Typography>
    )
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ width: 150, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>{alerte && <Pastille ton={alerte.ton}>{alerte.libelle}</Pastille>}</Box>
        {cellule(96, i?.ecart === null || i?.ecart === undefined ? '' : formatPourcent(i.ecart), i?.ecart !== null && i?.ecart !== undefined ? (i.ecart <= -5 ? 'error.main' : i.ecart < 0 ? 'warning.dark' : 'text.primary') : undefined)}
        {cellule(176, i?.caseLibelle || 'Non classé', i?.caseLibelle ? 'text.primary' : undefined)}
        {cellule(88, i?.depuis === null || i?.depuis === undefined ? 'jamais' : `${i.depuis} j`, i?.alerteVisite ? 'warning.dark' : undefined)}
        {cellule(64, i?.taches ? String(i.taches) : '', 'text.primary')}
      </Box>
    )
  }
  const ligne = (m: Magasin) => {
    if (large) return <LigneCompacte key={m.nom} lien={lienFiche(m.nom)} avatar={<Blason magasin={m} />} titre={m.nom} detail={suiviEtRR(m)} fin={colonnesDe(m)} />
    const p = pastilles.get(m.nom)
    const e = tri === 'ca' && reseau ? analyser(reseau, m.nom)?.ecart : undefined
    return (
      <LigneCompacte key={m.nom} lien={lienFiche(m.nom)} avatar={<Blason magasin={m} />} titre={m.nom}
        detail={suiviEtRR(m)}
        fin={e !== undefined && e !== null && p?.ton !== 'rouge' ? <Pastille ton={e < 0 ? 'orange' : 'gris'}>{`${e > 0 ? '+' : ''}${String(e.toFixed(1)).replace('.', ',')} %`}</Pastille> : p && <Pastille ton={p.ton}>{p.libelle}</Pastille>} />
    )
  }
  const lettres = tri === 'nom' ? [...new Set(tries.map((m) => lettreDe(m.nom)))] : []
  const groupes = tri === 'nom' ? lettres.map((l) => ({ l, ms: visibles.filter((m) => lettreDe(m.nom) === l) })).filter((g) => g.ms.length) : []
  const enTete = suivis ? [{ titre: 'Favoris', ms: suivis.favoris }, { titre: 'Consultés récemment', ms: suivis.recents }].filter((g) => g.ms.length) : []
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {large && (
        <Box role="group" aria-label="Trier par colonne" sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, mb: -1 }}>
          <ButtonBase onClick={() => trier?.('nom')} aria-pressed={tri === 'nom'} sx={{ flex: 1, justifyContent: 'flex-start', minHeight: 48, pl: 7, fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: tri === 'nom' ? 700 : 500, color: tri === 'nom' ? 'text.primary' : 'text.secondary' }}>Magasin</ButtonBase>
          <Box sx={{ width: 150, flexShrink: 0 }} />
          {colonnes.map((c) => (
            <ButtonBase key={c.v} onClick={() => trier?.(c.v)} aria-pressed={tri === c.v} aria-label={`Trier par ${c.libelle === 'Vu' ? 'dernière visite' : c.libelle}`}
              sx={{ width: c.largeur, flexShrink: 0, justifyContent: 'flex-end', minHeight: 48, gap: 0.25, fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: tri === c.v ? 700 : 500, color: tri === c.v ? 'text.primary' : 'text.secondary' }}>
              {tri === c.v && <ArrowDownward sx={{ fontSize: 16 }} />}{c.libelle}
            </ButtonBase>
          ))}
        </Box>
      )}
      {enTete.map((g) => (
        <Box key={g.titre} component="section" aria-label={g.titre}>
          <Typography component="h2" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.875rem', py: 0.5, px: 0.5 }}>{g.titre}</Typography>
          <CarteLignes>{g.ms.map(ligne)}</CarteLignes>
        </Box>
      ))}
      {tri === 'nom' ? <Box component="section" aria-label="Liste des magasins" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{groupes.map((g) => (
        <Box key={g.l} component="section" aria-label={`Magasins en ${g.l}`}>
          <Box id={`lettre-${g.l}`} sx={{ position: 'sticky', top: sousBandes('--onglets', '--filtres'), zIndex: 3, bgcolor: 'background.default', scrollMarginTop: sousBandes('--onglets', '--filtres'), py: 0.5, px: 0.5 }}>
            <Typography component="h2" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.875rem' }}>{g.l}</Typography>
          </Box>
          <CarteLignes>{g.ms.map(ligne)}</CarteLignes>
        </Box>
      ))}</Box> : <CarteLignes label="Liste des magasins">{visibles.map(ligne)}</CarteLignes>}
      {nb < tries.length && (
        <Button variant="outlined" onClick={() => setNb(nb + PAS)} sx={{ alignSelf: 'center', minHeight: 48 }}>
          Afficher {Math.min(PAS, tries.length - nb)} magasins de plus
        </Button>
      )}
    </Box>
  )
}
