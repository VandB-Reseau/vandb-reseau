import type { ReactNode } from 'react'
import { EmptyState } from '../../components/EmptyState'

// État vide : ce qui manque, pourquoi, et l'action possible. Refonte vague 2 (17A) : le même composant que le reste de
// l'app, une seule famille d'illustrations (pictogrammes de la charte, choisis d'après le sujet)
export function EtatVide({ titre, texte, action }: { titre: string; texte: string; action?: ReactNode }) {
  return <EmptyState titre={titre} texte={texte} action={action} />
}
