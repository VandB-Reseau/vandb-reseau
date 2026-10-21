// Suivi rangé par magasin (santé, journal, audits, associés, actions, déploiements, constats de campagne, préparation des visites).
// Dans la base, une ligne par magasin et par rubrique (table suivi_magasins) : un Coach ou un RR ne lit
// et n'écrit que celles de ses magasins. L'app garde en mémoire l'ancien format d'app_config.
// Tant que le script cloisonnement_equipe.sql n'est pas passé, tout reste dans app_config.

// Clé d'app_config → rubrique de suivi_magasins
export const rubriques = {
  sante_parc: 'sante', sante_parc_sauvegarde: 'sante_sauvegarde', notes_magasins: 'notes', audits: 'audits',
  associes: 'associes', actions: 'actions', deploiements: 'deploiements', campagnes: 'constats',
  preparations_visites: 'preparation',
} as const
export type CleSuivie = keyof typeof rubriques
export const estSuivie = (cle: string): cle is CleSuivie => cle in rubriques

type Objet = Record<string, unknown>
const objet = (v: unknown): Objet => (v && typeof v === 'object' && !Array.isArray(v) ? v as Objet : {})
const vide = (v: unknown) => v === undefined || v === null || (Array.isArray(v) ? !v.length : typeof v === 'object' && !Object.keys(v as Objet).length)

// Partie commune (gardée dans app_config) et valeur de chaque magasin
export function eclater(cle: CleSuivie, valeur: unknown): { commun: unknown; parMagasin: Objet } {
  const v = objet(valeur)
  if (cle === 'deploiements') {
    const valeurs = objet(v.valeurs), journal = objet(v.journal)
    const parMagasin: Objet = {}
    for (const m of new Set([...Object.keys(valeurs), ...Object.keys(journal)])) {
      if (vide(valeurs[m]) && vide(journal[m])) continue
      parMagasin[m] = { valeurs: valeurs[m] ?? {}, journal: journal[m] ?? [] }
    }
    return { commun: { thematiques: Array.isArray(v.thematiques) ? v.thematiques : [] }, parMagasin }
  }
  if (cle === 'campagnes') {
    const parMagasin: Record<string, Objet> = {}
    for (const [campagne, mags] of Object.entries(objet(v.constats))) {
      for (const [m, k] of Object.entries(objet(mags))) if (!vide(k)) (parMagasin[m] ??= {})[campagne] = k
    }
    return { commun: { liste: Array.isArray(v.liste) ? v.liste : [] }, parMagasin }
  }
  return { commun: undefined, parMagasin: Object.fromEntries(Object.entries(v).filter(([, x]) => !vide(x))) }
}

export function assembler(cle: CleSuivie, commun: unknown, parMagasin: Objet): unknown {
  if (cle === 'deploiements') {
    const c = objet(commun)
    const valeurs: Objet = {}, journal: Objet = {}
    for (const [m, x] of Object.entries(parMagasin)) {
      const d = objet(x)
      if (!vide(d.valeurs)) valeurs[m] = d.valeurs
      if (!vide(d.journal)) journal[m] = d.journal
    }
    return { thematiques: Array.isArray(c.thematiques) ? c.thematiques : [], valeurs, journal }
  }
  if (cle === 'campagnes') {
    const constats: Record<string, Objet> = {}
    for (const [m, x] of Object.entries(parMagasin)) for (const [campagne, k] of Object.entries(objet(x))) (constats[campagne] ??= {})[m] = k
    return { liste: Array.isArray(objet(commun).liste) ? objet(commun).liste : [], constats }
  }
  return { ...parMagasin }
}

// Lignes de suivi_magasins → entrées d'app_config, fusionnées avec la partie commune
export function configDepuisSuivi(config: { key: string; value: unknown }[], lignes: { store_name: string; cle: string; valeur: unknown }[]) {
  const parRubrique = new Map<string, Objet>()
  for (const l of lignes) {
    const r = parRubrique.get(l.cle) ?? {}
    r[l.store_name] = l.valeur
    parRubrique.set(l.cle, r)
  }
  const lire = (k: string) => { const v = config.find((c) => c.key === k)?.value; if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return undefined } }
  const autres = config.filter((c) => !estSuivie(c.key))
  return [...autres, ...(Object.keys(rubriques) as CleSuivie[]).map((k) => ({ key: k, value: JSON.stringify(assembler(k, lire(k), parRubrique.get(rubriques[k]) ?? {})) }))]
}
