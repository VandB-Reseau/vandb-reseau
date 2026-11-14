import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CssBaseline from '@mui/material/CssBaseline'
import GlobalStyles from '@mui/material/GlobalStyles'
import { ThemeProvider } from '@mui/material/styles'
import '@fontsource/lato/400.css'
import '@fontsource/lato/700.css'
import '@fontsource/lato/900.css'
import '@fontsource/alegreya/700.css'
import '@fontsource/alegreya/800.css'
import { theme } from './theme/theme'
import { AuthProvider } from './auth/AuthContext'
import App from './App'
// Écoute dès le démarrage la proposition d'installation du navigateur
import './lib/installation'

// Premier affichage seulement quand les polices de la charte sont prêtes (préchargées par vite.config.ts) : plus de texte
// qui s'affiche en police de secours puis change de police (Joseph, 14/11/2026). Au-delà de 1,5 s (réseau très lent),
// l'app s'affiche quand même et la police arrive ensuite.
const polices = ['400 1em Lato', '700 1em Lato', '900 1em Lato', '700 1em Alegreya', '800 1em Alegreya']
const policesPretes: Promise<unknown> = 'fonts' in document
  ? Promise.race([Promise.all(polices.map((p) => document.fonts.load(p))).catch(() => undefined), new Promise((ok) => setTimeout(ok, 1500))])
  : Promise.resolve()

policesPretes.then(() => createRoot(document.getElementById('root')!).render(
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
))
