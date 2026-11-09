// Équipe d'un magasin et masse salariale chargée, personne par personne (Joseph, 27/10/2026) :
// - une ligne par poste (« Vendeur 1 », « Vendeur 2 »), sans nom ; le gérant y figure s'il se rémunère (souvent TNS) ;
// - charges patronales : un taux par catégorie, moins la réduction générale dégressive unique (RGDU, ex-réduction Fillon),
//   calculée sur le brut annuel de chaque salarié, maximale au SMIC, nulle à 3 SMIC ; pas de réduction pour un gérant TNS ;
// - primes annuelles versées le mois choisi, pas de 13e mois ; entrées et sorties au mois ;
// - primes d'équipe (lot 26) : une enveloppe sans heures ni salaire, chargée au taux de sa catégorie, sans réduction
//   (la réduction dépend du salaire de chaque bénéficiaire, inconnu ici : le coût n'est pas sous-estimé) ;
// - extras (Joseph, 29/10/2026) : un poste comme un autre, heures moyennes par semaine ou par mois × taux horaire brut,
//   congés payés compris ; ils remplacent les extras de personnel des temps forts ;
// - congés payés (Joseph, 04/11/2026) : provision d'environ 10 % du salaire de base (règle du dixième), chargée au taux
//   effectif de la personne (charges moins réduction générale, sans recalcul de la réduction), ajoutée à la masse
//   salariale chargée. Ni pour le gérant TNS, ni pour les extras (congés déjà dans leur taux horaire), ni pour les primes
//   d'équipe ; les primes annuelles n'y entrent pas. Taux réglé dans les Paramètres réseau, 0 pour les paramètres
//   enregistrés avant (les budgets déjà calculés ne bougent pas tant que le Directeur ne l'a pas saisi).
// Fonction pure, testée dans tests/moteur/equipe.spec.ts.

export type Categorie = 'employe' | 'agent_maitrise' | 'cadre' | 'apprenti' | 'gerant_tns'
export const CATEGORIES: Categorie[] = ['employe', 'agent_maitrise', 'cadre', 'apprenti', 'gerant_tns']
export const categorieLibelle: Record<Categorie, string> = {
  employe: 'Employé', agent_maitrise: 'Agent de maîtrise', cadre: 'Cadre', apprenti: 'Apprenti', gerant_tns: 'Gérant TNS',
}

export interface Prime { mois: number; montant: number }
export interface Personne {
  id?: number
  poste: string
  categorie: Categorie
  heuresHebdo: number
  brutMensuel: number      // rémunération mensuelle pour un gérant TNS
  primes: Prime[]
  entree: string | null    // « AAAA-MM » ; null : déjà là au 1er janvier
  sortie: string | null    // « AAAA-MM », dernier mois travaillé ; null : pas de départ prévu
  heuresSaisie?: 'semaine' | 'mois'  // unité choisie à la saisie (lot 26) ; le calcul part toujours des heures par semaine
  enveloppe?: boolean      // primes d'équipe sans salarié (lot 26) : ni heures ni salaire, charges de la catégorie, sans réduction
  tauxHoraire?: number     // extras : taux horaire brut ; brutMensuel = taux × heures moyennes du mois
  // Lot 35 (Joseph, 02/11/2026) : hausses de salaire datées, appliquées à partir de leur mois et cumulées, en plus de
  // la hausse générale de l'année
  hausses?: HausseDatee[]
}
export interface HausseDatee { mois: string; taux: number }   // « AAAA-MM »

// Heures par mois ↔ heures par semaine : 52 semaines sur 12 mois
export const SEMAINES_PAR_MOIS = 52 / 12

export interface ParametresCharges {
  taux: Record<Categorie, number>   // charges patronales avant réduction, en part du brut
  reduction: {
    smicAnnuel: number              // SMIC annuel brut pour 35 heures par semaine
    tmin: number
    tdelta: number
    puissance: number
    horsReduction: number           // part du taux que la réduction ne couvre pas (formation, taxe d'apprentissage)
  }
  congesPayes?: number              // provision des congés payés, en part du salaire de base (absent : 0)
}

export interface CoutPersonne {
  personne: Personne
  brut: number[]; charges: number[]; reduction: number[]; cout: number[]; heures: number[]  // 12 mois
  congesPayes: number[]             // provision chargée des congés payés, comprise dans cout (12 mois)
  brutAnnuel: number; coutAnnuel: number; congesPayesAnnuel: number; coefficient: number; tauxEffectif: number; etp: number
}
export interface MasseSalariale {
  personnes: CoutPersonne[]
  parMois: { brut: number; charges: number; reduction: number; congesPayes: number; cout: number; heures: number }[]
  brut: number; charges: number; reduction: number; congesPayes: number; cout: number; etp: number; tauxEffectif: number
}

const DUREE_LEGALE = 35
const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const deux = (n: number) => String(n).padStart(2, '0')

// Mois de l'année où la personne est présente (entrée et sortie comprises)
export function moisPresents(p: Pick<Personne, 'entree' | 'sortie'>, annee: number): boolean[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = `${annee}-${deux(i + 1)}`
    return (!p.entree || p.entree <= m) && (!p.sortie || p.sortie >= m)
  })
}

// Coefficient de la réduction générale pour un brut annuel, avec le SMIC ramené au temps de travail et aux mois présents
export function coefficientReduction(brutAnnuel: number, smicReference: number, r: ParametresCharges['reduction']): number {
  if (brutAnnuel <= 0 || smicReference <= 0 || brutAnnuel >= 3 * smicReference) return 0
  const max = r.tmin + r.tdelta
  const c = r.tmin + r.tdelta * Math.pow(0.5 * (3 * smicReference / brutAnnuel - 1), r.puissance)
  return Math.round(Math.min(max, c) * 10_000) / 10_000
}

// Hausses datées déjà passées au mois donné (« AAAA-MM »), cumulées : +2 % puis +3 % font × 1,02 × 1,03
export function facteurHausses(p: Pick<Personne, 'hausses'>, mois: string): number {
  return (p.hausses ?? []).filter((h) => h.mois <= mois).reduce((f, h) => f * (1 + h.taux), 1)
}

// Les congés payés se provisionnent pour les salariés : ni gérant TNS, ni extras, ni primes d'équipe
export const avecCongesPayes = (p: Personne) => p.categorie !== 'gerant_tns' && !p.enveloppe && !p.tauxHoraire

export function coutPersonne(p: Personne, c: ParametresCharges, annee: number, hausse = 0): CoutPersonne {
  const presents = moisPresents(p, annee)
  const nbMois = presents.filter(Boolean).length
  const base = presents.map((ok, i) => (ok ? p.brutMensuel * (1 + hausse) * facteurHausses(p, `${annee}-${deux(i + 1)}`) : 0))
  const brut = base.map((b, i) => b + (presents[i] ? somme(p.primes.filter((x) => x.mois === i + 1).map((x) => x.montant)) : 0))
  const brutAnnuel = somme(brut)
  const taux = c.taux[p.categorie] ?? 0
  const smicReference = c.reduction.smicAnnuel * (p.heuresHebdo / DUREE_LEGALE) * (nbMois / 12)
  // La réduction ne dépasse jamais les cotisations qu'elle couvre
  const coefficient = p.categorie === 'gerant_tns' ? 0
    : Math.min(coefficientReduction(brutAnnuel, smicReference, c.reduction), Math.max(0, taux - c.reduction.horsReduction))
  const charges = brut.map((b) => b * taux)
  const reduction = brut.map((b) => b * coefficient)
  const tauxCP = avecCongesPayes(p) ? c.congesPayes ?? 0 : 0
  const congesPayes = base.map((b) => b * tauxCP * (1 + taux - coefficient))
  const cout = brut.map((b, i) => b + charges[i] - reduction[i] + congesPayes[i])
  const heures = presents.map((ok) => (ok ? p.heuresHebdo * SEMAINES_PAR_MOIS : 0))
  return {
    personne: p, brut, charges, reduction, congesPayes, cout, heures, brutAnnuel, coutAnnuel: somme(cout), congesPayesAnnuel: somme(congesPayes), coefficient,
    tauxEffectif: taux - coefficient, etp: (p.heuresHebdo / DUREE_LEGALE) * (nbMois / 12),
  }
}

// Masse salariale chargée de l'équipe pour une année ; hausse : indexation des salaires (pas des primes)
export function masseSalariale(equipe: Personne[], c: ParametresCharges, annee: number, hausse = 0): MasseSalariale {
  const personnes = equipe.map((p) => coutPersonne(p, c, annee, hausse))
  const parMois = Array.from({ length: 12 }, (_, i) => ({
    brut: somme(personnes.map((x) => x.brut[i])),
    charges: somme(personnes.map((x) => x.charges[i])),
    reduction: somme(personnes.map((x) => x.reduction[i])),
    congesPayes: somme(personnes.map((x) => x.congesPayes[i])),
    cout: somme(personnes.map((x) => x.cout[i])),
    heures: somme(personnes.map((x) => x.heures[i])),
  }))
  const brut = somme(parMois.map((m) => m.brut))
  const charges = somme(parMois.map((m) => m.charges))
  const reduction = somme(parMois.map((m) => m.reduction))
  const congesPayes = somme(parMois.map((m) => m.congesPayes))
  return {
    personnes, parMois, brut, charges, reduction, congesPayes, cout: brut + charges - reduction + congesPayes,
    etp: somme(personnes.map((x) => x.etp)), tauxEffectif: brut ? (charges - reduction) / brut : 0,
  }
}
