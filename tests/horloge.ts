import type { Page } from '@playwright/test'

// Date des tests : les données fictives sont écrites autour de la fin octobre 2026 (chiffres jusqu'à septembre,
// ouvertures de novembre et de janvier, visites d'octobre). Sans repère fixe, la suite vieillit avec le calendrier et
// casse la mise en ligne. Tests et navigateur vivent donc le 27/10/2026 à 10 h, l'horloge continue de tourner
// (durées, délais et minuteries inchangés : seul le point de départ est décalé).
export const MAINTENANT_DES_TESTS = '2026-10-27T10:00:00+01:00'

const Origine = Date
const DECALAGE = Origine.parse(MAINTENANT_DES_TESTS) - Origine.now()

if (!(globalThis as { __horlogeDecalee?: boolean }).__horlogeDecalee) {
  class DateDecalee extends Origine {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(Origine.now() + DECALAGE)
      else super(...(args as [string | number | Date]))
    }
    static now() { return Origine.now() + DECALAGE }
  }
  globalThis.Date = DateDecalee as DateConstructor
  ;(globalThis as { __horlogeDecalee?: boolean }).__horlogeDecalee = true
}

// Même décalage dans la page, avant tout script de l'app
export async function decalerHorloge(page: Page) {
  await page.addInitScript((cible: number) => {
    const O = Date
    const d = cible - O.now()
    class D extends O {
      constructor(...a: unknown[]) {
        if (a.length === 0) super(O.now() + d)
        else super(...(a as [string | number | Date]))
      }
      static now() { return O.now() + d }
    }
    ;(window as unknown as { Date: DateConstructor }).Date = D as DateConstructor
  }, Origine.now() + DECALAGE)
}
