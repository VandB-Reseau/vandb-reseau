// Fonction Supabase « notifier » : notifications sur le téléphone (lot L8, 21/10/2026).
// À coller dans Supabase > Edge Functions > Deploy a new function > Via Editor, sous le nom « notifier ».
// Aucune clé à créer : la paire de clés d'envoi est générée au premier appel et rangée dans cles_push.
//   { action: 'cle' }                       → clé publique, pour abonner un appareil
//   { type: 'message' | 'visite', ids: [] } → envoie les notifications de ces messages ou comptes rendus
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push@3.6.7'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reponse = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const base = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

async function cles(): Promise<{ publique: string; privee: string }> {
  const lu = await base.from('cles_push').select('publique,privee').eq('id', 1).maybeSingle()
  if (lu.data) return lu.data
  const k = webpush.generateVAPIDKeys()
  await base.from('cles_push').upsert({ id: 1, publique: k.publicKey, privee: k.privateKey }, { onConflict: 'id', ignoreDuplicates: true })
  const relu = await base.from('cles_push').select('publique,privee').eq('id', 1).single()
  if (relu.error) throw relu.error
  return relu.data
}

interface Envoi { endpoint: string; p256dh: string; auth: string; titre: string; texte: string; lien: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const corps = await req.json().catch(() => ({})) as { action?: string; type?: string; ids?: unknown[] }
    const k = await cles()
    if (corps.action === 'cle') return reponse({ cle: k.publique })

    const jeton = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: compte } = await base.auth.getUser(jeton)
    if (!compte?.user) return reponse({ erreur: 'non_connecte' }, 401)
    const ids = (Array.isArray(corps.ids) ? corps.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200)
    if (!['message', 'visite'].includes(String(corps.type)) || !ids.length) return reponse({ erreur: 'format' }, 400)

    const { data, error } = await base.rpc('notifications_a_envoyer', { p_type: corps.type, p_ids: ids, p_auteur: compte.user.id })
    if (error) throw error
    webpush.setVapidDetails('https://vandb-reseau.github.io/vandb-reseau/', k.publique, k.privee)
    let envoyees = 0
    for (const e of (data ?? []) as Envoi[]) {
      try {
        await webpush.sendNotification({ endpoint: e.endpoint, keys: { p256dh: e.p256dh, auth: e.auth } },
          JSON.stringify({ titre: e.titre, texte: e.texte, lien: e.lien }), { TTL: 86400 })
        envoyees++
      } catch (err) {
        // Appareil désabonné ou navigateur réinstallé : l'abonnement ne sert plus
        const code = (err as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await base.from('abonnements_push').delete().eq('endpoint', e.endpoint)
      }
    }
    return reponse({ envoyees })
  } catch (err) {
    return reponse({ erreur: String((err as Error).message ?? err) }, 500)
  }
})
