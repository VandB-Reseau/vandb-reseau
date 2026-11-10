import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import { Aide } from './Aide'
import { chargerCommentaires, envoyerCommentaire, type Commentaire } from '../data/pilotage'
import { ancreAttention, pointsSansJustification, type PointAttention } from '../moteur/attention'

// Points d'attention avant l'envoi (vague 6, 74A) : chaque point mène à la partie à corriger ; s'il reste, une phrase de
// justification, rangée dans les commentaires du budget, est écrite avant l'envoi au siège.
export function PointsAttention({ magasin, annee, points, peutJustifier, aller, onBloquants }: {
  magasin: string; annee: number; points: PointAttention[]; peutJustifier: boolean; aller: (partie: string) => void; onBloquants: (n: number) => void
}) {
  const [commentaires, setCommentaires] = useState<Commentaire[] | null>(null)
  const [textes, setTextes] = useState<Record<string, string>>({})
  const [occupe, setOccupe] = useState('')
  const [erreur, setErreur] = useState('')
  const charger = () => chargerCommentaires(magasin, annee).then(setCommentaires, () => setCommentaires([]))
  useEffect(() => { void charger() }, [magasin, annee]) // eslint-disable-line react-hooks/exhaustive-deps
  const justifications = new Map((commentaires ?? []).filter((c) => !c.parent && c.ancre.startsWith('attention/')).map((c) => [c.ancre, c]))
  const restants = pointsSansJustification(points, justifications.keys())
  useEffect(() => { onBloquants(commentaires ? restants.length : points.length) }, [commentaires, restants.length, points.length]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!points.length) return null
  const justifier = async (p: PointAttention) => {
    const texte = (textes[p.cle] ?? '').trim()
    if (!texte) return
    setOccupe(p.cle); setErreur('')
    try {
      await envoyerCommentaire(magasin, annee, { ancre: ancreAttention(p.cle), libelle: p.libelle, texte })
      setTextes((t) => ({ ...t, [p.cle]: '' }))
      await charger()
    } catch { setErreur('La justification n’a pas été enregistrée. Vérifie ta connexion, puis réessaie.') } finally { setOccupe('') }
  }
  return (
    <Card component="section" aria-label="Points d’attention" sx={{ p: { xs: 2, md: 2.5 }, borderLeft: 4, borderColor: restants.length ? 'warning.main' : 'success.main' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="h2" sx={{ flex: 1 }}>Points d’attention · {points.length}</Typography>
        <Aide sujet="pointsAttention" />
        <Typography variant="body2" sx={{ fontWeight: 700, color: restants.length ? 'warning.dark' : 'success.dark' }}>
          {restants.length ? `${restants.length} à justifier avant l’envoi` : 'Tous justifiés'}
        </Typography>
      </Box>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2 }}>
        {points.map((p) => {
          const j = justifications.get(ancreAttention(p.cle))
          return (
            <Box component="li" key={p.cle} aria-label={p.libelle} sx={{ display: 'grid', gap: 1, pb: 2, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0, pb: 0 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 220 }}>
                  <Typography sx={{ fontWeight: 700 }}>{p.libelle}</Typography>
                  <Typography variant="body2" color="text.secondary">{p.texte}</Typography>
                </Box>
                <Button endIcon={<ChevronRightOutlined />} onClick={() => aller(p.partie)} sx={{ minHeight: 48 }}>Aller corriger</Button>
              </Box>
              {j ? (
                <Typography variant="body2" sx={{ bgcolor: 'action.hover', borderRadius: 2, px: 1.5, py: 1 }}>
                  <b>Justification{j.auteurNom ? ` de ${j.auteurNom}` : ''} :</b> {j.texte}
                </Typography>
              ) : peutJustifier ? (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                  <TextField size="small" fullWidth label="Pourquoi ce point reste" value={textes[p.cle] ?? ''} onChange={(e) => setTextes((t) => ({ ...t, [p.cle]: e.target.value }))}
                    slotProps={{ htmlInput: { maxLength: 500 } }} />
                  <Button variant="outlined" disabled={!(textes[p.cle] ?? '').trim() || occupe === p.cle} onClick={() => void justifier(p)} sx={{ minHeight: 48, flexShrink: 0 }}>Justifier</Button>
                </Box>
              ) : <Typography variant="body2" color="warning.dark">Pas encore justifié.</Typography>}
            </Box>
          )
        })}
      </Box>
      {erreur && <Alert severity="error" sx={{ mt: 2 }}>{erreur}</Alert>}
    </Card>
  )
}
