// Brouillon du compte rendu (lot L2, 21/10/2026) : gardé sur l'appareil au fil de la saisie, repris à la
// réouverture, effacé à l'enregistrement. Les photos n'y sont pas (déjà envoyées à l'espace photos).
const PREFIXE = 'vandb-brouillon-cr:'

export function lireBrouillon<T>(cle: string): (T & { garde: string }) | null {
  try {
    const s = localStorage.getItem(PREFIXE + cle)
    return s ? JSON.parse(s) : null
  } catch { return null }
}
export function garderBrouillon(cle: string, valeur: object) {
  try { localStorage.setItem(PREFIXE + cle, JSON.stringify({ ...valeur, garde: new Date().toISOString() })) } catch { /* stockage plein ou interdit : rien de gardé */ }
}
export function effacerBrouillon(cle: string) {
  try { localStorage.removeItem(PREFIXE + cle) } catch { /* rien */ }
}
