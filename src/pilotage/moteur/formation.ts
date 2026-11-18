// Former un collaborateur (Joseph, 18/11/2026 : « simulation du coût de formation d'un de nos collaborateurs en magasin :
// coût de la formation journalière, indemnité kilométrique, hôtel, réduction OPCO, réduction CPF, aide dans le cas d'un
// alternant »). Ordres de grandeur : la prise en charge réelle dépend de l'OPCO du magasin, de ses fonds de l'année et de
// l'accord de l'organisme. Fonction pure, testée dans tests/pilotage/moteur/formation.spec.ts.
//
// Repères 2026 proposés par défaut, modifiables par le Directeur (Paramètres, Simulateurs) :
// - barème kilométrique (voiture, jusqu'à 5 000 km par an) : 3 CV 0,529 €, 4 CV 0,606 €, 5 CV 0,636 €, 6 CV 0,665 €,
//   7 CV et plus 0,697 € par km, + 20 % pour une voiture électrique (barème inchangé depuis 2023, brochure pratique 2026) ;
// - OPCO, plan de développement des compétences d'une entreprise de moins de 50 salariés (règles AKTO 2026, entreprises
//   hors branche) : coûts pédagogiques pris en charge jusqu'à 30 € par heure et par salarié, dans un budget de 2 500 € par
//   an sous 11 salariés (4 000 € de 11 à 49) ; salaire, trajet, hôtel et repas ne sont pas pris en charge ;
// - CPF : reste à charge forfaitaire de 150 € par formation pour le salarié depuis le 2 avril 2026 (décret n° 2026-234),
//   dont il est dispensé quand l'employeur complète le financement (abondement) ;
// - apprenti (contrat conclu en 2026, entreprise de moins de 250 salariés) : 5 000 € la 1re année jusqu'au bac (niveaux
//   3 et 4), 4 500 € au niveau 5 (BTS), 2 000 € aux niveaux 6 et 7 (licence, master) depuis le décret n° 2026-168 du
//   6 mars 2026, 6 000 € pour un apprenti en situation de handicap ; la formation au CFA est payée par l'OPCO.

export interface ReglesFormation {
  km: { cv3: number; cv4: number; cv5: number; cv6: number; cv7: number } // € par km, jusqu'à 5 000 km par an
  electrique: number          // majoration du barème pour une voiture électrique
  opcoHeure: number           // plafond OPCO des coûts pédagogiques, par heure et par salarié
  opcoBudget: number          // budget OPCO de l'année pour le magasin (0 : pas de limite)
  cpfResteACharge: number     // participation forfaitaire du salarié au CPF
  aides: { niveau34: number; niveau5: number; niveau67: number; handicap: number } // aide à l'embauche d'un apprenti, 1re année
}
export const REGLES_FORMATION: ReglesFormation = {
  km: { cv3: 0.529, cv4: 0.606, cv5: 0.636, cv6: 0.665, cv7: 0.697 }, electrique: 0.2,
  opcoHeure: 30, opcoBudget: 2_500, cpfResteACharge: 150,
  aides: { niveau34: 5_000, niveau5: 4_500, niveau67: 2_000, handicap: 6_000 },
}
export type Puissance = 'cv3' | 'cv4' | 'cv5' | 'cv6' | 'cv7'
export type NiveauApprenti = 'niveau34' | 'niveau5' | 'niveau67' | 'handicap'

export interface Formation {
  jours: number; heuresParJour: number; coutHeure: number   // temps de formation payé au collaborateur, coût chargé de l'heure
  pedagogiqueJour: number                                   // prix de la formation par jour, HT
  trajets: number; kmAllerRetour: number; puissance: Puissance; electrique: boolean; peages: number // déplacement en voiture
  nuits: number; prixNuit: number; repas: number; prixRepas: number
  heuresRemplacement: number; coutHeureRemplacement: number // heures payées en magasin pour le remplacer
  opco: boolean; opcoDejaUtilise: number; opcoAutres: number // demande à l'OPCO ; budget de l'année déjà pris ; autres frais qu'il prend
  cpf: number                                               // droits CPF mobilisés par le collaborateur (€)
  apprenti: NiveauApprenti | null                           // alternant (contrat d'apprentissage conclu en 2026)
  tauxMarge: number                                         // marge du magasin, pour le CA qui paie la formation
}
export interface EffetFormation {
  heures: number
  salaire: number; pedagogique: number; indemnites: number; prixKm: number; peages: number; hotel: number; repas: number; remplacement: number
  coutTotal: number
  cpf: number; opcoPedagogique: number; opcoAutres: number; aide: number; financements: number
  resteACharge: number; parJour: number | null; parHeure: number | null
  participationCollaborateur: number   // reste à charge CPF du collaborateur (0 si le magasin complète)
  caPourPayer: number | null           // CA HT qui paie le reste, à la marge du magasin moins redevance et publicité
}

const pos = (x: number | null | undefined) => (Number.isFinite(x) ? Math.max(0, x as number) : 0)

export function simulerFormation(x: Formation, r: ReglesFormation, redevanceEtPub = 0.03): EffetFormation {
  const jours = pos(x.jours)
  const heures = jours * pos(x.heuresParJour)
  const salaire = heures * pos(x.coutHeure)
  const pedagogique = jours * pos(x.pedagogiqueJour)
  const prixKm = pos(r.km[x.puissance] ?? r.km.cv5) * (x.electrique ? 1 + pos(r.electrique) : 1)
  const indemnites = pos(x.trajets) * pos(x.kmAllerRetour) * prixKm
  const peages = pos(x.peages)
  const hotel = pos(x.nuits) * pos(x.prixNuit)
  const repas = pos(x.repas) * pos(x.prixRepas)
  const remplacement = pos(x.heuresRemplacement) * pos(x.coutHeureRemplacement)
  const coutTotal = salaire + pedagogique + indemnites + peages + hotel + repas + remplacement

  // Apprenti : le CFA est payé par l'OPCO (niveau de prise en charge du contrat), l'aide de l'État s'ajoute
  // Sinon : d'abord les droits CPF du collaborateur, puis l'OPCO sur le reste, au plafond horaire et dans son budget
  const cpf = x.apprenti ? 0 : Math.min(pos(x.cpf), pedagogique)
  const budgetRestant = pos(r.opcoBudget) > 0 ? Math.max(0, pos(r.opcoBudget) - pos(x.opcoDejaUtilise)) : Infinity
  const opcoPedagogique = x.apprenti ? pedagogique
    : x.opco ? Math.min(pedagogique - cpf, heures * pos(r.opcoHeure), budgetRestant) : 0
  const opcoAutres = x.opco || x.apprenti ? Math.min(pos(x.opcoAutres), coutTotal - pedagogique) : 0
  const aide = x.apprenti ? pos(r.aides[x.apprenti]) : 0
  const financements = cpf + opcoPedagogique + opcoAutres + aide
  const resteACharge = coutTotal - financements
  // Le collaborateur paie le forfait CPF, sauf si le magasin paie une part de la formation (abondement)
  const abondement = pedagogique - cpf - opcoPedagogique
  const participationCollaborateur = cpf > 0 && abondement <= 0 ? pos(r.cpfResteACharge) : 0
  const marge = pos(x.tauxMarge) - pos(redevanceEtPub)
  return {
    heures, salaire, pedagogique, indemnites, prixKm, peages, hotel, repas, remplacement, coutTotal,
    cpf, opcoPedagogique, opcoAutres, aide, financements, resteACharge,
    parJour: jours > 0 ? resteACharge / jours : null, parHeure: heures > 0 ? resteACharge / heures : null,
    participationCollaborateur,
    caPourPayer: resteACharge > 0 && marge > 0 ? resteACharge / marge : null,
  }
}
