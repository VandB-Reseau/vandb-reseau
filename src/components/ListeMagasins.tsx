import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import { CarteLignes, Initiales, LigneCompacte, Pastille, type Ton } from './Social'
import { lienFiche } from '../lib/format'
import { statutLibelle, type Magasin, type Reseau } from '../data/modele'
import { useReseau } from '../data/ReseauContext'
import { analyser } from '../data/chiffres'
import { anneeDe, suiviRythme } from '../data/visites'

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

// Magasins en lignes compactes (PC et téléphone) : initiales, nom, Coach et Responsable Régional, une pastille au plus
export function ListeMagasins({ magasins }: { magasins: Magasin[] }) {
  const { reseau } = useReseau()
  const [nb, setNb] = useState(PAS)
  const pastilles = useMemo(() => pastillesDe(reseau), [reseau])
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <CarteLignes label="Liste des magasins">
        {magasins.slice(0, nb).map((m) => {
          const p = pastilles.get(m.nom)
          return (
            <LigneCompacte key={m.nom} lien={lienFiche(m.nom)} avatar={<Initiales nom={m.nom} />} titre={m.nom}
              detail={[m.coach || 'Sans Coach', m.rr?.nom].filter(Boolean).join(' · ')}
              fin={p && <Pastille ton={p.ton}>{p.libelle}</Pastille>} />
          )
        })}
      </CarteLignes>
      {nb < magasins.length && (
        <Button variant="outlined" onClick={() => setNb(nb + PAS)} sx={{ alignSelf: 'center', minHeight: 48 }}>
          Afficher {Math.min(PAS, magasins.length - nb)} magasins de plus
        </Button>
      )}
    </Box>
  )
}
