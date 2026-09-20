import { create } from 'zustand';

import { aviso } from '@/lib/registro';
import { supabase } from '@/lib/supabase';
import type { Usuario } from '@/types/database.types';

// Mi PROPIO perfil, con todas las columnas. La policy usuarios_select_propio
// (migración 0014) hace que esta consulta solo pueda devolver mi fila: para ver
// a otra persona está `perfiles_publicos` (usuarios.service.ts).
interface PerfilState {
  perfil: Usuario | null;
  cargando: boolean;
  /**
   * END-11 · Un estado APARTE del perfil, no un perfil en null.
   *
   * Mientras «falló la lectura» y «no hay datos» compartieran representación,
   * la pantalla no podía distinguirlos — y elegía la interpretación más
   * alarmante: «Sin presupuesto · Sin distancia · Sin universidad», a alguien
   * que acababa de llenar ese cuestionario.
   */
  error: string | null;
  setPerfil: (perfil: Usuario | null) => void;
  cargarPerfil: (usuarioId: string) => Promise<void>;
  actualizarPerfil: (usuarioId: string, cambios: Partial<Usuario>) => Promise<void>;
}

export const usePerfilStore = create<PerfilState>((set, get) => ({
  perfil: null,
  cargando: false,
  error: null,
  setPerfil: (perfil) => set({ perfil }),
  cargarPerfil: async (usuarioId) => {
    set({ cargando: true });
    try {
      // maybeSingle y no single: justo después del signUp puede haber una
      // fracción de segundo antes de que el trigger de alta (§12) escriba la
      // fila, y `single` lanzaría en vez de devolver null. Esa fila ausente es
      // un VACÍO legítimo, y por eso no marca error.
      const { data, error } = await supabase.from('usuarios').select('*').eq('id', usuarioId).maybeSingle();

      if (error) {
        // No se toca `perfil`. Un dato viejo es peor que uno nuevo y mejor que
        // una mentira: con el anterior en pantalla la persona ve sus filtros
        // —quizá desactualizados— en vez de leer que los perdió.
        aviso('cargarPerfil falló', { detalle: error.message });
        set({ error: 'No pudimos actualizar tu ficha. Estás viendo los últimos datos cargados.', cargando: false });
        return;
      }

      set({ perfil: data as Usuario | null, error: null, cargando: false });
    } catch (e) {
      aviso('cargarPerfil no respondió', undefined, e);
      set({ error: 'No pudimos actualizar tu ficha. Estás viendo los últimos datos cargados.', cargando: false });
    }
  },
  actualizarPerfil: async (usuarioId, cambios) => {
    const { data, error } = await supabase
      .from('usuarios')
      .update(cambios)
      .eq('id', usuarioId)
      .select()
      .single();
    // Aquí SÍ se lanza, al revés que al leer: quien guarda tiene que enterarse
    // de que no se guardó. Tragarse esto convertiría un fallo de escritura en
    // un «listo» falso, que es el mismo defecto en la otra dirección.
    if (error) throw error;
    set({ perfil: (data as Usuario) ?? get().perfil, error: null });
  },
}));
