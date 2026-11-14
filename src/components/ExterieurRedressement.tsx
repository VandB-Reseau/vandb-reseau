import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Typography from '@mui/material/Typography'
import AddTaskOutlined from '@mui/icons-material/AddTaskOutlined'
import { Ligne, Section } from './Section'
import { ChampDate } from './ChampDate'
import { useApercu } from '../auth/Apercu'
import { useAuth } from '../auth/AuthContext'
import { porteursDu } from '../data/actions'
import { enregistrerActionLibre } from '../data/chargement'
import { analyser, formatEuros, formatPourcent, libelleMois } from '../data/chiffres'
import { exterieurDe } from '../data/exterieur'
import { useReseau } from '../data/ReseauContext'
import type { Magasin, Reseau } from '../data/modele'
import { CAUSES_DIFFICULTE, leviersPour, type CauseDifficulte, type LevierRedressement } from '../pilotage/moteur/boiteOutils'

const pct = (x: number) => `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`

// Vague 9, choix 140 (Joseph 14/11/2026) : l'Extérieur à sa place dans les chiffres du magasin, pour l'équipe seulement
export function SectionExterieur({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const x = exterieurDe(reseau, m.nom)
  if (!x) return null
  const r = x.reseau
  return (
    <Section titre={`Marché extérieur · ${x.annee}`}
      action={<Button component={RouterLink} to={`/magasins/${encodeURIComponent(m.nom)}?vue=chiffres&partie=simulateurs&sim=exterieur`} sx={{ minHeight: 48 }}>Simuler un contrat</Button>}>
      <Ligne libelle={`CA extérieur, janvier à ${libelleMois(x.dernierMois).split(' ')[0]}`}>{formatEuros(x.caExt)}</Ligne>
      <Ligne libelle="Part du CA du magasin">{x.part === null ? null : pct(x.part)}</Ligne>
      <Ligne libelle={`Évolution sur ${Number(x.annee) - 1}`}>{x.evolution === null ? null : `${formatPourcent(x.evolution)} (${formatEuros(x.caExtN1)})`}</Ligne>
      {r && (
        <>
          <Ligne libelle={`Rang parmi ${r.n} magasins avec un CA extérieur`}>{`${r.rang}e · ${r.position === 'haut' ? 'quart supérieur' : r.position === 'bas' ? 'quart inférieur' : 'dans la moyenne'}`}</Ligne>
          <Ligne libelle="Médiane, quart inférieur et supérieur">{`${formatEuros(r.mediane)} · ${formatEuros(r.q1)} à ${formatEuros(r.q3)}`}</Ligne>
        </>
      )}
    </Section>
  )
}

// Vague 9, choix 147 : magasin qui décroche. Le Coach coche les causes, l'app propose les leviers de la « Caisse à outils
// magasins en difficultés » et crée une tâche du Coach par levier retenu. Grille causes et leviers par défaut, à corriger.
export function SectionRedressement({ reseau, m }: { reseau: Reseau; m: Magasin }) {
  const { recharger } = useReseau()
  const { profil } = useAuth()
  const { apercu, equipe } = useApercu()
  const [causes, setCauses] = useState<CauseDifficulte[]>([])
  const [retenus, setRetenus] = useState<LevierRedressement[]>([])
  const dans30 = useMemo(() => { const d = new Date(`${reseau.jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 30); return d.toISOString().slice(0, 10) }, [reseau.jour])
  const [echeance, setEcheance] = useState(dans30)
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<{ bon: boolean; texte: string } | null>(null)
  if (analyser(reseau, m.nom)?.statut !== 'decroche') return null
  const leviers = leviersPour(causes)
  const choisis = leviers.filter((l) => retenus.includes(l.cle))
  const lectureSeule = !!apercu || !!equipe
  const basculer = <T,>(l: T[], v: T, oui: boolean) => (oui ? [...l, v] : l.filter((x) => x !== v))
  const creer = async () => {
    setOccupe(true); setMessage(null)
    const porteur = porteursDu(reseau, m.nom).find((p) => p.role === 'Coach')?.nom ?? ''
    let n = 0
    for (const l of choisis) {
      try {
        await enregistrerActionLibre(m.nom, { action: `Redressement : ${l.libelle}`, porteur, echeance, creeLe: reseau.jour, ...(profil?.nom ? { auteur: profil.nom } : {}) })
        n++
      } catch { /* suivant */ }
    }
    await recharger().catch(() => undefined)
    setOccupe(false)
    setRetenus([])
    setMessage(n ? { bon: true, texte: `${n} tâche${n > 1 ? 's' : ''} du plan créée${n > 1 ? 's' : ''}${porteur ? ` pour ${porteur}` : ''}.` } : { bon: false, texte: 'Les tâches n’ont pas été créées. Vérifie ta connexion, puis réessaie.' })
  }
  return (
    <Section titre="Plan de redressement">
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Pourquoi le magasin décroche</Typography>
      <Box role="group" aria-label="Causes du décrochage" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, mb: 1 }}>
        {CAUSES_DIFFICULTE.map((c) => (
          <FormControlLabel key={c.cle} label={c.libelle} sx={{ minHeight: 48, mr: 0 }}
            control={<Checkbox sx={{ width: 48, height: 48 }} checked={causes.includes(c.cle)} onChange={(e) => { setCauses((l) => basculer(l, c.cle, e.target.checked)); setMessage(null) }} />} />
        ))}
      </Box>
      {leviers.length > 0 && (
        <>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Leviers proposés</Typography>
          <Box role="group" aria-label="Leviers du plan" sx={{ display: 'grid', mb: 1 }}>
            {leviers.map((l) => (
              <FormControlLabel key={l.cle} label={`${l.theme} · ${l.libelle}`} sx={{ minHeight: 48, mr: 0 }} disabled={lectureSeule}
                control={<Checkbox sx={{ width: 48, height: 48 }} checked={retenus.includes(l.cle)} onChange={(e) => setRetenus((x) => basculer(x, l.cle, e.target.checked))} />} />
            ))}
          </Box>
          {!lectureSeule && (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <ChampDate label="Échéance" value={echeance} onChange={(e) => setEcheance(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 190 }} />
              <Button variant="contained" startIcon={<AddTaskOutlined />} disabled={!choisis.length || occupe || !echeance} onClick={() => void creer()} sx={{ minHeight: 48 }}>
                {choisis.length ? `Créer ${choisis.length} tâche${choisis.length > 1 ? 's' : ''} du Coach` : 'Choisir les leviers'}
              </Button>
            </Box>
          )}
        </>
      )}
      {message && <Alert severity={message.bon ? 'success' : 'error'} sx={{ mt: 1.5 }}>{message.texte}</Alert>}
    </Section>
  )
}
