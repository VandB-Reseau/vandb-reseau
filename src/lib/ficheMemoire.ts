// Fiche magasin (choix 203, Joseph 15/11/2026), gardé sur l'appareil : le dernier onglet et le dernier filtre de
// l'Activité, rouverts à l'ouverture d'une fiche sans onglet demandé. Sans mémoire possible (navigation privée), la fiche
// s'ouvre sur la Vue d'ensemble. Magasin précédent / suivant (202) retiré à la demande de Joseph (15/11/2026).
const CLE_ONGLET = 'vandb-fiche-onglet'
const CLE_FIL = 'vandb-fiche-fil'

const lire = (stock: () => Storage, cle: string) => { try { return stock().getItem(cle) } catch { return null } }
const ecrire = (stock: () => Storage, cle: string, v: string | null) => {
  try { if (v === null) stock().removeItem(cle); else stock().setItem(cle, v) } catch { /* pas de mémoire : rien de grave */ }
}

export const ongletRetenu = () => lire(() => localStorage, CLE_ONGLET)
export const filRetenu = () => lire(() => localStorage, CLE_FIL)
export const retenirOnglet = (o: string) => ecrire(() => localStorage, CLE_ONGLET, o)
export const retenirFil = (f: string) => ecrire(() => localStorage, CLE_FIL, f === 'tout' ? null : f)
