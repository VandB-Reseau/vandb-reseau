import { supabase } from '../lib/supabase'
import { construireReseau, type DonneesBrutes, type Parametres } from './construction'
import type { Reseau } from './modele'

function json<T>(valeur: unknown, defaut: T): T {
  if (valeur === null || valeur === undefined) return defaut
  if (typeof valeur !== 'string') return valeur as T
  try { return JSON.parse(valeur) as T } catch { return defaut }
}

export class ErreurChargement extends Error {}

// Lit les tables Supabase partagées avec l'ancienne app (lecture seule)
export async function chargerReseau(jour = new Date().toISOString().slice(0, 10)): Promise<Reseau> {
  const [config, surcharges, affectations, coachs, recrues] = await Promise.all([
    supabase.from('app_config').select('key,value').in('key', ['store_adds', 'store_renames', 'drs_data', 'params']),
    supabase.from('store_overrides').select('*'),
    supabase.from('reassigns').select('store,cs,date,note,type').order('date'),
    supabase.from('cs_overrides').select('*'),
    supabase.from('recruits').select('*'),
  ])
  const erreur = config.error ?? surcharges.error ?? affectations.error ?? coachs.error
  if (erreur) throw new ErreurChargement(erreur.message)

  const cle = (k: string) => config.data?.find((r) => r.key === k)?.value
  const params = json<Partial<Parametres>>(cle('params'), {})
  const brutes: DonneesBrutes = {
    magasins: json(cle('store_adds'), []),
    renommages: json(cle('store_renames'), {}),
    surcharges: surcharges.data ?? [],
    affectations: affectations.data ?? [],
    configRR: json(cle('drs_data'), {}),
    coachs: coachs.data ?? [],
    recrues: recrues.error ? [] : recrues.data ?? [],
    parametres: {
      prepDuration: Number(params.prepDuration) || 2, postDuration: Number(params.postDuration) || 4,
      maxUnits: Number(params.maxUnits) || 8, alertThreshold: Number(params.alertThreshold) || 7,
      poidsOuvert: params.poidsOuvert === undefined ? 1 : Number(params.poidsOuvert),
      poidsRenforce: params.poidsRenforce === undefined ? 2 : Number(params.poidsRenforce),
    },
  }
  return construireReseau(brutes, jour)
}

// ── Écritures (partagées avec l'ancienne app) ──

export class ErreurEnregistrement extends Error {}

// Réaffecte un magasin à un Coach à partir d'une date (même format que l'ancienne app)
export async function reaffecter(magasin: string, coach: string, date: string, note: string): Promise<void> {
  const { error } = await supabase.from('reassigns').insert({ store: magasin, cs: coach, date, note, type: 'manual' })
  if (error) throw new ErreurEnregistrement(error.message)
}

// Met à jour quelques paramètres en conservant tous les autres réglages de l'ancienne app
export async function enregistrerParametres(changements: Record<string, number>): Promise<void> {
  const lu = await supabase.from('app_config').select('value').eq('key', 'params')
  if (lu.error) throw new ErreurEnregistrement(lu.error.message)
  const actuels = json<Record<string, unknown>>(lu.data?.[0]?.value, {})
  const value = JSON.stringify({ ...actuels, ...changements })
  const res = lu.data?.length
    ? await supabase.from('app_config').update({ value }).eq('key', 'params')
    : await supabase.from('app_config').insert({ key: 'params', value })
  if (res.error) throw new ErreurEnregistrement(res.error.message)
}
