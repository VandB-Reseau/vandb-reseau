// Brouillons des messages (refonte vague 6, 72A) : le texte en cours de chaque conversation est gardé sur l'appareil,
// repris en y revenant, annoncé « Brouillon » dans la liste. Effacé à l'envoi. Rien n'est envoyé à la base.
import { useSyncExternalStore } from 'react'

const PREFIXE = 'brouillon:'
const abonnes = new Set<() => void>()
let version = 0

function lire(cle: string): string {
  try { return localStorage.getItem(PREFIXE + cle) ?? '' } catch { return '' }
}

export function brouillonDe(cle: string): string {
  return lire(cle)
}

export function garderBrouillon(cle: string, texte: string) {
  const avant = lire(cle)
  try {
    if (texte.trim()) localStorage.setItem(PREFIXE + cle, texte)
    else localStorage.removeItem(PREFIXE + cle)
  } catch { /* stockage indisponible : le brouillon n'est pas gardé */ }
  if (!!avant.trim() !== !!texte.trim()) { version++; abonnes.forEach((f) => f()) }
}

// Relit la liste quand un brouillon apparaît ou disparaît
export function useBrouillons(): (cle: string) => string {
  useSyncExternalStore((f) => { abonnes.add(f); return () => { abonnes.delete(f) } }, () => version)
  return lire
}
