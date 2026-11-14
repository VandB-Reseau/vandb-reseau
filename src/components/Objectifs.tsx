// Objectifs chiffrés du magasin (refonte vague 3, Joseph 09/11/2026, 26A) : vue d'ensemble de la fiche, préparation de visite
import { useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Fenetre } from './EditionEquipe'
import { Puces } from './Social'
import { useAuth } from '../auth/AuthContext'
import { enregistrerObjectifs } from '../data/chargement'
import { actionsDuMagasin } from '../data/actions'
import { analyser, chiffresDuMagasin, decalerMois, libelleMois } from '../data/chiffres'
import { echelle } from '../theme/theme'
import { INDICATEURS, avancement, cibleObjectif, formatIndicateur, libelleStatut, periodeObjectif, phraseObjectif, valeurAu, type IndicateurObjectif, type ModeObjectif, type Objectif, type StatutObjectif } from '../data/objectifs'
import type { Magasin, Reseau } from '../data/modele'

const couleurStatut: Record<StatutObjectif, string> = { atteint: 'success.main', voie: 'success.main', retard: 'error.main', manque: 'error.main', attente: 'text.secondary' }
const couleurJauge: Record<StatutObjectif, string> = { atteint: '#307672', voie: '#307672', retard: '#c24119', manque: '#c24119', attente: '#b4afa8' }

// Joseph (14/11/2026) : en tête de chaque objectif de l'année, sa période, sa cible, sa jauge et son statut ; les
// priorités qui y mènent se rangent dessous (SectionObjectifsPlan, PlanAction.tsx)
export function EnteteObjectif({ reseau, magasin, o, onClick }: { reseau: Reseau; magasin: string; o: Objectif; onClick?: () => void }) {
  const a = avancement(reseau, magasin, o)
  const detail = [a.mois ? `${libelleMois(a.mois)} : ${formatIndicateur(o.indicateur, o.mode, a.actuel)}` : null, o.par && `fixé par ${o.par}`].filter(Boolean).join(' · ')
  const pct = Math.max(0, Math.min(1, a.progression ?? 0)) * 100
  const contenu = (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(0, 1fr) 120px 150px' }, gap: { xs: 0.5, sm: 2 }, alignItems: 'center', width: '100%', textAlign: 'left' }}>
      <Box sx={{ minWidth: 0, gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{periodeObjectif(o)}</Typography>
        <Typography component="h3" sx={{ fontWeight: 700, fontSize: echelle.carte }}>{cibleObjectif(o)}</Typography>
        {detail && <Typography variant="body2" color="text.secondary">{detail}</Typography>}
      </Box>
      <Box role="meter" aria-label={`Avancement : ${phraseObjectif(o)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
        sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: couleurJauge[a.statut], borderRadius: 4 }} />
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 700, color: couleurStatut[a.statut], textAlign: { sm: 'right' } }}>{libelleStatut[a.statut]}</Typography>
    </Box>
  )
  const sx = { display: 'block', width: '100%', py: 1, minHeight: 56, borderRadius: 1 } as const
  return onClick
    ? <ButtonBase onClick={onClick} aria-label={`Modifier l’objectif ${phraseObjectif(o)}`} sx={{ ...sx, fontFamily: 'inherit', '&:hover': { bgcolor: 'action.hover' } }}>{contenu}</ButtonBase>
    : <Box sx={sx}>{contenu}</Box>
}

const nombreSaisi = (t: string) => { const n = Number(t.replace(/\s/g, '').replace(',', '.').replace('%', '').replace('€', '')); return t.trim() && Number.isFinite(n) ? n : null }

export function DialogObjectif({ reseau, m, objectif, onFermer }: { reseau: Reseau; m: Magasin; objectif: Objectif | null; onFermer: (msg?: string) => void }) {
  const { profil } = useAuth()
  const liste = chiffresDuMagasin(reseau, m.nom)
  const dernier = analyser(reseau, m.nom)?.mois ?? decalerMois(reseau.jour.slice(0, 7), -1)
  const [indicateur, setIndicateur] = useState<IndicateurObjectif>(objectif?.indicateur ?? 'pmCave')
  const [mode, setMode] = useState<ModeObjectif>(objectif?.mode ?? 'valeur')
  const [cible, setCible] = useState(objectif ? String(objectif.cible).replace('.', ',') : '')
  // Joseph (14/11/2026) : un objectif se fixe pour l'année ou le semestre ; fin de l'année en cours par défaut, l'année
  // suivante dès novembre
  const an = Number(reseau.jour.slice(0, 4)) + (Number(reseau.jour.slice(5, 7)) >= 11 ? 1 : 0)
  const horizons = [`${an}-06`, `${an}-12`, ...(an === Number(reseau.jour.slice(0, 4)) ? [`${an + 1}-12`] : [])]
  const [echeance, setEcheance] = useState(objectif?.echeance ?? `${an}-12`)
  const ouvertes = actionsDuMagasin(reseau, m.nom).filter((x) => !x.a.faite || objectif?.taches.includes(x.cle))
  const [taches, setTaches] = useState<string[]>(objectif?.taches ?? [])
  const moisDepart = objectif?.moisDepart ?? dernier
  const depart = objectif && objectif.indicateur === indicateur && objectif.mode === mode ? objectif.depart : valeurAu(liste, indicateur, mode, moisDepart)
  const n = nombreSaisi(cible)
  const valide = n !== null && /^\d{4}-\d{2}$/.test(echeance) && echeance > moisDepart
  const enregistrer = async () => {
    const o: Objectif = {
      id: objectif?.id ?? `o_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      indicateur, mode, depart, moisDepart, cible: n!, echeance, taches,
      par: objectif?.par ?? profil?.nom ?? '', creeLe: objectif?.creeLe ?? reseau.jour, visite: objectif?.visite ?? null,
    }
    const tous = reseau.objectifs?.[m.nom] ?? []
    await enregistrerObjectifs(m.nom, objectif ? tous.map((x) => (x.id === o.id ? o : x)) : [...tous, o])
    return objectif ? 'Objectif enregistré.' : 'Objectif fixé.'
  }
  const clore = async () => {
    await enregistrerObjectifs(m.nom, (reseau.objectifs?.[m.nom] ?? []).map((x) => (x.id === objectif!.id ? { ...x, clos: reseau.jour } : x)))
    return 'Objectif retiré du suivi.'
  }
  return (
    <Fenetre titre={objectif ? 'Modifier l’objectif' : `Fixer un objectif à ${m.nom}`} ouvert onFermer={onFermer} valide={valide} enregistrer={enregistrer}
      supprimer={objectif ? clore : undefined} libelleSuppression={objectif ? 'Retirer cet objectif du suivi ?' : undefined}>
      <TextField select label="Indicateur de la caisse" value={indicateur} onChange={(e) => setIndicateur(e.target.value as IndicateurObjectif)}>
        {INDICATEURS.map((i) => <MenuItem key={i.id} value={i.id} sx={{ minHeight: 48 }}>{i.libelle}</MenuItem>)}
      </TextField>
      <Puces label="Cible" valeur={mode} onChange={setMode} options={[{ v: 'valeur', libelle: 'Une valeur' }, { v: 'evolution', libelle: 'Une évolution vs N-1' }]} />
      <Typography variant="body2" color="text.secondary">
        {`Départ, ${libelleMois(moisDepart)} : ${formatIndicateur(indicateur, mode, depart)}${mode === 'evolution' ? ' vs N-1' : ''}`}
      </Typography>
      <Puces label="Période" valeur={horizons.includes(echeance) ? echeance : 'autre'} onChange={(v) => { if (v !== 'autre') setEcheance(v) }}
        options={[...horizons.map((h) => ({ v: h, libelle: h.endsWith('-06') ? `1er semestre ${h.slice(0, 4)}` : `Année ${h.slice(0, 4)}` })), { v: 'autre', libelle: 'Autre échéance' }]} />
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <TextField label={mode === 'evolution' ? 'Évolution visée (%)' : 'Valeur visée'} value={cible} onChange={(e) => setCible(e.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          error={!!cible && n === null} helperText={!!cible && n === null ? 'Un nombre, par exemple 26,5' : ' '} />
        <TextField type="month" label="Échéance" value={echeance} onChange={(e) => setEcheance(e.target.value)} slotProps={{ inputLabel: { shrink: true } }}
          error={!!echeance && echeance <= moisDepart} helperText={!!echeance && echeance <= moisDepart ? `Après ${libelleMois(moisDepart)}` : ' '} />
      </Box>
      {!!ouvertes.length && (
        <Box role="group" aria-label="Tâches rattachées">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Tâches rattachées</Typography>
          {ouvertes.map((x) => (
            <FormControlLabel key={x.cle} sx={{ display: 'flex', minHeight: 48, mr: 0 }} label={x.a.action}
              control={<Checkbox checked={taches.includes(x.cle)} onChange={(e) => setTaches((t) => (e.target.checked ? [...t, x.cle] : t.filter((k) => k !== x.cle)))} />} />
          ))}
        </Box>
      )}
    </Fenetre>
  )
}
