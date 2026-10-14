import { defineConfig, devices } from '@playwright/test'

// Tests dans un vrai navigateur, sur PC et sur téléphone, avec Supabase simulé.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173/', trace: 'retain-on-failure' },
  projects: [
    { name: 'pc', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'telephone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'VITE_SUPABASE_URL=https://supabase.test VITE_SUPABASE_ANON_KEY=cle-test npx vite build --outDir dist-test && npx vite preview --outDir dist-test --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
