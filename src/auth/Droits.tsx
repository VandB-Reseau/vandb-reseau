import { createContext, useContext, type ReactNode } from 'react'

// Ce que le compte peut modifier. Les référentiels (liste des magasins, affectations, équipe, fiches des
// personnes, campagnes, thématiques, réglages) sont tenus par le Directeur de réseau seul ; la base refuse
// les autres écritures (script cloisonnement_equipe.sql), l'écran n'en montre donc pas les boutons.
interface Droits { referentiels: boolean }
const Ctx = createContext<Droits>({ referentiels: true })

export function DroitsProvider({ referentiels, children }: Droits & { children: ReactNode }) {
  return <Ctx.Provider value={{ referentiels }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useDroits = () => useContext(Ctx)
