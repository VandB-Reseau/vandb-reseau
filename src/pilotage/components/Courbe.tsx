import { brand } from '../theme/theme'

// Petite courbe d'une carte : tendance sur l'année, sans axe ni légende (décorative, la valeur est dans la carte).
// reference (Joseph, 23/11/2026) : l'an dernier en pointillé gris, à la même échelle
// repere (396, Joseph 24/11/2026) : la médiane du réseau à date, en trait jaune horizontal
export function Courbe({ valeurs, reference, couleur = brand.vert, repere }: { valeurs: (number | null)[]; reference?: (number | null)[]; couleur?: string; repere?: number | null }) {
  const pts = (l: (number | null)[]) => l.map((v, i) => ({ i, v })).filter((p): p is { i: number; v: number } => p.v !== null)
  const points = pts(valeurs)
  if (points.length < 2) return null
  // L'an dernier sur les seuls mois de la courbe, pour comparer à date
  const ref = reference ? pts(reference).filter((p) => p.i >= points[0].i && p.i <= points[points.length - 1].i) : []
  const tous = [...points, ...ref, ...(repere != null ? [{ i: 0, v: repere }] : [])]
  const max = Math.max(...tous.map((p) => p.v)), min = Math.min(0, ...tous.map((p) => p.v))
  // Étirée sur les seuls mois connus : deux mois de réel occupent toute la largeur
  const premier = points[0].i, dernier = points[points.length - 1].i
  const x = (i: number) => ((i - premier) / (dernier - premier)) * 100
  const y = (v: number) => 28 - ((v - min) / (max - min || 1)) * 26
  const tracer = (l: { i: number; v: number }[]) => l.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const trace = tracer(points)
  const aire = `${trace} L${x(points[points.length - 1].i).toFixed(1)},30 L${x(points[0].i).toFixed(1)},30 Z`
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden width="100%" height="32" style={{ display: 'block' }}>
      {ref.length > 1 && <path d={tracer(ref)} fill="none" stroke="var(--mui-palette-text-secondary)" strokeWidth={1.25} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity={0.7} />}
      {repere != null && <line data-repere x1={0} x2={100} y1={y(repere)} y2={y(repere)} stroke={brand.or} strokeWidth={1.5} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />}
      <path d={aire} fill={couleur} opacity={0.1} />
      <path d={trace} fill="none" stroke={couleur} strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}
