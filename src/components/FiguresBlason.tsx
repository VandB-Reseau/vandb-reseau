import type { ReactNode } from 'react'
import type { Figure } from '../data/modele'

// Figures du blason de ville (charte V and B, « 3 - La figure ») : un élément local dessiné de façon schématique,
// en aplat, au centre du blason. Dessinées sur une grille de 24 ; « c » = couleur de la figure (blanc ou noir).

const trait = (c: string, epaisseur = 1.8) => ({ fill: 'none', stroke: c, strokeWidth: epaisseur, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const })

export const figures: Record<Figure, { libelle: string; dessin: (c: string) => ReactNode }> = {
  voile: { libelle: 'Voilier', dessin: (c) => <g fill={c}><path d="M11 2.5V16H3.5Z" /><path d="M12.6 5.5V16H19.5Z" /><path d="M2.5 17.5h19l-2.6 4H5.1Z" /></g> },
  phare: { libelle: 'Phare', dessin: (c) => <g fill={c}><path d="M10.5 2h3v2.5h-3Z" /><path d="M8.8 5h6.4v1.8H8.8Z" /><path d="M9.6 7.6h4.8l1.6 14H8Z" /></g> },
  ancre: { libelle: 'Ancre', dessin: (c) => <g {...trait(c, 2)}><circle cx="12" cy="4.3" r="1.9" /><path d="M12 6.2V21M8 9h8M4.5 13.5a7.5 7.5 0 0 0 15 0" /></g> },
  poisson: { libelle: 'Poisson', dessin: (c) => <g fill={c}><path d="M2.5 12C6 6.5 13 6.5 16.5 12 13 17.5 6 17.5 2.5 12Z" /><path d="M15.5 12 21.5 7v10Z" /></g> },
  coquillage: { libelle: 'Coquillage', dessin: (c) => <g fill={c}><path d="M12 19 3.2 9.8a9.6 9.6 0 0 1 17.6 0Z" /><path d="M9.5 19.5h5l-1 2.5h-3Z" /></g> },
  hermine: { libelle: 'Hermine', dessin: (c) => <g fill={c}><circle cx="12" cy="3.6" r="1.6" /><circle cx="8.6" cy="5.6" r="1.6" /><circle cx="15.4" cy="5.6" r="1.6" /><path d="M12 7.2c-1.3 5-3 9.5-5.5 14l3.2-1.8L12 22.5l2.3-3.1 3.2 1.8c-2.5-4.5-4.2-9-5.5-14Z" /></g> },
  sommet: { libelle: 'Sommet', dessin: (c) => <g fill={c}><path d="M1.5 20.5 9 6.5l3.6 6.6 3.2-4.6 6.7 12Z" /></g> },
  sapin: { libelle: 'Sapin', dessin: (c) => <g fill={c}><path d="M12 1.8 6.4 9.2h3L5.2 14.6h3.6L4 20h16l-4.8-5.4h3.6L14.6 9.2h3Z" /><path d="M10.8 20h2.4v3h-2.4Z" /></g> },
  epi: { libelle: 'Épi de blé', dessin: (c) => <g fill={c}><path d="M11.2 9h1.6v13h-1.6Z" /><ellipse cx="12" cy="4" rx="1.6" ry="2.7" />{[7.5, 11.5, 15.5].map((y) => <g key={y}><ellipse cx="9.4" cy={y} rx="1.5" ry="2.8" transform={`rotate(-35 9.4 ${y})`} /><ellipse cx="14.6" cy={y} rx="1.5" ry="2.8" transform={`rotate(35 14.6 ${y})`} /></g>)}</g> },
  feuille: { libelle: 'Feuille', dessin: (c) => <g fill={c}><path d="M12 19.5C4.2 15 4.2 7 12 2.5c7.8 4.5 7.8 12.5 0 17Z" /><path d="M11.2 18h1.6v4.5h-1.6Z" /></g> },
  arbre: { libelle: 'Arbre', dessin: (c) => <g fill={c}><circle cx="12" cy="9" r="6.8" /><path d="M10.8 14h2.4v8h-2.4Z" /></g> },
  clocher: { libelle: 'Clocher', dessin: (c) => <g fill={c}><path d="M11.2 1.5h1.6v2.5h-1.6Z" /><path d="M12 4 9 10v3l-4 3v5.5h14V16l-4-3v-3Z" /></g> },
  chateau: { libelle: 'Château', dessin: (c) => <g fill={c}><path d="M3.5 21.5V7.5h3V10h2.2V7.5h2.6V10h1.4V7.5h2.6V10h2.2V7.5h3v14h-6V17a2.5 2.5 0 0 0-5 0v4.5Z" /></g> },
  beffroi: { libelle: 'Beffroi', dessin: (c) => <g fill={c}><path d="M12 1.5 9.2 7h5.6Z" /><path d="M8 7.8h8v2H8Z" /><path d="M9 10.6h6v11H9Z" /></g> },
  pont: { libelle: 'Pont', dessin: (c) => <g fill={c}><path d="M1.5 8.5h21v3H21V20h-2.6a6.4 6.4 0 0 0-12.8 0H3v-8.5H1.5Z" /></g> },
  soleil: { libelle: 'Soleil', dessin: (c) => <g><circle cx="12" cy="12" r="4.6" fill={c} /><g {...trait(c, 2)}>{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d="M12 2.3v2.8" transform={`rotate(${a} 12 12)`} />)}</g></g> },
  lavande: { libelle: 'Lavande', dessin: (c) => <g fill={c}>{[[-14, 8], [0, 12], [14, 16]].map(([a, k]) => <g key={k} transform={`rotate(${a} 12 22)`}><path d="M11.3 10h1.4v12h-1.4Z" />{[3, 5.6, 8.2].map((y) => <ellipse key={y} cx="12" cy={y} rx="1.6" ry="1.5" />)}</g>)}</g> },
  olivier: { libelle: 'Rameau d’olivier', dessin: (c) => <g><path d="M6 21.5C9 15 13 8 18 2.5" {...trait(c, 1.6)} /><g fill={c}>{[[8.4, 16.5, -20], [10.4, 12.6, -30], [12.8, 9, -40], [15.4, 5.6, -50]].map(([x, y, a]) => <g key={y}><ellipse cx={x - 2.4} cy={y} rx="1.2" ry="2.7" transform={`rotate(${a - 40} ${x - 2.4} ${y})`} /><ellipse cx={x + 2} cy={y + 1.6} rx="1.2" ry="2.7" transform={`rotate(${a + 70} ${x + 2} ${y + 1.6})`} /></g>)}</g></g> },
  etoile: { libelle: 'Étoile', dessin: (c) => <g fill={c}><path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.2l-6.2 3.7 1.6-7L2 9.2l7.1-.6Z" /></g> },
  fleur: { libelle: 'Fleur', dessin: (c) => <g fill={c}>{[0, 72, 144, 216, 288].map((a) => <circle key={a} cx="12" cy="7" r="3.6" transform={`rotate(${a} 12 12)`} />)}<circle cx="12" cy="12" r="3" /></g> },
}

// Figure proposée quand la fiche n'en a pas : l'emblème local le plus partagé du département, sinon selon la topographie
const PAR_DEPARTEMENT: [Figure, string][] = [
  ['hermine', '22 56 35'],
  ['voile', '29 44 85 17 33 64 14 50 76 2A 2B 20'],
  ['phare', '62 80'],
  ['beffroi', '59 02 60'],
  ['sapin', '88 67 68 25 39 90 40'],
  ['sommet', '73 74 38 05 04 65 09 63 15 43 66'],
  ['lavande', '84 26'],
  ['soleil', '13 83 06 34 30 11'],
  ['olivier', '07'],
  ['chateau', '37 41 49 45 18 36 24 46'],
  ['epi', '28 51 10 77 27'],
  ['pont', '75 92 93 94 91 78 95'],
  ['arbre', '19 23 87 03 58'],
  ['feuille', '16 86 79 47 82 81 32 31 12 48'],
]
const figureDe = new Map(PAR_DEPARTEMENT.flatMap(([f, liste]) => liste.split(' ').map((d) => [d, f] as const)))

export function figureDeduite(departement: string, topographie: 'littoral' | 'montagne' | 'terres'): Figure {
  const t = departement.trim().toUpperCase()
  return figureDe.get(/^\d$/.test(t) ? `0${t}` : t) ?? (topographie === 'littoral' ? 'voile' : topographie === 'montagne' ? 'sommet' : 'clocher')
}

export const estFigure = (f: unknown): f is Figure => typeof f === 'string' && f in figures
