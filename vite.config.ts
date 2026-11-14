import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Polices de la charte demandées dès la lecture de la page, avant le code : le premier affichage est déjà en Lato et
// Alegreya, sans passer par la police de secours (Joseph, 14/11/2026 : le mois de l'Agenda changeait de police à l'ouverture).
// Seul le jeu « latin » (français compris) est préchargé ; les autres alphabets restent chargés à la demande.
function prechargerPolices(): Plugin {
  return {
    name: 'precharger-polices',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (_html, ctx) => Object.keys(ctx.bundle ?? {})
        .filter((f) => /(lato|alegreya)-latin-\d{3}-normal-[^/]*\.woff2$/.test(f))
        .sort()
        .map((f) => ({ tag: 'link', attrs: { rel: 'preload', href: `./${f}`, as: 'font', type: 'font/woff2', crossorigin: '' }, injectTo: 'head' as const })),
    },
  }
}

// Publié sur GitHub Pages sous /vandb-reseau/ ; chemins relatifs pour fonctionner à toute adresse.
export default defineConfig({
  plugins: [react(), prechargerPolices()],
  base: './',
})
