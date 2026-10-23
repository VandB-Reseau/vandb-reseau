import Box from '@mui/material/Box'
import littoral from '../assets/blasons/littoral.png'
import montagne from '../assets/blasons/montagne.png'
import terres from '../assets/blasons/terres.png'
import { brand } from '../theme/theme'
import type { Magasin, Topographie } from '../data/modele'
import { Initiales } from './Social'
import { figureDeduite, figures } from './FiguresBlason'

// Blason de ville (charte V and B) : la forme dit la topographie de la ville (littoral, montagne, terres),
// la couleur sa région (Nord vert, Sud orange, Est crème, Ouest noir, Centre jaune ; deux moitiés pour Nord-Est, Sud-Ouest…),
// la figure au centre un élément local (choisi dans la fiche, sinon proposé selon le département).
// Il prend exactement la place du rond à initiales qu'il remplace (Joseph, 23/10/2026).

export const libellesTopographie: Record<Topographie, string> = { littoral: 'Littoral', montagne: 'Montagne', terres: 'Terres' }
const formes: Record<Topographie, string> = { littoral, montagne, terres }

const LITTORAL = new Set(['59', '62', '80', '76', '14', '50', '35', '22', '29', '56', '44', '85', '17', '33', '40', '64', '66', '11', '34', '30', '13', '83', '06', '2A', '2B', '20', '971', '972', '973', '974', '976'])
const MONTAGNE = new Set(['04', '05', '09', '38', '65', '73', '74'])

// Département tel qu'il est saisi : « 1 » comme « 01 », « 2a » comme « 2A »
const dep = (d: string) => { const t = d.trim().toUpperCase(); return /^\d$/.test(t) ? `0${t}` : t }

export function topographieDeduite(departement: string): Topographie {
  const d = dep(departement)
  return LITTORAL.has(d) ? 'littoral' : MONTAGNE.has(d) ? 'montagne' : 'terres'
}

type Point = 'N' | 'S' | 'E' | 'O' | 'C'
const couleurs: Record<Point, string> = { N: brand.vert, S: brand.orange, E: brand.creme, O: brand.noir, C: brand.jaune }
const REGIONS: [Point[], string][] = [
  [['N'], '59 62 80 02 60 75 77 78 91 92 93 94 95'],
  [['N', 'O'], '76 27 14 50 61 28'],
  [['O'], '29 22 56 35 44 53 72 49 85 79 86 17'],
  [['N', 'E'], '08 51 55 54 57 67 68 88 10 52'],
  [['E'], '21 70 25 39 90 71 01 89 58'],
  [['S', 'E'], '69 42 38 73 74 26 07 05 04 06 83 84 13 2A 2B 20'],
  [['S'], '34 11 66 30 48 12 81 971 972 973 974 976'],
  [['S', 'O'], '33 40 64 65 32 47 82 31 09 46 24 16'],
]
const regionDe = new Map(REGIONS.flatMap(([p, liste]) => liste.split(' ').map((d) => [d, p] as const)))

export function couleursBlason(departement: string): string[] {
  return (regionDe.get(dep(departement)) ?? ['C']).map((p) => couleurs[p])
}

// Place de la figure dans chaque forme (en % du blason) : la montagne se resserre vers le bas, le littoral garde ses vagues
const placeFigure: Record<Topographie, { haut: number; cote: number }> = { littoral: { haut: 26, cote: 50 }, montagne: { haut: 22, cote: 46 }, terres: { haut: 26, cote: 52 } }
const CLAIRES: string[] = [brand.creme, brand.jaune]

export function Blason({ magasin, nom, taille = 44 }: { magasin: Magasin | undefined; nom?: string; taille?: number }) {
  if (!magasin) return <Initiales nom={nom ?? ''} taille={taille} />
  const topo = magasin.topographie || topographieDeduite(magasin.departement)
  const forme = formes[topo]
  const [a, b] = couleursBlason(magasin.departement)
  const figure = magasin.figure || figureDeduite(magasin.departement, topo)
  // Figure en blanc (charte) ; en noir sur le jaune et le crème, comme le blason de Loches
  const encre = CLAIRES.includes(a) || (b && CLAIRES.includes(b)) ? brand.noir : '#ffffff'
  const { haut, cote } = placeFigure[topo]
  const masque = { WebkitMaskImage: `url(${forme})`, maskImage: `url(${forme})`, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' } as const
  return (
    // Un liseré discret garde visible la teinte crème de l'Est sur fond clair
    <Box aria-hidden data-blason={topo} data-figure={figure} sx={{ width: taille, height: taille, flexShrink: 0, position: 'relative', filter: 'drop-shadow(0 0 0.75px rgba(49, 46, 46, 0.55))' }}>
      <Box sx={{ width: '100%', height: '100%', ...masque, background: b ? `linear-gradient(90deg, ${a} 0 50%, ${b} 50% 100%)` : a }} />
      <Box component="svg" viewBox="0 0 24 24" sx={{ position: 'absolute', top: `${haut}%`, left: `${(100 - cote) / 2}%`, width: `${cote}%`, height: `${cote}%`, filter: 'none' }}>
        {figures[figure].dessin(encre)}
      </Box>
    </Box>
  )
}
