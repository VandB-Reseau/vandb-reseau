import { lazy, type ComponentType } from 'react'

const CLE = 'vandb-rechargement-version'
const DELAI = 15_000

// Écran chargé à la demande. Après une mise en ligne, l'app déjà ouverte réclame d'anciens fichiers
// qui n'existent plus : on recharge alors la page une fois pour prendre la nouvelle version.
// L'heure du rechargement est gardée : un fichier encore introuvable juste après, même si un autre écran
// s'est chargé entre-temps, affiche l'erreur au lieu de recharger en boucle.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- même contrainte que lazy()
export function chargementDiffere<T extends ComponentType<any>>(charger: () => Promise<{ default: T }>) {
  return lazy(() => charger()
    .catch((e: unknown) => {
      let dejaRecharge = false
      try {
        dejaRecharge = Date.now() - Number(sessionStorage.getItem(CLE) ?? 0) < DELAI
        if (!dejaRecharge) sessionStorage.setItem(CLE, String(Date.now()))
      } catch { dejaRecharge = true }
      if (dejaRecharge) throw e
      window.location.reload()
      return new Promise<never>(() => {})
    }))
}
