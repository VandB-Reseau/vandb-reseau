// Sans dépendance : importé tel quel par les tests
// Résumé d'un compte rendu pour le fil d'actualité, construit par règles (sans IA) : la phrase clé
// (Synthèse, sinon notes, sinon première partie remplie) et les faits (santé, plan d'action, actions reprises, sujets abordés)
// Libellés courts des parties, dans l'ordre de PARTIES (compteRendu.ts) ; la Synthèse est la sixième
const COURTS = ['chiffres', 'plan précédent', 'magasin et offre', 'clients et animation', 'équipe']
const PARTIES_RESUMEES = [...COURTS, 'synthèse']
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

export function premierePhrase(t: string, max = 110): string {
  const p = t.trim().split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).find(Boolean) ?? ''
  if (p.length <= max) return p
  const coupe = p.slice(0, max)
  return `${coupe.slice(0, Math.max(coupe.lastIndexOf(' '), max * 0.6)).replace(/[\s,;:]+$/, '')}…`
}

export function resumeCompteRendu(v: { notes: string; parties: string[]; plan: { action: string }[] }, reprises = 0, sante = ''): { phrase: string; faits: string } {
  const parties = PARTIES_RESUMEES.map((_p, i) => (typeof v.parties[i] === 'string' ? v.parties[i] : ''))
  const source = parties[5].trim() || v.notes.trim() || parties.find((p) => p.trim()) || ''
  const abordes = COURTS.filter((_c, i) => parties[i].trim())
  const actions = v.plan.filter((a) => a.action.trim()).length
  const faits = [
    sante && `Santé : ${sante}`,
    actions && `${pluriel(actions, 'action')} au plan`,
    reprises && `${pluriel(reprises, 'action')} précédente${reprises > 1 ? 's' : ''} faite${reprises > 1 ? 's' : ''}`,
    abordes.length && `Abordé : ${abordes.join(', ')}`,
  ].filter(Boolean).join(' · ')
  return { phrase: premierePhrase(source), faits }
}
