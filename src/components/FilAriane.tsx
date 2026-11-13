import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import ArrowBack from '@mui/icons-material/ArrowBack'
import NavigateNextOutlined from '@mui/icons-material/NavigateNextOutlined'
import { useTelephone } from './Outils'

export type Etape = { libelle: string; lien: string }

// Vague 8 (105A) : sur PC, le chemin complet au-dessus du titre (« Magasins › Annecy Test › Visite »), chaque étape cliquable ;
// sur téléphone, la flèche de retour avec le nom de l'étape précédente.
// retour : geste du bouton du téléphone quand il doit revenir en arrière dans l'historique plutôt que vers le lien.
export function FilAriane({ etapes, ici, retour, pcSeulement = false, sx }: { etapes: Etape[]; ici?: string; retour?: () => void; pcSeulement?: boolean; sx?: object }) {
  const telephone = useTelephone()
  const naviguer = useNavigate()
  const precedente = etapes.at(-1)
  if (telephone) {
    if (pcSeulement || !precedente) return null
    return <Button startIcon={<ArrowBack />} onClick={retour ?? (() => naviguer(precedente.lien))} sx={{ mb: 1, ml: -1, minHeight: 48, ...sx }}>{precedente.libelle}</Button>
  }
  return (
    <Breadcrumbs aria-label="Fil d’Ariane" separator={<NavigateNextOutlined fontSize="small" />} className="sans-impression" sx={{ mb: 1, '& .MuiBreadcrumbs-li': { display: 'flex', alignItems: 'center', minHeight: 32 }, ...sx }}>
      {etapes.map((e) => <Link key={e.lien} component={RouterLink} to={e.lien} underline="hover" color="text.secondary" sx={{ fontWeight: 600 }}>{e.libelle}</Link>)}
      {ici && <Typography color="text.primary" aria-current="page" sx={{ fontWeight: 600 }}>{ici}</Typography>}
    </Breadcrumbs>
  )
}
