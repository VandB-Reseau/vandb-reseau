import v1 from '../assets/visages/visage1.png'
import v2 from '../assets/visages/visage2.png'
import v3 from '../assets/visages/visage3.png'
import v4 from '../assets/visages/visage4.png'
import v5 from '../assets/visages/visage5.png'
import v6 from '../assets/visages/visage6.png'

// Visages de la banque d'illustrations de la charte V and B (« Humains »), choisis à la main dans la fiche
// de chaque personne ; sans choix, ses initiales restent (Joseph, 23/10/2026)
export const visages: Record<string, string> = { v1, v2, v3, v4, v5, v6 }
export const estVisage = (v: unknown): v is string => typeof v === 'string' && v in visages
