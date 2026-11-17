// Rapports enregistrés de l'onglet Pilotage (migration 0050_rapports_pilotage.sql) : seulement des définitions,
// chacun recalcule les chiffres avec ses propres droits. Table fermée, tout passe par les fonctions de la base.
import { supabase } from '../lib/supabase'
import { normaliserDefinition, type Definition } from './rapports'

export interface RapportEnregistre { id: number; titre: string; definition: Definition; modele: boolean; partage: boolean; auteur: string; mien: boolean }

export class RapportsIndisponibles extends Error {}

export async function chargerRapports(equipe: boolean): Promise<RapportEnregistre[]> {
  const { data, error } = await supabase.rpc('rapports_du_compte')
  if (error || !Array.isArray(data)) throw new RapportsIndisponibles()
  return (data as Record<string, unknown>[]).filter((r) => typeof r.id === 'number' && typeof r.titre === 'string').map((r) => ({
    id: r.id as number, titre: r.titre as string, definition: normaliserDefinition(r.definition, equipe),
    modele: r.modele === true, partage: r.partage === true, auteur: typeof r.auteur === 'string' ? r.auteur : '', mien: r.mien === true,
  }))
}

export async function enregistrerRapport(r: { id: number | null; titre: string; definition: Definition; modele: boolean; partage: boolean }): Promise<number> {
  const { data, error } = await supabase.rpc('enregistrer_rapport', { p_id: r.id, p_titre: r.titre.trim(), p_definition: r.definition, p_modele: r.modele, p_partage: r.partage })
  if (error || typeof data !== 'number') throw new RapportsIndisponibles()
  return data
}

export async function supprimerRapport(id: number): Promise<void> {
  const { error } = await supabase.rpc('supprimer_rapport', { p_id: id })
  if (error) throw new RapportsIndisponibles()
}
