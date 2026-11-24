// 364 / 365 (Joseph, 23/11/2026, tableau de bord « type SaaS ») : deux graphes simples, dessinés en SVG, aux couleurs
// de la charte : un anneau de répartition avec sa légende, des barres sur quelques mois (le dernier en foncé).
// Pas de bibliothèque de graphes : rien à télécharger de plus, et le rendu suit le thème clair ou sombre.
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { brand, styleIntertitre } from '../theme/theme'

export interface Part { libelle: string; valeur: number; couleur?: string }
export const couleursParts = [brand.or, brand.vertFonce, brand.orange, brand.anthracite, brand.beige, brand.brique]

// Carte de graphe : titre, sous-titre gris, éventuellement une évolution à droite
export function CarteGraphe({ titre, sousTitre, fin, children }: { titre: string; sousTitre?: string; fin?: ReactNode; children: ReactNode }) {
  return (
    <Box component="section" aria-label={titre} sx={{ minWidth: 0, p: { xs: 1.5, md: 2 }, borderRadius: '14px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h3" sx={{ ...styleIntertitre, mb: 0 }}>{titre}</Typography>
          {sousTitre && <Typography variant="body2" color="text.secondary">{sousTitre}</Typography>}
        </Box>
        {fin}
      </Box>
      {children}
    </Box>
  )
}

// Anneau : les parts dans l'ordre, le total au centre, la légende à droite (dessous sur téléphone)
export function Anneau({ parts, centre, sousCentre, format, label }: { parts: Part[]; centre: string; sousCentre?: string; format: (n: number) => string; label: string }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.valeur), 0)
  const r = 52, ep = 18, c = 2 * Math.PI * r
  let deja = 0
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
      <Box sx={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
        <svg width={140} height={140} viewBox="0 0 140 140" role="img" aria-label={label}>
          <circle cx={70} cy={70} r={r} fill="none" stroke="var(--vb-entete, #f3eee6)" strokeWidth={ep} />
          {total > 0 && parts.map((p, i) => {
            const part = Math.max(0, p.valeur) / total
            const arc = <circle key={p.libelle} cx={70} cy={70} r={r} fill="none" stroke={p.couleur ?? couleursParts[i % couleursParts.length]} strokeWidth={ep}
              strokeDasharray={`${Math.max(0, part * c - 1.5)} ${c}`} strokeDashoffset={-deja * c} transform="rotate(-90 70 70)" />
            deja += part
            return arc
          })}
        </svg>
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{centre}</Typography>
          {sousCentre && <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{sousCentre}</Typography>}
        </Box>
      </Box>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, flex: 1, minWidth: 180, display: 'grid', gap: 0.75 }}>
        {parts.map((p, i) => (
          <Box component="li" key={p.libelle} sx={{ display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr) auto 44px', alignItems: 'center', columnGap: 1, fontSize: '0.875rem' }}>
            <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: p.couleur ?? couleursParts[i % couleursParts.length] }} />
            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.libelle}</Box>
            <Box component="span" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{format(p.valeur)}</Box>
            <Box component="span" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{total ? `${Math.round((Math.max(0, p.valeur) / total) * 100)} %` : '—'}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// Barres verticales : une par période ; la dernière (la période en cours) en foncé avec sa valeur au-dessus
export interface Barre { libelle: string; valeur: number | null; reference?: number | null }
// ouvrir (405, Joseph 24/11/2026) : un clic sur une barre ouvre son détail (le mois dans « Mois par mois »)
export function Barres({ barres, format, label, hauteur = 150, ouvrir, libelleOuvrir }: { barres: Barre[]; format: (n: number) => string; label: string; hauteur?: number; ouvrir?: (i: number) => void; libelleOuvrir?: (b: Barre) => string }) {
  const max = Math.max(1, ...barres.flatMap((b) => [b.valeur ?? 0, b.reference ?? 0]))
  const n = barres.length
  const avecRef = barres.some((b) => b.reference != null)
  return (
    <Box role={ouvrir ? 'group' : 'img'} aria-label={label} sx={{ position: 'relative' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, alignItems: 'end', gap: 1, height: hauteur, borderBottom: '1px solid', borderColor: 'divider', pt: 3 }}>
        {barres.map((b, i) => {
          const dernier = i === n - 1
          const h = b.valeur == null ? 0 : Math.max(2, (b.valeur / max) * (hauteur - 28))
          return (
            <Box key={b.libelle} {...(ouvrir ? { component: 'button' as const, type: 'button' as const, onClick: () => ouvrir(i), 'aria-label': libelleOuvrir?.(b) ?? b.libelle, title: libelleOuvrir?.(b) } : {})}
              sx={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 0.5,
                ...(ouvrir ? { border: 0, p: 0, m: 0, bgcolor: 'transparent', font: 'inherit', cursor: 'pointer', minWidth: 0, borderRadius: 1, '&:hover, &:focus-visible': { bgcolor: 'action.hover' } } : {}) }}>
              {avecRef && <Box sx={{ width: '34%', maxWidth: 18, height: b.reference == null ? 0 : Math.max(2, (b.reference / max) * (hauteur - 28)), borderRadius: '4px 4px 0 0', bgcolor: brand.beige, borderBottom: 0 }} />}
              <Box sx={{ position: 'relative', width: avecRef ? '40%' : '62%', maxWidth: avecRef ? 22 : 40, height: h, borderRadius: '6px 6px 0 0', bgcolor: dernier ? brand.vertFonce : 'rgba(48, 118, 114, 0.35)' }}>
                {dernier && b.valeur != null && <Box component="span" sx={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translate(-50%, -4px)', px: 0.75, py: 0.25, borderRadius: 1, bgcolor: 'text.primary', color: 'background.paper', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{format(b.valeur)}</Box>}
              </Box>
            </Box>
          )
        })}
      </Box>
      <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: 1, mt: 0.5 }}>
        {barres.map((b, i) => <Typography key={b.libelle} sx={{ fontSize: '0.75rem', textAlign: 'center', color: i === n - 1 ? 'text.primary' : 'text.secondary', fontWeight: i === n - 1 ? 700 : 400 }}>{b.libelle}</Typography>)}
      </Box>
      {avecRef && (
        <Box aria-hidden sx={{ display: 'flex', gap: 2, mt: 1, fontSize: '0.75rem', color: 'text.secondary' }}>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: brand.vertFonce }} />Cette année</Box>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: brand.beige }} />L’an dernier</Box>
        </Box>
      )}
      <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{barres.map((b) => `${b.libelle} : ${b.valeur == null ? 'pas de chiffre' : format(b.valeur)}`).join(', ')}</Box>
    </Box>
  )
}

// Barres empilées (407 / 408, Joseph 24/11/2026) : une colonne par période, chaque série en aplat de la charte, le total
// au-dessus ; un clic sur une colonne la choisit (actif), un second clic la relâche. La légende sous le graphe.
export interface Serie { libelle: string; couleur: string }
export interface Colonne { libelle: string; cle: string; valeurs: number[] }
export function BarresEmpilees({ colonnes, series, label, hauteur = 150, ouvrir, actif, libelleOuvrir, enPart = false }: {
  colonnes: Colonne[]; series: Serie[]; label: string; hauteur?: number; ouvrir?: (cle: string) => void; actif?: string | null; libelleOuvrir?: (c: Colonne) => string
  enPart?: boolean // chaque colonne à 100 % (répartition) plutôt qu'en nombre
}) {
  const total = (c: Colonne) => c.valeurs.reduce((a, v) => a + v, 0)
  const max = Math.max(1, ...colonnes.map(total))
  const n = colonnes.length
  const visibles = series.map((s, i) => ({ ...s, i })).filter((s) => colonnes.some((c) => (c.valeurs[s.i] ?? 0) > 0))
  return (
    <Box role={ouvrir ? 'group' : 'img'} aria-label={label} sx={{ position: 'relative' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, alignItems: 'end', gap: { xs: 0.5, md: 1 }, height: hauteur, borderBottom: '1px solid', borderColor: 'divider', pt: 2.5 }}>
        {colonnes.map((c) => {
          const t = total(c)
          const h = enPart ? (t ? hauteur - 24 : 0) : t ? Math.max(3, (t / max) * (hauteur - 24)) : 0
          const choisie = actif === c.cle
          return (
            <Box key={c.cle} {...(ouvrir ? { component: 'button' as const, type: 'button' as const, onClick: () => ouvrir(c.cle), 'aria-label': libelleOuvrir?.(c) ?? c.libelle, 'aria-pressed': choisie, title: libelleOuvrir?.(c) } : {})}
              sx={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', minWidth: 0,
                ...(ouvrir ? { border: 0, p: 0, m: 0, bgcolor: choisie ? 'action.selected' : 'transparent', font: 'inherit', cursor: 'pointer', borderRadius: 1, '&:hover, &:focus-visible': { bgcolor: 'action.hover' } } : {}),
                opacity: actif && !choisie ? 0.45 : 1 }}>
              <Box sx={{ position: 'relative', width: '64%', maxWidth: 40, height: h, display: 'flex', flexDirection: 'column-reverse', borderRadius: '6px 6px 0 0', overflow: 'hidden' }}>
                {c.valeurs.map((v, i) => v > 0 && <Box key={i} sx={{ flex: `${v} 0 0`, bgcolor: series[i]?.couleur ?? brand.vertFonce, minHeight: 2 }} />)}
              </Box>
              {t > 0 && !enPart && <Box component="span" sx={{ position: 'absolute', bottom: h + 2, left: 0, right: 0, textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{t}</Box>}
            </Box>
          )
        })}
      </Box>
      <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: { xs: 0.5, md: 1 }, mt: 0.5 }}>
        {colonnes.map((c) => <Typography key={c.cle} sx={{ fontSize: '0.75rem', textAlign: 'center', color: actif === c.cle ? 'text.primary' : 'text.secondary', fontWeight: actif === c.cle ? 700 : 400, overflow: 'hidden', whiteSpace: 'nowrap' }}>{c.libelle}</Typography>)}
      </Box>
      <Box aria-hidden sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5, mt: 1, fontSize: '0.75rem', color: 'text.secondary' }}>
        {visibles.map((s) => <Box key={s.libelle} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: s.couleur }} />{s.libelle}</Box>)}
      </Box>
      <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {colonnes.map((c) => `${c.libelle} : ${visibles.filter((s) => c.valeurs[s.i]).map((s) => `${s.libelle} ${c.valeurs[s.i]}`).join(', ') || 'rien'}`).join(' ; ')}
      </Box>
    </Box>
  )
}

// Barre de répartition horizontale (408) : une seule barre, chaque part en aplat avec son nombre dessous
export function BarreRepartition({ parts, label }: { parts: Part[]; label: string }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.valeur), 0)
  return (
    <Box role="img" aria-label={`${label} : ${parts.map((p) => `${p.libelle} ${p.valeur}`).join(', ')}`}>
      <Box sx={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', bgcolor: 'divider' }}>
        {total > 0 && parts.map((p, i) => p.valeur > 0 && <Box key={p.libelle} sx={{ flex: `${p.valeur} 0 0`, bgcolor: p.couleur ?? couleursParts[i % couleursParts.length], '& + &': { borderLeft: '2px solid', borderColor: 'background.paper' } }} />)}
      </Box>
      <Box aria-hidden sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2.5, rowGap: 0.5, mt: 1 }}>
        {parts.map((p, i) => (
          <Box key={p.libelle} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: '0.875rem' }}>
            <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: p.couleur ?? couleursParts[i % couleursParts.length] }} />
            {p.libelle}<Box component="span" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{p.valeur}</Box>
            <Box component="span" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{total ? `${Math.round((p.valeur / total) * 100)} %` : ''}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
