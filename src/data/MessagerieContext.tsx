import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Piece } from '../lib/pieces'
import { supabase } from '../lib/supabase'
import {
  chargerMessagerie, cleFil, envoyerDansFil, envoyerMessage, marquerLu as marquerLuBase, marquerLuFil, supprimerMessage, type Fil, type Messagerie, type Sujet,
} from './messagerie'

interface EtatMessagerie {
  messagerie: Messagerie | null
  charge: boolean // premier chargement terminé
  // Échange à deux. repli : magasin de l'envoi tant que la base n'est pas passée aux échanges à deux
  envoyer: (destinataire: string, texte: string, magasins: string[], repli: string | null, pieces?: Piece[], repondA?: number | null) => Promise<void>
  // Groupe d'un magasin ou groupe libre ; mentions : clés des personnes citées
  envoyerFil: (f: Fil, texte: string, mentions: string[], pieces?: Piece[], repondA?: number | null) => Promise<void>
  // Après un geste qui change les messages (réaction, modification…) : relecture et signal aux autres écrans
  signalerChangement: () => Promise<void>
  supprimer: (id: number) => Promise<void>
  marquerLu: (magasin: string, sujet: Sujet) => void
  lireFil: (f: Fil) => void
  recharger: () => Promise<void>
}

const Ctx = createContext<EtatMessagerie | null>(null)
const RAFRAICHISSEMENT = 60_000

// Clé de lecture d'un fil dans « lus »
function cleLecture(f: Fil, version: number): string {
  if (f.genre === 'personne') return `personne:${f.cle}|messages`
  if (f.genre === 'groupe') return `${cleFil(f)}|messages`
  return `${f.magasin}|${f.equipe && version >= 4 ? 'equipe' : 'messages'}`
}

// Temps réel (vague 6, 64A) : un simple signal « quelque chose a changé », sans aucun contenu, envoyé après chaque
// envoi ; chaque écran ouvert relit alors ses messages par messagerie(), avec ses propres droits. La relecture
// de chaque minute reste en secours (signal perdu, temps réel indisponible).
const CANAL = 'messagerie'
type Canal = ReturnType<typeof supabase.channel>
function ouvrirCanal(relire: () => void): Canal | null {
  try {
    if (typeof supabase.channel !== 'function' || typeof WebSocket === 'undefined') return null
    return supabase.channel(CANAL, { config: { broadcast: { self: false } } }).on('broadcast', { event: 'nouveau' }, () => relire()).subscribe()
  } catch { return null }
}

// Messages et lectures du compte, relus à chaque signal, chaque minute et au retour sur l'onglet
export function MessagerieProvider({ children }: { children: ReactNode }) {
  const [messagerie, setMessagerie] = useState<Messagerie | null>(null)
  const [charge, setCharge] = useState(false)
  const actif = useRef(true)
  const canal = useRef<Canal | null>(null)

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
    canal.current = ouvrirCanal(() => { void recharger() })
    return () => {
      actif.current = false; window.clearInterval(minuterie); document.removeEventListener('visibilitychange', retour)
      if (canal.current) { void supabase.removeChannel(canal.current).catch(() => undefined); canal.current = null }
    }
  }, [recharger])

  const marquerLu = useCallback((magasin: string, sujet: Sujet) => {
    setMessagerie((m) => (m ? { ...m, lus: { ...m.lus, [`${magasin}|${sujet}`]: new Date().toISOString() } } : m))
    marquerLuBase(magasin, sujet).catch(() => { /* reprise à la prochaine ouverture */ })
  }, [])

  const version = messagerie?.version ?? 1
  const lireFil = useCallback((f: Fil) => {
    setMessagerie((m) => (m ? { ...m, lus: { ...m.lus, [cleLecture(f, m.version)]: new Date().toISOString() } } : m))
    marquerLuFil(f, version).catch(() => { /* reprise à la prochaine ouverture */ })
  }, [version])

  const prevenir = useCallback(() => {
    try { void canal.current?.send({ type: 'broadcast', event: 'nouveau', payload: {} })?.catch?.(() => undefined) } catch { /* temps réel indisponible : relecture de secours */ }
  }, [])
  const signalerChangement = useCallback(async () => { prevenir(); await recharger() }, [prevenir, recharger])

  const envoyer = useCallback(async (destinataire: string, texte: string, magasins: string[], repli: string | null, pieces: Piece[] = [], repondA: number | null = null) => {
    try {
      await envoyerMessage(destinataire, texte, magasins, version, repli, pieces, repondA)
      prevenir()
    } finally {
      await recharger()
    }
  }, [recharger, version, prevenir])

  const envoyerFil = useCallback(async (f: Fil, texte: string, mentions: string[], pieces: Piece[] = [], repondA: number | null = null) => {
    try {
      await envoyerDansFil(f, texte, mentions, pieces, version, repondA)
      prevenir()
    } finally {
      await recharger()
    }
  }, [recharger, version, prevenir])

  const supprimer = useCallback(async (id: number) => {
    await supprimerMessage(id)
    setMessagerie((m) => (m ? { ...m, messages: m.messages.filter((x) => x.id !== id) } : m))
  }, [])

  return <Ctx.Provider value={{ messagerie, charge, envoyer, envoyerFil, supprimer, marquerLu, lireFil, recharger, signalerChangement }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMessagerie(): EtatMessagerie {
  const c = useContext(Ctx)
  if (!c) throw new Error('useMessagerie hors MessagerieProvider')
  return c
}
