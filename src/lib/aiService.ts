// Wrapper de llamadas al microservicio de IA (ver sección 11 del doc maestro).
// Nunca se llama directo desde pantallas — pasa siempre por aquí, para que
// AI_SERVICE_URL y la autenticación vivan en un solo lugar (sección 18).

const AI_SERVICE_URL = process.env.EXPO_PUBLIC_AI_SERVICE_URL ?? 'http://localhost:8000';

export interface ParseoPerfilResultado {
  fuma: boolean;
  mascotas: boolean;
  nivel_ruido: 'bajo' | 'medio' | 'alto';
  horario_predominante: 'diurno' | 'nocturno' | 'mixto';
  notas: string;
}

// TODO (Semana 8): integrar al flujo de registro/cuestionario.
export async function parsearPerfil(texto: string): Promise<ParseoPerfilResultado> {
  const respuesta = await fetch(`${AI_SERVICE_URL}/parsear-perfil`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto }),
  });
  if (!respuesta.ok) throw new Error(`parsearPerfil falló: ${respuesta.status}`);
  return respuesta.json();
}

// TODO (Semana 9): integrar al crear/editar perfil y publicaciones.
export async function generarEmbedding(texto: string): Promise<number[]> {
  const respuesta = await fetch(`${AI_SERVICE_URL}/generar-embedding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto }),
  });
  if (!respuesta.ok) throw new Error(`generarEmbedding falló: ${respuesta.status}`);
  const datos = await respuesta.json();
  return datos.vector;
}

export async function verificarSalud(): Promise<boolean> {
  try {
    const respuesta = await fetch(`${AI_SERVICE_URL}/salud`);
    return respuesta.ok;
  } catch {
    return false;
  }
}
