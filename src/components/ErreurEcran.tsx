import { Component, type ReactNode } from 'react'
import Button from '@mui/material/Button'
import ReplayOutlined from '@mui/icons-material/ReplayOutlined'
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined'
import { EmptyState } from './EmptyState'

// Un écran qui plante n'efface plus toute l'app : message humain et bouton pour recharger
export class ErreurEcran extends Component<{ children: ReactNode }, { erreur: boolean }> {
  state = { erreur: false }
  static getDerivedStateFromError() { return { erreur: true } }
  render() {
    if (!this.state.erreur) return this.props.children
    return (
      <EmptyState
        icone={<ReportProblemOutlined />}
        titre="Cette page n’a pas pu s’afficher"
        texte="La connexion a peut-être été coupée ou une nouvelle version vient d’être publiée."
        action={<Button variant="contained" startIcon={<ReplayOutlined />} onClick={() => window.location.reload()} sx={{ minHeight: 48 }}>Recharger</Button>}
      />
    )
  }
}
