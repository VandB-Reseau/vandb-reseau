import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { chargerMessagerie, envoyerMessage, marquerLu as marquerLuBase, supprimerMessage, type Messagerie, type Sujet } from './messagerie'

interface EtatMessagerie {
  messagerie: Messagerie | null
  charge: boolean // premier chargement terminé
  envoyer: (magasins: string[], texte: string, mentions: string[], equipe?: boolean) => Promise<void>
  supprimer: (id: number) => Promise<void>
  marquerLu: (magasin: string, sujet: Sujet) => void
}

const Ctx = createContext<EtatMessagerie | null>(null)
const RAFRAICHISSEMENT = 60_000

// Messages et lectures du compte, relus chaque minute et au retour sur l'onglet
export function MessagerieProvider({ children }: { children: ReactNode }) {
  const [messagerie, setMessagerie] = useState<Messagerie | null>(null)
  const [charge, setCharge] = useState(false)
  const actif = useRef(true)

  const recharger = useCallback(async () => {
    const m = await chargerMessagerie().catch(() => null)
    if (!actif.current) return
    // Une relecture en échec garde les messages déjà affichés
    setMessagerie((avant) => m ?? avant)
    setCharge(true)
  }, [])

  useEffect(() => {
    actif.current = true
    void recharger()
    const minuterie = window.setInterval(() => { if (document.visibilityState === 'visible') void recharger() }, RAFRAICHISSEMENT)
    const retour = () => { if (document.visibilityState === 'visible') void recharger() }
    document.addEventListener('visibilitychange', retour)
    return () => { actif.current = false; window.clearInterval(minuterie); document.removeEventListener('visibilitychange', retour) }
  }, [recharger])

  const marquerLu = useCallback((magasin: string, sujet: Sujet) => {
    setMessagerie((m) => (m ? { ...m, lus: { ...m.lus, [`${magasin}|${sujet}`]: new Date().toISOString() } } : m))
    marquerLuBase(magasin, sujet).catch(() => { /* reprise à la prochaine ouverture */ })
  }, [])

  const version = messagerie?.version ?? 1
  const envoyer = useCallback(async (magasins: string[], texte: string, mentions: string[], equipe = false) => {
    try {
      await envoyerMessage(magasins, texte, mentions, equipe, version)
    } finally {
      await recharger()
    }
  }, [recharger, version])

  const supprimer = useCallback(async (id: number) => {
    await supprimerMessage(id)
    setMessagerie((m) => {
      if (!m) return m
      const lot = m.messages.find((x) => x.id === id)?.lot
      return { ...m, messages: m.messages.filter((x) => x.id !== id && !(lot && x.lot === lot)) }
    })
  }, [])

  return <Ctx.Provider value={{ messagerie, charge, envoyer, supprimer, marquerLu }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMessagerie(): EtatMessagerie {
  const c = useContext(Ctx)
  if (!c) throw new Error('useMessagerie hors MessagerieProvider')
  return c
}
