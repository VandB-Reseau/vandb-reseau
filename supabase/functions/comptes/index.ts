// Fonction Supabase « comptes » : comptes des franchisés créés et supprimés depuis l'app (23/10/2026).
// À coller dans Supabase > Edge Functions > Deploy a new function > Via Editor, sous le nom « comptes ».
// Réservée au Directeur de réseau (rôle relu dans la base, jamais dans le jeton). Aucun e-mail envoyé par Supabase :
// le Directeur transmet lui-même les identifiants, et le mot de passe provisoire est changé à la première connexion.
//   { action: 'creer', email }        → crée le compte (ou redonne un mot de passe provisoire à un compte jamais connecté)
//   { action: 'reinitialiser', user } → nouveau mot de passe provisoire pour un compte de franchisé
//   { action: 'supprimer', user }     → supprime le compte d'un franchisé ; son accès part avec lui
import { createClient, type User } from 'npm:@supabase/supabase-js@2.45.4'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reponse = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const base = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const EQUIPE = ['directeur', 'rr', 'coach']
const role = (u: User) => String(u.app_metadata?.role ?? '')

// 12 caractères sans lettres ambiguës (0/O, 1/l/I), par groupes de 4 : facile à recopier
function motDePasse(): string {
  const lettres = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const tirage = crypto.getRandomValues(new Uint32Array(12))
  const s = Array.from(tirage, (n) => lettres[n % lettres.length]).join('')
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`
}

async function parEmail(email: string): Promise<User | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await base.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find((x) => x.email?.toLowerCase() === email)
    if (u) return u
    if (data.users.length < 200) return null
  }
  return null
}

async function provisoire(u: User) {
  const mot = motDePasse()
  const { error } = await base.auth.admin.updateUserById(u.id, { password: mot, user_metadata: { ...u.user_metadata, mot_de_passe_provisoire: true } })
  if (error) throw error
  return reponse({ user_id: u.id, email: u.email, mot_de_passe: mot })
}

// Seul un compte de franchisé (ou coupé, ou jamais rattaché) se réinitialise ou se supprime ici
const compteFranchise = (u: User) => !EQUIPE.includes(role(u))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const jeton = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: connecte } = await base.auth.getUser(jeton)
    if (!connecte?.user) return reponse({ erreur: 'non_connecte' }, 401)
    const { data: moi } = await base.auth.admin.getUserById(connecte.user.id)
    if (!moi?.user || role(moi.user) !== 'directeur') return reponse({ erreur: 'acces_refuse' }, 403)

    const corps = await req.json().catch(() => ({})) as { action?: string; email?: unknown; user?: unknown }
    if (corps.action === 'creer') {
      const email = typeof corps.email === 'string' ? corps.email.trim().toLowerCase() : ''
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reponse({ erreur: 'format' }, 400)
      const existant = await parEmail(email)
      if (existant) {
        if (EQUIPE.includes(role(existant))) return reponse({ erreur: 'compte_equipe' }, 409)
        // Compte déjà créé mais jamais utilisé : on redonne un mot de passe provisoire ; sinon il garde le sien
        if (!existant.last_sign_in_at) return await provisoire(existant)
        return reponse({ user_id: existant.id, email: existant.email, existant: true })
      }
      const mot = motDePasse()
      const { data, error } = await base.auth.admin.createUser({ email, password: mot, email_confirm: true, user_metadata: { mot_de_passe_provisoire: true } })
      if (error || !data.user) throw error ?? new Error('creation')
      return reponse({ user_id: data.user.id, email: data.user.email, mot_de_passe: mot })
    }
    if (corps.action === 'reinitialiser' || corps.action === 'supprimer') {
      if (typeof corps.user !== 'string') return reponse({ erreur: 'format' }, 400)
      const { data } = await base.auth.admin.getUserById(corps.user)
      if (!data?.user) return corps.action === 'supprimer' ? reponse({ supprime: true }) : reponse({ erreur: 'compte_introuvable' }, 404)
      if (data.user.id === moi.user.id || !compteFranchise(data.user)) return reponse({ erreur: 'compte_equipe' }, 409)
      if (corps.action === 'reinitialiser') return await provisoire(data.user)
      const { error } = await base.auth.admin.deleteUser(data.user.id)
      if (error) throw error
      return reponse({ supprime: true })
    }
    return reponse({ erreur: 'format' }, 400)
  } catch (err) {
    return reponse({ erreur: String((err as Error).message ?? err) }, 500)
  }
})
