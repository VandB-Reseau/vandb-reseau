import { calculerBudget } from './budget'
import { economieFranchise } from './economie'
import { coutPersonne, type Personne } from './equipe'
import { echeancier } from './financement'
import { joursHorsDimanche } from './objectifs'
import { tresorerieBudget } from './tresorerie'
import { UNIVERS, type Budget, type Hypotheses, type ParametresReseau, type TempsFort, type Univers } from './types'

// Simulateurs du franchisé (choix 125 à 135, Joseph 13/11/2026) : les décisions du quotidien, hors du budget. Rien n'est
// enregistré par le calcul. Deux familles :
// - ceux qui rejouent le budget du magasin avec une hypothèse changée (embauche, coup dur de trésorerie) : on compare le
//   budget tel qu'il est et le même budget avec le changement, par le moteur complet (calculerBudget, tresorerieBudget) ;
// - ceux qui se calculent à part, avec quelques chiffres saisis (promo, vente additionnelle, reste à faire, soirée,
//   achat en volume, investissement).
// Montants HT, sauf les prix et paniers saisis TTC, convertis avec la TVA moyenne de l'univers. Fonctions pures, testées
// dans tests/pilotage/moteur/simulateurs.spec.ts avec un magasin fictif vérifié à la main.

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const fini = (x: number | null | undefined, defaut = 0) => (Number.isFinite(x) ? (x as number) : defaut)
const deux = (n: number) => String(n).padStart(2, '0')
const moisValide = (m: number) => Number.isInteger(m) && m >= 1 && m <= 12

// Repères des simulateurs réglés par le Directeur (Paramètres des budgets) ; absents : 0, le franchisé saisit les siens
export interface ParametresSimulateurs {
  tauxDecouvert: number                                     // coût annuel de l'argent immobilisé (découvert, ligne de crédit)
  aideApprenti: number                                      // aide annuelle à l'embauche d'un apprenti, la 1re année
  corner: { caParMetre: number; tauxMarge: number; demarque: number } // corner alimentaire : CA HT par mètre linéaire et par an
  // Vague 9 (choix 138 à 147, Joseph 14/11/2026)
  coutHoraire: number                                       // coût chargé d'une heure de travail (livraisons, ouvertures)
  exterieur: { prixKm: number; dureeTireuse: number; entretienTireuse: number; co2ParFut: number } // marché extérieur
  donMecenat: boolean                                       // contrepartie d'un contrat traitée comme un don (réduction mécénat)
  pression: { cibleMarge: number; joursFraicheur: number }  // cible de marge du bar, jours au-delà desquels un fût s'abîme
  tva: { normale: number; intermediaire: number; reduite: number } // taux de TVA de la calculette des prix
  productivite: { partBar: number; cible: number }[]        // CA HT par heure visé selon la part du bar (seuil mini, cible)
  majorations: { dimanche: number; ferie: number }          // majoration des heures payées un dimanche, un jour férié
  coefInterim: number                                       // coefficient de facturation de l'intérim sur le salaire brut
}
export const simulateursParDefaut: ParametresSimulateurs = {
  tauxDecouvert: 0, aideApprenti: 0, corner: { caParMetre: 0, tauxMarge: 0, demarque: 0 },
  coutHoraire: 0, exterieur: { prixKm: 0, dureeTireuse: 0, entretienTireuse: 0, co2ParFut: 0 }, donMecenat: false,
  pression: { cibleMarge: 0, joursFraicheur: 0 },
  // Taux légaux en France métropolitaine (20 %, 10 %, 5,5 %), modifiables par le Directeur
  tva: { normale: 0.2, intermediaire: 0.1, reduite: 0.055 },
  productivite: [], majorations: { dimanche: 0, ferie: 0 }, coefInterim: 0,
}
const positif = (x: unknown) => Math.max(0, fini(x as number))
export function parametresSimulateurs(p: { simulateurs?: Partial<ParametresSimulateurs> } | null | undefined): ParametresSimulateurs {
  const s = p?.simulateurs ?? {}
  const d = simulateursParDefaut
  const tva = (k: keyof ParametresSimulateurs['tva']) => (Number.isFinite(s.tva?.[k]) ? positif(s.tva?.[k]) : d.tva[k])
  return {
    tauxDecouvert: positif(s.tauxDecouvert), aideApprenti: positif(s.aideApprenti),
    corner: { caParMetre: positif(s.corner?.caParMetre), tauxMarge: positif(s.corner?.tauxMarge), demarque: positif(s.corner?.demarque) },
    coutHoraire: positif(s.coutHoraire),
    exterieur: { prixKm: positif(s.exterieur?.prixKm), dureeTireuse: positif(s.exterieur?.dureeTireuse), entretienTireuse: positif(s.exterieur?.entretienTireuse), co2ParFut: positif(s.exterieur?.co2ParFut) },
    donMecenat: s.donMecenat === true,
    pression: { cibleMarge: positif(s.pression?.cibleMarge), joursFraicheur: positif(s.pression?.joursFraicheur) },
    tva: { normale: tva('normale'), intermediaire: tva('intermediaire'), reduite: tva('reduite') },
    productivite: (Array.isArray(s.productivite) ? s.productivite : [])
      .filter((x) => x && Number.isFinite(x.partBar) && Number.isFinite(x.cible) && x.cible > 0)
      .map((x) => ({ partBar: Math.min(1, positif(x.partBar)), cible: positif(x.cible) }))
      .sort((a, b) => b.partBar - a.partBar),
    majorations: { dimanche: positif(s.majorations?.dimanche), ferie: positif(s.majorations?.ferie) },
    coefInterim: positif(s.coefInterim),
  }
}

// ── Budget rejoué ───────────────────────────────────────────────────────────────────────────────────────────────────
export interface Situation { h: Hypotheses; p: ParametresReseau; depart: number }   // depart : trésorerie au 1er janvier
export interface EtatBudget {
  ca: number; marge: number; personnel: number; ebe: number; resultatNet: number; pctFP: number
  heures: number // heures travaillées de l'année (productivité, choix 145)
  soldes: number[]; fin: number; pointBas: { montant: number; mois: number }; premierMoisNegatif: number | null // mois 0 à 11
}
export interface Comparaison { avant: EtatBudget; apres: EtatBudget; ecart: { ca: number; marge: number; personnel: number; ebe: number; resultatNet: number; pctFP: number; fin: number; pointBas: number } }

export function etatBudget(h: Hypotheses, p: ParametresReseau, depart: number, retouche?: (soldes: number[]) => number[]): EtatBudget {
  const b = calculerBudget(h, p)
  const t = tresorerieBudget(b, h, p, p.tresorerie, depart)
  const soldes = retouche ? retouche(t.mois.map((m) => m.fin)) : t.mois.map((m) => m.fin)
  const bas = soldes.reduce((m, x, i) => (x < soldes[m] ? i : m), 0)
  const neg = soldes.findIndex((x) => x < 0)
  return {
    ca: b.ca, marge: b.marge, personnel: b.personnel, ebe: b.ebe, resultatNet: b.resultatNet, pctFP: b.ratios.pctFP,
    heures: somme(b.mois.map((m) => (m.productivite ? m.ca / m.productivite : 0))),
    soldes, fin: soldes[11], pointBas: { montant: soldes[bas], mois: bas }, premierMoisNegatif: neg >= 0 ? neg : null,
  }
}
function comparer(avant: EtatBudget, apres: EtatBudget): Comparaison {
  return {
    avant, apres,
    ecart: {
      ca: apres.ca - avant.ca, marge: apres.marge - avant.marge, personnel: apres.personnel - avant.personnel, ebe: apres.ebe - avant.ebe,
      resultatNet: apres.resultatNet - avant.resultatNet, pctFP: apres.pctFP - avant.pctFP, fin: apres.fin - avant.fin, pointBas: apres.pointBas.montant - avant.pointBas.montant,
    },
  }
}

// ── 127 · Si j'embauche, si quelqu'un part, si les heures changent ─────────────────────────────────────────────────
export type Mouvement =
  | { type: 'embauche'; poste: Omit<Personne, 'entree' | 'sortie' | 'id'>; mois: number }   // arrivée au 1er du mois (1 à 12)
  | { type: 'depart'; index: number; mois: number }                                         // parti au 1er du mois
  | { type: 'heures'; index: number; mois: number; heuresHebdo: number }                    // nouvelles heures à partir du mois
export interface EffetEmbauche extends Comparaison {
  coutAnnee: number          // coût chargé de l'année budgétée (positif : coûte en plus ; négatif : économie)
  coutPlein: number          // le même sur 12 mois pleins
  aide: number               // aide à l'apprentissage déduite (embauche d'un apprenti)
  caNecessaire: number | null // CA HT en plus sur 12 mois pour payer le coût plein, à marge sur coûts variables égale
}

// L'équipe avec le mouvement ; sans équipe saisie, le coût s'ajoute aux salaires mensuels du personnel
export function appliquerMouvement(h: Hypotheses, m: Mouvement, p: ParametresReseau): Hypotheses {
  const a = h.annee
  if (!moisValide(m.mois)) return h
  if (m.type === 'embauche') {
    const nouveau: Personne = { ...m.poste, primes: m.poste.primes ?? [], entree: `${a}-${deux(m.mois)}`, sortie: null }
    if (h.equipe?.length) return { ...h, equipe: [...h.equipe, nouveau] }
    const c = coutPersonne(nouveau, p.charges, a, h.hausseSalaires ?? 0)
    return {
      ...h, personnel: {
        ...h.personnel,
        salairesMensuels: h.personnel.salairesMensuels.map((s, i) => s + c.cout[i]),
        heuresMensuelles: h.personnel.heuresMensuelles.map((x, i) => x + c.heures[i]),
      },
    }
  }
  const equipe = h.equipe ?? []
  const p0 = equipe[m.index]
  if (!p0) return h
  const avant = m.mois > 1 ? { ...p0, sortie: `${a}-${deux(m.mois - 1)}` } : null
  const garde = (x: Personne | null) => (x ? [x] : [])
  if (m.type === 'depart') return { ...h, equipe: equipe.flatMap((x, i) => (i === m.index ? garde(avant) : [x])) }
  // Heures : le salaire suit les heures (même taux horaire) ; le poste est coupé en deux périodes
  const facteur = p0.heuresHebdo > 0 ? m.heuresHebdo / p0.heuresHebdo : 0
  const apres: Personne = { ...p0, id: undefined, heuresHebdo: m.heuresHebdo, brutMensuel: p0.brutMensuel * facteur, entree: `${a}-${deux(m.mois)}`, primes: p0.primes.filter((x) => x.mois >= m.mois) }
  const avantH = avant ? { ...avant, primes: p0.primes.filter((x) => x.mois < m.mois) } : null
  return { ...h, equipe: equipe.flatMap((x, i) => (i === m.index ? [...garde(avantH), apres] : [x])) }
}

export function simulerEmbauche(s: Situation, m: Mouvement, aideApprenti = 0): EffetEmbauche {
  const avant = etatBudget(s.h, s.p, s.depart)
  const h2 = appliquerMouvement(s.h, m, s.p)
  const aide = m.type === 'embauche' && m.poste.categorie === 'apprenti' ? aideApprenti * (13 - m.mois) / 12 : 0
  const apresBrut = etatBudget(h2, s.p, s.depart)
  // L'aide arrive en subvention d'exploitation : elle allège le résultat et la trésorerie, pas la masse salariale
  const apres = aide ? avecAide(apresBrut, aide, m.mois) : apresBrut
  const c = comparer(avant, apres)
  const coutAnnee = apresBrut.personnel - avant.personnel
  const moisPresents = m.type === 'embauche' ? 13 - m.mois : 13 - m.mois
  const coutPlein = moisPresents > 0 ? coutAnnee * 12 / moisPresents : 0
  const e = economieFranchise(calculerBudget(s.h, s.p), s.h, s.p)
  const aidePleine = m.type === 'embauche' && m.poste.categorie === 'apprenti' ? aideApprenti : 0
  return { ...c, coutAnnee, coutPlein, aide, caNecessaire: e.tauxMCV > 0 ? (coutPlein - aidePleine) / e.tauxMCV : null }
}
function avecAide(e: EtatBudget, aide: number, mois: number): EtatBudget {
  const parMois = aide / (13 - mois)
  let cumul = 0
  const soldes = e.soldes.map((x, i) => { if (i + 1 >= mois) cumul += parMois; return x + cumul })
  const bas = soldes.reduce((m, x, i) => (x < soldes[m] ? i : m), 0)
  const neg = soldes.findIndex((x) => x < 0)
  return { ...e, ebe: e.ebe + aide, resultatNet: e.resultatNet + aide, soldes, fin: soldes[11], pointBas: { montant: soldes[bas], mois: bas }, premierMoisNegatif: neg >= 0 ? neg : null }
}

// ── 128 · Promo ou hausse de prix ──────────────────────────────────────────────────────────────────────────────────
// Taux de marge m sur le prix de vente HT. Une remise r (en part du prix) laisse m − r de marge par article :
// pour garder la même marge, il faut vendre m ÷ (m − r) fois plus. Une hausse h laisse (m + h) ÷ (1 + h) de taux, et
// une marge par article de m + h (en part de l'ancien prix) : on garde la même marge en perdant jusqu'à 1 − m ÷ (m + h)
// des ventes. Sans effet d'aubaine ni report d'achat : c'est un calcul de seuil.
export interface EffetPrix { type: 'remise' | 'hausse'; taux: number; tauxMarge: number; ventesEnPlus: number | null; ventesPerdables: number | null; nouveauTauxMarge: number }
export function simulerPrix(type: 'remise' | 'hausse', taux: number, tauxMarge: number): EffetPrix {
  const m = tauxMarge, t = Math.max(0, taux)
  if (type === 'remise') {
    const reste = m - t
    return { type, taux: t, tauxMarge: m, ventesEnPlus: reste > 0 ? m / reste - 1 : null, ventesPerdables: null, nouveauTauxMarge: t < 1 ? reste / (1 - t) : 0 }
  }
  return { type, taux: t, tauxMarge: m, ventesEnPlus: null, ventesPerdables: m + t > 0 ? 1 - m / (m + t) : null, nouveauTauxMarge: (m + t) / (1 + t) }
}

// ── 129 · Coup dur de trésorerie ───────────────────────────────────────────────────────────────────────────────────
export type CoupDur =
  | { type: 'baisse'; taux: number; de: number; a: number }          // CA en moins sur ces mois, tous univers (0,15 = −15 %)
  | { type: 'depense'; montant: number; mois: number }               // dépense imprévue HT payée ce mois, amortie sur 5 ans
  | { type: 'retard'; montant: number; mois: number; retard: number } // encaissement TTC attendu ce mois, arrivé n mois plus tard
export function simulerCoupDur(s: Situation, coups: CoupDur[]): Comparaison {
  const avant = etatBudget(s.h, s.p, s.depart)
  let h = s.h
  const retards: { montant: number; mois: number; retard: number }[] = []
  for (const c of coups) {
    if (c.type === 'baisse' && moisValide(c.de) && moisValide(c.a) && c.de <= c.a && c.taux > 0) {
      h = { ...h, ajustementsCA: [...(h.ajustementsCA ?? []), ...UNIVERS.map((u) => ({ libelle: 'Simulation : baisse du CA', univers: u, de: c.de, a: c.a, taux: -Math.min(1, c.taux) }))] }
    } else if (c.type === 'depense' && moisValide(c.mois) && c.montant > 0) {
      h = { ...h, investissements: [...(h.investissements ?? []), { libelle: 'Simulation : dépense imprévue', type: 'autre', montant: c.montant, mois: c.mois, duree: 5 }] }
    } else if (c.type === 'retard' && moisValide(c.mois) && c.montant > 0 && c.retard > 0) {
      retards.push(c)
    }
  }
  // Retard d'encaissement : l'argent manque de son mois jusqu'au mois d'arrivée (au-delà de décembre : pas dans l'année)
  const retouche = retards.length ? (soldes: number[]) => soldes.map((x, i) => x - somme(retards.filter((r) => i + 1 >= r.mois && i + 1 < r.mois + r.retard).map((r) => r.montant))) : undefined
  return comparer(avant, etatBudget(h, s.p, s.depart, retouche))
}

// ── 130 · Vente additionnelle en langage vendeur ───────────────────────────────────────────────────────────────────
// « Un article de plus à 1 client sur N, à P € TTC » : articles = tickets visés ÷ N ; CA HT = articles × P ÷ (1 + TVA) ;
// marge au taux saisi (celui de l'univers par défaut) ; redevance et publicité suivent le CA. L'équipe et les frais ne
// bougent pas.
export interface EffetVenteAdditionnelle { univers: 'cave' | 'bar'; articles: number; articlesParJour: number; caTTC: number; caHT: number; marge: number; ebe: number; panierEnPlus: number }
export function simulerVenteAdditionnelle(b: Budget, p: Pick<ParametresReseau, 'tauxRedevance' | 'tauxPublicite' | 'tvaPanier'>, x: { univers: 'cave' | 'bar'; unSur: number; prixTTC: number; tauxMarge?: number; joursParAn?: number }): EffetVenteAdditionnelle | null {
  const f = b.flux[x.univers]
  if (!f || f.objectif <= 0 || x.unSur < 1 || x.prixTTC <= 0) return null
  const familles = b.familles.filter((y) => y.univers === x.univers)
  const caU = somme(familles.map((y) => y.objectif))
  const taux = x.tauxMarge ?? (caU > 0 ? somme(familles.map((y) => y.margeObjectif)) / caU : 0)
  const articles = f.objectif / x.unSur
  const caTTC = articles * x.prixTTC
  const caHT = caTTC / (1 + (p.tvaPanier[x.univers] ?? 0))
  const marge = caHT * taux
  const jours = x.joursParAn ?? 307 // lundi à samedi, hors 6 jours fériés
  return { univers: x.univers, articles, articlesParJour: articles / jours, caTTC, caHT, marge, ebe: marge - caHT * (p.tauxRedevance + p.tauxPublicite), panierEnPlus: x.prixTTC / x.unSur }
}

// ── 131 · Reste à faire du mois ────────────────────────────────────────────────────────────────────────────────────
// CA HT du mois à date (lu sur la caisse jusqu'à hier soir) face au budget du mois : ce qu'il faut faire par jour
// d'ouverture restant (aujourd'hui compris), et l'écart au rythme actuel. Jours d'ouverture : lundi à samedi.
export interface ResteAFaire { budget: number; realise: number; reste: number; joursPasses: number; joursRestants: number; parJour: number | null; rythme: number | null; ecartParJour: number | null; atteint: boolean }
export function joursOuverts(annee: number, mois: number, du: number, au: number, ouverts: number[] = [1, 2, 3, 4, 5, 6]): number {
  let n = 0
  for (let j = du; j <= au; j++) if (ouverts.includes(new Date(annee, mois - 1, j).getDay())) n++
  return n
}
export function resteAFaire(b: Budget, annee: number, mois: number, jour: number, realise: number, ouverts: number[] = [1, 2, 3, 4, 5, 6]): ResteAFaire {
  const fin = new Date(annee, mois, 0).getDate()
  const budget = b.mois[mois - 1]?.ca ?? 0
  const joursPasses = joursOuverts(annee, mois, 1, Math.min(fin, jour - 1), ouverts)
  const joursRestants = joursOuverts(annee, mois, Math.max(1, jour), fin, ouverts)
  const reste = Math.max(0, budget - realise)
  const parJour = joursRestants > 0 ? reste / joursRestants : null
  const rythme = joursPasses > 0 ? realise / joursPasses : null
  return { budget, realise, reste, joursPasses, joursRestants, parJour, rythme, ecartParJour: parJour !== null && rythme !== null ? parJour - rythme : null, atteint: realise >= budget && budget > 0 }
}
export { joursHorsDimanche }

// ── 133 · Soirée, dégustation, événement ───────────────────────────────────────────────────────────────────────────
// Prix TTC par participant, TVA de l'univers, taux de marge sur les ventes de la soirée, coûts propres HT (animation,
// location, communication) et extras de personnel chargés. Gain = marge − redevance et publicité − coûts.
// Seuil : participants pour ne pas perdre d'argent = coûts ÷ (prix HT × (marge − redevance − publicité)).
export interface EffetSoiree { caHT: number; marge: number; redevance: number; couts: number; gain: number; seuil: number | null; gainParParticipant: number }
export function simulerSoiree(x: { prixTTC: number; participants: number; tva: number; tauxMarge: number; couts: number; extras: number }, p: Pick<ParametresReseau, 'tauxRedevance' | 'tauxPublicite'>): EffetSoiree {
  const prixHT = Math.max(0, x.prixTTC) / (1 + x.tva)
  const caHT = prixHT * Math.max(0, x.participants)
  const marge = caHT * x.tauxMarge
  const redevance = caHT * (p.tauxRedevance + p.tauxPublicite)
  const couts = Math.max(0, x.couts) + Math.max(0, x.extras)
  const unitaire = prixHT * (x.tauxMarge - p.tauxRedevance - p.tauxPublicite)
  return { caHT, marge, redevance, couts, gain: marge - redevance - couts, seuil: unitaire > 0 ? Math.ceil(couts / unitaire - 1e-9) : null, gainParParticipant: unitaire }
}
// Le temps fort à ajouter au budget : CA de la soirée dans son mois ; coûts propres hors extras (les extras se saisissent
// dans l'Équipe) ; achats payés le mois d'avant
export function tempsFortDeSoiree(nom: string, mois: number, univers: Univers, e: Pick<EffetSoiree, 'caHT'>, coutsHorsExtras: number): TempsFort {
  return { nom, type: 'soiree', mois, univers, caAnPasse: 0, ca: Math.round(e.caHT), autresCharges: Math.round(Math.max(0, coutsHorsExtras)), moisAchats: Math.max(1, mois - 1) }
}

// ── 134 · Acheter en volume, précommande de Noël ───────────────────────────────────────────────────────────────────
// Achat HT au prix habituel A, remise r : on paie A(1−r) à la commande. Gain de la remise = A × r. Coût de l'argent
// immobilisé = A(1−r) × taux annuel ÷ 12 × durée moyenne de stockage (la moitié du temps pour tout vendre, ventes
// régulières). Invendu : part du stock jamais vendue, perdue au prix payé. Durée maximale pour que la remise vaille le coup :
// celle où le gain net s'annule.
export interface EffetAchat { paye: number; remise: number; coutArgent: number; perteInvendu: number; gain: number; moisMaximum: number | null; payeTTC: number }
export function simulerAchat(x: { montant: number; remise: number; mois: number; invendu: number; tauxAnnuel: number; tvaAchats: number }): EffetAchat {
  const A = Math.max(0, x.montant), r = Math.min(1, Math.max(0, x.remise))
  const paye = A * (1 - r)
  const remise = A * r
  const parMois = paye * Math.max(0, x.tauxAnnuel) / 12 / 2
  const coutArgent = parMois * Math.max(0, x.mois)
  const perteInvendu = paye * Math.min(1, Math.max(0, x.invendu))
  const net = remise - perteInvendu
  return { paye, remise, coutArgent, perteInvendu, gain: net - coutArgent, moisMaximum: parMois > 0 ? (net > 0 ? net / parMois : 0) : null, payeTTC: paye * (1 + x.tvaAchats) }
}

// ── 135 · Investir : tireuse, terrasse, corner alimentaire ─────────────────────────────────────────────────────────
// Année pleine : CA en plus × (taux de marge − démarque) − redevance et publicité − charges en plus = EBE en plus ;
// amortissement linéaire ; intérêts de la 1re année du prêt. Délai de retour = coût ÷ EBE en plus d'une année pleine.
// Année de la mise en service : au prorata des mois ouverts ; trésorerie = EBE du prorata − coût payé (trésorerie) ou
// − échéances (prêt, capital encaissé le mois d'avant la 1re échéance, donc sans effet sur la trésorerie).
export interface Investir { cout: number; duree: number; mois: number; ca: number; tauxMarge: number; demarque: number; charges: number; pret?: { taux: number; duree: number } | null }
export interface EffetInvestir {
  ebeAn: number; amortissement: number; interets: number; resultatAn: number; retourAnnees: number | null
  annee1: { mois: number; ebe: number; tresorerie: number }
}
export function simulerInvestissement(x: Investir, p: Pick<ParametresReseau, 'tauxRedevance' | 'tauxPublicite'>): EffetInvestir {
  const cout = Math.max(0, x.cout)
  const ebeAn = x.ca * (x.tauxMarge - x.demarque) - x.ca * (p.tauxRedevance + p.tauxPublicite) - x.charges
  const amortissement = x.duree > 0 ? cout / x.duree : cout
  const pret = x.pret && x.pret.duree > 0 && cout > 0 ? echeancier({ libelle: '', montant: cout, taux: x.pret.taux, duree: x.pret.duree, premiereEcheance: 1 }) : null
  const interets = pret ? somme(pret.interets) : 0
  const mois = moisValide(x.mois) ? 13 - x.mois : 12
  const ebe1 = ebeAn * mois / 12
  // Échéances de l'année : de la mise en service à décembre
  const echeances = pret ? pret.echeance * Math.max(0, mois - 1) : 0
  return {
    ebeAn, amortissement, interets, resultatAn: ebeAn - amortissement - interets, retourAnnees: ebeAn > 0 ? cout / ebeAn : null,
    annee1: { mois, ebe: ebe1, tresorerie: ebe1 - (pret ? echeances : cout) },
  }
}
// Repères du corner alimentaire : CA d'une année pleine pour tant de mètres linéaires
export const caCorner = (metres: number, s: ParametresSimulateurs) => Math.max(0, metres) * s.corner.caParMetre
