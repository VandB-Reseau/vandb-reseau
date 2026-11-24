// Phrase de lecture automatique (Joseph, 24/11/2026, choix 394), comme celle des rapports de Pilotage (387) :
// le chiffre d'ensemble, combien de magasins font mieux ou moins bien, en tête et en retrait. Des comptes et des
// tris de chiffres déjà calculés par le moteur : aucun calcul financier ici.
import { ecartPts, ecartTaux, moins } from './format'


// Classement face à une référence : `ecarts` déjà calculés (null = sans comparaison)
export function lectureEcarts(o: { quoi: string; total: number | null; ref: string; lignes: { nom: string; e: number | null }[]; seuil: number; points?: boolean; inverse?: boolean; unite?: [string, string] }): string | null {
  const [un, plusieurs] = o.unite ?? ['magasin', 'magasins']
  const f = (v: number) => moins(o.points ? ecartPts(v) : ecartTaux(v))
  const avec = o.lignes.filter((l): l is { nom: string; e: number } => l.e !== null)
  if (o.total === null && !avec.length) return null
  const phrases = [o.total === null ? '' : `${o.quoi} : ${f(o.total)} sur ${o.ref}`]
  if (avec.length >= 2) {
    const bien = (e: number) => (o.inverse ? e <= 0 : e >= 0)
    const mieux = avec.filter((l) => bien(l.e)).length
    const net = avec.filter((l) => (o.inverse ? l.e > o.seuil : l.e < -o.seuil)).length
    const seuil = o.points ? `${Math.round(o.seuil * 100)} point${o.seuil >= 0.02 ? 's' : ''}` : `${Math.round(o.seuil * 100)} %`
    phrases.push(`${mieux} ${mieux > 1 ? plusieurs : un} sur ${avec.length} ${mieux > 1 ? 'sont' : 'est'} au niveau ou mieux${net ? `, ${net} ${net > 1 ? 'sont' : 'est'} à plus de ${seuil} en retrait` : ''}`)
    const t = [...avec].sort((a, b) => (o.inverse ? a.e - b.e : b.e - a.e))
    phrases.push(`En tête : ${t[0].nom} (${f(t[0].e)}) ; le plus en retrait : ${t.at(-1)!.nom} (${f(t.at(-1)!.e)})`)
  }
  return phrases.filter(Boolean).join('. ') + '.'
}
