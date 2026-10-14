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
  const [config, surcharges, affectations, coachs] = await Promise.all([
    supabase.from('app_config').select('key,value').in('key', ['store_adds', 'store_renames', 'drs_data', 'params']),
    supabase.from('store_overrides').select('*'),
    supabase.from('reassigns').select('store,cs,date,note,type').order('date'),
    supabase.from('cs_overrides').select('cs_name,tel,email,tech'),
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
    parametres: { prepDuration: Number(params.prepDuration) || 2, postDuration: Number(params.postDuration) || 4 },
  }
  return construireReseau(brutes, jour)
}
