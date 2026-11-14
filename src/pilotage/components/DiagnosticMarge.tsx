import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Aide } from './Aide'
import { Indicateur } from './Indicateur'
import { useAuth } from '../auth/AuthContext'
import { chargerCommentaires, envoyerCommentaire, type Commentaire } from '../data/pilotage'
import { ancreDemarque, CAUSES_DEMARQUE, diagnosticMarge, ecrireCausesDemarque, lireCausesDemarque, type CauseDemarque } from '../moteur/boiteOutils'
import { ecartPts, montant } from '../lib/format'

// Écart de marge au quadrimestre (vague 9, choix 144) : quand la marge réelle passe sous celle de la caisse au-delà du
// seuil d'alerte, ce que vaut un point et l'écart en euros, et les causes de l'audit de marge cochées avec le franchisé.
// Rangées en commentaire (ancre « demarque/aaaa/qN »), lisibles par le Coach comme les autres échanges.
export function DiagnosticMarge({ magasin, annee, quadrimestre, fin, ca, ecart, seuil }: {
  magasin: string; annee: number; quadrimestre: number; fin: string; ca: number; ecart: number | null; seuil: number
}) {
  const { profil } = useAuth()
  const d = diagnosticMarge(ca, ecart, seuil)
  const ancre = ancreDemarque(annee, quadrimestre)
  const [faite, setFaite] = useState<Commentaire | null | undefined>(undefined)
  const [causes, setCauses] = useState<CauseDemarque[]>([])
  const [phrase, setPhrase] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  const relire = () => chargerCommentaires(magasin, annee).then((l) => setFaite(l.filter((c) => !c.parent && c.ancre === ancre).at(-1) ?? null), () => setFaite(null))
  useEffect(() => { if (d?.alerte) void relire() }, [magasin, annee, ancre, d?.alerte]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!d?.alerte || ecart === null) return null
  const lu = faite ? lireCausesDemarque(faite.texte) : null
  const peutEcrire = !!profil && !profil.apercu
  const enregistrer = async () => {
    setOccupe(true); setErreur('')
    try {
      await envoyerCommentaire(magasin, annee, { ancre, libelle: `Écart de marge à fin ${fin}`, texte: ecrireCausesDemarque(causes, phrase) })
      await relire()
    } catch { setErreur('Les causes n’ont pas été enregistrées. Vérifie ta connexion, puis réessaie.') } finally { setOccupe(false) }
  }
  return (
    <Card component="section" aria-label="Écart de marge à expliquer" sx={{ p: { xs: 2, md: 2.5 }, display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="h2" sx={{ flex: 1 }}>Écart de marge à fin {fin}</Typography>
        <Aide sujet="diagnosticMarge" />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        <Indicateur libelle="Écart à la marge de la caisse" valeur={ecartPts(ecart)} detail={`soit ${montant(Math.abs(d.ecartEuros))} de marge en moins`} />
        <Indicateur libelle="Un point de marge" valeur={montant(d.unPoint)} detail={`sur ${montant(ca)} de CA HT`} />
      </Box>
      {lu ? (
        <Box>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Causes trouvées{faite?.auteurNom ? ` (${faite.auteurNom})` : ''}</Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {CAUSES_DEMARQUE.filter((c) => lu.causes.includes(c.cle)).map((c) => <li key={c.cle}><Typography>{c.libelle}</Typography></li>)}
          </Box>
          {lu.phrase && <Typography sx={{ mt: 0.5 }}>{lu.phrase}</Typography>}
        </Box>
      ) : faite === undefined ? null : peutEcrire ? (
        <Box sx={{ display: 'grid', gap: 1 }}>
          <Typography sx={{ fontWeight: 700 }}>Causes à vérifier</Typography>
          <Box role="group" aria-label="Causes de l’écart de marge" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
            {CAUSES_DEMARQUE.map((c) => (
              <FormControlLabel key={c.cle} label={c.libelle} sx={{ minHeight: 48, mr: 0 }}
                control={<Checkbox sx={{ width: 48, height: 48 }} checked={causes.includes(c.cle)} onChange={(e) => setCauses((l) => (e.target.checked ? [...l, c.cle] : l.filter((x) => x !== c.cle)))} />} />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
            <TextField fullWidth label="En une phrase (facultatif)" value={phrase} onChange={(e) => setPhrase(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} />
            <Button variant="outlined" disabled={!causes.length || occupe} onClick={() => void enregistrer()} sx={{ minHeight: 48, flexShrink: 0 }}>Enregistrer</Button>
          </Box>
        </Box>
      ) : <Typography color="text.secondary">Causes pas encore cherchées.</Typography>}
      {erreur && <Alert severity="error">{erreur}</Alert>}
    </Card>
  )
}
