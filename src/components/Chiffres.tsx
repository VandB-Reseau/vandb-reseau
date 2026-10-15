import { useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ErrorOutline from '@mui/icons-material/ErrorOutlineOutlined'
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined'
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutlineOutlined'
import { Fenetre } from './EditionEquipe'
import { enregistrerChiffres } from '../data/chargement'
import {
  caDe, champsSaisis, chiffresDuMagasin, completerChiffres, formatValeur, libellesChiffres, couleurAlerte, decalerMois, formatEuros, libelleAlerte, libelleMois, libelleMoisCourt, lireNombre, moisPrecedent,
  type ChampChiffre, type ChiffreMois, type StatutAlerte, type SuiviAlerte,
} from '../data/chiffres'
import { dateCourte } from '../lib/format'
import type { Reseau } from '../data/modele'

const icones: Record<StatutAlerte, React.ReactElement> = {
  decroche: <ErrorOutline />, surveiller: <WarningAmberOutlined />, ok: <CheckCircleOutline />,
}

export function PastilleAlerte({ statut }: { statut: StatutAlerte | null }) {
  if (!statut) return <Chip size="small" label="Sans chiffres" variant="outlined" sx={{ fontSize: 12 }} />
  return <Chip size="small" icon={icones[statut]} label={libelleAlerte[statut]} color={couleurAlerte[statut]} variant={statut === 'ok' ? 'outlined' : 'filled'} sx={{ fontSize: 12, fontWeight: 600 }} />
}

// Où en est l'appel d'un magasin qui décroche
export function PastilleAppel({ s }: { s: SuiviAlerte | null }) {
  if (!s) return null
  if (s.contact) return <Chip size="small" color={s.contact.date <= s.limite ? 'success' : 'default'} variant="outlined" label={`Contact le ${dateCourte(s.contact.date)}`} sx={{ fontSize: 12, fontWeight: 600 }} />
  if (s.retard > 0) return <Chip size="small" color="error" label={`Appel en retard de ${s.retard} j`} sx={{ fontSize: 12, fontWeight: 600 }} />
  return <Chip size="small" color="warning" label={`À appeler avant le ${dateCourte(s.limite)}`} sx={{ fontSize: 12, fontWeight: 600 }} />
}

// ── Saisie des chiffres d'un mois ──
type Valeurs = Partial<Record<ChampChiffre, string>>
const versTexte = (c: ChiffreMois | undefined): Valeurs => Object.fromEntries(champsSaisis.map((k) => [k, c?.[k] === null || c?.[k] === undefined ? '' : String(c[k]).replace('.', ',')]))

export function useSaisieChiffres(reseau: Reseau, magasin: string, moisInitial: string) {
  const [mois, setMoisBrut] = useState(moisInitial)
  const lu = (m: string, nom = magasin) => chiffresDuMagasin(reseau, nom).find((c) => c.mois === m)
  const [valeurs, setValeurs] = useState<Valeurs>(() => versTexte(lu(moisInitial)))
  const [pour, setPour] = useState(magasin)
  // Changer de mois ou de magasin recharge les chiffres déjà connus
  if (pour !== magasin) { setPour(magasin); setValeurs(versTexte(lu(mois))) }
  const setMois = (m: string) => { setMoisBrut(m); if (/^\d{4}-\d{2}$/.test(m)) setValeurs(versTexte(lu(m))) }
  const invalides = champsSaisis.filter((k) => valeurs[k]?.trim() && lireNombre(valeurs[k]) === null)
  const avant = versTexte(lu(mois))
  const modifie = /^\d{4}-\d{2}$/.test(mois) && champsSaisis.some((k) => lireNombre(valeurs[k]) !== lireNombre(avant[k]))
  // Les chiffres saisis, complétés des CA, flux cumulé et panier moyen calculés
  const ligne = () => completerChiffres({ magasin, mois, ...Object.fromEntries(champsSaisis.map((k) => [k, lireNombre(valeurs[k])])) }, lu(mois))
  return { mois, setMois, valeurs, setValeurs, invalides, modifie, ligne, valide: invalides.length === 0 }
}
export type SaisieChiffres = ReturnType<typeof useSaisieChiffres>

export function ChampsChiffres({ s, reseau, titre }: { s: SaisieChiffres; reseau: Reseau; titre?: string }) {
  // Les 24 derniers mois, du plus récent au plus ancien
  const options = Array.from({ length: 24 }, (_x, i) => decalerMois(reseau.jour.slice(0, 7), -i))
  if (!options.includes(s.mois)) options.push(s.mois)
  return (
    <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      {titre && <Typography component="legend" variant="subtitle2" sx={{ mb: 1.5 }}>{titre}</Typography>}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
        <TextField select label="Mois" value={s.mois} onChange={(e) => s.setMois(e.target.value)} sx={{ gridColumn: { xs: 'span 2', sm: 'auto' } }}>
          {options.map((m) => <MenuItem key={m} value={m}>{libelleMois(m)}</MenuItem>)}
        </TextField>
        {champsSaisis.map((k) => {
          const { libelle, unite } = libellesChiffres[k]
          return (
            <TextField
              key={k} label={unite ? `${libelle} (${unite})` : libelle} value={s.valeurs[k] ?? ''} inputMode="decimal"
              sx={k === 'caExt' ? { gridColumn: { xs: 'span 2', sm: 'auto' } } : undefined}
              onChange={(e) => s.setValeurs((v) => ({ ...v, [k]: e.target.value }))}
              error={s.invalides.includes(k)} helperText={s.invalides.includes(k) ? 'Nombre attendu' : undefined}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            />
          )
        })}
      </Box>
      <Calcules s={s} />
    </Box>
  )
}

// CA cave, CA bar, CA cumulé et flux cumulé, calculés à partir de la saisie
function Calcules({ s }: { s: SaisieChiffres }) {
  if (s.invalides.length) return null
  const l = s.ligne()
  const ca = caDe(l as ChiffreMois)
  const lignes: [string, string][] = [
    ['CA cave', formatValeur('caCave', l.caCave ?? null)], ['CA bar', formatValeur('caBar', l.caBar ?? null)],
    ['CA cumulé', formatEuros(ca)], ['Flux cumulé', formatValeur('tickets', l.tickets ?? null)],
  ]
  return (
    <Box aria-label="Chiffres calculés" role="group" sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, mt: 2, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
      {lignes.map(([t, v]) => (
        <Box key={t}>
          <Typography variant="body2" color="text.secondary">{t}</Typography>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>{v}</Typography>
        </Box>
      ))}
    </Box>
  )
}

export function DialogChiffres({ reseau, magasin, onFermer }: { reseau: Reseau; magasin: string; onFermer: (m?: string) => void }) {
  const s = useSaisieChiffres(reseau, magasin, moisPrecedent(reseau.jour))
  return (
    <Fenetre titre={`Chiffres de ${magasin}`} ouvert onFermer={onFermer} valide={s.valide && s.modifie}
      enregistrer={async () => { await enregistrerChiffres([s.ligne()]); return `Chiffres de ${libelleMois(s.mois)} enregistrés.` }}>
      <ChampsChiffres s={s} reseau={reseau} />
    </Fenetre>
  )
}

// CA des 12 derniers mois connus, en barres ; le même mois un an plus tôt en trait
export function GraphiqueCA({ liste }: { liste: ChiffreMois[] }) {
  const fin = liste.filter((c) => caDe(c) !== null).at(-1)?.mois
  if (!fin) return null
  const parMois = new Map(liste.map((c) => [c.mois, c]))
  const mois = Array.from({ length: 12 }, (_x, i) => decalerMois(fin, i - 11))
  const points = mois.map((m) => ({ m, ca: caDe(parMois.get(m)), n1: caDe(parMois.get(decalerMois(m, -12))) }))
  const max = Math.max(1, ...points.flatMap((p) => [p.ca ?? 0, p.n1 ?? 0]))
  const L = 600, H = 150, bas = 148, pas = L / 12, larg = pas - 10
  const y = (v: number) => bas - (v / max) * (bas - 10)
  const resume = points.map((p) => `${libelleMois(p.m)} : ${formatEuros(p.ca)}${p.n1 !== null ? `, un an plus tôt ${formatEuros(p.n1)}` : ''}`).join(' ; ')
  return (
    <Box sx={{ mt: 1 }}>
      <Box component="svg" viewBox={`0 0 ${L} ${H}`} role="img" aria-label={`CA mensuel sur 12 mois. ${resume}`} sx={{ width: '100%', height: 'auto', display: 'block' }}>
        <line x1={0} x2={L} y1={bas} y2={bas} stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} />
        {points.map((p, i) => (
          <g key={p.m}>
            <title>{`${libelleMois(p.m)} : ${formatEuros(p.ca)}${p.n1 !== null ? ` · un an plus tôt ${formatEuros(p.n1)}` : ''}`}</title>
            <rect x={i * pas} y={0} width={pas} height={H} fill="transparent" />
            {p.ca !== null && <path d={`M${i * pas + 5},${bas} V${y(p.ca) + 4} q0,-4 4,-4 h${larg - 8} q4,0 4,4 V${bas} Z`} fill="#1b6fce" />}
            {p.n1 !== null && <line x1={i * pas + 3} x2={i * pas + pas - 3} y1={y(p.n1)} y2={y(p.n1)} stroke="#ef7d00" strokeWidth={3} strokeLinecap="round" />}
          </g>
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', mt: 0.5 }} aria-hidden>
        {points.filter((_p, i) => i % 2 === 1).map((p) => <Typography key={p.m} variant="caption" color="text.secondary" sx={{ textAlign: 'right', pr: '4%' }}>{libelleMoisCourt(p.m)}</Typography>)}
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 0.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: '#1b6fce' }} />CA du mois</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 14, height: 3, borderRadius: 1, bgcolor: '#ef7d00' }} />Un an plus tôt</Typography>
      </Box>
    </Box>
  )
}
