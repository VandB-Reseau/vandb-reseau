// Client Supabase de l'app réseau ; les données du pilotage sont rangées dans le schéma « pilotage »
import { supabase } from '../../lib/supabase'
import { dansApercu } from './apercu'
export { supabase, supabaseConfigured } from '../../lib/supabase'

// « Voir comme » (Joseph, 04/11/2026) : le Directeur lit le budget tel que la personne le voit, avec ses propres droits.
// Rien ne s'écrit : toute écriture répond « aperçu » sans toucher la base ; seules les lectures passent.
const LECTURES = new Set(['budgets_du_compte', 'mes_droits', 'reel_du_compte', 'ouvertures_reseau', 'concordance_ca', 'magasins_orphelins'])
const REFUS = { data: null, error: { message: 'apercu', code: 'apercu', details: '', hint: '' }, count: null, status: 403, statusText: 'apercu' }
function refuse(): unknown {
  const p: unknown = new Proxy(function () { /* requête sans effet */ }, {
    get: (_c, k) => (k === 'then' ? (ok?: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(REFUS).then(ok, ko) : () => p),
    apply: () => p,
  })
  return p
}
const lie = (o: object, k: PropertyKey) => { const v = Reflect.get(o, k); return typeof v === 'function' ? v.bind(o) : v }

export const pilotage = () => {
  const s = supabase.schema('pilotage')
  if (!dansApercu()) return s
  return new Proxy(s, {
    get(c, k) {
      if (k === 'rpc') return (fn: string, ...args: unknown[]) => (LECTURES.has(fn) ? (c.rpc as (...a: unknown[]) => unknown)(fn, ...args) : refuse())
      if (k === 'from') return (table: string) => new Proxy(c.from(table), {
        get: (q, m) => (['insert', 'update', 'upsert', 'delete'].includes(String(m)) ? () => refuse() : lie(q, m)),
      })
      return lie(c, k)
    },
  })
}
