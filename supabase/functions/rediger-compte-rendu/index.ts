// Fonction Supabase (Deno) : range les notes dictées d'une visite dans les 10 parties du compte rendu.
// La clé de l'IA reste ici, dans les secrets Supabase (ANTHROPIC_API_KEY), jamais dans l'app.
// Seuls les comptes connectés peuvent l'appeler (vérification du jeton par Supabase).
import Anthropic from 'npm:@anthropic-ai/sdk'
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk/helpers/zod'
import { z } from 'npm:zod'

const PARTIES = [
  ['Chiffres clés et gestion', 'CA et évolution N-1, panier moyen, fréquentation, position réseau. Stocks, commandes, démarque, marge si abordée.'],
  ["Suivi du plan d'action précédent", 'Actions réalisées, non réalisées, et pourquoi.'],
  ['Respect du concept : PPM', 'Plein : rayons garnis, pas de ruptures. Propre : magasin, vitrine, réserve. Marchand : implantation, têtes de gondole, PLV, étiquetage prix. Normes d’enseigne.'],
  ['Offre et assortiment', 'Assortiment cave et bière, référencements, nouveautés, adaptation à la clientèle locale.'],
  ['Expérience client', 'Accueil, conseil, qualité du service.'],
  ['Animation commerciale', 'Dégustations, événements, temps forts du calendrier, fidélité.'],
  ['Ancrage local et digital', 'Avis Google, réseaux sociaux, clients pros et comités d’entreprise, partenariats.'],
  ['Espace bar et consommation sur place', 'Fréquentation, créneaux, rentabilité, conformité (licence, mineurs, loi Évin).'],
  ['Équipe et management', 'Effectif, plannings, formation, turnover, climat.'],
  ['Synthèse', '3 points forts, 3 axes de progrès, engagements du franchisé.'],
]

const SYSTEME = `Tu aides un Coach V and B (réseau de caves-bars en franchise) à rédiger le compte rendu de suivi d'une visite magasin, envoyé au franchisé.
Tu reçois ses notes dictées en vrac (transcription vocale : fautes, noms déformés, phrases incomplètes) et, s'il y en a, ce qui est déjà rédigé et le plan d'action de la visite précédente.

Les 10 parties, dans cet ordre :
${PARTIES.map(([t, g], i) => `${i + 1}. ${t} : ${g}`).join('\n')}

Règles :
- N'utilise que ce que disent les notes et le texte déjà rédigé. N'invente aucun chiffre, nom, fait ni engagement.
- Une partie dont les notes ne parlent pas reste une chaîne vide. Aucune partie n'est obligatoire.
- Garde le texte déjà rédigé par le Coach et complète-le avec les nouvelles informations, sans le contredire.
- Style : français professionnel, direct, respectueux du franchisé, phrases courtes ; listes avec « - » en début de ligne. Corrige les erreurs de transcription évidentes.
- Partie 2 : situe chaque action du plan précédent (réalisée, en cours, non réalisée) seulement si les notes en parlent.
- Plan d'action : les actions convenues ou préconisées dans les notes, avec le porteur (Franchisé, Coach, ou le prénom cité) et l'échéance telle que dite, sinon vide. Garde les actions déjà saisies.`

const Sortie = z.object({
  parties: z.array(z.string()),
  plan: z.array(z.object({ action: z.string(), porteur: z.string(), echeance: z.string() })),
})

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const repondre = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const client = new Anthropic()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { magasin = '', notes = '', parties = [], plan = [], planPrecedent = [] } = await req.json()
    if (!String(notes).trim()) return repondre({ erreur: 'notes vides' }, 400)
    const deja = PARTIES.map(([t], i) => (parties[i] ? `${i + 1}. ${t}\n${parties[i]}` : '')).filter(Boolean).join('\n\n')
    const message = [
      `Magasin : ${magasin}`,
      planPrecedent.length ? `Plan d'action de la visite précédente :\n${planPrecedent.map((a: { action: string; porteur?: string; echeance?: string }) => `- ${a.action} (${a.porteur || 'porteur non précisé'}${a.echeance ? `, ${a.echeance}` : ''})`).join('\n')}` : '',
      deja ? `Déjà rédigé :\n${deja}` : '',
      plan.length ? `Actions déjà saisies :\n${plan.map((a: { action: string }) => `- ${a.action}`).join('\n')}` : '',
      `Notes dictées :\n${notes}`,
      'Renvoie les 10 parties (chaîne vide si non abordée) et le plan d’action.',
    ].filter(Boolean).join('\n\n')

    const reponse = await client.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'low', format: zodOutputFormat(Sortie) },
      system: SYSTEME,
      messages: [{ role: 'user', content: message }],
    })
    if (reponse.stop_reason === 'refusal' || !reponse.parsed_output) return repondre({ erreur: 'rédaction impossible' }, 502)
    const sortie = reponse.parsed_output
    return repondre({ parties: PARTIES.map((_p, i) => sortie.parties[i] ?? ''), plan: sortie.plan })
  } catch (e) {
    console.error(e)
    return repondre({ erreur: 'rédaction impossible' }, 500)
  }
})
