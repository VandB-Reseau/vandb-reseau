// Vocabulaire réservé (refonte vague 4, Joseph 10/11/2026, 40A) : un mot veut dire une seule chose dans toute l'app.
// S'ouvre à la demande depuis le menu du compte, jamais d'office.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'

export const GLOSSAIRE: { domaine: string; termes: [string, string][] }[] = [
  { domaine: 'Chiffres d’un magasin', termes: [['Décroche', 'CA sous le seuil fixé dans Paramètres (−10 % par défaut) face à sa référence.'], ['À surveiller', 'CA sous le second seuil (−5 % par défaut).'], ['Dans la norme', 'CA au-dessus des deux seuils.'], ['Sans chiffres', 'Pas de mois de comparaison disponible.']] },
  { domaine: 'Nine box', termes: [['Prioritaires', 'Redressement, relance, management à renforcer.'], ['Solides', 'Les autres cases classées.'], ['Non classés', 'Aucun classement saisi.']] },
  { domaine: 'Visites', termes: [['À jour', 'Vu dans le délai de sa case nine box.'], ['À voir', 'Pas vu depuis plus longtemps que le délai de sa case.'], ['Jamais visité', 'Aucune visite enregistrée.']] },
  { domaine: 'Charge d’un Coach', termes: [['Correcte', 'Sous le seuil d’attention.'], ['Presque pleine', 'Au seuil d’attention ou au-dessus.'], ['Au maximum', 'À la charge maximale.'], ['Dépassement', 'Au-delà de la charge maximale.']] },
  { domaine: 'Tâches', termes: [['À faire', 'Pas encore commencée.'], ['En cours', 'Commencée.'], ['Bloquée', 'Attend quelque chose ; la raison est écrite.'], ['Faite', 'Terminée.'], ['En retard', 'Échéance passée, pas encore faite.']] },
  { domaine: 'Où trouver quoi', termes: [['Cloche', 'Ce qui s’est passé : tâche confiée, compte rendu publié, commentaire, rapport du mois.'], ['À traiter', 'Ce que je dois faire, une seule fois chaque chose.'], ['Messages', 'Les conversations.']] },
]

export function DialogGlossaire({ onFermer }: { onFermer: () => void }) {
  return (
    <Dialog open onClose={onFermer} fullWidth maxWidth="sm" aria-labelledby="titre-glossaire">
      <DialogTitle id="titre-glossaire">Vocabulaire de l’app</DialogTitle>
      <DialogContent>
        {GLOSSAIRE.map((g) => (
          <Box key={g.domaine} component="section" aria-label={g.domaine} sx={{ mb: 2 }}>
            <Typography component="h3" sx={{ fontWeight: 700, mb: 0.5 }}>{g.domaine}</Typography>
            <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'minmax(110px, auto) 1fr', columnGap: 2, rowGap: 0.5 }}>
              {g.termes.map(([t, d]) => [
                <Typography key={`${t}-t`} component="dt" variant="body2" sx={{ fontWeight: 600 }}>{t}</Typography>,
                <Typography key={`${t}-d`} component="dd" variant="body2" color="text.secondary" sx={{ m: 0 }}>{d}</Typography>,
              ])}
            </Box>
          </Box>
        ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={onFermer} sx={{ minHeight: 48 }}>Fermer</Button></DialogActions>
    </Dialog>
  )
}
