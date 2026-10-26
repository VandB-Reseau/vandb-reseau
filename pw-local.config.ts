import base from './playwright.config'
import { defineConfig } from '@playwright/test'
export default defineConfig({ ...base, testDir: './tests', use: { ...base.use, launchOptions: { executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' } },
  projects: base.projects!.map((p) => ({ ...p, use: { ...p.use, launchOptions: { executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' } } })) })
