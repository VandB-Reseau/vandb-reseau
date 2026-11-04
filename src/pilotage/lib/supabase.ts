// Client Supabase de l'app réseau ; les données du pilotage sont rangées dans le schéma « pilotage »
import { supabase } from '../../lib/supabase'
export { supabase, supabaseConfigured } from '../../lib/supabase'
export const pilotage = () => supabase.schema('pilotage')
