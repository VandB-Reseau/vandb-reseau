import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth as useAuthReseau } from '../../auth/AuthContext'
import { useApercu } from '../../auth/Apercu'
import { pilotage } from '../lib/supabase'
import type { Profil } from './roles'

// Profil du pilotage, construit sur celui de l'app réseau (même compte, rôle lu en base par mon_acces) et complété des
// droits propres au pilotage (mes_droits : paramétrage, contrôle de gestion). Fonction absente ou injoignable : aucun
// droit de plus que le rôle.
interface EtatPilotage { profil: Profil | null; pret: boolean }
const Ctx = createContext<EtatPilotage>({ profil: null, pret: false })

export async function lireDroits(): Promise<{ parametreur: boolean; controleGestion: boolean }> {
  try {
    const { data, error } = await pilotage().rpc('mes_droits')
    const d = !error && data && typeof data === 'object' ? (data as { parametrer?: unknown; controle_gestion?: unknown }) : {}
    return { parametreur: d.parametrer === true, controleGestion: d.controle_gestion === true }
  } catch {
    return { parametreur: false, controleGestion: false }
  }
}

export function PilotageAuthProvider({ children }: { children: ReactNode }) {
  const { profil } = useAuthReseau()
  const { apercu, equipe } = useApercu()
  const [droits, setDroits] = useState<{ id: string; parametreur: boolean; controleGestion: boolean } | null>(null)
  const id = profil?.id ?? null
  useEffect(() => {
    if (!id) return
    let actif = true
    lireDroits().then((d) => { if (actif) setDroits({ id, ...d }) })
    return () => { actif = false }
  }, [id])
  const pret = !!profil && droits?.id === profil.id
  const valeur: EtatPilotage = {
    pret,
    // « Voir comme » : le rôle de la personne vue, sans les droits propres du Directeur (paramètres, contrôle de gestion)
    profil: !profil || !pret ? null
      : apercu ? { id: profil.id, email: profil.email, nom: apercu.franchise, role: 'franchise', apercu: true }
      : equipe ? { id: profil.id, email: profil.email, nom: profil.nom, role: profil.role, apercu: true }
      : { id: profil.id, email: profil.email, nom: profil.nom, role: profil.role, parametreur: droits!.parametreur, controleGestion: droits!.controleGestion },
  }
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): EtatPilotage {
  return useContext(Ctx)
}
