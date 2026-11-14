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
  // Vague 10 (choix 152 à 165, Joseph 14/11/2026)
  contrat: { redaction: number; paieParMois: number }       // frais fixes d'un CDD : rédaction du contrat et fin, bulletin par mois
  tireuses: { semainesSaison: number; occupationSaison: number; occupationHors: number; saturation: number } // week-ends loués
  livraison: { kmMax: number; franco: number; prix: number }[] // grille de livraison : gratuite dès « franco » € HT commandés
  marcheExterieur: { paliers: { caMax: number; tireuses: number; investissement: number; heures: number }[]; camion: number }
  familles: { libelle: string; univers: 'cave' | 'bar'; marge: number; tva: 'normale' | 'intermediaire' | 'reduite' }[]
  remises: Record<CleRemise, number>                        // repères en part du CA HT (0 : pas de repère)
}
// Remises et offerts (choix 163) : les lignes du fichier « Pilotage remises & gratuités »
export const LIGNES_REMISES = [
  { cle: 'offerts', libelle: 'Offerts et dégustations' },
  { cle: 'persos', libelle: 'Consommation personnelle' },
  { cle: 'prixSpeciaux', libelle: 'Prix spéciaux' },
  { cle: 'remises', libelle: 'Remises en caisse' },
  { cle: 'fidelite', libelle: 'Fidélité (points, bons)' },
] as const
export type CleRemise = (typeof LIGNES_REMISES)[number]['cle']
// Valeurs courantes proposées tant que le Directeur ne les a pas réglées (aucune donnée du réseau) : coefficient
// d'intérim et frais d'un CDD de la fiche outil intérim ; saison de mai à août (17 week-ends), 90 % des week-ends loués
// en saison, 20 % le reste de l'année (Joseph, 14/11/2026), parc saturé au-delà de 85 %
export const COEF_INTERIM = 1.75
export const CONTRAT_CDD = { redaction: 260, paieParMois: 20 }
export const TIREUSES = { semainesSaison: 17, occupationSaison: 0.9, occupationHors: 0.2, saturation: 0.85 }
export const simulateursParDefaut: ParametresSimulateurs = {
  tauxDecouvert: 0, aideApprenti: 0, corner: { caParMetre: 0, tauxMarge: 0, demarque: 0 },
  coutHoraire: 0, exterieur: { prixKm: 0, dureeTireuse: 0, entretienTireuse: 0, co2ParFut: 0 }, donMecenat: false,
  pression: { cibleMarge: 0, joursFraicheur: 0 },
  // Taux légaux en France métropolitaine (20 %, 10 %, 5,5 %), modifiables par le Directeur
  tva: { normale: 0.2, intermediaire: 0.1, reduite: 0.055 },
  productivite: [], majorations: { dimanche: 0, ferie: 0 }, coefInterim: COEF_INTERIM,
  contrat: { ...CONTRAT_CDD }, tireuses: { ...TIREUSES }, livraison: [], marcheExterieur: { paliers: [], camion: 0 }, familles: [],
  remises: { offerts: 0, persos: 0, prixSpeciaux: 0, remises: 0, fidelite: 0 },
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
    coefInterim: positif(s.coefInterim) || COEF_INTERIM,
    contrat: { redaction: ou(s.contrat?.redaction, CONTRAT_CDD.redaction), paieParMois: ou(s.contrat?.paieParMois, CONTRAT_CDD.paieParMois) },
    tireuses: {
      semainesSaison: Math.min(52, ou(s.tireuses?.semainesSaison, TIREUSES.semainesSaison)), occupationSaison: Math.min(1, ou(s.tireuses?.occupationSaison, TIREUSES.occupationSaison)),
      occupationHors: Math.min(1, ou(s.tireuses?.occupationHors, TIREUSES.occupationHors)), saturation: Math.min(1, ou(s.tireuses?.saturation, TIREUSES.saturation)),
    },
    livraison: liste(s.livraison).filter((x) => x && Number.isFinite(x.kmMax) && x.kmMax > 0)
      .map((x) => ({ kmMax: positif(x.kmMax), franco: positif(x.franco), prix: positif(x.prix) })).sort((a, b) => a.kmMax - b.kmMax),
    marcheExterieur: {
      paliers: liste(s.marcheExterieur?.paliers).filter((x) => x && Number.isFinite(x.caMax) && x.caMax > 0)
        .map((x) => ({ caMax: positif(x.caMax), tireuses: positif(x.tireuses), investissement: positif(x.investissement), heures: positif(x.heures) })).sort((a, b) => a.caMax - b.caMax),
      camion: positif(s.marcheExterieur?.camion),
    },
    familles: liste(s.familles).filter((x) => x && typeof x.libelle === 'string' && x.libelle.trim() && Number.isFinite(x.marge))
      .map((x) => ({ libelle: x.libelle.trim().slice(0, 40), univers: x.univers === 'bar' ? 'bar' as const : 'cave' as const, marge: Math.min(0.99, positif(x.marge)), tva: (['normale', 'intermediaire', 'reduite'] as const).includes(x.tva) ? x.tva : 'normale' as const })),
    remises: Object.fromEntries(LIGNES_REMISES.map((l) => [l.cle, Math.min(1, positif(s.remises?.[l.cle]))])) as Record<CleRemise, number>,
  }
}
const ou = (x: unknown, defaut: number) => (Number.isFinite(x) ? positif(x) : defaut)
const liste = <T,>(x: T[] | undefined | null): T[] => (Array.isArray(x) ? x : [])

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

// ── 133 · Soirée, dégustation, événement (152 et 153 : achats des participants, coûts détaillés) ──────────────────
// Prix TTC par participant, TVA de l'univers, taux de marge sur les ventes de la soirée. Achats (152) : une part des
// participants achète un panier TTC (TVA et marge de la cave) ; avec un bon d'achat du prix d'entrée, le bon est une
// remise sur ces achats (il ne dépasse pas le panier). Coûts (153) : lignes propres HT, extras de personnel, et heures
// en plus de l'équipe déjà en place (personnes × heures × coût horaire chargé × (1 + majoration)).
// Gain = marge − redevance et publicité − coûts. Seuil : participants pour ne pas perdre d'argent = coûts ÷ gain d'un
// participant (entrée et achats compris).
export const LIGNES_EVENEMENT = [
  { cle: 'produits', libelle: 'Produits offerts (prix d’achat)' },
  { cle: 'securite', libelle: 'Sécurité' },
  { cle: 'deco', libelle: 'Décoration' },
  { cle: 'animation', libelle: 'Animation, intervenant' },
  { cle: 'communication', libelle: 'Communication (flyers, réseaux)' },
  { cle: 'location', libelle: 'Location (matériel, salle)' },
  { cle: 'divers', libelle: 'Divers' },
] as const
export type LigneEvenement = (typeof LIGNES_EVENEMENT)[number]['cle']
export interface AchatsSoiree { part: number; panierTTC: number; tva: number; tauxMarge: number; bon: boolean }
export interface HeuresEquipe { personnes: number; heures: number; coutHoraire: number; majoration: number }
export interface Soiree { prixTTC: number; participants: number; tva: number; tauxMarge: number; couts: number; extras: number; achats?: AchatsSoiree | null; equipe?: HeuresEquipe | null }
export interface EffetSoiree {
  caHT: number; caEntree: number; caAchats: number; bon: number; acheteurs: number
  marge: number; redevance: number; couts: number; equipeEnPlace: number; gain: number; seuil: number | null; gainParParticipant: number
}
export const coutHeuresEquipe = (e: HeuresEquipe | null | undefined) =>
  e ? Math.max(0, e.personnes) * Math.max(0, e.heures) * Math.max(0, e.coutHoraire) * (1 + Math.max(0, e.majoration)) : 0
export function simulerSoiree(x: Soiree, p: Pick<ParametresReseau, 'tauxRedevance' | 'tauxPublicite'>): EffetSoiree {
  const rp = p.tauxRedevance + p.tauxPublicite
  // Ce que rapporte un participant (entrée, et achats à hauteur de la part qui achète)
  const prixHT = Math.max(0, x.prixTTC) / (1 + x.tva)
  const a = x.achats && x.achats.part > 0 && x.achats.panierTTC > 0 ? x.achats : null
  const part = a ? Math.min(1, a.part) : 0
  const panierHT = a ? a.panierTTC / (1 + a.tva) : 0
  const bonHT = a && a.bon ? Math.min(Math.max(0, x.prixTTC), a.panierTTC) / (1 + a.tva) : 0
  const caUn = prixHT + part * (panierHT - bonHT)
  const margeUn = prixHT * x.tauxMarge + part * (panierHT * (a?.tauxMarge ?? 0) - bonHT)
  const unitaire = margeUn - caUn * rp
  const n = Math.max(0, x.participants)
  const equipeEnPlace = coutHeuresEquipe(x.equipe)
  const couts = Math.max(0, x.couts) + Math.max(0, x.extras) + equipeEnPlace
  const caHT = caUn * n, marge = margeUn * n, redevance = caHT * rp
  return {
    caHT, caEntree: prixHT * n, caAchats: part * panierHT * n, bon: part * bonHT * n, acheteurs: part * n,
    marge, redevance, couts, equipeEnPlace, gain: marge - redevance - couts,
    seuil: unitaire > 0 ? Math.ceil(couts / unitaire - 1e-9) : null, gainParParticipant: unitaire,
  }
}
// Les temps forts à ajouter au budget : l'entrée dans l'univers de la soirée, les achats des participants en cave (bon
// d'achat déduit) ; coûts propres hors personnel (extras et heures de l'équipe se voient dans l'Équipe) ; achats payés
// le mois d'avant
export function tempsFortDeSoiree(nom: string, mois: number, univers: Univers, e: Pick<EffetSoiree, 'caHT'> & Partial<Pick<EffetSoiree, 'caAchats' | 'bon'>>, coutsHorsExtras: number): TempsFort[] {
  const achats = Math.max(0, (e.caAchats ?? 0) - (e.bon ?? 0))
  const commun = { type: 'soiree' as const, mois, caAnPasse: 0, moisAchats: Math.max(1, mois - 1) }
  if (!(achats > 0) || univers === 'cave') return [{ ...commun, nom, univers, ca: Math.round(e.caHT), autresCharges: Math.round(Math.max(0, coutsHorsExtras)) }]
  return [
    { ...commun, nom, univers, ca: Math.round(e.caHT - achats), autresCharges: Math.round(Math.max(0, coutsHorsExtras)) },
    { ...commun, nom: `${nom} (achats)`.slice(0, 60), univers: 'cave', ca: Math.round(achats), autresCharges: 0 },
  ]
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

// ── 164 · Système de primes de l'équipe ───────────────────────────────────────────────────────────────────────────
// Paliers de progression du CA HT (5 %, 10 %…) avec la prime de chaque salarié, celle du gérant, et une part de la
// progression reversée (1 à 2 % du CA en plus, fichier primes du réseau). À chaque palier : CA en plus = CA de base ×
// progression ; marge en plus = CA en plus × (taux de marge − redevance et publicité) ; coût = (primes × salariés + prime du
// gérant + CA en plus × part reversée) × (1 + charges). Gain net = marge en plus − coût. Le dernier palier rentable est
// celui où la prime paie encore. Charges au taux employé avant réduction (prudent : la réduction baisse avec la prime).
export interface PalierPrime { progression: number; prime: number; primeGerant: number }
export interface Primes { caBase: number; tauxMarge: number; salaries: number; tauxCharges: number; partReversee: number; paliers: PalierPrime[] }
export interface EffetPalier extends PalierPrime { caEnPlus: number; margeEnPlus: number; cout: number; gain: number; rentable: boolean }
export function simulerPrimes(x: Primes, p: Pick<ParametresReseau, 'tauxRedevance' | 'tauxPublicite'>): { paliers: EffetPalier[]; dernierRentable: number | null } {
  const rp = p.tauxRedevance + p.tauxPublicite
  const paliers = [...x.paliers].filter((l) => l.progression > 0).sort((a, b) => a.progression - b.progression).map((l) => {
    const caEnPlus = Math.max(0, x.caBase) * l.progression
    const margeEnPlus = caEnPlus * (x.tauxMarge - rp)
    const cout = (Math.max(0, l.prime) * Math.max(0, x.salaries) + Math.max(0, l.primeGerant) + caEnPlus * Math.max(0, x.partReversee)) * (1 + Math.max(0, x.tauxCharges))
    return { ...l, caEnPlus, margeEnPlus, cout, gain: margeEnPlus - cout, rentable: margeEnPlus - cout >= 0 }
  })
  const i = paliers.map((l) => l.rentable).lastIndexOf(true)
  return { paliers, dernierRentable: i >= 0 ? i : null }
}

// ── 163 · Remises et offerts face aux repères ──────────────────────────────────────────────────────────────────
// Montants HT de la période (la caisse ne les envoie pas) rapportés au CA HT de la même période ; écart au repère du siège
// en euros (positif : plus que le repère). Chaque euro au-dessus du repère est de la marge perdue : sur une année, l'écart
// annualisé (× 12 ÷ mois de la période) est l'EBE que le magasin récupère en revenant au repère.
export interface LigneRemise { cle: CleRemise; libelle: string; montant: number; part: number | null; repere: number; ecart: number | null }
export function analyserRemises(ca: number, mois: number, montants: Partial<Record<CleRemise, number>>, reperes: Record<CleRemise, number>) {
  const lignes: LigneRemise[] = LIGNES_REMISES.map((l) => {
    const m = Math.max(0, fini(montants[l.cle]))
    const repere = reperes[l.cle] ?? 0
    return { cle: l.cle, libelle: l.libelle, montant: m, part: ca > 0 ? m / ca : null, repere, ecart: repere > 0 && ca > 0 ? m - ca * repere : null }
  })
  const total = somme(lignes.map((l) => l.montant))
  const ecart = somme(lignes.map((l) => Math.max(0, l.ecart ?? 0)))
  const an = mois > 0 ? 12 / mois : 1
  return { lignes, total, part: ca > 0 ? total / ca : null, ecart, ecartAn: ecart * an }
}

// ── 160 · Marge de plusieurs produits (planche, coffret, panier) ────────────────────────────────────────────────
// Chaque ligne : coût HT unitaire (consigne non reprise comprise), prix TTC, quantité. Marge pondérée = (CA HT − coût) ÷ CA HT.
export interface LigneMix { libelle: string; cout: number; consigne: number; prixTTC: number; quantite: number }
export function margeMix(lignes: LigneMix[], tva: number) {
  const detail = lignes.map((l) => {
    const q = Math.max(0, l.quantite), ca = Math.max(0, l.prixTTC) / (1 + tva) * q, cout = (Math.max(0, l.cout) + Math.max(0, l.consigne)) * q
    return { ca, cout, marge: ca - cout, taux: ca > 0 ? (ca - cout) / ca : null }
  })
  const ca = somme(detail.map((d) => d.ca)), cout = somme(detail.map((d) => d.cout))
  return { detail, ca, cout, marge: ca - cout, taux: ca > 0 ? (ca - cout) / ca : null, prixTTC: ca * (1 + tva) }
}

// ── 158 · Un levier sur plusieurs magasins ──────────────────────────────────────────────────────────────────────
// Sur le budget de chaque magasin, un levier qui s'additionne d'un magasin à l'autre :
// - vente : un article à P € TTC pour 1 client sur N (130) ;
// - panier : + X € TTC par ticket : CA HT = tickets × X ÷ (1 + TVA), à la marge de l'univers ;
// - tickets : + X % de tickets au même panier : CA HT = CA de l'univers × X, à la marge de l'univers ;
// - prix : + X % sur les prix, mêmes ventes : CA HT = CA de l'univers × X, tout en marge.
// EBE en plus = marge − redevance et publicité (ce que le réseau perçoit en plus). Équipe et frais ne bougent pas.
export type Levier =
  | { type: 'vente'; univers: 'cave' | 'bar'; unSur: number; prixTTC: number }
  | { type: 'panier'; univers: 'cave' | 'bar'; euros: number }
  | { type: 'tickets'; univers: 'cave' | 'bar'; taux: number }
  | { type: 'prix'; univers: 'cave' | 'bar'; taux: number }
export interface EffetLevier { ca: number; marge: number; redevance: number; ebe: number; caAvant: number; ebeAvant: number; articlesParJour: number | null }
export function appliquerLevier(b: Budget, p: Pick<ParametresReseau, 'tauxRedevance' | 'tauxPublicite' | 'tvaPanier'>, l: Levier): EffetLevier | null {
  const rp = p.tauxRedevance + p.tauxPublicite
  const familles = b.familles.filter((y) => y.univers === l.univers)
  const caU = somme(familles.map((y) => y.objectif))
  const tauxU = caU > 0 ? somme(familles.map((y) => y.margeObjectif)) / caU : 0
  const tickets = b.flux[l.univers]?.objectif ?? 0
  const avant = { caAvant: b.ca, ebeAvant: b.ebe }
  if (l.type === 'vente') {
    const r = simulerVenteAdditionnelle(b, p, { univers: l.univers, unSur: l.unSur, prixTTC: l.prixTTC })
    return r ? { ca: r.caHT, marge: r.marge, redevance: r.caHT * rp, ebe: r.ebe, ...avant, articlesParJour: r.articlesParJour } : null
  }
  if (caU <= 0) return null
  if (l.type === 'panier' && !(tickets > 0)) return null
  const ca = l.type === 'panier' ? tickets * Math.max(0, l.euros) / (1 + (p.tvaPanier[l.univers] ?? 0)) : caU * Math.max(0, l.taux)
  const marge = l.type === 'prix' ? ca : ca * tauxU
  return { ca, marge, redevance: ca * rp, ebe: marge - ca * rp, ...avant, articlesParJour: null }
}
