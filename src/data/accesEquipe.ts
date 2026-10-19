// Accès des Coachs et des Responsables Régionaux : un compte créé dans Supabase, rattaché depuis la fiche
// de la personne par le Directeur de réseau (fonctions du script cloisonnement_equipe.sql)
import { supabase } from '../lib/supabase'

export type RoleEquipe = 'coach' | 'rr'
export interface AccesEquipe { userId: string; email: string; role: RoleEquipe; nom: string; derniereConnexion: string }

export class ErreurAccesEquipe extends Error {}
const messages: Record<string, string> = {
  compte_introuvable: 'Aucun compte n’existe avec cet email. Crée-le d’abord dans Supabase.',
  compte_directeur: 'Ce compte est celui du Directeur de réseau.',
  compte_franchise: 'Ce compte est l’accès d’un franchisé : il ne peut pas devenir un accès de l’équipe.',
  acces_refuse: 'Seul le Directeur de réseau peut gérer les accès.',
}
function erreur(e: { message?: string; code?: string } | null): never {
  const cle = Object.keys(messages).find((k) => e?.message?.includes(k))
  if (cle) throw new ErreurAccesEquipe(messages[cle])
  if (e?.code === 'PGRST202' || e?.message?.includes('Could not find the function')) throw new ErreurAccesEquipe('Les accès de l’équipe ne sont pas encore activés dans la base.')
  throw new ErreurAccesEquipe('Enregistrement impossible pour le moment. Réessaie dans un instant.')
}

// null : accès pas encore activés dans la base (script non passé)
export async function listerAccesEquipe(): Promise<AccesEquipe[] | null> {
  const { data, error } = await supabase.rpc('liste_acces_equipe')
  if (error || !Array.isArray(data)) return null
  return (data as Record<string, unknown>[]).filter((a) => a.role === 'coach' || a.role === 'rr').map((a) => ({
    userId: String(a.user_id), email: String(a.email ?? ''), role: a.role as RoleEquipe, nom: String(a.nom ?? ''),
    derniereConnexion: String(a.derniere_connexion ?? '').slice(0, 10),
  }))
}

// cle : nom du Coach, ou identifiant du Responsable Régional
export async function ouvrirAccesEquipe(email: string, role: RoleEquipe, cle: string) {
  const { error } = await supabase.rpc('ouvrir_acces_equipe', { p_email: email.trim(), p_role: role, p_nom: cle })
  if (error) erreur(error)
}

export async function couperAccesEquipe(userId: string) {
  const { error } = await supabase.rpc('couper_acces_equipe', { p_user: userId })
  if (error) erreur(error)
}

// Coach renommé dans l'app : son compte suit (sans effet tant que le script n'est pas passé)
export async function renommerAccesCoach(ancien: string, nouveau: string) {
  await supabase.rpc('renommer_acces_coach', { p_ancien: ancien, p_nouveau: nouveau })
}
