import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Notifications sur le téléphone (lot L8, Joseph, 21/10/2026) : l'appareil s'abonne auprès de son navigateur,
// la fonction Supabase « notifier » envoie un message privé reçu ou un compte rendu de visite.
// Sur iPhone, seulement quand l'app est installée sur l'écran d'accueil.
export type EtatNotifications = 'actif' | 'inactif' | 'bloque' | 'indisponible'

export const pushDisponible = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const URL_SW = `${import.meta.env.BASE_URL}sw.js`

async function abonnement(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  return reg ? reg.pushManager.getSubscription() : null
}

export async function lireEtat(): Promise<EtatNotifications> {
  if (!pushDisponible()) return 'indisponible'
  if (Notification.permission === 'denied') return 'bloque'
  try { return Notification.permission === 'granted' && (await abonnement()) ? 'actif' : 'inactif' } catch { return 'inactif' }
}

function cleBinaire(base64: string): Uint8Array {
  const b = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0))
}

export class ErreurNotifications extends Error {}

export async function activerNotifications() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new ErreurNotifications('Les notifications sont bloquées pour ce site dans les réglages du navigateur.')
  const reg = await navigator.serviceWorker.register(URL_SW, { scope: import.meta.env.BASE_URL })
  await navigator.serviceWorker.ready
  const { data, error } = await supabase.functions.invoke('notifier', { body: { action: 'cle' } })
  const cle = (data as { cle?: string } | null)?.cle
  if (error || !cle) throw new ErreurNotifications('Les notifications ne sont pas encore disponibles. Réessaie plus tard.')
  const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleBinaire(cle) as BufferSource })
  const j = sub.toJSON()
  const r = await supabase.rpc('abonner_appareil', { p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth })
  if (r.error) throw new ErreurNotifications('Les notifications n’ont pas pu être activées. Réessaie dans un instant.')
}

export async function couperNotifications() {
  const sub = await abonnement()
  if (!sub) return
  await supabase.rpc('desabonner_appareil', { p_endpoint: sub.endpoint })
  await sub.unsubscribe()
}

// Envoi après un message ou un compte rendu : sans effet si la fonction n'est pas en place
export function notifier(type: 'message' | 'visite', ids: number[]) {
  if (!ids.length) return
  void supabase.functions.invoke('notifier', { body: { type, ids } }).catch(() => { /* la notification dans l'app reste */ })
}

export function useNotificationsAppareil() {
  const [etat, setEtat] = useState<EtatNotifications>('indisponible')
  const relire = useCallback(() => { void lireEtat().then(setEtat) }, [])
  useEffect(relire, [relire])
  return { etat, relire }
}
