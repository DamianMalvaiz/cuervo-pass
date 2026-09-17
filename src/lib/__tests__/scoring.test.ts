import { calcularScore } from '../scoring';
import type { Publicacion, Usuario } from '@/types/database.types';

function publicacion(sobrescribir: Partial<Publicacion> = {}): Publicacion {
  const haceTresDias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: 'pub-1',
    usuario_id: 'otro-usuario',
    direccion: 'Calle Falsa 123',
    latitud: 19.32,
    longitud: -99.45,
    precio_renta: 3000,
    descripcion: 'Depa amueblado, pet friendly',
    fotos: null,
    whatsapp: '7220000000',
    vector_embedding: null,
    activa: true,
    reportes: 0,
    creado_en: haceTresDias,
    actualizado_en: haceTresDias,
    ...sobrescribir,
  };
}

function perfil(sobrescribir: Partial<Usuario> = {}): Usuario {
  return {
    id: 'user-1',
    nombre_usuario: 'ana',
    nombre_completo: 'Ana Pérez',
    foto_url: null,
    biografia: null,
    presupuesto_min: 2000,
    presupuesto_max: 3500,
    mascotas: true,
    fuma: false,
    nivel_ruido: null,
    busca_roomie: false,
    universidad: 'utvt',
    latitud_universidad: 19.3257,
    longitud_universidad: -99.4582,
    perfil_vector: null,
    activo: true,
    creado_en: new Date().toISOString(),
    ...sobrescribir,
  };
}

test('reproduce el ejemplo numérico de la sección 14 del doc maestro, adaptado (0.89)', () => {
  // Mismo escenario que el doc (1.5km, dentro de presupuesto, publicada hace 3
  // días) pero sin nivel_ruido (se quitó del cuestionario) — aquí compatibilidad
  // sale en 1.0 (mascotas coincide + no fuma, siempre compatible) en vez del
  // 0.5 del doc, que ahí sí restaba por no coincidir en ruido. Por eso el total
  // sube de 0.79 a 0.89; la fórmula y los pesos son los mismos.
  const score = calcularScore(publicacion(), perfil(), 1.5);
  expect(score).toBeCloseTo(0.89, 2);
});

test('penaliza publicaciones fuera de presupuesto', () => {
  const dentro = calcularScore(publicacion({ precio_renta: 3000 }), perfil(), 1.5);
  const fuera = calcularScore(publicacion({ precio_renta: 8000 }), perfil(), 1.5);
  expect(fuera).toBeLessThan(dentro);
});

test('no penaliza cuando falta la ubicación (score neutro, no cero)', () => {
  const score = calcularScore(publicacion(), perfil(), null);
  expect(score).toBeGreaterThan(0);
});

test('no exige mascotas en la descripción si el usuario no tiene mascota', () => {
  const score = calcularScore(publicacion({ descripcion: 'Depa sin mascotas' }), perfil({ mascotas: false }), 1.5);
  expect(score).toBeCloseTo(0.89, 2);
});

test('sin perfil (defensivo) devuelve un score neutro sin explotar', () => {
  expect(() => calcularScore(publicacion(), null, 1.5)).not.toThrow();
});
