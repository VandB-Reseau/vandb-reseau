import { useEffect, useState } from 'react'

// Installation de l'app sur l'écran d'accueil (Chrome, Edge) : le navigateur propose l'installation
// une fois ; on garde sa proposition pour l'offrir dans le menu du compte.
interface Proposition extends Event { prompt: () => Promise<void> }

let proposition: Proposition | null = null
const abonnes = new Set<() => void>()
const prevenir = () => abonnes.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); proposition = e as Proposition; prevenir() })
  window.addEventListener('appinstalled', () => { proposition = null; prevenir() })
}

export function useInstallation(): (() => void) | null {
  const [, rafraichir] = useState(0)
  useEffect(() => { const f = () => rafraichir((n) => n + 1); abonnes.add(f); return () => { abonnes.delete(f) } }, [])
  if (!proposition) return null
  const p = proposition
  return () => { void p.prompt().finally(() => { proposition = null; prevenir() }) }
}
