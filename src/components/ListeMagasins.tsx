import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { CarteLignes, Initiales, LigneCompacte, Pastille, type Ton } from './Social'
import { lienFiche } from '../lib/format'
import { statutLibelle, type Magasin, type Reseau } from '../data/modele'
import { useReseau } from '../data/ReseauContext'
import { analyser } from '../data/chiffres'
import { anneeDe, suiviRythme } from '../data/visites'
import { sousBandes } from './Collant'

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

export type TriMagasins = 'nom' | 'visite' | 'ca'
export const trisMagasins: { v: TriMagasins; libelle: string }[] = [{ v: 'nom', libelle: 'Nom' }, { v: 'visite', libelle: 'Dernière visite' }, { v: 'ca', libelle: 'Évolution du CA' }]
const lettreDe = (nom: string) => { const l = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase(); return /[A-Z]/.test(l) ? l : '#' }

// Magasins en lignes compactes (PC et téléphone) : initiales, nom, Coach et Responsable Régional, une info à droite.
// Triés par nom : intertitres A, B, C… collants (rangée de lettres retirée, Joseph, 21/10/2026).
// suivis : favoris et fiches ouvertes récemment, en tête de la liste quand aucun filtre n'est posé
export function ListeMagasins({ magasins, tri = 'nom', suivis }: { magasins: Magasin[]; tri?: TriMagasins; suivis?: { favoris: Magasin[]; recents: Magasin[] } }) {
  const { reseau } = useReseau()
  const [nb, setNb] = useState(PAS)
  const pastilles = useMemo(() => pastillesDe(reseau), [reseau])
  const tries = useMemo(() => {
    if (!reseau || tri === 'nom') return [...magasins].sort((x, y) => x.nom.localeCompare(y.nom, 'fr'))
    if (tri === 'visite') {
      const depuis = new Map(suiviRythme(reseau, anneeDe(reseau.jour)).map((l) => [l.magasin.nom, l.derniere ? l.depuis ?? 0 : Infinity]))
      return [...magasins].sort((x, y) => (depuis.get(y.nom) ?? -1) - (depuis.get(x.nom) ?? -1) || x.nom.localeCompare(y.nom, 'fr'))
    }
    const ecart = new Map(magasins.map((m) => [m.nom, analyser(reseau, m.nom)?.ecart ?? null]))
    const v = (m: Magasin) => ecart.get(m.nom) ?? Infinity
    return [...magasins].sort((x, y) => v(x) - v(y) || x.nom.localeCompare(y.nom, 'fr'))
  }, [magasins, reseau, tri])
  const visibles = tries.slice(0, nb)
  const ligne = (m: Magasin) => {
    const p = pastilles.get(m.nom)
    const e = tri === 'ca' && reseau ? analyser(reseau, m.nom)?.ecart : undefined
    return (
      <LigneCompacte key={m.nom} lien={lienFiche(m.nom)} avatar={<Initiales nom={m.nom} />} titre={m.nom}
        detail={[m.coach || 'Sans Coach', m.rr?.nom].filter(Boolean).join(' · ')}
        fin={e !== undefined && e !== null && p?.ton !== 'rouge' ? <Pastille ton={e < 0 ? 'orange' : 'gris'}>{`${e > 0 ? '+' : ''}${String(e.toFixed(1)).replace('.', ',')} %`}</Pastille> : p && <Pastille ton={p.ton}>{p.libelle}</Pastille>} />
    )
  }
  const lettres = tri === 'nom' ? [...new Set(tries.map((m) => lettreDe(m.nom)))] : []
  const groupes = tri === 'nom' ? lettres.map((l) => ({ l, ms: visibles.filter((m) => lettreDe(m.nom) === l) })).filter((g) => g.ms.length) : []
  const enTete = suivis ? [{ titre: 'Favoris', ms: suivis.favoris }, { titre: 'Consultés récemment', ms: suivis.recents }].filter((g) => g.ms.length) : []
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
