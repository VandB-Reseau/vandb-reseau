import { test, expect } from '@playwright/test'
import { proposerMagasins } from '../src/data/plan'
import type { Reseau } from '../src/data/modele'

// Deux Coachs fictifs : Anne habite à l'ouest et a aussi tous les magasins de l'est, Bruno habite à l'est et n'en a qu'un
test('la répartition confie les magasins éloignés au Coach le plus proche', () => {
  test.skip(test.info().project.name !== 'pc')
  const magasin = (nom: string, lon: number, coach: string) => ({ nom, lat: 47, lon, ouverture: '2020-01-01', rrEnDirect: false, historiqueCoach: [{ date: '2020-01-01', coach }] })
  const coach = (nom: string, lon: number) => ({ nom, lat: 47, lon, fictif: false, arrivee: '', historiqueRR: [], rr: null })
  const reseau = {
    jour: '2026-10-14',
    parametres: { maxUnits: 100, alertThreshold: 90, poidsOuvert: 1, poidsRenforce: 2, prepDuration: 3, postDuration: 6 },
    equipe: [coach('Anne OUEST', 0), coach('Bruno EST', 4)],
    magasins: [magasin('Ouest 1', 0.2, 'Anne OUEST'), magasin('Ouest 2', -0.2, 'Anne OUEST'), magasin('Est 1', 4.1, 'Anne OUEST'), magasin('Est 2', 3.9, 'Anne OUEST'), magasin('Est 3', 4.2, 'Bruno EST')],
  } as unknown as Reseau
  const p = proposerMagasins(reseau, reseau.jour, 100)
  expect(p.map((x) => `${x.magasin.nom}>${x.coach}`).sort()).toEqual(['Est 1>Bruno EST', 'Est 2>Bruno EST'])
  expect(p.every((x) => x.raison === 'trajets')).toBe(true)
})
