import { etapesOuverture, type IdEtape, type Magasin, type Reseau } from './modele'

// Ouverture suivie par étapes (sprint 25, F3) : cinq étapes saisies puis l'ouverture elle-même (date du magasin)
export type EtatEtape = 'faite' | 'retard' | 'prevue' | 'vide'
export interface EtatOuverture {
  etapes: { id: IdEtape | 'ouverture'; libelle: string; prevu: string; fait: string; etat: EtatEtape }[]
  faites: number
  total: number
  retard: { libelle: string; prevu: string } | null
  prochaine: { libelle: string; prevu: string } | null
}

export const aOuvrir = (m: Magasin, jour: string) => !m.ouverture || m.ouverture > jour

export function etatOuverture(reseau: Reseau, m: Magasin): EtatOuverture {
  const suivi = reseau.ouvertures[m.nom]?.etapes ?? {}
  const etat = (prevu: string, fait: string): EtatEtape => (fait ? 'faite' : prevu && prevu < reseau.jour ? 'retard' : prevu ? 'prevue' : 'vide')
  const etapes: EtatOuverture['etapes'] = etapesOuverture.map((e) => {
    const x = suivi[e.id] ?? { prevu: '', fait: '' }
    return { id: e.id, libelle: e.libelle, prevu: x.prevu, fait: x.fait, etat: etat(x.prevu, x.fait) }
  })
  const ouverte = !!m.ouverture && m.ouverture <= reseau.jour
  etapes.push({ id: 'ouverture', libelle: 'Ouverture', prevu: m.ouverture, fait: ouverte ? m.ouverture : '', etat: ouverte ? 'faite' : m.ouverture ? 'prevue' : 'vide' })
  const enRetard = etapes.find((e) => e.etat === 'retard')
  const suivante = etapes.find((e) => e.etat !== 'faite')
  return {
    etapes, total: etapes.length, faites: etapes.filter((e) => e.etat === 'faite').length,
    retard: enRetard ? { libelle: enRetard.libelle, prevu: enRetard.prevu } : null,
    prochaine: suivante ? { libelle: suivante.libelle, prevu: suivante.prevu } : null,
  }
}
