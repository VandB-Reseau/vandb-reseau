// Fiche magasin (choix 202 et 203, Joseph 15/11/2026), gardé sur l'appareil :
// - la liste de Magasins telle qu'elle était filtrée, pour passer au magasin précédent ou suivant sans y revenir ;
// - le dernier onglet et le dernier filtre de l'Activité, rouverts à l'ouverture d'une fiche sans onglet demandé.
// Sans mémoire possible (navigation privée), la fiche s'ouvre sur la Vue d'ensemble et suit l'ordre alphabétique.
const CLE_LISTE = 'vandb-liste-magasins'
const CLE_ONGLET = 'vandb-fiche-onglet'
const CLE_FIL = 'vandb-fiche-fil'

const lire = (stock: () => Storage, cle: string) => { try { return stock().getItem(cle) } catch { return null } }
const ecrire = (stock: () => Storage, cle: string, v: string | null) => {
  try { if (v === null) stock().removeItem(cle); else stock().setItem(cle, v) } catch { /* pas de mémoire : rien de grave */ }
}

export function memoriserListe(noms: string[]) {
  const v = JSON.stringify(noms)
  if (lire(() => sessionStorage, CLE_LISTE) !== v) ecrire(() => sessionStorage, CLE_LISTE, v)
}

// Voisins dans la liste filtrée si le magasin y est, sinon dans tous les magasins visibles, par ordre alphabétique
export function voisinsDe(nom: string, tous: string[]): { precedent: string | null; suivant: string | null } {
  let liste: string[] = []
  try { const v = JSON.parse(lire(() => sessionStorage, CLE_LISTE) ?? '[]'); if (Array.isArray(v)) liste = v.filter((x): x is string => typeof x === 'string' && tous.includes(x)) } catch { /* liste illisible */ }
  if (!liste.includes(nom)) liste = [...tous].sort((a, b) => a.localeCompare(b, 'fr'))
  const i = liste.indexOf(nom)
  return { precedent: i > 0 ? liste[i - 1] : null, suivant: i >= 0 && i < liste.length - 1 ? liste[i + 1] : null }
}

export const ongletRetenu = () => lire(() => localStorage, CLE_ONGLET)
export const filRetenu = () => lire(() => localStorage, CLE_FIL)
export const retenirOnglet = (o: string) => ecrire(() => localStorage, CLE_ONGLET, o)
export const retenirFil = (f: string) => ecrire(() => localStorage, CLE_FIL, f === 'tout' ? null : f)
