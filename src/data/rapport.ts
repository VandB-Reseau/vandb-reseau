// Rapport du mois (refonte vague 3, Joseph 09/11/2026, 29A) : ce qu'un Directeur, un RR ou un Coach relit chaque mois
// sur son périmètre. Calculé sur les données déjà lues ; l'écart au budget vient du moteur du pilotage.
import { analyserAu, caDe, chiffresDuMagasin, type Analyse } from './chiffres'
import { actionsDes, enRetard } from './actions'
import { anneeDe, suiviRythme, type LigneRythme } from './visites'
import { estVisite } from './chiffres'
import { avancement, objectifsDu, type Objectif } from './objectifs'
import type { Reseau } from './modele'

export interface RapportMois {
  mois: string | null // dernier mois connu de la caisse
  magasins: number
  ca: number | null; caReference: number | null; ecart: number | null // à magasins comparables (CA connu les deux années)
  decrochent: (Analyse & { magasin: string })[]; surveiller: (Analyse & { magasin: string })[]
  visites: number; visitesReference: number // visites faites dans le mois, référence nine box ramenée au mois
  pasVus: LigneRythme[]
  retards: { magasin: string; nombre: number }[]; totalRetards: number
  objectifs: { magasin: string; o: Objectif; statut: ReturnType<typeof avancement>['statut'] }[]
}

export function rapportDuMois(reseau: Reseau): RapportMois {
  const ouverts = reseau.magasins.filter((m) => m.statut !== 'avenir' && m.ouverture <= reseau.jour)
  const mois = ouverts.map((m) => chiffresDuMagasin(reseau, m.nom).filter((c) => caDe(c) !== null).at(-1)?.mois).filter((x): x is string => !!x).sort().at(-1) ?? null
  const analyses = mois ? ouverts.map((m) => ({ ...analyserAu(chiffresDuMagasin(reseau, m.nom), mois, reseau.seuils), magasin: m.nom })) : []
  const comparables = analyses.filter((a) => a.ca !== null && a.caReference)
  const ca = comparables.length ? comparables.reduce((s, a) => s + a.ca!, 0) : null
  const caReference = comparables.length ? comparables.reduce((s, a) => s + a.caReference!, 0) : null
  const rythme = suiviRythme(reseau, anneeDe(reseau.jour))
  const moisVisites = mois ?? reseau.jour.slice(0, 7)
  const visites = reseau.visites.filter((v) => estVisite(v) && !v.prevue && v.date.startsWith(moisVisites) && v.date <= reseau.jour).length
  const parMagasin = new Map<string, number>()
  for (const x of actionsDes(reseau, null)) if (enRetard(x.a, reseau.jour)) parMagasin.set(x.magasin, (parMagasin.get(x.magasin) ?? 0) + 1)
  const retards = [...parMagasin].map(([magasin, nombre]) => ({ magasin, nombre })).sort((a, b) => b.nombre - a.nombre || a.magasin.localeCompare(b.magasin, 'fr'))
  return {
    mois, magasins: ouverts.length, ca, caReference, ecart: ca !== null && caReference ? ((ca - caReference) / caReference) * 100 : null,
    decrochent: analyses.filter((a) => a.statut === 'decroche').sort((a, b) => (a.ecart ?? 0) - (b.ecart ?? 0)),
    surveiller: analyses.filter((a) => a.statut === 'surveiller').sort((a, b) => (a.ecart ?? 0) - (b.ecart ?? 0)),
    visites, visitesReference: Math.round(rythme.reduce((s, l) => s + l.reference, 0) / 12),
    pasVus: rythme.filter((l) => l.alerte).sort((a, b) => (b.depuis ?? Infinity) - (a.depuis ?? Infinity)),
    retards, totalRetards: retards.reduce((s, r) => s + r.nombre, 0),
    objectifs: ouverts.flatMap((m) => objectifsDu(reseau, m.nom).map((o) => ({ magasin: m.nom, o, statut: avancement(reseau, m.nom, o).statut }))),
  }
}
