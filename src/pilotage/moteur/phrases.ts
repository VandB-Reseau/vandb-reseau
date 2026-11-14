import type { EffetEcart } from './ecartExplique'
import { milliers, tauxCourt } from '../lib/format'

// Chiffres du franchisé en phrases (choix 119, Joseph 13/11/2026) : une phrase sous chaque chiffre clé, écrite par des
// modèles fixes, sans intelligence artificielle. Chaque modèle est vérifié dans tests/pilotage/moteur/phrases.spec.ts.
// Seuils : un écart de CA sous 0,5 % se dit « dans ton budget » ; un écart de marge sous 0,1 point « comme prévu » ;
// un écart d'EBE sous 500 € « comme prévu ». L'EBE se lit après la rémunération du gérant (dans l'Équipe du budget). La cause principale n'est citée que si elle fait au moins la moitié de l'écart.

const dansUnivers: Record<string, string> = { cave: 'à la Cave', bar: 'au Bar', exterieur: 'à l’Extérieur' }
const centimes = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const surCent = (part: number) => `${centimes.format(Math.round(part * 10_000) / 100)} €`

// Cause d'un écart de CA, en mots de vendeur
function cause(e: EffetEcart, favorable: boolean): string | null {
  const [quoi, u] = e.cle.split('/')
  const ou = dansUnivers[u]
  if (!ou) return null
  if (quoi === 'tickets') return favorable ? `${ou}, grâce à plus de clients` : `${ou}, où il manque des clients`
  if (quoi === 'panier') return favorable ? `${ou}, grâce au panier moyen` : `${ou}, où le panier moyen baisse`
  return ou
}

export function phraseCA(x: { fin: string; caReel: number; caBudget: number | null; caN1: number | null; anneeN1: number; effets?: EffetEcart[] }): string {
  if (x.caBudget && x.caBudget > 0) {
    const ecart = x.caReel - x.caBudget
    const part = ecart / x.caBudget
    if (Math.abs(part) < 0.005) return `À fin ${x.fin}, tu es dans ton budget.`
    const favorable = ecart > 0
    let p = `À fin ${x.fin}, tu es ${tauxCourt(Math.abs(Math.round(part * 1000) / 1000))} ${favorable ? 'au-dessus de' : 'sous'} ton budget, soit ${milliers(Math.abs(ecart))} ${favorable ? 'de plus' : 'de moins'}`
    const effets = (x.effets ?? []).filter((e) => Math.sign(e.effet) === Math.sign(ecart))
    const principal = effets.sort((a, b) => Math.abs(b.effet) - Math.abs(a.effet))[0]
    const c = principal && (x.effets?.length ?? 0) > 1 && Math.abs(principal.effet) >= Math.abs(ecart) / 2 ? cause(principal, favorable) : null
    if (c) p += `, surtout ${c}`
    return `${p}.`
  }
  if (x.caN1 && x.caN1 > 0) {
    const part = x.caReel / x.caN1 - 1
    if (Math.abs(part) < 0.005) return `À fin ${x.fin}, tu fais autant qu’en ${x.anneeN1}.`
    return `À fin ${x.fin}, tu fais ${tauxCourt(Math.abs(Math.round(part * 1000) / 1000))} ${part > 0 ? 'de plus' : 'de moins'} qu’en ${x.anneeN1}.`
  }
  return `À fin ${x.fin}, tu as fait ${milliers(x.caReel)} de chiffre d’affaires.`
}

export function phraseMarge(x: { taux: number | null; tauxBudget: number | null }): string | null {
  if (x.taux === null) return null
  const p = `Sur 100 € vendus, il te reste ${surCent(x.taux)} de marge`
  if (x.tauxBudget === null) return `${p}.`
  const d = x.taux - x.tauxBudget
  if (Math.abs(d) < 0.001) return `${p}, comme prévu.`
  return `${p}, ${surCent(Math.abs(d))} ${d > 0 ? 'de plus' : 'de moins'} que prévu.`
}

export function phraseFP(pctFP: number | null): string | null {
  if (pctFP === null || pctFP <= 0) return null
  return `Sur 100 € vendus, ${surCent(pctFP)} paient l’équipe.`
}

export function phraseEBE(x: { valeur: number; budget: number | null; fin: string | null }): string {
  const quand = x.fin ? `À fin ${x.fin}, il` : 'Sur l’année, il'
  const p = `${quand} te reste ${milliers(x.valeur)} pour rembourser tes emprunts, investir et payer tes impôts`
  if (x.budget === null) return `${p}.`
  const d = x.valeur - x.budget
  if (Math.abs(d) < 500) return `${p}, comme prévu.`
  return `${p}, ${milliers(Math.abs(d))} ${d > 0 ? 'de plus' : 'de moins'} que prévu.`
}

// Accueil du franchisé : le CA du dernier mois connu face au même mois de l'an dernier (écart déjà en %, ex. −4,2)
export function phraseCADuMois(x: { mois: string; reference: string; ecartPct: number | null }): string | null {
  if (x.ecartPct === null) return null
  if (Math.abs(x.ecartPct) < 0.5) return `En ${x.mois}, tu fais autant qu’en ${x.reference}.`
  return `En ${x.mois}, tu fais ${tauxCourt(Math.round(Math.abs(x.ecartPct) * 10) / 1000)} ${x.ecartPct > 0 ? 'de plus' : 'de moins'} qu’en ${x.reference}.`
}
