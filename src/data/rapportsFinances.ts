// Budgets et résultat des magasins du compte pour l'onglet Pilotage (schéma pilotage) : même calcul que le suivi des
// budgets (moteur pur src/pilotage/moteur/), plus le CA réel et budgété mois par mois pour suivre n'importe quelle période.
// Un franchisé ne reçoit que ses magasins (budgets_du_compte) ; une donnée absente laisse l'indicateur vide, sans erreur.
import { chargerBudgets, chargerParametres, chargerQuadrimestres, chargerReelDuCompte, chargerStocksReseau, hypothesesDe, parametresDuBudget, type SaisiesQuadrimestres } from '../pilotage/data/pilotage'
import { calculerBudget } from '../pilotage/moteur/budget'
import { fraisDepuisLignes } from '../pilotage/moteur/atterrissage'
import { ligneReseau, type MoisReel } from '../pilotage/moteur/suivi'
import { stockParDefaut, stockReseau } from '../pilotage/moteur/stock'
import type { FinanceMagasin } from './rapports'

const STATUTS: Record<string, string> = { valide: 'Validé', en_discussion: 'En discussion', propose: 'Proposé' }
const douze = (): MoisReel[] => Array.from({ length: 12 }, () => ({ caHT: 0, margeHT: 0, caAvecMarge: 0, caTTC: 0, tickets: 0 }))

export async function chargerFinancesRapports(annee: number): Promise<Map<string, FinanceMagasin>> {
  const [d, { parametres }, reel] = await Promise.all([chargerBudgets(annee), chargerParametres(annee), chargerReelDuCompte(annee)])
  const [quadrimestres, stocks] = await Promise.all([
    chargerQuadrimestres(annee).catch(() => ({} as SaisiesQuadrimestres)),
    chargerStocksReseau(annee).catch(() => ({} as Awaited<ReturnType<typeof chargerStocksReseau>>)),
  ])
  const groupes = new Map(d.groupes.map((g) => [g.id, g.nom]))
  const p = { tauxRedevance: parametres.tauxRedevance, tauxPublicite: parametres.tauxPublicite, charges: parametres.charges, annee }
  const pStock = parametres.tresorerie.stock ?? stockParDefaut
  const resultat = new Map<string, FinanceMagasin>()
  for (const l of d.magasins) {
    const h = l.statut ? hypothesesDe(l, d) : null
    const budget = h ? calculerBudget(h.hypotheses, parametresDuBudget(l, parametres)) : null
    const n = reel.magasins[l.magasin]?.n ?? douze(), n1 = reel.magasins[l.magasin]?.n1 ?? douze()
    const frais = d.frais[l.magasin]
    const ligne = ligneReseau({ magasin: l.magasin, n, n1, budget, equipe: d.equipes[l.magasin], frais: frais?.length ? fraisDepuisLignes(frais).frais : undefined, quadrimestres: quadrimestres[l.magasin] ?? {} }, p)
    const stock = stocks[l.magasin] ? stockReseau(n, n1, stocks[l.magasin], pStock) : null
    resultat.set(l.magasin, {
      annee, caReel: n.map((x) => x.caHT), caBudget: budget ? budget.mois.map((x) => x.ca) : null,
      statut: l.statut ? STATUTS[l.statut] ?? 'Proposé' : 'Sans budget', groupe: l.groupeId ? groupes.get(l.groupeId) ?? '' : '',
      moisRealises: ligne.moisRealises, personnel: ligne.sommes.personnel, heures: ligne.sommes.heures, ebe: ligne.sommes.ebe,
      loyer: ligne.sommes.loyer, caADate: ligne.sommes.ca, moisStock: stock?.moisCouverts ?? null,
    })
  }
  return resultat
}
