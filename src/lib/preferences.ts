// Préférences du compte (F4, sprint 21) : favoris, fiches récentes, vues enregistrées, dernière ouverture du canal Réseau.
// Gardées sur l'appareil comme avant, et recopiées dans la base (table preferences, migration 0021) pour les retrouver
// sur le PC comme sur le téléphone. Équipe seulement ; sans la table, rien ne change.
import { supabase } from './supabase'

export type ClePreference = 'suivis' | 'vues' | 'reseauVu' | 'tachesVues' | 'epingles' | 'pratiquesVues'
interface Branche { lire: () => unknown; appliquer: (v: unknown) => void; vide?: () => boolean }
const branches = new Map<ClePreference, Branche>()

let compte: string | null = null
let recu: Record<string, unknown> = {} // dernière valeur lue ou écrite : un module chargé plus tard s'y reprend
let minuterie: ReturnType<typeof setTimeout> | undefined

export function brancher(cle: ClePreference, b: Branche) {
  branches.set(cle, b)
  if (cle in recu) b.appliquer(recu[cle])
}

async function sauver() {
  if (!compte) return
  const valeur = { ...recu, ...Object.fromEntries([...branches].map(([k, b]) => [k, b.lire()])) }
  recu = valeur
  await supabase.from('preferences').upsert({ user_id: compte, valeur, maj_le: new Date().toISOString() }).then(() => undefined, () => undefined)
}

// Appelée à chaque changement : une seule écriture après une courte pause
export function preferenceChangee() {
  if (!compte) return
  clearTimeout(minuterie)
  minuterie = setTimeout(sauver, 800)
}

// À l'ouverture de l'app par un compte de l'équipe : la base l'emporte ; première fois, l'appareil y est recopié
export async function chargerPreferences() {
  const userId = (await supabase.auth.getSession()).data.session?.user.id
  if (!userId || userId === compte) return
  const { data, error } = await supabase.from('preferences').select('valeur').eq('user_id', userId).limit(1)
  if (error) return
  compte = userId
  const v = (data?.[0] as { valeur?: Record<string, unknown> } | undefined)?.valeur
  if (!v || typeof v !== 'object') {
    // Première fois : ce que l'appareil a déjà (favoris, récents, vues) part dans la base
    if ([...branches.values()].some((b) => b.vide && !b.vide())) await sauver()
    return
  }
  recu = v
  for (const [k, b] of branches) if (k in v) b.appliquer(v[k])
}

export function oublierPreferences() { compte = null; recu = {}; clearTimeout(minuterie) }
