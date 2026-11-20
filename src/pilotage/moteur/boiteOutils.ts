import type { ParametresReseau } from './types'

// Boîte à outils du coach (vague 9, choix 138 à 147, Joseph 14/11/2026) : les calculs des Excel d'aide à la décision
// repris dans l'app. Fonctions pures, montants HT (sauf les prix au verre saisis TTC), testées dans
// tests/pilotage/moteur/boiteOutils.spec.ts avec des chiffres fictifs vérifiés à la main.

type Redevances = Pick<ParametresReseau, 'tauxRedevance' | 'tauxPublicite'>
const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const pos = (x: number | null | undefined) => (Number.isFinite(x) ? Math.max(0, x as number) : 0)
const part = (x: number | null | undefined) => Math.min(1, pos(x))

// Réduction d'impôt du mécénat des entreprises (article 238 bis du code général des impôts) : 60 % du don
export const TAUX_MECENAT = 0.6
// Heures d'un temps plein sur l'année (35 h, durée légale annuelle)
export const HEURES_ETP = 1607

// ── 138 · Ce contrat extérieur est-il rentable ? (et 141, don à l'association) ───────────────────────────────────
// Par fût vendu : prix HT après remise − achat − CO2 − gobelets − redevance et publicité sur le prix remisé.
// Coûts fixes de l'année : tireuse (prix ÷ durée de vie + entretien ; seulement l'entretien si elle est déjà dans le
// parc), livraisons (km aller-retour × €/km + heures × coût horaire chargé), don ou sponsoring. Équilibre : coûts fixes
// ÷ net par fût, arrondi au fût supérieur. Remise maximale : celle qui ramène le gain à zéro au volume prévu.
// Don : en argent, ou en fûts valorisés au prix d'achat ; si le réseau le traite comme un don et que le reçu Cerfa est
// demandé, 60 % reviennent en réduction d'impôt.
// Vague 10 (154, 162) : sponsoring à part du don (contrepartie publicitaire : charge pleine, sans réduction d'impôt), avec
// une somme fixe et une rétrocession par fût ; matériel prêté (barnum, tables, frigo) et astreinte du week-end (heures ×
// coût horaire) en coûts fixes ; livraisons et locations de tireuse facturées au client en recettes (CA, donc redevance).
// Équilibre = (coûts fixes − recettes nettes) ÷ net par fût.
// Durée du contrat (Joseph, 16/11/2026 : « l'amortissement de la tireuse peut être sur 5 ans, mais si le contrat est sur
// 3… ça fait mal ») : une tireuse achetée pour un contrat plus court que sa durée de vie se paie sur la durée du contrat
// (prix ÷ années du contrat), par prudence ; le gain, l'équilibre et la remise maximale en tiennent compte. Deux repères en
// plus : le reste non amorti à la fin du contrat (prix × années restantes ÷ durée de vie, ce que coûte le départ du client
// si la tireuse ne ressert pas) et l'équilibre si elle ressert ailleurs (amortie sur sa durée de vie). Sans durée saisie,
// ou contrat au moins aussi long que la durée de vie : rien ne change.
// Gaz, consignes et gratuité (Joseph, 19/11/2026) : plusieurs tireuses possibles (prix et entretien multipliés) ; bouteilles
// de CO2 vendues au client au prix TTC (40 € par défaut), marge de 40 % prise sur le prix HT (hypothèse) : le CA HT entre
// dans les recettes (donc la redevance), l'achat (CA HT × (1 − marge)) s'en retire. Fûts offerts : achetés sans CA, en coût
// fixe (ils comptent dans l'équilibre). Consignes (fût 60 €, bouteille 85 €) payées au fournisseur et rendues au retour :
// aucun effet sur le gain, seulement sur la trésorerie ; bloqué au plus fort = fûts d'une livraison + bouteilles en place
// (0 si le client paie les consignes, il les avance alors à la place du magasin).
export interface ContratExterieur {
  futs: number; prixVente: number; remise: number; prixAchat: number; co2: number; gobelets: number
  tireuse: 'neuve' | 'parc'; prixTireuse: number; dureeTireuse: number; entretien: number
  livraisons: number; km: number; prixKm: number; heures: number; coutHoraire: number
  don: { type: 'aucun' | 'argent' | 'nature'; montant: number; futs: number; cerfa: boolean }
  prixLivraison?: number                              // facturé au client par livraison, HT
  sponsoring?: { montant: number; parFut: number }    // somme fixe et rétrocession par fût vendu
  materiel?: number                                   // matériel prêté, par an HT
  astreinte?: number                                  // heures d'astreinte du week-end par an
  locations?: { nombre: number; prix: number }        // locations de tireuse facturées (sans fûts du contrat)
  dureeContrat?: number                               // années ; 0 ou absent : la tireuse s'amortit sur sa durée de vie
  // Gobelets réutilisables fournis pour le contrat (Joseph, 16/11/2026 : 0,25 € le gobelet) : nombre × prix, coût fixe
  gobeletsContrat?: { nombre: number; prix: number }
  // Gaz, consignes et gratuité (Joseph, 19/11/2026). Plusieurs tireuses : prix et entretien × nombre.
  tireuses?: number                                   // 1 si absent
  futsOfferts?: number                                // fûts offerts au client sur l'année : achat sans CA
  // Bouteilles de CO2 : « en place » chez le client (consignées), « vendues » sur l'année au prix TTC, marge sur le HT
  co2Bouteilles?: { enPlace: number; vendues: number; prixTTC: number; marge: number; tva: number }
  // Consignes payées au fournisseur, rendues au retour : ni recette ni charge, seulement de la trésorerie
  consignes?: { fut: number; bouteille: number; facturees: boolean }
}
export interface EffetExterieur {
  caParFut: number; redevanceParFut: number; netParFut: number; ca: number
  tireuseAn: number; coutLivraison: number; livraisonsAn: number; prixPlancherLivraison: number | null
  // Détail d'une livraison (Joseph, 14/11/2026) : indemnités kilométriques, temps passé, facturé, net de l'année
  kmLivraison: number; tempsLivraison: number; livraisonsFacturees: number; netLivraisons: number
  don: { valeur: number; reduction: number; cout: number }
  sponsoring: number; materiel: number; astreinte: number; gobeletsAn: number; recettes: number; recettesNettes: number
  coutFixe: number; gain: number; equilibre: number | null; remiseMax: number | null
  // Compte de résultat du contrat (Joseph, 15/11/2026) : CA − fûts (achat, CO2, gobelets) − redevance et publicité
  // − rétrocession du sponsoring − coûts fixes = gain
  coutFuts: number; redevance: number; retrocession: number
  // Durée du contrat : années sur lesquelles la tireuse est payée, tireuse par an sur sa durée de vie, reste non amorti à la
  // fin du contrat, équilibre si la tireuse ressert après, gain cumulé sur la durée du contrat (null sans durée saisie)
  anneesTireuse: number; tireuseAnDureeVie: number; resteNonAmorti: number; equilibreDureeVie: number | null; gainContrat: number | null
  // Bouteilles de CO2 vendues : CA HT, achat, marge (CA − achat) ; fûts offerts : nombre et coût d'achat
  co2: { ca: number; achat: number; marge: number }; locationsFacturees: number
  futsOfferts: number; coutOfferts: number
  // Geste commercial (remise et fûts offerts) : marge des fûts sans et avec, en euros et en part du CA des fûts sans geste
  // ou avec ; coût du geste sur le gain de l'année (remise après redevance et publicité, fûts offerts au prix d'achat)
  geste: { margeSans: number; margeAvec: number; tauxSans: number | null; tauxAvec: number | null; coutGain: number }
  // Consignes : fûts d'une livraison, avancées sur l'année (fûts et bouteilles), rendues au retour, bloquées au plus fort
  consignes: { futsParLivraison: number; futs: number; bouteilles: number; sorties: number; rentrees: number; bloque: number; avanceClient: number }
}
// Marge d'un fût (Joseph, 14/11/2026) : prix de vente HT − prix d'achat HT, en euros et en part du prix de vente.
// Avant redevance, publicité, CO2 et gobelets, que le net par fût retire ensuite.
export function margeFut(prixVente: number, prixAchat: number): { valeur: number; taux: number | null } {
  const valeur = pos(prixVente) - pos(prixAchat)
  return { valeur, taux: pos(prixVente) > 0 ? valeur / pos(prixVente) : null }
}
const equilibre = (reste: number, net: number) => reste <= 0 ? 0 : net > 0 ? Math.ceil(reste / net - 1e-9) : null
export function simulerExterieur(x: ContratExterieur, p: Redevances, donMecenat: boolean): EffetExterieur {
  const rp = p.tauxRedevance + p.tauxPublicite
  const caParFut = Math.max(0, pos(x.prixVente) - pos(x.remise))
  const redevanceParFut = caParFut * rp
  const netParFut = caParFut - redevanceParFut - pos(x.prixAchat) - pos(x.co2) - pos(x.gobelets) - pos(x.sponsoring?.parFut)
  const nbTireuses = x.tireuses === undefined ? 1 : pos(x.tireuses)
  const vie = pos(x.dureeTireuse), contrat = pos(x.dureeContrat), neuve = x.tireuse === 'neuve'
  const anneesTireuse = contrat > 0 && (vie <= 0 || contrat < vie) ? contrat : vie
  const parAn = (annees: number) => nbTireuses * ((neuve ? (annees > 0 ? pos(x.prixTireuse) / annees : pos(x.prixTireuse)) : 0) + pos(x.entretien))
  const tireuseAn = parAn(anneesTireuse), tireuseAnDureeVie = parAn(vie)
  const resteNonAmorti = neuve && vie > 0 && anneesTireuse < vie ? nbTireuses * pos(x.prixTireuse) * (vie - anneesTireuse) / vie : 0
  const b = x.co2Bouteilles
  const caCo2 = b ? pos(b.vendues) * pos(b.prixTTC) / (1 + pos(b.tva)) : 0
  const co2 = { ca: caCo2, achat: caCo2 * (1 - part(b?.marge)), marge: caCo2 * part(b?.marge) }
  const futsOfferts = pos(x.futsOfferts), coutOfferts = futsOfferts * (pos(x.prixAchat) + pos(x.co2) + pos(x.gobelets))
  const kmLivraison = pos(x.km) * pos(x.prixKm), tempsLivraison = pos(x.heures) * pos(x.coutHoraire)
  const coutLivraison = kmLivraison + tempsLivraison
  const livraisonsAn = pos(x.livraisons) * coutLivraison
  const valeur = x.don.type === 'argent' ? pos(x.don.montant) : x.don.type === 'nature' ? pos(x.don.futs) * pos(x.prixAchat) : 0
  const reduction = donMecenat && x.don.cerfa ? valeur * TAUX_MECENAT : 0
  const don = { valeur, reduction, cout: valeur - reduction }
  const sponsoring = pos(x.sponsoring?.montant), materiel = pos(x.materiel), astreinte = pos(x.astreinte) * pos(x.coutHoraire)
  const gobeletsAn = pos(x.gobeletsContrat?.nombre) * pos(x.gobeletsContrat?.prix)
  const livraisonsFacturees = pos(x.livraisons) * pos(x.prixLivraison)
  // Recettes hors fûts : livraisons facturées, locations de tireuse, CO2 (net de son achat : seule sa marge paie les coûts)
  const recettesBrutes = livraisonsFacturees + pos(x.locations?.nombre) * pos(x.locations?.prix)
  const recettes = recettesBrutes + co2.ca
  const recettesNettes = recettes * (1 - rp) - co2.achat
  const coutFixe = tireuseAn + livraisonsAn + don.cout + sponsoring + materiel + astreinte + gobeletsAn + coutOfferts
  const futs = pos(x.futs)
  const gain = futs * netParFut + recettesNettes - coutFixe
  const reste = coutFixe - recettesNettes
  const prix = pos(x.prixVente), achat = pos(x.prixAchat)
  const margeSans = futs * (prix - achat), margeAvec = futs * (caParFut - achat) - futsOfferts * achat
  const geste = {
    margeSans, margeAvec, tauxSans: futs * prix > 0 ? margeSans / (futs * prix) : null, tauxAvec: futs * caParFut > 0 ? margeAvec / (futs * caParFut) : null,
    coutGain: futs * Math.min(pos(x.remise), prix) * (1 - rp) + coutOfferts,
  }
  const c = x.consignes, livres = futs + futsOfferts, bouteilles = pos(b?.enPlace)
  const futsParLivraison = pos(x.livraisons) > 0 ? Math.ceil(livres / pos(x.livraisons) - 1e-9) : livres
  const sortiesC = livres * pos(c?.fut) + bouteilles * pos(c?.bouteille)
  const consignes = {
    futsParLivraison, futs: livres * pos(c?.fut), bouteilles: bouteilles * pos(c?.bouteille), sorties: sortiesC, rentrees: sortiesC,
    bloque: c?.facturees ? 0 : Math.min(livres, futsParLivraison) * pos(c?.fut) + bouteilles * pos(c?.bouteille),
    avanceClient: c?.facturees ? Math.min(livres, futsParLivraison) * pos(c?.fut) + bouteilles * pos(c?.bouteille) : 0,
  }
  return {
    caParFut, redevanceParFut, netParFut, ca: futs * caParFut + recettes, tireuseAn, coutLivraison, livraisonsAn,
    kmLivraison, tempsLivraison, livraisonsFacturees, netLivraisons: livraisonsFacturees * (1 - rp) - livraisonsAn,
    prixPlancherLivraison: rp < 1 ? coutLivraison / (1 - rp) : null, don, sponsoring, materiel, astreinte, gobeletsAn, recettes, recettesNettes, coutFixe, gain,
    equilibre: equilibre(reste, netParFut),
    remiseMax: futs > 0 && rp < 1 ? Math.max(0, pos(x.remise) + (netParFut - reste / futs) / (1 - rp)) : null,
    coutFuts: futs * (pos(x.prixAchat) + pos(x.co2) + pos(x.gobelets)), redevance: (futs * caParFut + recettes) * rp, retrocession: futs * pos(x.sponsoring?.parFut),
    anneesTireuse, tireuseAnDureeVie, resteNonAmorti,
    equilibreDureeVie: equilibre(reste - (tireuseAn - tireuseAnDureeVie), netParFut),
    gainContrat: contrat > 0 ? gain * contrat : null,
    co2, locationsFacturees: recettesBrutes - livraisonsFacturees, futsOfferts, coutOfferts, geste, consignes,
  }
}
// 239 (Joseph, 16/11/2026, fiche « Rentabilité Extérieur ») : le gain du contrat selon le nombre de fûts vendus, de 20 à
// 70 comme dans la fiche, plus le nombre prévu et le seuil. Gain = fûts × net par fût + recettes nettes − coûts fixes.
export function gainsSelonFuts(r: EffetExterieur, futsPrevus: number): { futs: number; ca: number; gain: number; prevu: boolean; seuil: boolean }[] {
  const liste = [...new Set([20, 30, 40, 50, 60, 70, Math.round(pos(futsPrevus)), ...(r.equilibre ? [r.equilibre] : [])])].filter((f) => f > 0).sort((a, b) => a - b)
  return liste.map((f) => ({
    futs: f, ca: f * r.caParFut + r.recettes, gain: f * r.netParFut + r.recettesNettes - r.coutFixe,
    prevu: f === Math.round(pos(futsPrevus)), seuil: f === r.equilibre,
  }))
}

// 162 · Prix d'une livraison selon la grille du réseau : première ligne dont la distance (aller simple) couvre le trajet ;
// gratuite dès que la commande atteint le franco. Au-delà de la dernière distance : pas de prix (à fixer à la main).
export function prixLivraisonGrille(grille: { kmMax: number; franco: number; prix: number }[], km: number, commandeHT: number): number | null {
  const l = [...grille].sort((a, b) => a.kmMax - b.kmMax).find((g) => pos(km) <= g.kmMax + 1e-9)
  if (!l) return null
  return l.franco > 0 && commandeHT >= l.franco - 1e-9 ? 0 : l.prix
}
// 156 · Préconisation du réseau pour développer l'extérieur : le premier palier dont le CA maximal couvre l'objectif
// (le dernier au-delà). Charges de l'année = heures par semaine × 52 × coût horaire chargé.
export function palierExterieur<T extends { caMax: number }>(paliers: T[], objectif: number): T | null {
  const g = [...paliers].sort((a, b) => a.caMax - b.caMax)
  return g.find((x) => objectif <= x.caMax + 1e-9) ?? g.at(-1) ?? null
}

// ── 139 · Faut-il racheter une tireuse ? ──────────────────────────────────────────────────────────────────────────
// Lecture de la plateforme de location (sorties, refus) : une tireuse fait au plus une sortie par semaine.
// Occupation = sorties ÷ (tireuses × semaines). Marge perdue = refus × fûts par sortie × net par fût. Une tireuse neuve
// coûte chaque année prix ÷ durée de vie + entretien : on rachète si la marge perdue dépasse ce coût ; on remplace une
// vieille tireuse si ses réparations de l'année le dépassent.
// Vague 10 (155, Joseph 14/11/2026) : l'occupation se compte en week-ends (une tireuse sortie un week-end compte pour un
// week-end, quel que soit le nombre de jours). Elle se saisit en part des week-ends loués, en saison et le reste de
// l'année (valeurs du siège, modifiables), ou se déduit des sorties lues dans la plateforme. Trois réponses : fûts et
// week-ends loués par an pour payer une tireuse de plus (coût annuel ÷ net par fût, au fût supérieur, puis ÷ fûts par
// week-end) ; parc saturé quand l'occupation de saison atteint le seuil réglé ; on rachète quand les week-ends refusés
// dépassent ceux qu'il faut pour payer une tireuse (même chose que marge perdue > coût annuel).
export interface ParcTireuses {
  tireuses: number; semainesSaison: number; sortiesSaison: number; sortiesHorsSaison: number
  refus: number; futsParSortie: number; netParFut: number
  prixNeuve: number; dureeVie: number; entretien: number
  vieilles: { nom: string; age: number; reparations: number }[]
  occupation?: { saison: number; hors: number } | null // saisie en part des week-ends (remplace les sorties)
  saturation?: number
  // 236 (Joseph, 16/11/2026, fiche « Rentabilité Extérieur ») : ce que le parc rapporte sur l'année
  prixVenteHT?: number; margeParFut?: number
}
export interface EffetParc {
  occupationSaison: number | null; occupationHorsSaison: number | null; margePerdue: number; coutAnnuelNeuve: number
  racheter: boolean; couverture: number | null; aRemplacer: string[]
  weekendsParTireuse: number; futsPourPayer: number | null; weekendsPourPayer: number | null; sature: boolean
  gainParTireuse: number
  // 236 : fûts, CA HT, marge (prix − achat) et net (après redevance et publicité, CO2, gobelets) du parc sur l'année
  futsParc: number; caParc: number; margeParc: number; netParc: number
}
export function simulerParc(x: ParcTireuses): EffetParc {
  const n = pos(x.tireuses), saison = Math.min(52, pos(x.semainesSaison))
  const capSaison = n * saison, capHors = n * (52 - saison)
  const occupationSaison = x.occupation ? part(x.occupation.saison) : capSaison > 0 ? pos(x.sortiesSaison) / capSaison : null
  const occupationHorsSaison = x.occupation ? part(x.occupation.hors) : capHors > 0 ? pos(x.sortiesHorsSaison) / capHors : null
  const weekendsParTireuse = saison * (occupationSaison ?? 0) + (52 - saison) * (occupationHorsSaison ?? 0)
  const margePerdue = pos(x.refus) * pos(x.futsParSortie) * x.netParFut
  const coutAnnuelNeuve = (x.dureeVie > 0 ? pos(x.prixNeuve) / x.dureeVie : pos(x.prixNeuve)) + pos(x.entretien)
  const futsPourPayer = x.netParFut > 0 && coutAnnuelNeuve > 0 ? Math.ceil(coutAnnuelNeuve / x.netParFut - 1e-9) : null
  const futsParc = n * weekendsParTireuse * pos(x.futsParSortie)
  return {
    occupationSaison, occupationHorsSaison, margePerdue, coutAnnuelNeuve, racheter: margePerdue > coutAnnuelNeuve && coutAnnuelNeuve > 0,
    couverture: coutAnnuelNeuve > 0 ? margePerdue / coutAnnuelNeuve : null,
    aRemplacer: x.vieilles.filter((v) => coutAnnuelNeuve > 0 && pos(v.reparations) > coutAnnuelNeuve).map((v) => v.nom),
    weekendsParTireuse, futsPourPayer, weekendsPourPayer: futsPourPayer !== null && x.futsParSortie > 0 ? Math.ceil(futsPourPayer / x.futsParSortie - 1e-9) : null,
    sature: !!x.saturation && occupationSaison !== null && occupationSaison >= x.saturation - 1e-9,
    gainParTireuse: weekendsParTireuse * pos(x.futsParSortie) * x.netParFut - coutAnnuelNeuve,
    futsParc, caParc: futsParc * pos(x.prixVenteHT), margeParc: futsParc * (x.margeParFut ?? 0), netParc: futsParc * x.netParFut,
  }
}

// ── 142 · Ma carte pression ────────────────────────────────────────────────────────────────────────────────────
// Un fût de L litres perd une part p (mousse, purge) : L × (1 − p) litres servis. Coût du litre servi = prix du fût HT ÷
// litres servis ; demi = 25 cl, pinte = 50 cl. Prix HT = prix TTC ÷ (1 + TVA). Marge du verre = prix HT − coût.
// Le bec se juge sur sa marge, tous formats confondus (CA HT de la semaine − coût des litres vendus) ÷ CA HT (Joseph, 15/11/2026).
// Jours pour vider un fût = litres servis ÷ litres vendus par jour (semaine de 7 jours : la bière vieillit le dimanche
// aussi). Fûts par mois = litres vendus par semaine × 52 ÷ 12 ÷ litres servis.
export const DEMI = 0.25, VERRE33 = 0.33, PINTE = 0.5
// Vague 10 (161) : le verre de 33 cl, facultatif (absent des cartes gardées avant)
export interface Bec { biere: string; prixFut: number; litres: number; perte: number; prixDemi: number; prixPinte: number; demis: number; pintes: number; prix33?: number; verres33?: number }
export interface LigneBec {
  coutLitre: number | null; coutDemi: number | null; coutPinte: number | null; tauxDemi: number | null; tauxPinte: number | null
  caSemaine: number; margeSemaine: number; tauxMarge: number | null; litresSemaine: number
  joursPourVider: number | null; futsParMois: number | null; vieillit: boolean; sousCible: boolean; prixDemiCible: number | null
  // Hausse de tous les prix du bec (demi, 33 cl, pinte) qui amène sa marge, formats confondus, à la cible (Joseph, 15/11/2026)
  hausseCible: number | null
}
export interface CartePression { lignes: LigneBec[]; caSemaine: number; margeSemaine: number; tauxMarge: number | null; futsParMois: number; faible: number | null }
export function ligneBec(b: Bec, tva: number, cible: number, joursFraicheur: number): LigneBec {
  const servis = pos(b.litres) * (1 - part(b.perte))
  const coutLitre = servis > 0 ? pos(b.prixFut) / servis : null
  const ht = (ttc: number) => pos(ttc) / (1 + tva)
  const coutDemi = coutLitre === null ? null : coutLitre * DEMI, coutPinte = coutLitre === null ? null : coutLitre * PINTE
  const taux = (prix: number, cout: number | null) => (cout === null || ht(prix) <= 0 ? null : (ht(prix) - cout) / ht(prix))
  const caSemaine = ht(b.prixDemi) * pos(b.demis) + ht(b.prix33 ?? 0) * pos(b.verres33) + ht(b.prixPinte) * pos(b.pintes)
  const coutSemaine = (coutDemi ?? 0) * pos(b.demis) + (coutLitre ?? 0) * VERRE33 * pos(b.verres33) + (coutPinte ?? 0) * pos(b.pintes)
  const litresSemaine = DEMI * pos(b.demis) + VERRE33 * pos(b.verres33) + PINTE * pos(b.pintes)
  const tauxMarge = caSemaine > 0 ? (caSemaine - coutSemaine) / caSemaine : null
  const joursPourVider = servis > 0 && litresSemaine > 0 ? servis / (litresSemaine / 7) : null
  return {
    coutLitre, coutDemi, coutPinte, tauxDemi: taux(b.prixDemi, coutDemi), tauxPinte: taux(b.prixPinte, coutPinte),
    caSemaine, margeSemaine: caSemaine - coutSemaine, tauxMarge, litresSemaine, joursPourVider,
    futsParMois: servis > 0 ? litresSemaine * 52 / 12 / servis : null,
    vieillit: joursFraicheur > 0 && joursPourVider !== null && joursPourVider > joursFraicheur,
    sousCible: cible > 0 && tauxMarge !== null && tauxMarge < cible - 1e-9,
    // Prix TTC du demi qui donne la marge visée
    prixDemiCible: cible > 0 && cible < 1 && coutDemi !== null ? coutDemi / (1 - cible) * (1 + tva) : null,
    // Prix × k : marge = 1 − coût ÷ (k × CA) ; cible atteinte pour k = (coût ÷ CA) ÷ (1 − cible)
    hausseCible: cible > 0 && cible < 1 && caSemaine > 0 && tauxMarge !== null && tauxMarge < cible - 1e-9 ? (coutSemaine / caSemaine) / (1 - cible) - 1 : null,
  }
}
export function cartePression(becs: Bec[], tva: number, cible: number, joursFraicheur: number): CartePression {
  const lignes = becs.map((b) => ligneBec(b, tva, cible, joursFraicheur))
  const caSemaine = somme(lignes.map((l) => l.caSemaine)), margeSemaine = somme(lignes.map((l) => l.margeSemaine))
  // Le bec à revoir : parmi ceux qui vieillissent ou sont sous la cible, celui qui rapporte le moins par semaine
  const aRevoir = lignes.map((l, i) => ({ l, i })).filter(({ l }) => l.vieillit || l.sousCible)
  const faible = aRevoir.length ? aRevoir.reduce((a, b) => (b.l.margeSemaine < a.l.margeSemaine ? b : a)).i : null
  return { lignes, caSemaine, margeSemaine, tauxMarge: caSemaine > 0 ? margeSemaine / caSemaine : null, futsParMois: somme(lignes.map((l) => l.futsParMois ?? 0)), faible }
}
// Ajouter ou remplacer un bec : le nouveau prend une part c de ses litres aux autres becs (cannibalisation), perdus à la
// marge moyenne par litre des becs qui restent ; un bec remplacé perd toute sa marge. Gain = marge du nouveau − pertes.
// Remboursé en semaines = coût d'installation ÷ gain par semaine.
export interface EffetNouveauBec { margeNouveau: number; perteCannibalisation: number; perteRemplace: number; gainSemaine: number; gainAn: number; semainesRetour: number | null }
export function nouveauBec(becs: Bec[], nouveau: Bec, x: { cout: number; cannibalisation: number; remplace: number | null }, tva: number): EffetNouveauBec {
  const restants = becs.map((b) => ligneBec(b, tva, 0, 0)).filter((_, i) => i !== x.remplace)
  const litres = somme(restants.map((l) => l.litresSemaine))
  const margeParLitre = litres > 0 ? somme(restants.map((l) => l.margeSemaine)) / litres : 0
  const n = ligneBec(nouveau, tva, 0, 0)
  const perteCannibalisation = part(x.cannibalisation) * n.litresSemaine * margeParLitre
  const perteRemplace = x.remplace !== null && becs[x.remplace] ? ligneBec(becs[x.remplace], tva, 0, 0).margeSemaine : 0
  const gainSemaine = n.margeSemaine - perteCannibalisation - perteRemplace
  return { margeNouveau: n.margeSemaine, perteCannibalisation, perteRemplace, gainSemaine, gainAn: gainSemaine * 52, semainesRetour: gainSemaine > 0 ? pos(x.cout) / gainSemaine : null }
}

// 161 · Audit de la perte sur une semaine (fichier « Audit bouteilles et pressions ») : litres sortis du stock (fûts vidés
// × litres) face aux litres vendus (25, 33, 50 cl et 1 L) et offerts. Perte réelle = sortis − vendus − offerts.
// Une part est normale (bière qu'on laisse couler à chaque service, mousse vidée à chaque fût percé, Joseph 14/11/2026) :
// perte standard = sortis × taux standard. Seul l'écart (réelle − standard, jamais négatif) coûte : au prix d'achat
// du litre, et en CA manqué au prix moyen de vente HT du litre vendu (CA HT de la semaine ÷ litres vendus) ; année : × 52.
export interface AuditPression { futs: number; litres: number; prixFut: number; demis: number; verres33: number; pintes: number; litresVendus1L: number; offerts: number; caHT: number; standard: number }
export interface EffetAudit {
  sortis: number; vendus: number; perte: number; taux: number | null; perteStandard: number; ecart: number; tauxEcart: number | null
  coutPerte: number; coutStandard: number; coutSemaine: number; caManqueSemaine: number; coutAn: number; caManqueAn: number
}
export function auditPression(x: AuditPression): EffetAudit {
  const sortis = pos(x.futs) * pos(x.litres)
  const vendus = DEMI * pos(x.demis) + VERRE33 * pos(x.verres33) + PINTE * pos(x.pintes) + pos(x.litresVendus1L)
  const perte = Math.max(0, sortis - vendus - pos(x.offerts))
  const perteStandard = sortis * Math.min(1, pos(x.standard))
  const ecart = Math.max(0, perte - perteStandard)
  const coutLitre = pos(x.litres) > 0 ? pos(x.prixFut) / pos(x.litres) : 0
  const prixLitre = vendus > 0 ? pos(x.caHT) / vendus : 0
  return {
    sortis, vendus, perte, taux: sortis > 0 ? perte / sortis : null, perteStandard, ecart, tauxEcart: sortis > 0 ? ecart / sortis : null,
    coutPerte: perte * coutLitre, coutStandard: perteStandard * coutLitre,
    coutSemaine: ecart * coutLitre, caManqueSemaine: ecart * prixLitre, coutAn: ecart * coutLitre * 52, caManqueAn: ecart * prixLitre * 52,
  }
}

// ── 143 · Calculette prix et marge ────────────────────────────────────────────────────────────────────────────
// Coût HT = somme des composants (coût × quantité). Taux de marge sur le prix de vente HT. Prix HT pour une marge m :
// coût ÷ (1 − m) ; prix TTC = HT × (1 + TVA). Coefficient = prix TTC ÷ coût HT (habitude des fiches prix).
export interface Composant { libelle: string; cout: number; quantite: number }
export interface EffetPrixVente { cout: number; prixHT: number; prixTTC: number; marge: number; tauxMarge: number | null; coefficient: number | null }
export const coutComposition = (l: Composant[]) => somme(l.map((c) => pos(c.cout) * pos(c.quantite)))
export function prixPourMarge(cout: number, tauxMarge: number, tva: number): EffetPrixVente | null {
  if (tauxMarge >= 1) return null
  const prixHT = pos(cout) / (1 - tauxMarge), prixTTC = prixHT * (1 + tva)
  return { cout: pos(cout), prixHT, prixTTC, marge: prixHT - pos(cout), tauxMarge, coefficient: cout > 0 ? prixTTC / cout : null }
}
export function margePourPrix(cout: number, prixTTC: number, tva: number): EffetPrixVente {
  const prixHT = pos(prixTTC) / (1 + tva)
  return { cout: pos(cout), prixHT, prixTTC: pos(prixTTC), marge: prixHT - pos(cout), tauxMarge: prixHT > 0 ? (prixHT - pos(cout)) / prixHT : null, coefficient: cout > 0 ? pos(prixTTC) / cout : null }
}

// ── 144 · Écart de marge au quadrimestre ───────────────────────────────────────────────────────────────────────
// Ce que vaut un point de marge sur le CA de la période, et l'écart (marge réelle − marge de la caisse) en euros.
// Les causes de la grille d'audit de marge se cochent et se gardent en commentaire (ancre « demarque/aaaa/q »).
export const CAUSES_DEMARQUE = [
  { cle: 'offerts', libelle: 'Offerts et dégustations non passés en caisse' },
  { cle: 'casse', libelle: 'Casse' },
  { cle: 'prix', libelle: 'Prix pas à jour en caisse' },
  { cle: 'reception', libelle: 'Erreurs de réception (quantités, prix facturés)' },
  { cle: 'stock', libelle: 'Stock de fin de période pas passé en comptabilité' },
  { cle: 'consignes', libelle: 'Consignes et fûts mal comptés' },
  { cle: 'vol', libelle: 'Vol, démarque inconnue' },
] as const
export type CauseDemarque = (typeof CAUSES_DEMARQUE)[number]['cle']
export interface DiagnosticMarge { unPoint: number; ecartEuros: number; alerte: boolean }
export function diagnosticMarge(ca: number, ecart: number | null, seuil: number): DiagnosticMarge | null {
  if (ecart === null || !(ca > 0)) return null
  return { unPoint: ca * 0.01, ecartEuros: ca * ecart, alerte: ecart < -seuil - 1e-9 }
}
export const ancreDemarque = (annee: number, q: number) => `demarque/${annee}/q${q}`
export const ecrireCausesDemarque = (causes: CauseDemarque[], phrase: string) =>
  `Causes : ${CAUSES_DEMARQUE.filter((c) => causes.includes(c.cle)).map((c) => c.libelle).join(' ; ')}${phrase.trim() ? `. ${phrase.trim()}` : ''}`
export function lireCausesDemarque(texte: string): { causes: CauseDemarque[]; phrase: string } {
  const corps = texte.replace(/^Causes : /, '')
  const causes = CAUSES_DEMARQUE.filter((c) => corps.includes(c.libelle)).map((c) => c.cle)
  const dernier = CAUSES_DEMARQUE.filter((c) => causes.includes(c.cle)).at(-1)
  const fin = dernier ? corps.indexOf(dernier.libelle) + dernier.libelle.length : 0
  return { causes, phrase: corps.slice(fin).replace(/^\.\s*/, '') }
}

// ── 145 · Productivité cible selon la part du bar ─────────────────────────────────────────────────────────────
// Grille du réseau : CA HT par heure visé selon la part du bar dans le CA (plus il y a de bar, plus le service prend du
// temps). Première ligne dont le seuil est atteint, la grille étant triée du seuil le plus haut au plus bas.
// ETP = heures ÷ 1 607 ; ETP cible = CA ÷ cible ÷ 1 607.
export function cibleProductivite(grille: { partBar: number; cible: number }[], partBar: number): number | null {
  const g = [...grille].sort((a, b) => b.partBar - a.partBar)
  return g.find((x) => partBar >= x.partBar - 1e-9)?.cible ?? null
}
export interface ProductiviteCible { partBar: number; cible: number; reelle: number | null; etpReel: number; etpCible: number; heuresCible: number; ecartHeures: number }
export function productiviteCible(ca: number, caBar: number, heures: number, grille: { partBar: number; cible: number }[]): ProductiviteCible | null {
  if (!(ca > 0)) return null
  const partBar = pos(caBar) / ca
  const cible = cibleProductivite(grille, partBar)
  if (!cible) return null
  const heuresCible = ca / cible
  return { partBar, cible, reelle: heures > 0 ? ca / heures : null, etpReel: pos(heures) / HEURES_ETP, etpCible: heuresCible / HEURES_ETP, heuresCible, ecartHeures: pos(heures) - heuresCible }
}
// Le même poste selon le contrat : CDD avec 10 % de prime de fin de contrat (indemnité de précarité, sur le brut, chargée
// comme le salaire) et ses frais fixes (159 : rédaction du contrat et solde de tout compte, bulletin de paie chaque mois) ;
// intérim facturé brut × coefficient de l'agence, mois par mois (l'agence fait contrat et paie).
export function coutContrats(coutCDI: number, brutMensuel: number, mois: number, coefInterim: number, frais: { redaction: number; paieParMois: number } = { redaction: 0, paieParMois: 0 }): { cdi: number; cdd: number; fraisCDD: number; interim: number | null } {
  const fraisCDD = pos(frais.redaction) + pos(frais.paieParMois) * pos(mois)
  return { cdi: coutCDI, cdd: coutCDI * 1.1 + fraisCDD, fraisCDD, interim: coefInterim > 0 ? pos(brutMensuel) * coefInterim * pos(mois) : null }
}

// ── 242 · Heures supplémentaires (fiche « masse salariale » de Joseph, 16/11/2026) ─────────────────────────────────
// Part des heures sup dans les heures payées du mois. Coût = heures sup × coût horaire chargé × (1 + majoration) ; la
// majoration seule est ce qu'un extra payé sans majoration ferait économiser, moins sa paie du mois (frais fixes).
// Seuil : heures sup par mois à partir desquelles un extra coûte moins cher = paie du mois ÷ (coût horaire × majoration).
export interface HeuresSup { part: number | null; coutMois: number; majorationMois: number; coutAn: number; gainExtraMois: number; seuilHeures: number | null }
export function simulerHeuresSup(x: { heures: number; heuresSup: number; coutHoraire: number; majoration: number; paieExtraMois: number }): HeuresSup {
  const sup = pos(x.heuresSup), heure = pos(x.coutHoraire), maj = pos(x.majoration)
  const coutMois = sup * heure * (1 + maj), majorationMois = sup * heure * maj
  return {
    part: pos(x.heures) > 0 ? sup / pos(x.heures) : null, coutMois, majorationMois, coutAn: coutMois * 12,
    gainExtraMois: majorationMois - pos(x.paieExtraMois), seuilHeures: heure * maj > 0 ? pos(x.paieExtraMois) / (heure * maj) : null,
  }
}

// ── 146 · Ouvrir un dimanche ou un jour férié ───────────────────────────────────────────────────────────────────
// CA HT attendu du jour (bar et cave), dont une part aurait été faite un autre jour (report) : seul le reste compte.
// Gain = marge du CA nouveau − redevance et publicité − heures × coût horaire chargé × (1 + majoration) − frais du jour.
// CA du jour pour ne rien perdre, au même mélange bar et cave : coûts ÷ ((1 − report) × (marge moyenne − redevance)).
export interface Ouverture { caBar: number; caCave: number; margeBar: number; margeCave: number; report: number; heures: number; coutHoraire: number; majoration: number; frais: number }
export interface EffetOuverture { ca: number; caNouveau: number; marge: number; redevance: number; personnel: number; frais: number; gain: number; seuil: number | null }
export function simulerOuverture(x: Ouverture, p: Redevances): EffetOuverture {
  const rp = p.tauxRedevance + p.tauxPublicite
  const ca = pos(x.caBar) + pos(x.caCave), garde = 1 - part(x.report)
  const caNouveau = ca * garde
  const marge = (pos(x.caBar) * x.margeBar + pos(x.caCave) * x.margeCave) * garde
  const redevance = caNouveau * rp
  const personnel = pos(x.heures) * pos(x.coutHoraire) * (1 + pos(x.majoration))
  const frais = pos(x.frais)
  const tauxMoyen = ca > 0 ? (pos(x.caBar) * x.margeBar + pos(x.caCave) * x.margeCave) / ca : (x.margeBar + x.margeCave) / 2
  const unitaire = garde * (tauxMoyen - rp)
  return { ca, caNouveau, marge, redevance, personnel, frais, gain: marge - redevance - personnel - frais, seuil: unitaire > 0 ? (personnel + frais) / unitaire : null }
}

// ── 147 · Plan de redressement d'un magasin qui décroche ──────────────────────────────────────────────────────
// Les dix causes de la « Caisse à outils magasins en difficultés » et ses leviers. La grille du fichier n'était pas
// remplie : liens proposés par défaut, à corriger par le Directeur.
export const CAUSES_DIFFICULTE = [
  { cle: 'concurrence', libelle: 'Concurrence' },
  { cle: 'lancement', libelle: 'Lancement difficile' },
  { cle: 'charges', libelle: 'Poids des charges' },
  { cle: 'franchise', libelle: 'Compétences, état d’esprit du franchisé' },
  { cle: 'implication', libelle: 'Gestion de plusieurs magasins, implication' },
  { cle: 'vente', libelle: 'Magasin en vente' },
  { cle: 'perso', libelle: 'Difficultés personnelles' },
  { cle: 'gestion', libelle: 'Problème de gestion' },
  { cle: 'emplacement', libelle: 'Emplacement, bâtiment' },
  { cle: 'image', libelle: 'Risque pour l’image de marque' },
] as const
export type CauseDifficulte = (typeof CAUSES_DIFFICULTE)[number]['cle']
export const LEVIERS_REDRESSEMENT = [
  { cle: 'preco', theme: 'Stock', libelle: 'Préconisation de commande et montant maximum de commande' },
  { cle: 'inventaire', theme: 'Stock', libelle: 'Inventaires réguliers ou tournants' },
  { cle: 'consignes', theme: 'Stock', libelle: 'Gestion des consignes' },
  { cle: 'tresorerie', theme: 'Trésorerie', libelle: 'Plan de trésorerie suivi chaque mois' },
  { cle: 'bilan', theme: 'Trésorerie', libelle: 'Lire le dernier bilan avec le franchisé' },
  { cle: 'marge', theme: 'Trésorerie', libelle: 'Diagnostic du défaut de marge' },
  { cle: 'masse', theme: 'Trésorerie', libelle: 'Vérifier la masse salariale et la productivité' },
  { cle: 'seuil', theme: 'Trésorerie', libelle: 'Calculer le point mort et refaire le prévisionnel' },
  { cle: 'prix', theme: 'Trésorerie', libelle: 'Vérifier que les prix sont à jour' },
  { cle: 'echeancier', theme: 'Trésorerie', libelle: 'Étaler les charges, échéancier avec les fournisseurs' },
  { cle: 'loyer', theme: 'Trésorerie', libelle: 'Revoir loyer, charges et taxe foncière' },
  { cle: 'academy', theme: 'Formation', libelle: 'Test et formation V and B Academy pour l’équipe' },
  { cle: 'gamme', theme: 'Formation', libelle: 'Maîtrise de la gamme du magasin' },
  { cle: 'expert', theme: 'Formation', libelle: 'Accompagnement par un expert du réseau' },
  { cle: 'reseaux', theme: 'Flux', libelle: 'Relance sur les réseaux sociaux' },
  { cle: 'communication', theme: 'Flux', libelle: 'Plan de communication personnalisé' },
  { cle: 'entreprises', theme: 'Flux', libelle: 'Prospection des entreprises (comités d’entreprise)' },
  { cle: 'ancrage', theme: 'Flux', libelle: 'Ancrage local : apéro des voisins, associations' },
  { cle: 'animations', theme: 'Flux', libelle: 'Animations, masterclass, dégustations' },
  { cle: 'coachPro', theme: 'Humain', libelle: 'Proposer un coach professionnel' },
  { cle: 'direction', theme: 'Humain', libelle: 'Rendez-vous avec la direction' },
  { cle: 'relanceCave', theme: 'CA', libelle: 'Plan de relance de la cave' },
  { cle: 'local', theme: 'CA', libelle: 'État des lieux du local (travaux, emplacement)' },
  { cle: 'etudeConcurrence', theme: 'CA', libelle: 'Étude de la concurrence' },
] as const
export type LevierRedressement = (typeof LEVIERS_REDRESSEMENT)[number]['cle']
export const GRILLE_REDRESSEMENT: Record<CauseDifficulte, LevierRedressement[]> = {
  concurrence: ['etudeConcurrence', 'prix', 'animations', 'reseaux', 'relanceCave'],
  lancement: ['communication', 'ancrage', 'entreprises', 'tresorerie', 'seuil'],
  charges: ['masse', 'loyer', 'echeancier', 'seuil', 'tresorerie'],
  franchise: ['academy', 'gamme', 'expert', 'coachPro'],
  implication: ['direction', 'coachPro', 'masse'],
  vente: ['direction', 'bilan'],
  perso: ['coachPro', 'direction'],
  gestion: ['preco', 'inventaire', 'consignes', 'marge', 'tresorerie', 'bilan'],
  emplacement: ['local', 'communication', 'ancrage'],
  image: ['academy', 'prix', 'direction'],
}
// Leviers proposés pour les causes cochées, dans l'ordre de la liste, sans doublon
export function leviersPour(causes: CauseDifficulte[]): (typeof LEVIERS_REDRESSEMENT)[number][] {
  const cles = new Set(causes.flatMap((c) => GRILLE_REDRESSEMENT[c] ?? []))
  return LEVIERS_REDRESSEMENT.filter((l) => cles.has(l.cle))
}

// ── 228 · Remises entreprise par paliers (fichier « Simulateur remises B2B » de Joseph, 16/11/2026) ─────────────
// Une commande d'entreprise (comité d'entreprise, mariage, cadeaux) : le palier se lit sur le nombre total d'unités
// (1 bouteille = 1 unité, 1 bourriche = 1 unité) et sa remise s'applique à toute la commande. Prix public TTC ramené en
// HT (vente facturée en HT), prix d'achat HT accises comprises. Taux de marge sur le prix de vente HT remisé.
// Ajout au fichier : redevance et publicité retirées du CA HT remisé (ce qu'il reste au magasin).
// Creux : en passant un seuil, la marge totale peut retomber sous celle du haut du palier précédent ; on donne jusqu'à
// combien d'unités (au même mélange de produits) : margeRetrouveeA = première quantité qui rend au moins autant.
export interface PalierRemise { min: number; remise: number }
// Par famille, on saisit un taux de marge sur le prix de vente HT avant remise (Joseph, 16/11/2026) : achat = prix HT × (1 − taux).
// Produit par produit, on garde le prix d'achat réel. Une famille gardée avant ce choix (achat seul) se lit comme avant.
export interface LigneB2B { libelle: string; quantite: number; prixTTC: number; achatHT: number; taux?: number }
// Achat et marge unitaires HT d'une ligne, avant remise
export function unitaireB2B(l: LigneB2B, tva: number): { prixHT: number; achatHT: number; marge: number; taux: number | null } {
  const prixHT = pos(l.prixTTC) / (1 + pos(tva))
  const achatHT = l.taux === undefined || !Number.isFinite(l.taux) ? pos(l.achatHT) : prixHT * (1 - Math.min(1, l.taux))
  return { prixHT, achatHT, marge: prixHT - achatHT, taux: prixHT > 0 ? (prixHT - achatHT) / prixHT : null }
}
export type AlerteB2B = 'perte' | 'plancher' | 'ok'
export interface LigneB2BCalculee {
  libelle: string; quantite: number; prixHT: number; caBrut: number; caNet: number; marge: number; taux: number | null; alerte: AlerteB2B | null
  remiseMax: number | null // remise la plus forte qui garde le plancher, pour ce produit
}
export interface PalierCalcule { min: number; max: number | null; remise: number; margeUnite: number | null; taux: number | null; alerte: AlerteB2B | null; margeRetrouveeA: number | null }
export interface EffetRemisesB2B {
  unites: number; palier: number; remise: number
  caBrut: number; cout: number; caNet: number; margeSansRemise: number; marge: number; taux: number | null; margeCedee: number
  redevance: number; reste: number
  lignes: LigneB2BCalculee[]; paliers: PalierCalcule[]
  suivant: { index: number; manque: number; remise: number } | null
  alertes: number // lignes à perte ou sous le plancher
}
const alerteDe = (marge: number, taux: number | null, plancher: number): AlerteB2B | null =>
  taux === null ? null : marge < 0 ? 'perte' : taux < plancher ? 'plancher' : 'ok'
// Paliers rangés par quantité minimale croissante, le premier ramené à 0
export function paliersRanges(paliers: PalierRemise[]): PalierRemise[] {
  const l = [...paliers].map((x) => ({ min: Math.round(pos(x.min)), remise: part(x.remise) })).sort((a, b) => a.min - b.min)
  if (!l.length) return [{ min: 0, remise: 0 }]
  l[0] = { ...l[0], min: 0 }
  return l
}
export function simulerRemisesB2B(x: { paliers: PalierRemise[]; lignes: LigneB2B[]; tva: number; plancher: number }, p: Redevances): EffetRemisesB2B {
  const rp = p.tauxRedevance + p.tauxPublicite
  const plancher = part(x.plancher)
  const paliers = paliersRanges(x.paliers)
  const lignesSaisies = x.lignes.map((l) => ({ libelle: l.libelle, quantite: Math.round(pos(l.quantite)), ...unitaireB2B(l, x.tva) }))
  const unites = somme(lignesSaisies.map((l) => l.quantite))
  let palier = 0
  paliers.forEach((y, i) => { if (unites >= y.min) palier = i })
  const remise = paliers[palier].remise
  const lignes: LigneB2BCalculee[] = lignesSaisies.map((l) => {
    const caBrut = l.quantite * l.prixHT, caNet = caBrut * (1 - remise), marge = caNet - l.quantite * l.achatHT
    const taux = caNet > 0 ? marge / caNet : null
    return {
      libelle: l.libelle, quantite: l.quantite, prixHT: l.prixHT, caBrut, caNet, marge, taux, alerte: alerteDe(marge, taux, plancher),
      remiseMax: l.prixHT > 0 && plancher < 1 ? Math.max(0, 1 - l.achatHT / (l.prixHT * (1 - plancher))) : null,
    }
  })
  const caBrut = somme(lignes.map((l) => l.caBrut)), cout = somme(lignesSaisies.map((l) => l.quantite * l.achatHT))
  const caNet = caBrut * (1 - remise), marge = caNet - cout
  const redevance = caNet * rp
  // Par palier, au mélange de la commande : prix et achat moyens par unité
  const pvMoy = unites > 0 ? caBrut / unites : null, paMoy = unites > 0 ? cout / unites : null
  const calcules: PalierCalcule[] = paliers.map((y, i) => {
    const max = i + 1 < paliers.length ? paliers[i + 1].min - 1 : null
    if (pvMoy === null || paMoy === null) return { min: y.min, max, remise: y.remise, margeUnite: null, taux: null, alerte: null, margeRetrouveeA: null }
    const vente = pvMoy * (1 - y.remise), margeUnite = vente - paMoy
    const taux = vente > 0 ? margeUnite / vente : null
    return { min: y.min, max, remise: y.remise, margeUnite, taux, alerte: alerteDe(margeUnite, taux, plancher), margeRetrouveeA: null }
  })
  for (let i = 1; i < calcules.length; i++) {
    const avant = calcules[i - 1], c = calcules[i]
    if (avant.margeUnite === null || c.margeUnite === null || c.margeUnite <= 0 || avant.max === null || avant.margeUnite <= 0) continue
    const egal = Math.ceil(avant.max * avant.margeUnite / c.margeUnite - 1e-9)
    if (egal > c.min) c.margeRetrouveeA = egal
  }
  const suivant = palier + 1 < paliers.length ? { index: palier + 1, manque: paliers[palier + 1].min - unites, remise: paliers[palier + 1].remise } : null
  return {
    unites, palier, remise, caBrut, cout, caNet, margeSansRemise: caBrut - cout, marge, taux: caNet > 0 ? marge / caNet : null, margeCedee: caBrut - caNet,
    redevance, reste: marge - redevance, lignes, paliers: calcules, suivant,
    alertes: lignes.filter((l) => l.quantite > 0 && (l.alerte === 'perte' || l.alerte === 'plancher')).length,
  }
}

// ── Remises entreprise au bar (Joseph, 17/11/2026) ─────────────────────────────────────────────────────────────
// Les salariés d'une société viennent au bar. On part de leurs venues habituelles, sans remise (aujourd'hui). Chaque
// palier est une remise en euros TTC par produit (choix conseillé) ou par panier ; le simulateur dit combien de venues
// de plus il faut pour garder la même masse de marge (Joseph, 17/11/2026 : « si je mets −0,50 € par produit, il faut
// combien de venues supplémentaires pour le compenser »). Le palier s'ouvre donc à habituelles + venues en plus.
// C'est théorique : on espère plus de venues, rien ne les garantit. Une fois le palier atteint, la remise vaut pour
// toutes les venues, habituelles comprises.
// Loi Évin (code de la santé publique, article L3322-9) : une remise sur l'alcool doit aussi porter sur les boissons
// sans alcool ; par prudence la remise porte sur tout le panier (food, softs, alcool), jamais sur l'alcool seul.
// Un panier type d'une venue : par nature, produits par venue, prix TTC moyen, % de marge sur le prix HT avant remise,
// TVA de la nature (10 % food et softs sur place, 20 % alcool). Remise par produit : chaque produit perd la remise TTC,
// ramenée en HT à sa TVA, sans descendre sous 0. Par panier : la remise TTC se répartit au prorata du TTC, donc
// HT = remise × CA HT ÷ CA TTC. Masse de marge = CA HT remisé − achats HT.
// Venues pour compenser = habituelles × marge d'une venue sans remise ÷ marge d'une venue remisée, à la venue
// supérieure ; venues en plus = ce nombre − habituelles.
export type NatureBar = 'food' | 'soft' | 'alcool'
export interface LigneBar { libelle: string; nature: NatureBar; parVenue: number; prixTTC: number; taux: number }
export interface PalierBar { remise: number } // remise en euros TTC
export interface PalierBarCalcule {
  remise: number; remiseHT: number; margeVenue: number; taux: number | null; alerte: AlerteB2B | null
  enPlus: number | null // venues de plus pour garder la masse de marge ; null : une venue remisée ne rapporte plus rien
  venues: number | null // habituelles + venues en plus : le palier s'ouvre là
  hausse: number | null // venues en plus ÷ habituelles
  marge: number | null // masse de marge de la période à ce nombre de venues
}
export interface LigneBarCalculee { libelle: string; nature: NatureBar; parVenue: number; prixHT: number; margeAvant: number; margeApres: number; taux: number | null; alerte: AlerteB2B | null; remiseMax: number | null }
export interface EffetRemisesBar {
  habituelles: number; parAn: number
  produits: number; caTTC: number; caHT: number; achat: number // par venue, avant remise
  margeVenue: number; taux: number | null; marge: number // aujourd'hui : par venue, taux, masse de la période
  paliers: PalierBarCalcule[] // rangés par remise croissante
  remiseForte: number // remise du palier le plus fort, pour le détail du panier
  evin: boolean
  lignes: LigneBarCalculee[]
}
export function paliersBarRanges(paliers: PalierBar[]): PalierBar[] {
  return [...paliers].map((x) => ({ remise: pos(x.remise) })).sort((a, b) => a.remise - b.remise)
}
export function simulerRemisesBar(
  x: { paliers: PalierBar[]; lignes: LigneBar[]; habituelles: number; periode: 'semaine' | 'mois'; base: 'produit' | 'panier'; plancher: number; tva: Record<NatureBar, number> },
): EffetRemisesBar {
  const plancher = part(x.plancher)
  const paliers = paliersBarRanges(x.paliers)
  const habituelles = Math.round(pos(x.habituelles))
  const parAn = x.periode === 'semaine' ? 52 : 12
  const saisies = x.lignes.map((l) => {
    const tva = pos(x.tva[l.nature]), prixTTC = pos(l.prixTTC), prixHT = prixTTC / (1 + tva)
    return { libelle: l.libelle, nature: l.nature, parVenue: pos(l.parVenue), tva, prixTTC, prixHT, achat: prixHT * (1 - part(l.taux)) }
  })
  const produits = somme(saisies.map((l) => l.parVenue))
  const caTTC = somme(saisies.map((l) => l.parVenue * l.prixTTC)), caHT = somme(saisies.map((l) => l.parVenue * l.prixHT))
  const achat = somme(saisies.map((l) => l.parVenue * l.achat))
  // Remise HT d'une venue pour une remise TTC donnée
  const remiseHTDe = (r: number) => x.base === 'produit'
    ? somme(saisies.map((l) => l.parVenue * Math.min(r, l.prixTTC) / (1 + l.tva)))
    : caTTC > 0 ? Math.min(r, caTTC) * caHT / caTTC : 0
  const margeSans = caHT - achat
  const masse = habituelles * margeSans
  const calcules: PalierBarCalcule[] = paliers.map((y) => {
    const remiseHT = remiseHTDe(y.remise), net = caHT - remiseHT, margeVenue = net - achat
    const taux = net > 0 ? margeVenue / net : null
    const alerte = produits > 0 ? alerteDe(margeVenue, taux, plancher) : null
    const venues = margeVenue > 0 ? Math.max(habituelles, Math.ceil(masse / margeVenue - 1e-9)) : null
    const enPlus = venues === null ? null : venues - habituelles
    return {
      remise: y.remise, remiseHT, margeVenue, taux, alerte, enPlus, venues,
      hausse: enPlus === null || habituelles === 0 ? null : enPlus / habituelles, marge: venues === null ? null : venues * margeVenue,
    }
  })
  const remiseForte = Math.max(0, ...paliers.map((y) => y.remise))
  // Par produit : marge d'un produit avant et après la remise la plus forte, remise maximale TTC qui garde le plancher
  const lignes: LigneBarCalculee[] = saisies.map((l) => {
    const remiseLigneHT = x.base === 'produit' ? Math.min(remiseForte, l.prixTTC) / (1 + l.tva) : (caTTC > 0 ? Math.min(remiseForte, caTTC) / caTTC : 0) * l.prixHT
    const net = l.prixHT - remiseLigneHT, margeApres = net - l.achat, taux = net > 0 ? margeApres / net : null
    const remiseMax = l.prixHT > 0 && plancher < 1 ? Math.max(0, (l.prixHT - l.achat / (1 - plancher)) * (1 + l.tva)) : null
    return { libelle: l.libelle, nature: l.nature, parVenue: l.parVenue, prixHT: l.prixHT, margeAvant: l.prixHT - l.achat, margeApres, taux, alerte: l.parVenue > 0 ? alerteDe(margeApres, taux, plancher) : null, remiseMax }
  })
  const alcool = saisies.some((l) => l.nature === 'alcool' && l.parVenue > 0)
  const sansAlcool = saisies.some((l) => l.nature !== 'alcool' && l.parVenue > 0)
  return {
    habituelles, parAn, produits, caTTC, caHT, achat, margeVenue: margeSans, taux: caHT > 0 ? margeSans / caHT : null, marge: masse,
    paliers: calcules, remiseForte, evin: !(alcool && !sansAlcool && remiseForte > 0), lignes,
  }
}

// 238 (Joseph, 16/11/2026, fiche « Rentabilité Extérieur », cible entreprise) : démarcher des entreprises (cadeaux
// clients) pendant un test. Temps = heures par semaine × semaines × coût d'une heure chargée. Marge attendue =
// entreprises × ticket moyen HT × (marge − redevance et publicité). Seuil = entreprises qu'il faut pour payer le temps.
export interface EffetProspection { heures: number; coutTemps: number; ca: number; marge: number; redevance: number; gain: number; seuil: number | null }
export function simulerProspection(x: { heuresSemaine: number; semaines: number; coutHoraire: number; entreprises: number; ticket: number; marge: number }, p: Redevances): EffetProspection {
  const rp = p.tauxRedevance + p.tauxPublicite
  const heures = pos(x.heuresSemaine) * pos(x.semaines), coutTemps = heures * pos(x.coutHoraire)
  const ca = pos(x.entreprises) * pos(x.ticket), marge = ca * part(x.marge), redevance = ca * rp
  const parEntreprise = pos(x.ticket) * (part(x.marge) - rp)
  return { heures, coutTemps, ca, marge, redevance, gain: marge - redevance - coutTemps, seuil: coutTemps <= 0 ? 0 : parEntreprise > 0 ? Math.ceil(coutTemps / parEntreprise - 1e-9) : null }
}

// ── 291 · Mon loyer (Joseph, 18/11/2026) ─────────────────────────────────────────────────────────────────────────
// Poids du loyer (et des charges locatives) dans le CA HT, effet d'une hausse annoncée ou d'une renégociation sur
// l'EBE, cumul sur les années qui restent au bail, CA HT à vendre en plus pour absorber la hausse (marge − redevance
// et publicité), loyer supportable au repère du siège (part du CA, 0 : pas de repère).
export interface Loyer { ca: number; tauxMarge: number; ebe: number; loyer: number; charges: number; nouveauLoyer: number; annees: number; repere: number }
export interface EffetLoyer {
  avant: { immobilier: number; part: number | null; ebe: number }
  apres: { immobilier: number; part: number | null; ebe: number }
  ecartAn: number; ecartMois: number; cumul: number
  caPourAbsorber: number | null   // null : marge sous la redevance, ou baisse du loyer
  supportable: number | null      // loyer (hors charges) au repère du siège
}
export function simulerLoyer(x: Loyer, p: Redevances): EffetLoyer {
  const ca = pos(x.ca), charges = pos(x.charges)
  const avant = pos(x.loyer) + charges, apres = pos(x.nouveauLoyer) + charges
  const ecartAn = pos(x.nouveauLoyer) - pos(x.loyer)
  const unitaire = part(x.tauxMarge) - p.tauxRedevance - p.tauxPublicite
  return {
    avant: { immobilier: avant, part: ca > 0 ? avant / ca : null, ebe: x.ebe },
    apres: { immobilier: apres, part: ca > 0 ? apres / ca : null, ebe: x.ebe - ecartAn },
    ecartAn, ecartMois: ecartAn / 12, cumul: ecartAn * pos(x.annees),
    caPourAbsorber: ecartAn > 0 && unitaire > 0 ? ecartAn / unitaire : null,
    supportable: part(x.repere) > 0 && ca > 0 ? Math.max(0, part(x.repere) * ca - charges) : null,
  }
}

// ── 292 · Mix Cave / Bar (Joseph, 18/11/2026) ────────────────────────────────────────────────────────────────────
// Une part du CA HT passe de la cave au bar (ou l'inverse), CA total égal : la marge suit le taux de chaque univers ;
// le bar demande plus d'heures, saisies ou lues dans la grille de productivité du siège (CA par heure selon la part du
// bar). Redevance et publicité inchangées (même CA). EBE = marge en plus − heures en plus.
export interface MixCaveBar { caCave: number; caBar: number; margeCave: number; margeBar: number; part: number; sens: 'vers_bar' | 'vers_cave'; heuresSemaine: number | null; coutHoraire: number; grille: { partBar: number; cible: number }[] }
export interface EtatMix { caCave: number; caBar: number; partBar: number | null; marge: number; tauxMarge: number | null; cible: number | null; heuresVisees: number | null }
export interface EffetMix { avant: EtatMix; apres: EtatMix; deplace: number; ecartMarge: number; heuresSemaine: number; heuresGrille: number | null; personnel: number; ecartEbe: number }
export function simulerMix(x: MixCaveBar): EffetMix {
  const caCave = pos(x.caCave), caBar = pos(x.caBar), ca = caCave + caBar
  const deplace = Math.min(ca * part(x.part), x.sens === 'vers_bar' ? caCave : caBar)
  const etat = (cave: number, bar: number): EtatMix => {
    const marge = cave * part(x.margeCave) + bar * part(x.margeBar)
    const partBar = ca > 0 ? bar / ca : null
    const cible = partBar !== null && x.grille.length ? cibleProductivite(x.grille, partBar) : null
    return { caCave: cave, caBar: bar, partBar, marge, tauxMarge: ca > 0 ? marge / ca : null, cible, heuresVisees: cible ? ca / cible : null }
  }
  const avant = etat(caCave, caBar)
  const apres = x.sens === 'vers_bar' ? etat(caCave - deplace, caBar + deplace) : etat(caCave + deplace, caBar - deplace)
  const heuresGrille = avant.heuresVisees !== null && apres.heuresVisees !== null ? (apres.heuresVisees - avant.heuresVisees) / 52 : null
  const heuresSemaine = x.heuresSemaine ?? heuresGrille ?? 0
  const personnel = heuresSemaine * 52 * pos(x.coutHoraire)
  const ecartMarge = apres.marge - avant.marge
  return { avant, apres, deplace, ecartMarge, heuresSemaine, heuresGrille, personnel, ecartEbe: ecartMarge - personnel }
}

// ── Prix du fût d'un gros marché extérieur (Joseph, 20/11/2026) ───────────────────────────────────────────────────
// « Pour des gros marchés extérieurs, tous les coûts annexes (livraison, PLV, stand, entretien des tireuses, achats
// annexes, achat de tireuses…) doivent être compris dans le prix au fût, pour compenser tous les achats et le billet
// d'entrée en don ou sponsoring. » On part des coûts et de la marge souhaitée, et on en tire le prix du fût HT.
// Coûts fixes du marché C = coûts annexes (tout le montant sur ce marché, achat de tireuses compris) + coût réel du billet
// d'entrée (don avec reçu Cerfa : 60 % reviennent en réduction d'impôt ; sponsoring : charge pleine). Par fût : achat A.
// Redevance et publicité rp sur le CA HT. Masse de marge = CA HT − redevance et publicité − achats − C (ce qui reste au
// magasin une fois tout payé). Marge souhaitée :
//   en part du CA HT t : P = (A + C ÷ N) ÷ (1 − rp − t) ; impossible si t ≥ 1 − rp
//   en euros au total M (ou par fût m, M = m × N) : P = (A + (C + M) ÷ N) ÷ (1 − rp)
// Prix plancher (masse nulle) = (A + C ÷ N) ÷ (1 − rp). Au prix trouvé, le net par fût = P × (1 − rp) − A ; équilibre =
// C ÷ net, au fût supérieur : sous ce nombre de fûts vendus, le marché perd de l'argent (les coûts ne baissent pas).
export interface MarcheGros {
  futs: number; prixAchat: number
  couts: { libelle: string; montant: number }[]
  billet: { type: 'aucun' | 'don' | 'sponsoring'; montant: number; cerfa: boolean }
  marge: { mode: 'taux' | 'parFut' | 'total'; valeur: number }
  tva: number
}
export interface EffetMarcheGros {
  annexes: number; billet: { valeur: number; reduction: number; cout: number }; coutsFixes: number
  prixHT: number | null; prixTTC: number | null; prixPlancher: number | null
  ca: number; achats: number; redevance: number; masseMarge: number; tauxMasse: number | null
  margeFut: number | null; tauxMargeFut: number | null                  // prix − achat, en part du prix (marge « habituelle »)
  parFut: { achat: number; annexes: number; billet: number; redevance: number; marge: number } | null
  netParFut: number | null; equilibre: number | null
}
export function prixFutMarche(x: MarcheGros, p: Redevances): EffetMarcheGros {
  const rp = p.tauxRedevance + p.tauxPublicite
  const n = pos(x.futs), achat = pos(x.prixAchat)
  const annexes = somme(x.couts.map((c) => pos(c.montant)))
  const valeur = x.billet.type === 'aucun' ? 0 : pos(x.billet.montant)
  const reduction = x.billet.type === 'don' && x.billet.cerfa ? valeur * TAUX_MECENAT : 0
  const billet = { valeur, reduction, cout: valeur - reduction }
  const coutsFixes = annexes + billet.cout
  const visee = x.marge.mode === 'taux' ? null : x.marge.mode === 'parFut' ? pos(x.marge.valeur) * n : pos(x.marge.valeur)
  const diviseur = x.marge.mode === 'taux' ? 1 - rp - part(x.marge.valeur) : 1 - rp
  const prixHT = n > 0 && diviseur > 0 ? (achat + (coutsFixes + (visee ?? 0)) / n) / diviseur : null
  const prixPlancher = n > 0 && rp < 1 ? (achat + coutsFixes / n) / (1 - rp) : null
  const ca = prixHT === null ? 0 : prixHT * n
  const achats = achat * n, redevance = ca * rp
  const masseMarge = prixHT === null ? 0 : ca - redevance - achats - coutsFixes
  const netParFut = prixHT === null ? null : prixHT * (1 - rp) - achat
  return {
    annexes, billet, coutsFixes, prixHT, prixTTC: prixHT === null ? null : prixHT * (1 + pos(x.tva)), prixPlancher,
    ca, achats, redevance, masseMarge, tauxMasse: ca > 0 ? masseMarge / ca : null,
    margeFut: prixHT === null ? null : prixHT - achat, tauxMargeFut: prixHT ? (prixHT - achat) / prixHT : null,
    parFut: prixHT === null ? null : { achat, annexes: annexes / n, billet: billet.cout / n, redevance: prixHT * rp, marge: masseMarge / n },
    netParFut, equilibre: netParFut === null ? null : equilibre(coutsFixes, netParFut),
  }
}
// Le risque du gros marché : les coûts sont fixes, le prix les répartit sur les fûts prévus. Masse de marge au prix trouvé
// si l'on vend la moitié, les trois quarts, tous les fûts prévus ou 20 % de plus, et au seuil d'équilibre.
export function masseSelonFuts(r: EffetMarcheGros, futsPrevus: number): { futs: number; ca: number; masse: number; prevu: boolean; seuil: boolean }[] {
  if (r.prixHT === null || r.netParFut === null) return []
  const n = Math.round(pos(futsPrevus))
  const liste = [...new Set([Math.round(n * 0.5), Math.round(n * 0.75), n, Math.round(n * 1.2), ...(r.equilibre ? [r.equilibre] : [])])].filter((f) => f > 0).sort((a, b) => a - b)
  return liste.map((f) => ({ futs: f, ca: f * r.prixHT!, masse: f * r.netParFut! - r.coutsFixes, prevu: f === n, seuil: f === r.equilibre }))
}
