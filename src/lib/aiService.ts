// Documento maestro v5 · §19 y §24.
//
// Cambio de fondo frente a v3: la app YA NO habla con el microservicio. Antes
// llamaba a EXPO_PUBLIC_AI_SERVICE_URL directo, lo que significaba que la URL
// del servicio —y cualquier credencial que hiciera falta para usarlo— acababan
// dentro del APK, que cualquiera descomprime.
//
// Ahora todo pasa por la Edge Function `ai-proxy`, que valida la sesión, aplica
// la cuota diaria en Postgres y agrega el token compartido. Lo único que viaja
// en el bundle es la URL de Supabase y la anon key, que son públicas por diseño.

import { supabase } from '@/lib/supabase';

export interface ParseoPerfilResultado {
  fuma: boolean;
  mascotas: boolean;
  nivel_ruido: 'bajo' | 'medio' | 'alto';
  horario_predominante: 'diurno' | 'nocturno' | 'mixto';
  notas: string;
  // Dice si la respuesta vino del modelo o de los valores neutros. Sin este
  // campo no hay forma de saber si la IA funciona o si llevas dos semanas
  // guardando valores por omisión para todos y creyendo que sí (§19).
  degradado: boolean;
}

export class ServicioIaError extends Error {
  constructor(message: string, readonly cuotaAgotada = false) {
    super(message);
    this.name = 'ServicioIaError';
  }
}

async function invocarProxy<T>(ruta: 'parsear-perfil' | 'generar-embedding', texto: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: { ruta, texto },
  });

  if (error) {
    // 429 = cuota diaria agotada. Es un estado previsto, no una falla: el
    // llamador lo distingue para poder decirle al usuario qué pasó y qué hacer,
    // en vez de un "algo salió mal" (§27).
    const status = (error as { context?: { status?: number } }).context?.status;
    throw new ServicioIaError(error.message, status === 429);
  }
  return data as T;
}

export function parsearPerfil(texto: string): Promise<ParseoPerfilResultado> {
  return invocarProxy<ParseoPerfilResultado>('parsear-perfil', texto);
}

export async function generarEmbedding(texto: string): Promise<number[]> {
  const datos = await invocarProxy<{ vector: number[] }>('generar-embedding', texto);
  return datos.vector;
}

// Verificación previa a la demo. No toca el microservicio directo: prueba la
// cadena completa app → Edge Function → túnel → contenedor, que es la que
// importa. El error más frecuente el día de la demo es que el túnel murió
// durante la noche y en localhost todo seguía viéndose bien (§24).
export async function verificarCadenaIa(): Promise<boolean> {
  try {
    await generarEmbedding('verificación');
    return true;
  } catch {
    return false;
  }
}
