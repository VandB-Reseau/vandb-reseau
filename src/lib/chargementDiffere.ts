import { lazy, type ComponentType } from 'react'

const CLE = 'vandb-rechargement-version'

// Écran chargé à la demande. Après une mise en ligne, l'app déjà ouverte réclame d'anciens fichiers
// qui n'existent plus : on recharge alors la page une fois pour prendre la nouvelle version.
export function chargementDiffere<T extends ComponentType<never>>(charger: () => Promise<{ default: T }>) {
  return lazy(() => charger()
    .then((m) => { try { sessionStorage.removeItem(CLE) } catch { /* stockage indisponible */ } return m })
    .catch((e: unknown) => {
      let dejaRecharge = false
      try { dejaRecharge = sessionStorage.getItem(CLE) === '1'; sessionStorage.setItem(CLE, '1') } catch { dejaRecharge = true }
      if (dejaRecharge) throw e
      window.location.reload()
      return new Promise<never>(() => {})
    }))
}
