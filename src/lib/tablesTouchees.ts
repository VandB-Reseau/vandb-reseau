// Tables écrites depuis le dernier chargement du réseau (proposition 370, Joseph 23/11/2026) : après un enregistrement,
// l'app ne relit que ce qui a changé au lieu des douze tables du réseau. Chaque écriture vers la base est notée ici
// au passage (client Supabase, src/lib/supabase.ts) ; dans le doute, tout est relu, comme avant.

// Pour suivi_magasins et app_config : les rubriques (ou clés) touchées ; « tout » quand on ne sait pas lesquelles
export type Touche = Set<string> | 'tout'
let touchees = new Map<string, Touche>()
let toutRelire = false

// Fonctions de la base qui écrivent dans les tables que le réseau charge (relevé des migrations du 23/11/2026) :
// après l'une d'elles, tout est relu. Toute nouvelle fonction qui écrit dans ces tables s'ajoute ici.
const ECRIVENT_RESEAU = new Set([
  'ajouter_action_franchise', 'constat_campagne_franchise', 'ecrire_equipements', 'ecrire_exterieur', 'ecrire_mot_franchise',
  'marquer_action_franchise', 'remettre_modification', 'statut_action_franchise', 'tache_exterieur_franchise',
])
// Fonctions du budget qui ne font que lire (les autres peuvent changer les chiffres du mois venus de la caisse)
const LECTURES_BUDGET = new Set(['budgets_du_compte', 'mes_droits', 'reel_du_compte', 'ouvertures_reseau', 'concordance_ca', 'magasins_orphelins'])
// Tables dont on suit le détail (une rubrique ou une clé par ligne)
const COLONNE_DETAIL: Record<string, string> = { suivi_magasins: 'cle', app_config: 'key' }

function noter(table: string, detail: Touche) {
  const avant = touchees.get(table)
  if (avant === 'tout' || detail === 'tout') { touchees.set(table, 'tout'); return }
  touchees.set(table, new Set([...(avant ?? []), ...detail]))
}

// Valeurs d'un filtre PostgREST « eq.x » ou « in.(x,y) » ; null si le filtre manque ou ne se lit pas
function valeursFiltre(brut: string | null): string[] | null {
  if (!brut) return null
  if (brut.startsWith('eq.')) return [brut.slice(3)]
  if (brut.startsWith('in.(') && brut.endsWith(')')) return brut.slice(4, -1).split(',').map((x) => x.replace(/^"|"$/g, ''))
  return null
}

function detailDe(colonne: string, url: URL, corps: unknown): Touche {
  const parFiltre = valeursFiltre(url.searchParams.get(colonne))
  if (parFiltre) return new Set(parFiltre)
  const lignes = [corps].flat() as Record<string, unknown>[]
  const valeurs = lignes.map((l) => (l && typeof l === 'object' ? l[colonne] : undefined))
  return valeurs.length && valeurs.every((v) => typeof v === 'string') ? new Set(valeurs as string[]) : 'tout'
}

function corpsJson(init?: RequestInit): unknown {
  if (typeof init?.body !== 'string') return null
  try { return JSON.parse(init.body) } catch { return null }
}

// Note la requête si c'est une écriture : appelée avant l'envoi, pour qu'un rechargement lancé juste après la voie
export function noterRequete(entree: RequestInfo | URL, init?: RequestInit) {
  const methode = (init?.method ?? (entree instanceof Request ? entree.method : 'GET')).toUpperCase()
  if (methode === 'GET' || methode === 'HEAD' || methode === 'OPTIONS') return
  let url: URL
  try { url = new URL(entree instanceof Request ? entree.url : String(entree)) } catch { toutRelire = true; return }
  const chemin = url.pathname
  if (chemin.startsWith('/auth/') || chemin.startsWith('/storage/')) return
  if (chemin.startsWith('/functions/')) {
    // Notifications envoyées après coup : rien du réseau ne change
    if (!/\/functions\/v1\/notifier$/.test(chemin)) toutRelire = true
    return
  }
  if (!chemin.startsWith('/rest/v1/')) return
  const entetes = new Headers(init?.headers ?? (entree instanceof Request ? entree.headers : undefined))
  const schema = entetes.get('content-profile') ?? entetes.get('accept-profile')
  const nom = chemin.slice('/rest/v1/'.length)
  const fonction = nom.startsWith('rpc/') ? nom.slice(4) : null
  // Schéma du budget : seuls les chiffres du mois (caisse) en viennent
  if (schema && schema !== 'public') { if (!fonction || !LECTURES_BUDGET.has(fonction)) noter('chiffres', 'tout'); return }
  if (fonction) { if (ECRIVENT_RESEAU.has(fonction)) toutRelire = true; return }
  const colonne = COLONNE_DETAIL[nom]
  noter(nom, colonne ? detailDe(colonne, url, corpsJson(init)) : 'tout')
}

// Ce qui a changé depuis le dernier appel ; « tout » quand une écriture ne se rattache à aucune table connue
export function prendreTablesTouchees(): Map<string, Touche> | 'tout' {
  const r = toutRelire ? 'tout' as const : touchees
  touchees = new Map()
  toutRelire = false
  return r
}

// Un rechargement raté : ses tables seront relues en entier la fois suivante
export function relireToutLaProchaineFois() { toutRelire = true }
