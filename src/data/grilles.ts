// ── Grilles d'audit hygiène et excellence opérationnelle (app_config, clé grilles_audit) ──
// Construites et modifiables dans Paramètres ; remplies pendant la visite d'audit.

export type EtatPoint = 'oui' | 'non' | 'na'
export interface PointGrille { id: string; libelle: string; critique?: boolean }
export interface ThemeGrille { id: string; libelle: string; points: PointGrille[] }
export interface Grille { seuil: number; themes: ThemeGrille[] }
export type Grilles = Record<string, Grille>

export interface Photo { chemin: string; taille: number }
// Libellés recopiés : un audit garde sa grille même si elle change ensuite
export interface ReponsePoint { theme: string; libelle: string; critique?: boolean; etat: EtatPoint | null; commentaire?: string; photos?: Photo[] }
export type Reponses = Record<string, ReponsePoint>

export const libellesGrilles: Record<string, string> = { hygiene: 'Hygiène', excellence: 'Excellence opérationnelle' }

let compteur = 0
export const nouvelId = (prefixe: string) => `${prefixe}_${Date.now().toString(36)}${(compteur++).toString(36)}`

const theme = (id: string, libelle: string, points: [string, boolean?][]): ThemeGrille => ({
  id, libelle, points: points.map(([l, critique], i) => ({ id: `${id}_${i + 1}`, libelle: l, ...(critique ? { critique: true } : {}) })),
})

// Grilles de départ, à ajuster dans Paramètres
export const grillesParDefaut: Grilles = {
  hygiene: {
    seuil: 80,
    themes: [
      theme('froid', 'Chaîne du froid', [
        ['Températures des frigos relevées et notées chaque jour', true],
        ['Aucun produit périmé en rayon, au bar ou en réserve', true],
        ['Produits entamés étiquetés avec leur date d’ouverture'],
      ]),
      theme('bar', 'Bar et plonge', [
        ['Plan de travail et matériel du bar propres'],
        ['Verres et vaisselle propres, rangés à l’abri'],
        ['Lave-verres en état, produits de lavage adaptés'],
        ['Point de lavage des mains équipé (savon, essuie-mains)', true],
      ]),
      theme('stockage', 'Réserve et stockage', [
        ['Réserve rangée, rien posé au sol'],
        ['Produits d’entretien séparés des denrées'],
        ['Poubelles fermées et vidées'],
      ]),
      theme('locaux', 'Salle et sanitaires', [
        ['Salle, terrasse et mobilier propres'],
        ['Sanitaires clients propres et approvisionnés'],
      ]),
      theme('documents', 'Documents', [
        ['Plan de nettoyage affiché et rempli'],
        ['Traçabilité des produits conservée (étiquettes, lots)'],
        ['Formation hygiène et permis d’exploitation à jour'],
      ]),
    ],
  },
  excellence: {
    seuil: 80,
    themes: [
      theme('exterieur', 'Façade et vitrine', [
        ['Façade, enseigne et vitres propres, enseigne éclairée'],
        ['Vitrine conforme à l’opération commerciale en cours'],
        ['Horaires d’ouverture affichés'],
      ]),
      theme('magasin', 'Magasin', [
        ['Rayons pleins, pas de rupture visible'],
        ['Étiquettes de prix présentes et justes'],
        ['Balisage de l’opération en cours en place'],
        ['Nouveautés mises en avant'],
      ]),
      theme('bar', 'Bar', [
        ['Carte du bar à jour'],
        ['Offre food disponible'],
        ['Ambiance conforme (musique, lumière, température)'],
      ]),
      theme('vente', 'Accueil et vente', [
        ['Client salué dans les premières secondes'],
        ['Conseil proposé sur le choix du produit'],
        ['Vente additionnelle proposée'],
        ['Carte de fidélité proposée en caisse'],
      ]),
      theme('reglementation', 'Réglementation', [
        ['Affichage de l’interdiction de vente d’alcool aux mineurs', true],
        ['Licence affichée'],
      ]),
      theme('equipe', 'Équipe', [
        ['Effectif adapté à l’affluence'],
        ['Tenue aux couleurs de l’enseigne'],
      ]),
    ],
  },
}

export function normaliserGrilles(brut: unknown): Grilles {
  const g = (brut && typeof brut === 'object' ? brut : {}) as Partial<Grilles>
  return Object.fromEntries(Object.entries(grillesParDefaut).map(([type, defaut]) => {
    const x = g[type]
    if (!x || !Array.isArray(x.themes)) return [type, defaut]
    return [type, { seuil: Number.isFinite(Number(x.seuil)) ? Number(x.seuil) : defaut.seuil, themes: x.themes }]
  }))
}

export const nombrePoints = (g: Grille) => g.themes.reduce((n, t) => n + t.points.length, 0)

// Réponses vides pour une grille, avec les libellés du moment
export function reponsesVides(g: Grille): Reponses {
  return Object.fromEntries(g.themes.flatMap((t) => t.points.map((p) => [p.id, { theme: t.libelle, libelle: p.libelle, ...(p.critique ? { critique: true } : {}), etat: null }])))
}

// Fusion : un audit déjà rempli garde ses points ; les points ajoutés depuis apparaissent vides
export function reponsesPourSaisie(g: Grille, existantes: Reponses | undefined): Reponses {
  if (!existantes || !Object.keys(existantes).length) return reponsesVides(g)
  const vides = reponsesVides(g)
  return { ...Object.fromEntries(Object.entries(vides).filter(([id]) => !(id in existantes))), ...existantes }
}

// Points regroupés par thème, dans l'ordre de saisie
export function parTheme(reponses: Reponses): { theme: string; points: [string, ReponsePoint][] }[] {
  const groupes = new Map<string, [string, ReponsePoint][]>()
  for (const e of Object.entries(reponses)) groupes.set(e[1].theme, [...(groupes.get(e[1].theme) ?? []), e])
  return [...groupes].map(([theme, points]) => ({ theme, points }))
}

export interface ResultatGrille { renseignes: number; total: number; oui: number; non: number; score: number | null; critiques: ReponsePoint[]; conforme: boolean | null }

// Score = conformes / (conformes + non conformes) ; un point critique non conforme rend l'audit non conforme
export function resultatGrille(reponses: Reponses, seuil: number): ResultatGrille {
  const liste = Object.values(reponses)
  const oui = liste.filter((r) => r.etat === 'oui').length
  const non = liste.filter((r) => r.etat === 'non').length
  const renseignes = liste.filter((r) => r.etat !== null).length
  const score = oui + non ? Math.round((oui / (oui + non)) * 1000) / 10 : null
  const critiques = liste.filter((r) => r.critique && r.etat === 'non')
  const conforme = score === null ? null : critiques.length === 0 && score >= seuil
  return { renseignes, total: liste.length, oui, non, score, critiques, conforme }
}

export const ecarts = (reponses: Reponses | undefined) => Object.values(reponses ?? {}).filter((r) => r.etat === 'non')
export const photosDe = (reponses: Reponses | undefined) => Object.values(reponses ?? {}).flatMap((r) => r.photos ?? [])
