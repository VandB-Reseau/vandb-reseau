// « Voir comme » sur le budget : magasins de la personne vue (null hors aperçu). Posé par la zone du budget.
export const apercuPilotage: { magasins: Set<string> | null; cle: string } = { magasins: null, cle: '' }
export const dansApercu = () => apercuPilotage.magasins !== null
export const visibleEnApercu = (magasin: string) => !apercuPilotage.magasins || apercuPilotage.magasins.has(magasin)
