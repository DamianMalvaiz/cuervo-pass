import type { Publicacion, Usuario } from '@/types/database.types';

// Motor de sugerencias Nivel 1 (sección 14 del doc maestro) — filtros
// ponderados explícitos, sin IA todavía. Se calcula en el cliente (como
// distancia.ts) para no depender de una función SQL nueva en este nivel;
// Nivel 2 (embeddings, semana 9) sí vive en Postgres vía pgvector.
export const PESO_DISTANCIA = 0.3;
export const PESO_PRESUPUESTO = 0.3;
export const PESO_COMPATIBILIDAD = 0.2;
export const PESO_FRESCURA = 0.2;

const DISTANCIA_MAXIMA_ACEPTABLE_KM = 5;
const DIAS_FRESCURA_MAXIMOS = 30;

function scoreDistancia(distanciaKm: number | null): number {
  // Sin ubicación conocida (falta geocoding de alguna de las dos partes): no
  // se premia ni se penaliza, para no hundir publicaciones válidas por un
  // dato faltante que no es culpa de quien publicó.
  if (distanciaKm == null) return 0.5;
  return Math.max(0, 1 - distanciaKm / DISTANCIA_MAXIMA_ACEPTABLE_KM);
}

function scorePresupuesto(precioRenta: number, presupuestoMin: number | null, presupuestoMax: number | null): number {
  if (presupuestoMin == null || presupuestoMax == null) return 0.5;
  return precioRenta >= presupuestoMin && precioRenta <= presupuestoMax ? 1 : 0.3;
}

// Heurística simple del MVP (doc, sección 14): comparar contra la descripción
// de texto libre en vez de una columna explícita `permite_mascotas`. Si el
// usuario no necesita esa condición, cuenta como compatible de cualquier forma.
function coincideMascotas(descripcion: string | null, quiereMascotas: boolean): boolean {
  if (!quiereMascotas) return true;
  const texto = (descripcion ?? '').toLowerCase();
  return texto.includes('mascota') || texto.includes('pet friendly');
}

function coincideFuma(descripcion: string | null, fuma: boolean): boolean {
  if (!fuma) return true;
  const texto = (descripcion ?? '').toLowerCase();
  return texto.includes('fumar') || texto.includes('fumador') || texto.includes('smoking');
}

function scoreCompatibilidad(publicacion: Publicacion, perfil: Usuario | null): number {
  if (!perfil) return 0.5;
  return (
    (coincideMascotas(publicacion.descripcion, perfil.mascotas) ? 0.5 : 0) +
    (coincideFuma(publicacion.descripcion, perfil.fuma) ? 0.5 : 0)
  );
}

function scoreFrescura(creadoEn: string): number {
  const diasDesdePublicacion = (Date.now() - new Date(creadoEn).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, 1 - diasDesdePublicacion / DIAS_FRESCURA_MAXIMOS);
}

export function calcularScore(publicacion: Publicacion, perfil: Usuario | null, distanciaKm: number | null): number {
  const total =
    PESO_DISTANCIA * scoreDistancia(distanciaKm) +
    PESO_PRESUPUESTO * scorePresupuesto(publicacion.precio_renta, perfil?.presupuesto_min ?? null, perfil?.presupuesto_max ?? null) +
    PESO_COMPATIBILIDAD * scoreCompatibilidad(publicacion, perfil) +
    PESO_FRESCURA * scoreFrescura(publicacion.creado_en);
  return Math.round(total * 100) / 100;
}
