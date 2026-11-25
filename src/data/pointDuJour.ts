// « Mon point du jour » (choix 429 à 436, Joseph, 25/11/2026) : l'action terrain d'abord. Visites, comptes rendus, tâches
// et carnet ; le chiffre d'affaires, le budget et le prévisionnel restent dans leurs pages (pilotage, pas notification).
// Le Coach voit chaque ligne ; le RR et le Directeur voient les leurs une par une, et une ligne par personne pour le reste.
import type { NoteMagasin, Reseau, Visite } from './modele'
import { estVisite } from './chiffres'
import { anneeDe, lienVisite, suiviRythme } from './visites'
import { actionsEnCours, echeanceDate, enRetard, portePar, porteursDe, type ActionSuivie } from './actions'
import { dernierEchange, extrait, instantNote, lienNote, ouverte, tonDe } from './carnet'
import { rappelsVisites } from './ordreDuJour'
import { ajouterJours } from './agenda'
import { magasinsDu, type Perimetre } from './perimetre'
import { libelleSuivi } from './charge'
import { dateCourte, lienFiche } from '../lib/format'

export type Famille = 'comptesrendus' | 'taches' | 'carnet' | 'visites'
export type TonPoint = 'rouge' | 'orange' | 'type' | 'gris'
export interface LignePoint {
  cle: string; famille: Famille; titre: string; detail: string; lien: string
  magasin?: string // blason de ville
  personne?: string // ligne de synthèse par personne (RR, Directeur)
  pastille?: { ton: TonPoint; libelle: string }
  visite?: Visite // visite prévue passée : Faite ou Reporter
  tache?: ActionSuivie // tâche à cocher
  note?: { magasin: string; note: NoteMagasin } // « Je m'en occupe »
}
export interface PointDuJour { journee: Visite[]; lignes: LignePoint[] }

export const FAMILLES: { v: Famille; libelle: string; lien: string }[] = [
  { v: 'comptesrendus', libelle: 'Comptes rendus', lien: '/visites' },
  { v: 'taches', libelle: 'Tâches', lien: '/taches' },
  { v: 'carnet', libelle: 'Carnet', lien: '/carnet' },
  { v: 'visites', libelle: 'Magasins à visiter', lien: '/visites?vue=rythme' },
]

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

// Une ligne par personne : le nombre, les magasins concernés en détail
function synthese(famille: Famille, cle: string, groupes: Map<string, { magasins: string[]; rouge: boolean }>, libelle: (n: number) => string, lien: (nom: string) => string): LignePoint[] {
  return [...groupes.entries()].sort((a, b) => b[1].magasins.length - a[1].magasins.length || a[0].localeCompare(b[0])).map(([nom, g]) => ({
    cle: `${cle}-${nom}`, famille, personne: nom, titre: nom, lien: lien(nom), detail: [...new Set(g.magasins)].join(', '),
    pastille: { ton: g.rouge ? 'rouge' : 'orange', libelle: libelle(g.magasins.length) },
  }))
}
function ajouterA(groupes: Map<string, { magasins: string[]; rouge: boolean }>, nom: string, magasin: string, rouge = false) {
  const g = groupes.get(nom) ?? { magasins: [], rouge: false }
  g.magasins.push(magasin)
  g.rouge ||= rouge
  groupes.set(nom, g)
}

export function pointDuJour(reseau: Reseau, p: Perimetre, moi: string): PointDuJour {
  const j = reseau.jour
  const demain = ajouterJours(j, 1)
  const dans7j = ajouterJours(j, 7)
  const encadrement = p.type !== 'coach'
  const perimetre = magasinsDu(reseau, p)
  const noms = new Set(perimetre.map((m) => m.nom))
  // Le Coach a toutes les visites de ses magasins sans visiteur nommé ; le RR et le Directeur, celles où ils sont nommés
  const mienne = (v: Visite) => (encadrement ? !!moi && v.visiteurs.includes(moi) : !moi || !v.visiteurs.length || v.visiteurs.includes(moi))
  const visiteurDe = (v: Visite) => v.visiteurs[0] || 'Visiteur non renseigné'
  const lignes: LignePoint[] = []

  // 430 : ma journée, aujourd'hui et demain
  const journee = reseau.visites.filter((v) => estVisite(v) && (v.date === j || v.date === demain) && noms.has(v.magasin) && mienne(v))
    .sort((a, b) => a.date.localeCompare(b.date) || a.magasin.localeCompare(b.magasin))

  // 431 : visites passées jamais closes, comptes rendus à écrire, signatures attendues
  const aClore = reseau.visites.filter((v) => v.prevue && v.date < j && v.id !== null && noms.has(v.magasin) && estVisite(v)).sort((a, b) => a.date.localeCompare(b.date))
  const rappels = rappelsVisites(reseau, noms, encadrement ? '' : moi)
  const crParPersonne = new Map<string, { magasins: string[]; rouge: boolean }>()
  for (const v of aClore) {
    if (encadrement && !mienne(v)) { ajouterA(crParPersonne, visiteurDe(v), v.magasin, v.date < ajouterJours(j, -7)); continue }
    if (!encadrement && !mienne(v)) continue
    lignes.push({ cle: `vp-${v.id}`, famille: 'comptesrendus', titre: v.magasin, magasin: v.magasin, lien: '', visite: v,
      detail: [`Prévue le ${dateCourte(v.date)}`, encadrement ? '' : v.visiteurs.filter((n) => n !== moi).join(', ')].filter(Boolean).join(' · '), pastille: { ton: 'orange', libelle: 'À clore' } })
  }
  for (const r of rappels.filter((r) => r.genre !== 'preparer')) {
    if (encadrement && !mienne(r.visite)) { ajouterA(crParPersonne, visiteurDe(r.visite), r.magasin); continue }
    lignes.push({ cle: r.cle, famille: 'comptesrendus', titre: r.magasin, magasin: r.magasin, detail: r.detail,
      lien: `${lienVisite(r.visite).split('?')[0]}?id=${r.visite.id}&etape=${r.genre === 'signature' ? 'suivi' : 'surplace'}`,
      pastille: { ton: 'type', libelle: r.genre === 'compterendu' ? 'Compte rendu' : 'Signature' } })
  }
  lignes.push(...synthese('comptesrendus', 'crp', crParPersonne, (n) => `${n} en retard`, () => '/visites'))

  // 432 : tâches en retard, bloquées ou dues dans la semaine
  const tachesParPersonne = new Map<string, { magasins: string[]; rouge: boolean }>()
  const enCours = actionsEnCours(reseau, noms).sort((x, y) => (echeanceDate(x.a) || '9999').localeCompare(echeanceDate(y.a) || '9999'))
  for (const x of enCours) {
    const retard = enRetard(x.a, j)
    const bloquee = x.a.statut === 'bloquee'
    const semaine = !!echeanceDate(x.a) && echeanceDate(x.a) <= dans7j
    if (!retard && !bloquee && !semaine) continue
    if (encadrement && !portePar(x.a, moi)) {
      if (retard || bloquee) ajouterA(tachesParPersonne, porteursDe(x.a)[0] ?? 'Sans porteur', x.magasin, true)
      continue
    }
    lignes.push({ cle: `t-${x.cle}`, famille: 'taches', titre: x.a.action, lien: `${lienFiche(x.magasin)}?vue=actions`, tache: x,
      detail: [x.magasin, x.libre?.exterieur && `Marché extérieur : ${x.libre.exterieur.nom}`, encadrement ? '' : x.a.porteur, bloquee && x.a.raison ? `bloquée : ${x.a.raison}` : echeanceDate(x.a) && `pour le ${dateCourte(echeanceDate(x.a))}`].filter(Boolean).join(' · '),
      pastille: bloquee ? { ton: 'rouge', libelle: 'Bloquée' } : retard ? { ton: 'rouge', libelle: 'En retard' } : undefined })
  }
  lignes.push(...synthese('taches', 'tp', tachesParPersonne, (n) => `${pluriel(n, 'tâche')} en retard`, () => '/taches'))

  // 433 : carnet. Les alertes que personne n'a prises (ou que j'ai prises), les notes où l'on me nomme sans réponse de ma part
  const vues = new Set<string>()
  const alertes = perimetre.flatMap((m) => (reseau.notesMagasins[m.nom] ?? []).filter((n) => ouverte(n) && tonDe(n) === 'alerte' && n.par !== moi && (!n.prise || n.prise.par === moi)).map((note) => ({ magasin: m.nom, note })))
    .sort((a, b) => dernierEchange(b.note).localeCompare(dernierEchange(a.note)))
  for (const x of alertes) {
    vues.add(x.note.id)
    lignes.push({ cle: `na-${x.note.id}`, famille: 'carnet', titre: x.magasin, magasin: x.magasin, lien: lienNote(x.magasin, x.note.id), note: x,
      detail: [x.note.par, dateCourte(x.note.date), x.note.prise ? 'tu t’en occupes' : '', extrait(x.note.texte, 90)].filter(Boolean).join(' · '), pastille: { ton: 'rouge', libelle: 'Alerte' } })
  }
  if (moi) {
    const il30j = ajouterJours(j, -30)
    for (const m of perimetre) {
      for (const n of reseau.notesMagasins[m.nom] ?? []) {
        if (vues.has(n.id) || n.close) continue
        const mentions = [...(n.mentions?.includes(moi) && n.par !== moi ? [{ par: n.par, quand: instantNote(n), texte: n.texte }] : []),
          ...(n.reponses ?? []).filter((r) => r.mentions?.includes(moi) && r.par !== moi)]
        const derniere = mentions.at(-1)
        if (!derniere || derniere.quand.slice(0, 10) < il30j) continue
        if ((n.reponses ?? []).some((r) => r.par === moi && r.quand > derniere.quand)) continue
        lignes.push({ cle: `nm-${n.id}`, famille: 'carnet', titre: m.nom, magasin: m.nom, lien: lienNote(m.nom, n.id), note: ouverte(n) ? { magasin: m.nom, note: n } : undefined,
          detail: [`${derniere.par || 'Un collègue'} te mentionne`, dateCourte(derniere.quand.slice(0, 10)), extrait(derniere.texte, 90)].join(' · '), pastille: { ton: 'type', libelle: 'Mention' } })
      }
    }
  }

  // 434 : visites à préparer (les miennes), puis magasins pas vus depuis plus longtemps que le délai de leur case
  for (const r of rappelsVisites(reseau, noms, moi).filter((r) => r.genre === 'preparer' && mienne(r.visite))) {
    lignes.push({ cle: r.cle, famille: 'visites', titre: r.magasin, magasin: r.magasin, detail: r.detail, lien: `${lienVisite(r.visite).split('?')[0]}?id=${r.visite.id}&etape=preparer`, pastille: { ton: 'gris', libelle: 'À préparer' } })
  }
  const pasVusParCoach = new Map<string, { magasins: string[]; rouge: boolean }>()
  const ecart = (l: { depuis: number | null; delai: number }) => (l.depuis === null ? Infinity : l.depuis - l.delai)
  for (const l of suiviRythme(reseau, anneeDe(j)).filter((l) => l.alerte && noms.has(l.magasin.nom)).sort((x, y) => ecart(y) - ecart(x))) {
    if (encadrement) { ajouterA(pasVusParCoach, libelleSuivi(l.magasin, l.coach), l.magasin.nom); continue }
    lignes.push({ cle: `v-${l.magasin.nom}`, famille: 'visites', titre: l.magasin.nom, magasin: l.magasin.nom, lien: lienFiche(l.magasin.nom),
      detail: [l.case?.libelle ?? 'Non classé', l.depuis !== null ? `pas vu depuis ${l.depuis} j` : 'jamais visité', l.dernierContact && `appel le ${dateCourte(l.dernierContact.date)}`].filter(Boolean).join(' · '), pastille: { ton: 'type', libelle: 'Visite' } })
  }
  lignes.push(...synthese('visites', 'vc', pasVusParCoach, (n) => `${pluriel(n, 'magasin')} pas vu${n > 1 ? 's' : ''}`, () => '/visites?vue=rythme'))

  return { journee, lignes }
}
