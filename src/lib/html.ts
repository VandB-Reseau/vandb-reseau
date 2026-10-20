// Communications mises en forme (mail, page web, éditeur) : le HTML collé est reconstruit balise par balise
// à partir d'une liste fermée. Aucun script, aucun formulaire, aucun cadre, aucun gestionnaire d'événement ;
// liens web, courriel et téléphone seulement ; images en https. Le nettoyage est refait à chaque affichage.

export const HTML_MAX = 200_000

// Balises retirées avec tout leur contenu
const RETIREES = new Set(['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'button', 'textarea', 'select', 'option',
  'svg', 'math', 'noscript', 'template', 'head', 'meta', 'link', 'title', 'base', 'audio', 'video', 'source', 'track', 'canvas', 'map', 'area', 'dialog', 'portal'])
// Balises gardées (les autres sont remplacées par leur contenu)
const GARDEES = new Set(['p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'sub', 'sup', 'mark', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'blockquote', 'hr', 'pre', 'code', 'center', 'figure', 'figcaption'])
const PROPRIETES = new Set(['color', 'background-color', 'font-weight', 'font-style', 'font-size', 'text-align', 'text-decoration', 'text-transform', 'line-height', 'letter-spacing',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color', 'border-style', 'border-width', 'border-radius', 'border-collapse',
  'vertical-align', 'width', 'max-width', 'list-style-type', 'white-space'])
const ALIGNEMENTS = new Set(['left', 'center', 'right', 'justify'])

const lienSur = (v: string) => /^(https?:|mailto:|tel:)/i.test(v.trim())
const imageSure = (v: string) => /^https:\/\//i.test(v.trim())

// Taille de texte : 12 px au moins (règle de l'app), sinon la taille par défaut
function tailleSure(v: string): boolean {
  const m = /^(\d+(?:\.\d+)?)(px|pt|em|rem|%)$/.exec(v)
  if (!m) return ['medium', 'large', 'x-large', 'xx-large', 'larger'].includes(v)
  const n = Number(m[1])
  const px = m[2] === 'px' ? n : m[2] === 'pt' ? (n * 4) / 3 : m[2] === '%' ? (n / 100) * 16 : n * 16
  return px >= 12 && px <= 64
}

function stylePropre(style: string): string {
  const garde: string[] = []
  for (const decl of style.split(';')) {
    const i = decl.indexOf(':')
    if (i < 0) continue
    const prop = decl.slice(0, i).trim().toLowerCase()
    const valeur = decl.slice(i + 1).replace(/!important/gi, '').trim().toLowerCase()
    if (!PROPRIETES.has(prop) || !valeur || /url\(|expression|javascript|@import|\\|<|>|var\(/.test(valeur)) continue
    if (prop === 'font-size' && !tailleSure(valeur)) continue
    garde.push(`${prop}: ${valeur}`)
  }
  return garde.join('; ')
}

function copier(source: Node, cible: Node, doc: Document) {
  for (const n of Array.from(source.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE) { cible.appendChild(doc.createTextNode(n.textContent ?? '')); continue }
    if (n.nodeType !== Node.ELEMENT_NODE) continue
    const el = n as Element
    const tag = el.tagName.toLowerCase()
    if (RETIREES.has(tag)) continue
    // <font color> devient un <span> coloré ; les autres balises inconnues laissent leur contenu
    const nom = tag === 'font' ? 'span' : tag
    if (!GARDEES.has(nom)) { copier(el, cible, doc); continue }
    if (nom === 'img' && !imageSure(el.getAttribute('src') ?? '')) continue
    const neuf = doc.createElement(nom)
    let style = stylePropre(el.getAttribute('style') ?? '')
    if (tag === 'font' && el.getAttribute('color') && /^#?[\w]+$/.test(el.getAttribute('color')!)) style = [`color: ${el.getAttribute('color')}`, style].filter(Boolean).join('; ')
    if (style) neuf.setAttribute('style', style)
    const align = (el.getAttribute('align') ?? '').toLowerCase()
    if (ALIGNEMENTS.has(align)) neuf.setAttribute('align', align)
    if (nom === 'a') {
      const href = el.getAttribute('href') ?? ''
      if (lienSur(href)) { neuf.setAttribute('href', href.trim()); neuf.setAttribute('target', '_blank'); neuf.setAttribute('rel', 'noopener noreferrer') }
    }
    if (nom === 'img') {
      neuf.setAttribute('src', el.getAttribute('src')!.trim())
      neuf.setAttribute('alt', (el.getAttribute('alt') ?? '').slice(0, 300))
      neuf.setAttribute('loading', 'lazy')
      neuf.setAttribute('referrerpolicy', 'no-referrer')
      const l = el.getAttribute('width') ?? ''
      if (/^\d{1,4}$/.test(l)) neuf.setAttribute('width', l)
    }
    if (nom === 'td' || nom === 'th') {
      for (const a of ['colspan', 'rowspan']) { const v = el.getAttribute(a) ?? ''; if (/^\d{1,2}$/.test(v)) neuf.setAttribute(a, v) }
      const va = (el.getAttribute('valign') ?? '').toLowerCase()
      if (['top', 'middle', 'bottom'].includes(va)) neuf.setAttribute('valign', va)
    }
    if (nom === 'ol') { const d = el.getAttribute('start') ?? ''; if (/^\d{1,4}$/.test(d)) neuf.setAttribute('start', d) }
    copier(el, neuf, doc)
    cible.appendChild(neuf)
  }
}

// HTML reconstruit, sûr à afficher ; vide si rien de lisible
export function nettoyerHtml(html: string): string {
  if (!html.trim()) return ''
  const source = new DOMParser().parseFromString(html, 'text/html')
  const doc = document.implementation.createHTMLDocument('')
  const racine = doc.createElement('div')
  copier(source.body, racine, doc)
  const propre = racine.innerHTML.trim()
  return texteDuHtml(propre) || racine.querySelector('img') ? propre : ''
}

// Texte brut (recherche, fil d'activité) : un saut de ligne par bloc
export function texteDuHtml(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('br').forEach((b) => b.replaceWith('\n'))
  doc.querySelectorAll('p, div, li, tr, h1, h2, h3, h4, h5, h6, blockquote, center, table').forEach((b) => b.append('\n'))
  return (doc.body.textContent ?? '').replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}
