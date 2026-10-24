import { useEffect } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import TextField, { type TextFieldProps } from '@mui/material/TextField'
import MicOutlined from '@mui/icons-material/MicOutlined'
import StopCircleOutlined from '@mui/icons-material/StopCircleOutlined'
import { useDictee } from '../lib/dictee'

// Dictée gratuite du téléphone partout où l'on écrit un texte long (sprint 24, F2) : tâche, message, notes,
// commentaire. Le texte dicté s'ajoute à la fin ; rien n'est enregistré du son.
const ajouterA = (v: string, t: string) => (v.trim() ? `${v.trimEnd()} ${t}` : t)

// Micro seul, pour une barre d'écriture (Messages) ; une erreur est signalée par « signaler »
export function BoutonDictee({ libelle, changer, signaler }: { libelle: string; changer: (f: (v: string) => string) => void; signaler?: (m: string) => void }) {
  const dictee = useDictee((t) => changer((v) => ajouterA(v, t)))
  useEffect(() => { if (dictee.erreur) signaler?.(dictee.erreur) }, [dictee.erreur, signaler])
  if (!dictee.disponible) return null
  return (
    <IconButton aria-label={dictee.actif ? `Arrêter la dictée : ${libelle}` : `Dicter : ${libelle}`} onClick={dictee.basculer} color={dictee.actif ? 'error' : 'default'} sx={{ width: 48, height: 48, flexShrink: 0 }}>
      {dictee.actif ? <StopCircleOutlined /> : <MicOutlined />}
    </IconButton>
  )
}

// Champ texte avec micro au bout ; « valeur » et « changer » remplacent value et onChange
export function TexteDicte({ libelleDictee, valeur, changer, ...props }: Omit<TextFieldProps, 'value' | 'onChange'> & { libelleDictee: string; valeur: string; changer: (f: (v: string) => string) => void }) {
  const dictee = useDictee((t) => changer((v) => ajouterA(v, t)))
  const slotProps = (props.slotProps ?? {}) as Record<string, unknown>
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: props.fullWidth ? '100%' : undefined }}>
      <TextField {...props} value={valeur} onChange={(e) => changer(() => e.target.value)}
        slotProps={{ ...slotProps, input: { ...(slotProps.input as object ?? {}), endAdornment: dictee.disponible ? (
          <InputAdornment position="end" sx={{ alignSelf: props.multiline ? 'flex-start' : undefined, mt: props.multiline ? 1 : 0 }}>
            <IconButton aria-label={dictee.actif ? `Arrêter la dictée : ${libelleDictee}` : `Dicter : ${libelleDictee}`} onClick={dictee.basculer} color={dictee.actif ? 'error' : 'default'} sx={{ width: 48, height: 48, mr: -1 }}>
              {dictee.actif ? <StopCircleOutlined /> : <MicOutlined />}
            </IconButton>
          </InputAdornment>
        ) : undefined } }} />
      {dictee.erreur && <Alert severity="warning" sx={{ mt: 1 }}>{dictee.erreur}</Alert>}
    </Box>
  )
}
