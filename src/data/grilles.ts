// ── Grilles d'audit hygiène et excellence opérationnelle (app_config, clé grilles_audit) ──
// Construites et modifiables dans Paramètres ; remplies pendant la visite d'audit.

export type EtatPoint = 'oui' | 'non' | 'na'
export interface PointGrille { id: string; libelle: string; critique?: boolean }
export interface ThemeGrille { id: string; libelle: string; points: PointGrille[] }
// libelle : nom de l'audit (grilles ajoutées dans Paramètres) ; supprimee : date de retrait, l'audit n'est plus proposé
// mais ses résultats déjà remplis restent lisibles (Joseph, 17/11/2026)
export interface Grille { seuil: number; themes: ThemeGrille[]; libelle?: string; supprimee?: string }
export type Grilles = Record<string, Grille>

export interface Photo { chemin: string; taille: number }
// Libellés recopiés : un audit garde sa grille même si elle change ensuite
export interface ReponsePoint { theme: string; libelle: string; critique?: boolean; etat: EtatPoint | null; commentaire?: string; photos?: Photo[] }
export type Reponses = Record<string, ReponsePoint>

export const libellesGrilles: Record<string, string> = { hygiene: 'Hygiène', excellence: 'Excellence opérationnelle', marge: 'Audit de marge' }

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
  // 244 (Joseph, 16/11/2026) : sa check-list « Audit de marge » ; « Non » = à mettre en place, le commentaire porte l'échéance
  marge: {
    seuil: 80,
    themes: [
      theme('commande', 'Commande', [
        ['Commandes ajustées à l’activité réelle (stock de quelques références sondé face aux ventes)'],
        ['Fûts commandés en priorité pendant les promotions'],
        ['Hors promotion, fûts commandés avec une marge cohérente (simulateur « Ma carte pression »)'],
        ['Commandes des promotions des années passées archivées'],
      ]),
      theme('reception', 'Réception', [
        ['Livraison rapprochée du bon de livraison, et le bon de la facture', true],
        ['Quantités, dates limites de consommation et d’utilisation contrôlées'],
        ['Prix facturés des achats en direct contrôlés face aux prix négociés'],
        ['Avoirs demandés et remboursements suivis'],
      ]),
      theme('stockage', 'Stockage', [
        ['Inventaire tournant chaque semaine au magasin'],
        ['Premier entré, premier sorti respecté'],
        ['Contrôle visuel régulier des stocks'],
        ['Dates limites contrôlées chaque mois, au magasin et en réserve'],
        ['Produits rares stockés sous clé, accès limité'],
      ]),
      theme('prix', 'Prix et caisse', [
        ['Prix de vente des produits en direct calculés (simulateur « Prix et marge »)'],
        ['Prix en magasin mis à jour pour les produits de la centrale'],
        ['Prix en magasin mis à jour pour les produits achetés en direct'],
        ['Cours des produits rares suivi'],
        ['Taux de marge cohérent sur les coffrets bois'],
        ['Tous les coûts intégrés dans les prix des marchés extérieurs (simulateur « Contrat extérieur »)'],
        ['Pertes notées et valorisées', true],
        ['Marge du mois suivie avec le stock saisi'],
        ['Briefing pour orienter les ventes (meilleure marge, dates courtes)'],
        ['Programmation des caisses vérifiée (consignes automatiques, taux de TVA)'],
        ['Annulations en caisse vérifiées et tracées', true],
      ]),
      theme('bar', 'Bar', [
        ['Pression servie uniquement dans des verres gradués'],
        ['Stop-mousse en place'],
        ['Procédure de déstockage en place'],
        ['Tout est tapé en caisse au bar, dans le bon intitulé', true],
        ['Audits fûts et bouteilles réalisés (simulateur « Ma carte pression », audit de la perte)'],
        ['Inventaire du bar chaque mois'],
        ['Prix de vente du bar calculés'],
        ['Offerts du bar suivis'],
      ]),
      theme('alimentaire', 'Alimentaire au bar', [
        ['Fiche de coût de chaque assiette (simulateur « Prix et marge »)'],
        ['Fiches de coût affichées au poste d’envoi'],
        ['Équipe formée aux techniques de préparation'],
        ['Repères de grammage donnés'],
        ['Denrées entamées stockées avec leur date limite secondaire'],
      ]),
    ],
  },
}

export const grillesDeDepart = Object.keys(grillesParDefaut)

export function normaliserGrilles(brut: unknown): Grilles {
  const g = (brut && typeof brut === 'object' ? brut : {}) as Partial<Grilles>
  const lire = (x: Grille | undefined, defaut: Grille | null): Grille | null => {
    if (!x || !Array.isArray(x.themes)) return defaut
    const libelle = typeof x.libelle === 'string' && x.libelle.trim() ? x.libelle.trim() : undefined
    if (!defaut && !libelle) return null
    return {
      seuil: Number.isFinite(Number(x.seuil)) ? Number(x.seuil) : defaut?.seuil ?? 80, themes: x.themes,
      ...(libelle ? { libelle } : {}), ...(typeof x.supprimee === 'string' && x.supprimee ? { supprimee: x.supprimee } : {}),
    }
  }
  // Grilles de départ toujours présentes (retirées = marquées supprimées), puis les audits ajoutés
  const depart = Object.entries(grillesParDefaut).map(([type, defaut]) => [type, lire(g[type], defaut)!] as const)
  const ajoutees = Object.entries(g).filter(([type]) => !(type in grillesParDefaut)).map(([type, x]) => [type, lire(x, null)] as const).filter((e): e is [string, Grille] => !!e[1])
  return Object.fromEntries([...depart, ...ajoutees])
}

export const libelleGrille = (grilles: Grilles, type: string) => grilles[type]?.libelle || libellesGrilles[type] || 'Audit'
// Audits proposés en visite : ceux qui ne sont pas supprimés, avec au moins un point
export const grillesActives = (grilles: Grilles) => Object.entries(grilles).filter(([, g]) => !g.supprimee && nombrePoints(g) > 0).map(([type]) => type)

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
