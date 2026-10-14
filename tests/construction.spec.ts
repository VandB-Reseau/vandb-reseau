import { expect, test } from '@playwright/test'
import { construireReseau, statutA } from '../src/data/construction'
import { affectationsFictives, coachsFictifs, configRRFictive, magasinsFictifs } from './donnees-fictives'

const p = { prepDuration: 2, postDuration: 4 }
const reseau = construireReseau({
  magasins: magasinsFictifs, renommages: { 'Gap Test': 'Gap Centre Test' },
  surcharges: [{ store_name: 'Nice Test', resp: 'Responsable surchargé' }, { store_name: 'Metz Test', rr: 'rr1' }, { store_name: 'Lille Test', rr: 'rr3' }],
  affectations: affectationsFictives as never, configRR: configRRFictive, coachs: coachsFictifs, parametres: p,
}, '2026-10-14')
const m = (nom: string) => reseau.magasins.find((x) => x.nom === nom)!

test.describe('construction du réseau', () => {
  test.skip(({ isMobile }) => isMobile, 'logique pure, un seul passage')

  test('statuts selon la date d’ouverture', () => {
    expect(statutA('2026-11-20', '2026-10-14', p)).toBe('preouverture')
    expect(statutA('2026-08-20', '2026-10-14', p)).toBe('nouveau')
    expect(statutA('2020-01-15', '2026-10-14', p)).toBe('ouvert')
    expect(statutA('2027-06-01', '2026-10-14', p)).toBe('avenir')
  })

  test('Coach = dernière affectation à date, RR via le Coach', () => {
    expect(m('Lyon Test').coach).toBe('Noé MODELE')
    expect(m('Lyon Test').rr?.nom).toBe('Sam SUD')
    expect(m('Annecy Test').coach).toBe('Hugo FICTIF')
    expect(m('Annecy Test').rr?.nom).toBe('Alex NORD')
  })

  test('RR en direct prioritaire, sauf rôle intégrés', () => {
    expect(m('Metz Test').rr?.nom).toBe('Alex NORD')
    expect(m('Metz Test').rrEnDirect).toBe(true)
    expect(m('Lille Test').rr?.nom).toBe('Sam SUD') // rr3 = intégrés : le RR du Coach reste affiché
  })

  test('surcharges, renommages, recrutements et dates inconnues', () => {
    expect(m('Nice Test').responsable?.nom).toBe('Responsable surchargé')
    expect(m('Gap Centre Test')).toBeTruthy()
    expect(m('Lyon Test').responsable).toBeNull() // « En cours de recrutement »
    expect(m('Vichy Test').ouvertureConnue).toBe(false)
    expect(m('Vichy Test').coach).toBe('')
    expect(m('Lyon Test').franchise).toBe(false)
    expect(reseau.coachs['Tom TECHNICIEN']).toBeUndefined()
  })
})
