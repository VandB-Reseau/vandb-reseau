import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { codePostalValide, departementDepuisCP, estFrance, libelleDepartement, type FichePersonnelle } from '../data/personnes'

const PAYS = ['France', 'Belgique', 'Luxembourg', 'Suisse', 'Espagne', 'Italie', 'Allemagne', 'Monaco', 'Andorre']
export const emailValide = (e: string) => !e.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

export function fichePersonnelleValide(f: FichePersonnelle) {
  return !!f.nom.trim() && emailValide(f.email) && (!estFrance(f.pays) || codePostalValide(f.codePostal))
}

// Champs communs à toutes les fiches personnelles ; le département se remplit seul pour la France
export function ChampsPersonnels({ f, onChange, doublon, aideNom, libelleArrivee = 'Date d’arrivée', autoFocus }: {
  f: FichePersonnelle; onChange: (f: FichePersonnelle) => void; doublon?: boolean; aideNom?: string; libelleArrivee?: string; autoFocus?: boolean
}) {
  const maj = (champs: Partial<FichePersonnelle>) => onChange({ ...f, ...champs })
  const france = estFrance(f.pays)
  const date = { type: 'date', slotProps: { inputLabel: { shrink: true } } } as const
  return (
    <Box>
      <Typography variant="subtitle2" component="h3" sx={{ mb: 1.5 }}>Fiche personnelle</Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField label="Prénom" value={f.prenom} onChange={(e) => maj({ prenom: e.target.value })} autoFocus={autoFocus} />
        <TextField label="Nom" value={f.nom} onChange={(e) => maj({ nom: e.target.value })} required error={doublon}
          helperText={doublon ? 'Cette personne existe déjà.' : aideNom ?? ' '} />
        <TextField label="Date de naissance" value={f.naissance} onChange={(e) => maj({ naissance: e.target.value })} {...date} />
        <TextField label={libelleArrivee} value={f.arrivee} onChange={(e) => maj({ arrivee: e.target.value })} {...date} />
        <Autocomplete
          freeSolo options={PAYS} value={f.pays} inputValue={f.pays}
          onInputChange={(_e, v) => maj({ pays: v, ...(estFrance(v) ? {} : { codePostal: '' }) })}
          renderInput={(p) => <TextField {...p} label="Pays" />}
        />
        {france ? (
          <TextField label="Code postal" value={f.codePostal} inputMode="numeric"
            onChange={(e) => { const cp = e.target.value; const d = departementDepuisCP(cp); maj({ codePostal: cp, ...(d ? { departement: d } : {}) }) }}
            error={!codePostalValide(f.codePostal)} helperText={codePostalValide(f.codePostal) ? 'Le département se remplit tout seul.' : 'Cinq chiffres, par exemple 69002.'} />
        ) : <Box sx={{ display: { xs: 'none', sm: 'block' } }} />}
        <TextField label="Département" value={f.departement} onChange={(e) => maj({ departement: e.target.value })}
          helperText={france && f.departement ? libelleDepartement(f.departement) : france ? ' ' : 'Région ou province, si utile.'} />
        <TextField label="Ville" value={f.ville} onChange={(e) => maj({ ville: e.target.value })} />
        <TextField label="Email" type="email" value={f.email} onChange={(e) => maj({ email: e.target.value })}
          error={!emailValide(f.email)} helperText={emailValide(f.email) ? ' ' : 'Adresse email incomplète.'} />
        <TextField label="Téléphone" type="tel" value={f.telephone} onChange={(e) => maj({ telephone: e.target.value })} />
      </Box>
    </Box>
  )
}
