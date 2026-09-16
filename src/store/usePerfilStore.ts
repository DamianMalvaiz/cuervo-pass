import { create } from 'zustand';

import type { Usuario } from '@/types/database.types';

interface PerfilState {
  perfil: Usuario | null;
  cargando: boolean;
  setPerfil: (perfil: Usuario | null) => void;
}

// TODO (Semana 2): cargar/editar el perfil real contra Supabase desde aquí.
export const usePerfilStore = create<PerfilState>((set) => ({
  perfil: null,
  cargando: false,
  setPerfil: (perfil) => set({ perfil }),
}));
