import type { TypeSimulation } from '../data/pilotage'

// Titres et questions des simulateurs, lus aussi par la recherche rapide (232, Joseph 16/11/2026) sans charger les écrans
export const LISTE_SIMULATEURS: { cle: TypeSimulation; titre: string; question: string }[] = [
  { cle: 'levier', titre: 'Mon meilleur levier', question: 'Quel petit effort rapporte le plus ?' },
  { cle: 'embauche', titre: 'Embaucher', question: 'Embauche, départ, heures, primes ?' },
  { cle: 'prix', titre: 'Promo, prix, remises', question: 'Combien vendre en plus, mes remises sont-elles dans les repères ?' },
  { cle: 'tresorerie', titre: 'Coup dur de trésorerie', question: 'Et si le CA baisse, si un client paie en retard ?' },
  { cle: 'vente_additionnelle', titre: 'Vente additionnelle', question: 'Un article de plus à un client sur dix ?' },
  { cle: 'reste_a_faire', titre: 'Reste à faire du mois', question: 'Combien vendre par jour pour tenir mon budget ?' },
  { cle: 'soiree', titre: 'Soirée, dégustation', question: 'Combien de participants pour ne pas perdre d’argent ?' },
  { cle: 'achat', titre: 'Acheter en volume', question: 'La remise vaut-elle le stock qui reste et qui dort ?' },
  { cle: 'investissement', titre: 'Investir', question: 'Terrasse, travaux, four, marché extérieur : en combien de temps remboursé ?' },
  { cle: 'exterieur', titre: 'Contrat extérieur', question: 'Ce contrat avec une association est-il rentable ?' },
  { cle: 'tireuses', titre: 'Parc de tireuses', question: 'Combien de week-ends pour payer une tireuse ?' },
  { cle: 'pression', titre: 'Ma carte pression', question: 'Quels becs, quelle marge, quelle perte ?' },
  { cle: 'calculette', titre: 'Prix et marge', question: 'À quel prix vendre pour ma marge ?' },
  { cle: 'ouverture', titre: 'Dimanche ou jour férié', question: 'Ouvrir ce jour-là rapporte-t-il ?' },
  // 228 (Joseph, 16/11/2026) : son fichier « Simulateur remises B2B » dans l'app
  { cle: 'remises_b2b', titre: 'Remises entreprise par paliers', question: 'Quelle remise par palier sans casser ma marge ?' },
  // 287, 291, 292 (Joseph, 18/11/2026)
  { cle: 'remuneration', titre: 'Me rémunérer', question: 'Salaire ou dividendes : combien je garde, combien part en impôts ?' },
  { cle: 'loyer', titre: 'Mon loyer', question: 'Que pèse mon loyer, que coûte une hausse ?' },
  // Joseph, 18/11/2026
  { cle: 'formation', titre: 'Former un collaborateur', question: 'Que coûte une formation, une fois l’OPCO, le CPF et les aides déduits ?' },
  { cle: 'mix', titre: 'Mix Cave et Bar', question: 'Si plus de CA passe au bar, que gagne-t-on ?' },
]
