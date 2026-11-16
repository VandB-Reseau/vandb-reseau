// Entrée dans un champ de montant : passe au champ de montant suivant du même écran (ou de la même fenêtre), contenu sélectionné.
// 233 (Joseph, 16/11/2026) : dans un tableau, on saisit comme dans un tableur. Entrée descend d'une ligne dans la même
// colonne (Maj + Entrée remonte), Tab passe à droite comme d'habitude ; coller plusieurs cellules copiées d'Excel
// (une colonne de 12 mois, un bloc de quantités) remplit les champs du tableau à partir de celui où l'on colle.
const visible = (c: HTMLElement) => c.offsetParent !== null
const champDe = (cellule: Element | null | undefined) =>
  [...(cellule?.querySelectorAll<HTMLInputElement>('input[inputmode=decimal]:not([disabled])') ?? [])].find(visible) ?? null

// Le champ du tableau à « lignes » plus bas (ou plus haut si négatif) et « colonnes » plus à droite ; les lignes sans
// champ dans cette colonne (sous-totaux, titres) sont sautées
function voisin(champ: HTMLInputElement, lignes: number, colonnes = 0): HTMLInputElement | null {
  const cellule = champ.closest('td, th') as HTMLTableCellElement | null
  const ligne = cellule?.parentElement as HTMLTableRowElement | null
  const tableau = ligne?.closest('table')
  if (!cellule || !ligne || !tableau) return null
  const toutes = [...tableau.querySelectorAll<HTMLTableRowElement>('tbody tr')]
  const colonne = cellule.cellIndex + colonnes
  let i = toutes.indexOf(ligne)
  if (i < 0) return null
  if (lignes === 0) return champDe(toutes[i].cells[colonne])
  const sens = Math.sign(lignes)
  let reste = Math.abs(lignes)
  while (reste > 0) {
    i += sens
    if (i < 0 || i >= toutes.length) return null
    if (champDe(toutes[i].cells[colonne])) reste -= 1
  }
  return champDe(toutes[i].cells[colonne])
}

// Valeur posée comme si on l'avait tapée : le composant (champ contrôlé par React) la reçoit par son onChange
function poser(champ: HTMLInputElement, valeur: string) {
  const reglage = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  reglage?.call(champ, valeur)
  champ.dispatchEvent(new Event('input', { bubbles: true }))
}

export function installerChampSuivant(): () => void {
  const touche = (e: KeyboardEvent) => {
    const champ = e.target as HTMLElement | null
    if (e.key !== 'Enter' || e.isComposing || !(champ instanceof HTMLInputElement) || champ.inputMode !== 'decimal') return
    // Dans un tableau : la ligne du dessous (ou du dessus), même colonne
    const dessous = voisin(champ, e.shiftKey ? -1 : 1)
    if (dessous) { e.preventDefault(); dessous.focus(); dessous.select(); return }
    if (e.shiftKey && champ.closest('td, th')) { e.preventDefault(); return }
    const zone = champ.closest('[role=dialog]') ?? document.querySelector('main')
    if (!zone) return
    const champs = [...zone.querySelectorAll<HTMLInputElement>('input[inputmode=decimal]:not([disabled])')].filter(visible)
    const suivant = champs[champs.indexOf(champ) + 1]
    e.preventDefault()
    if (suivant) { suivant.focus(); suivant.select() } else champ.blur()
  }
  const coller = (e: ClipboardEvent) => {
    const champ = e.target
    if (!(champ instanceof HTMLInputElement) || champ.inputMode !== 'decimal' || !champ.closest('td, th')) return
    const texte = (e.clipboardData?.getData('text/plain') ?? '').replace(/\r/g, '').replace(/\n+$/, '')
    if (!/[\t\n]/.test(texte)) return // une seule valeur : collage habituel
    e.preventDefault()
    const grille = texte.split('\n').map((l) => l.split('\t'))
    let dernier: HTMLInputElement | null = null
    grille.forEach((ligne, i) => ligne.forEach((v, j) => {
      const cible = i === 0 && j === 0 ? champ : voisin(champ, i, j)
      if (!cible) return
      poser(cible, v.trim().replace(/\s*€$/, ''))
      dernier = cible
    }))
    ;(dernier as HTMLInputElement | null)?.focus()
  }
  document.addEventListener('keydown', touche)
  document.addEventListener('paste', coller)
  return () => { document.removeEventListener('keydown', touche); document.removeEventListener('paste', coller) }
}
