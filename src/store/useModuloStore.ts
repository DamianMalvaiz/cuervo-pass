import { create } from 'zustand';

import type { Modulo } from '@/components/SelectorModulo';

/**
 * Qué módulo muestra Inicio. Es estado de interfaz, no un dato de la cuenta: vive en un store y
 * no en un parámetro de ruta para que «Mi anuncio de roomie» (en Mi perfil) pueda abrir Inicio
 * ya en Roomies sin que cada prueba de pantalla tenga que simular los parámetros del enrutador.
 */
interface ModuloState {
  modulo: Modulo;
  setModulo: (m: Modulo) => void;
}

export const useModuloStore = create<ModuloState>((set) => ({
  modulo: 'depas',
  setModulo: (modulo) => set({ modulo }),
}));
