import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Piece } from '../lib/pieces'
import { chargerMessagerie, envoyerMessage, marquerLu as marquerLuBase, marquerLuPersonne as marquerLuPersonneBase, supprimerMessage, type Lecture, type Messagerie, type Sujet } from './messagerie'

interface EtatMessagerie {
  messagerie: Messagerie | null
  charge: boolean // premier chargement terminé
  // repli : magasin de l'envoi tant que la base n'est pas passée aux échanges à deux
  envoyer: (destinataire: string, texte: string, magasins: string[], repli: string | null, pieces?: Piece[]) => Promise<void>
  supprimer: (id: number) => Promise<void>
  marquerLu: (magasin: string, sujet: Sujet) => void
  marquerLuPersonne: (cle: string) => void
  lire: (l: Lecture) => void
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

  const marquerLuPersonne = useCallback((cle: string) => {
    setMessagerie((m) => (m ? { ...m, lus: { ...m.lus, [`personne:${cle}|messages`]: new Date().toISOString() } } : m))
    marquerLuPersonneBase(cle).catch(() => { /* reprise à la prochaine ouverture */ })
  }, [])

  const lire = useCallback((l: Lecture) => {
    if (l.personne) marquerLuPersonne(l.personne)
    else if (l.magasin) marquerLu(l.magasin, l.sujet)
  }, [marquerLu, marquerLuPersonne])

  const version = messagerie?.version ?? 1
  const envoyer = useCallback(async (destinataire: string, texte: string, magasins: string[], repli: string | null, pieces: Piece[] = []) => {
    try {
      await envoyerMessage(destinataire, texte, magasins, version, repli, pieces)
    } finally {
      await recharger()
    }
  }, [recharger, version])

  const supprimer = useCallback(async (id: number) => {
    await supprimerMessage(id)
    setMessagerie((m) => (m ? { ...m, messages: m.messages.filter((x) => x.id !== id) } : m))
  }, [])

  return <Ctx.Provider value={{ messagerie, charge, envoyer, supprimer, marquerLu, marquerLuPersonne, lire }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMessagerie(): EtatMessagerie {
  const c = useContext(Ctx)
  if (!c) throw new Error('useMessagerie hors MessagerieProvider')
  return c
}
