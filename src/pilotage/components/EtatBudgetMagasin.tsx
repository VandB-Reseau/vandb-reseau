// Choix 258 (Joseph, 16/11/2026) : où en est le budget de l'année du magasin, pour la vue d'ensemble de sa fiche.
// Statut (proposé, en discussion, validé) et CA HT du budget face au CA atterri de l'année en cours, calculés par le
// moteur. Chargé à la demande avec le pilotage ; sans accès ou sans réponse, la tuile renvoie simplement à l'onglet.
import { useEffect, useState, type ReactNode } from 'react'
import { chargerAnnees } from '../data/annees'
import { anneeBudget, chargerBudgets, chargerParametres, hypothesesDe, parametresDuBudget, statutLibelle } from '../data/pilotage'
import { calculerBudget } from '../moteur/budget'
import { formatKEuros, formatPourcent } from '../../data/chiffres'

export interface EtatBudget { libelle: string; valeur: string; detail?: string; alerte?: boolean }

async function lire(nom: string): Promise<EtatBudget> {
  await chargerAnnees()
  const annee = anneeBudget()
  const libelle = `Budget ${annee}`
  const [d, { parametres }] = await Promise.all([chargerBudgets(annee), chargerParametres(annee)])
  const ligne = d.magasins.find((l) => l.magasin === nom)
  if (!ligne?.statut) return { libelle, valeur: 'Pas encore proposé', detail: 'Le siège propose, on se met d’accord' }
  const h = hypothesesDe(ligne, d)
  if (!h) return { libelle, valeur: statutLibelle[ligne.statut] }
  const b = calculerBudget(h.hypotheses, parametresDuBudget(ligne, parametres))
  const ecart = b.atterrissage ? ((b.ca - b.atterrissage) / b.atterrissage) * 100 : null
  return { libelle, valeur: statutLibelle[ligne.statut], detail: `CA ${formatKEuros(b.ca)}${ecart !== null ? ` · ${formatPourcent(ecart)} vs atterrissage ${annee - 1}` : ''}` }
}

export default function EtatBudgetMagasin({ nom, rendre }: { nom: string; rendre: (e: EtatBudget | null) => ReactNode }) {
  const [etat, setEtat] = useState<EtatBudget | null | undefined>(undefined)
  useEffect(() => {
    let actif = true
    lire(nom).then((e) => actif && setEtat(e), () => actif && setEtat(null))
    return () => { actif = false }
  }, [nom])
  return <>{rendre(etat === undefined ? { libelle: 'Budget', valeur: '…' } : etat)}</>
}
