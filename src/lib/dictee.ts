import { useEffect, useRef, useState } from 'react'

// Dictée vocale du navigateur (Chrome PC et Android) : le texte reconnu s'ajoute aux notes.
// L'audio n'est ni enregistré ni conservé.
interface Reconnaissance {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start: () => void; stop: () => void
}
type Fabrique = new () => Reconnaissance

function fabrique(): Fabrique | null {
  const w = window as unknown as { SpeechRecognition?: Fabrique; webkitSpeechRecognition?: Fabrique }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// « ajouter » doit rester valable d'un rendu à l'autre (ex. mise à jour fonctionnelle d'un état)
export function useDictee(ajouter: (texte: string) => void) {
  const disponible = typeof window !== 'undefined' && fabrique() !== null
  const [actif, setActif] = useState(false)
  const [erreur, setErreur] = useState('')
  const rec = useRef<Reconnaissance | null>(null)
  useEffect(() => () => rec.current?.stop(), [])

  const demarrer = () => {
    const F = fabrique()
    if (!F) return
    const r = new F()
    r.lang = 'fr-FR'; r.continuous = true; r.interimResults = false
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.trim()
        if (e.results[i].isFinal && t) ajouter(t)
      }
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setErreur('Le micro n’est pas autorisé pour ce site.')
      else if (e.error !== 'no-speech' && e.error !== 'aborted') setErreur('La dictée s’est interrompue.')
    }
    r.onend = () => { setActif(false); rec.current = null }
    setErreur('')
    rec.current = r
    r.start()
    setActif(true)
  }
  const arreter = () => rec.current?.stop()
  return { disponible, actif, erreur, basculer: () => (actif ? arreter() : demarrer()) }
}
