import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CssBaseline from '@mui/material/CssBaseline'
import GlobalStyles from '@mui/material/GlobalStyles'
import { ThemeProvider } from '@mui/material/styles'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/700.css'
import { theme } from './theme/theme'
import { AuthProvider } from './auth/AuthContext'
import App from './App'
// Écoute dès le démarrage la proposition d'installation du navigateur
import './lib/installation'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {/* Place de la barre de défilement toujours réservée : rien ne bouge en changeant d'onglet */}
      <GlobalStyles styles={{ html: { scrollbarGutter: 'stable', overflowY: 'scroll' } }} />
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
