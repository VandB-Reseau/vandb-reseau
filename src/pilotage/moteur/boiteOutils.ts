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
export interface ContratExterieur {
  futs: number; prixVente: number; remise: number; prixAchat: number; co2: number; gobelets: number
  tireuse: 'neuve' | 'parc'; prixTireuse: number; dureeTireuse: number; entretien: number
  livraisons: number; km: number; prixKm: number; heures: number; coutHoraire: number
  don: { type: 'aucun' | 'argent' | 'nature'; montant: number; futs: number; cerfa: boolean }
}
export interface EffetExterieur {
  caParFut: number; redevanceParFut: number; netParFut: number; ca: number
  tireuseAn: number; coutLivraison: number; livraisonsAn: number; prixPlancherLivraison: number | null
  don: { valeur: number; reduction: number; cout: number }
  coutFixe: number; gain: number; equilibre: number | null; remiseMax: number | null
}
export function simulerExterieur(x: ContratExterieur, p: Redevances, donMecenat: boolean): EffetExterieur {
  const rp = p.tauxRedevance + p.tauxPublicite
  const caParFut = Math.max(0, pos(x.prixVente) - pos(x.remise))
  const redevanceParFut = caParFut * rp
  const netParFut = caParFut - redevanceParFut - pos(x.prixAchat) - pos(x.co2) - pos(x.gobelets)
  const tireuseAn = (x.tireuse === 'neuve' ? (x.dureeTireuse > 0 ? pos(x.prixTireuse) / x.dureeTireuse : pos(x.prixTireuse)) : 0) + pos(x.entretien)
  const coutLivraison = pos(x.km) * pos(x.prixKm) + pos(x.heures) * pos(x.coutHoraire)
  const livraisonsAn = pos(x.livraisons) * coutLivraison
  const valeur = x.don.type === 'argent' ? pos(x.don.montant) : x.don.type === 'nature' ? pos(x.don.futs) * pos(x.prixAchat) : 0
  const reduction = donMecenat && x.don.cerfa ? valeur * TAUX_MECENAT : 0
  const don = { valeur, reduction, cout: valeur - reduction }
  const coutFixe = tireuseAn + livraisonsAn + don.cout
  const futs = pos(x.futs)
  const gain = futs * netParFut - coutFixe
  return {
    caParFut, redevanceParFut, netParFut, ca: futs * caParFut, tireuseAn, coutLivraison, livraisonsAn,
    prixPlancherLivraison: rp < 1 ? coutLivraison / (1 - rp) : null, don, coutFixe, gain,
    equilibre: netParFut > 0 ? Math.ceil(coutFixe / netParFut - 1e-9) : null,
    remiseMax: futs > 0 && rp < 1 ? Math.max(0, pos(x.remise) + (netParFut - coutFixe / futs) / (1 - rp)) : null,
  }
}

// ── 139 · Faut-il racheter une tireuse ? ──────────────────────────────────────────────────────────────────────────
// Lecture de la plateforme de location (sorties, refus) : une tireuse fait au plus une sortie par semaine.
// Occupation = sorties ÷ (tireuses × semaines). Marge perdue = refus × fûts par sortie × net par fût. Une tireuse neuve
// coûte chaque année prix ÷ durée de vie + entretien : on rachète si la marge perdue dépasse ce coût ; on remplace une
// vieille tireuse si ses réparations de l'année le dépassent.
export interface ParcTireuses {
  tireuses: number; semainesSaison: number; sortiesSaison: number; sortiesHorsSaison: number
  refus: number; futsParSortie: number; netParFut: number
  prixNeuve: number; dureeVie: number; entretien: number
  vieilles: { nom: string; age: number; reparations: number }[]
}
export interface EffetParc {
  occupationSaison: number | null; occupationHorsSaison: number | null; margePerdue: number; coutAnnuelNeuve: number
  racheter: boolean; couverture: number | null; aRemplacer: string[]
}
export function simulerParc(x: ParcTireuses): EffetParc {
  const n = pos(x.tireuses), saison = Math.min(52, pos(x.semainesSaison))
  const capSaison = n * saison, capHors = n * (52 - saison)
  const margePerdue = pos(x.refus) * pos(x.futsParSortie) * x.netParFut
  const coutAnnuelNeuve = (x.dureeVie > 0 ? pos(x.prixNeuve) / x.dureeVie : pos(x.prixNeuve)) + pos(x.entretien)
  return {
    occupationSaison: capSaison > 0 ? pos(x.sortiesSaison) / capSaison : null,
    occupationHorsSaison: capHors > 0 ? pos(x.sortiesHorsSaison) / capHors : null,
    margePerdue, coutAnnuelNeuve, racheter: margePerdue > coutAnnuelNeuve && coutAnnuelNeuve > 0,
    couverture: coutAnnuelNeuve > 0 ? margePerdue / coutAnnuelNeuve : null,
    aRemplacer: x.vieilles.filter((v) => coutAnnuelNeuve > 0 && pos(v.reparations) > coutAnnuelNeuve).map((v) => v.nom),
  }
}

// ── 142 · Ma carte pression ────────────────────────────────────────────────────────────────────────────────────
// Un fût de L litres perd une part p (mousse, purge) : L × (1 − p) litres servis. Coût du litre servi = prix du fût HT ÷
// litres servis ; demi = 25 cl, pinte = 50 cl. Prix HT = prix TTC ÷ (1 + TVA). Marge du verre = prix HT − coût.
// Jours pour vider un fût = litres servis ÷ litres vendus par jour (semaine de 7 jours : la bière vieillit le dimanche
// aussi). Fûts par mois = litres vendus par semaine × 52 ÷ 12 ÷ litres servis.
export const DEMI = 0.25, PINTE = 0.5
export interface Bec { biere: string; prixFut: number; litres: number; perte: number; prixDemi: number; prixPinte: number; demis: number; pintes: number }
export interface LigneBec {
  coutLitre: number | null; coutDemi: number | null; coutPinte: number | null; tauxDemi: number | null; tauxPinte: number | null
  caSemaine: number; margeSemaine: number; tauxMarge: number | null; litresSemaine: number
  joursPourVider: number | null; futsParMois: number | null; vieillit: boolean; sousCible: boolean; prixDemiCible: number | null
}
export interface CartePression { lignes: LigneBec[]; caSemaine: number; margeSemaine: number; tauxMarge: number | null; futsParMois: number; faible: number | null }
export function ligneBec(b: Bec, tva: number, cible: number, joursFraicheur: number): LigneBec {
  const servis = pos(b.litres) * (1 - part(b.perte))
  const coutLitre = servis > 0 ? pos(b.prixFut) / servis : null
  const ht = (ttc: number) => pos(ttc) / (1 + tva)
  const coutDemi = coutLitre === null ? null : coutLitre * DEMI, coutPinte = coutLitre === null ? null : coutLitre * PINTE
  const taux = (prix: number, cout: number | null) => (cout === null || ht(prix) <= 0 ? null : (ht(prix) - cout) / ht(prix))
  const caSemaine = ht(b.prixDemi) * pos(b.demis) + ht(b.prixPinte) * pos(b.pintes)
  const coutSemaine = (coutDemi ?? 0) * pos(b.demis) + (coutPinte ?? 0) * pos(b.pintes)
  const litresSemaine = DEMI * pos(b.demis) + PINTE * pos(b.pintes)
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
// comme le salaire) ; intérim facturé brut × coefficient de l'agence, mois par mois.
export function coutContrats(coutCDI: number, brutMensuel: number, mois: number, coefInterim: number): { cdi: number; cdd: number; interim: number | null } {
  return { cdi: coutCDI, cdd: coutCDI * 1.1, interim: coefInterim > 0 ? pos(brutMensuel) * coefInterim * pos(mois) : null }
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
