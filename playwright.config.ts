import { defineConfig, devices } from '@playwright/test'

// Tests dans un vrai navigateur, sur PC et sur téléphone, avec Supabase simulé.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  // CHROMIUM=/chemin/vers/chrome : navigateur déjà installé, sans téléchargement (comme le pilotage)
  use: { baseURL: 'http://localhost:4173/', trace: 'retain-on-failure', ...(process.env.CHROMIUM ? { launchOptions: { executablePath: process.env.CHROMIUM } } : {}) },
  projects: [
    // Moteur de calcul du pilotage (sans navigateur), venu de l'app de pilotage à la fusion
    { name: 'moteur', testDir: './tests/pilotage/moteur' },
    { name: 'pc', testIgnore: /pilotage\/moteur\//, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'telephone', testIgnore: /pilotage\/moteur\//, use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'VITE_SUPABASE_URL=https://supabase.test VITE_SUPABASE_ANON_KEY=cle-test npx vite build --outDir dist-test && npx vite preview --outDir dist-test --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
