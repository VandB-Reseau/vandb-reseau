import TextField, { type TextFieldProps } from '@mui/material/TextField'

// Vague 8 (100A) : un seul champ de date dans toute l'app. Il garde le calendrier natif de l'appareil (jj/mm/aaaa sur un
// appareil réglé en français, roue de dates sur iPhone) et la même présentation partout : libellé toujours au-dessus,
// valeur au format AAAA-MM-JJ dans le code.
export function ChampDate(props: Omit<TextFieldProps, 'type'>) {
  const { slotProps, ...reste } = props
  const etiquette = (slotProps?.inputLabel ?? {}) as object
  return <TextField type="date" {...reste} slotProps={{ ...slotProps, inputLabel: { ...etiquette, shrink: true } }} />
}
