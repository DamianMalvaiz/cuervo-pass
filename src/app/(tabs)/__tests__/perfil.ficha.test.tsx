import { render, screen } from '@testing-library/react-native';

// V.8 · Las RAMAS de `perfil.tsx`, no sus manejadores —esos están en
// `perfil.datos.test.tsx`—. La ficha tiene dos caras en casi cada campo y hasta
// ahora solo se pintaba una: el fixture de los otros archivos tiene el perfil
// completo, así que el lado «sin definir» no se ejecutaba nunca.
//
// No es cobertura por cobertura. `tono="atenuado"` existe precisamente para que
// una preferencia SIN DEFINIR se vea distinta de una definida: si ese lado
// estuviera roto, un perfil a medio llenar se leería como uno completo y la
// persona no sabría qué le falta. Es el mismo defecto que §27 en la escala de un
// campo.
//
// Y una que no es de presentación: el bloque de CONSENTIMIENTO DE IA. Es una
// declaración de lo que la app hace con los datos de alguien (LFPDPPP), y su
// lado «DESACTIVADO» no se había pintado nunca. Decir ACTIVADO a quien no
// consintió es del mismo género que una exportación que falla callada.

const PERFIL_COMPLETO = {
  id: 'abc12345-6789-0000-1111-222233334444',
  nombre_usuario: 'yo', nombre_completo: 'Yo Prueba', biografia: '',
  universidad: 'UTVT', presupuesto_min: 2000, presupuesto_max: 4000,
  distancia_max_km: 10, nivel_ruido: 'bajo', mascotas: true, fuma: true,
  busca_roomie: true, consiente_analisis_ia: true, cuestionario_completo: true,
  foto_url: null, horario_predominante: 'mixto',
};

// Lo que devuelve el servidor para alguien que acaba de registrarse y no ha
// pasado por el cuestionario: las columnas son nullable, así que esto es un
// estado real de la base y no un caso inventado.
const PERFIL_VACIO = {
  id: '', nombre_usuario: null, nombre_completo: null, biografia: null,
  universidad: null, presupuesto_min: null, presupuesto_max: null,
  distancia_max_km: null, nivel_ruido: null, mascotas: null, fuma: null,
  busca_roomie: false, consiente_analisis_ia: false, cuestionario_completo: false,
  foto_url: null, horario_predominante: null,
};

// Prefijo `mock` obligatorio: `babel-plugin-jest-hoist` sube las factorías de
// `jest.mock` por encima de las declaraciones del módulo, y solo tolera que una
// factoría lea una variable de fuera si su nombre empieza por `mock`. Tercera
// vez que este proyecto choca con esa regla.
const mockAlmacen: { perfil: Record<string, unknown> } = { perfil: { ...PERFIL_COMPLETO } };

// El conteo de favoritos de la tarjeta de identidad; tiene sus propias pruebas.
jest.mock('@/hooks/queries/useFavoritos', () => ({
  useMisFavoritosIds: () => ({ ids: new Set(['a', 'b']), cargando: false, fallo: false }),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock('@/services/usuarios.service', () => ({
  exportarMisDatos: jest.fn(),
  eliminarMiCuenta: jest.fn(),
}));
jest.mock('@/lib/storage', () => ({ subirFotoPerfil: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));
// La URL firmada se devuelve resuelta para poder pintar el lado CON foto, que es
// la otra rama que el fixture de los demás archivos nunca tocaba (§14: el bucket
// es privado, así que una ruta cruda no carga y siempre hay que firmar).
jest.mock('@/hooks/use-fotos-firmadas', () => ({
  useFotosFirmadas: (rutas: (string | null | undefined)[]) => ({
    urls: new Map(rutas.filter(Boolean).map((r) => [r, `https://firmada.test/${r}`])),
    fallo: null,
  }),
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ session: { user: { id: 'u1', email: 'yo@ejemplo.mx' } }, cerrarSesion: jest.fn() }),
}));
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: () => ({
    perfil: mockAlmacen.perfil,
    cargando: false,
    cargarPerfil: jest.fn(),
    actualizarPerfil: jest.fn(),
  }),
}));

import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { clienteDePrueba } from '@pruebas/consultas';

import PerfilScreen from '../perfil';

const pintar = async (perfil: Record<string, unknown> = { ...PERFIL_COMPLETO }) => {
  mockAlmacen.perfil = perfil;
  const cliente = clienteDePrueba();
  const Envoltura = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  return render(<PerfilScreen />, { wrapper: Envoltura });
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ── El consentimiento de IA ──────────────────────────────────────────────────
// El estado de «Sugerencias con IA» salió de Mi perfil: ahora se ve en Configuración (probado en
// `src/app/__tests__/configuracion.test.tsx`). Aquí solo se asegura que no vuelva a pintarse dos veces.
test('Mi perfil ya no lleva el recuadro de análisis con IA', async () => {
  await pintar();
  expect(screen.queryByText(/ANÁLISIS CON IA/)).toBeNull();
});

// ── La ficha a medio llenar ──────────────────────────────────────────────────

// Un perfil recién registrado. Sin este lado, los campos vacíos se pintarían
// como definidos y la persona no sabría qué le falta por llenar.
test('un perfil sin llenar dice «sin definir» en vez de quedarse en blanco', async () => {
  await pintar(PERFIL_VACIO);
  // Presupuesto, distancia y nivel de ruido: tres campos, el mismo texto.
  expect(screen.getAllByText('sin definir').length).toBeGreaterThanOrEqual(3);
});

// Las preferencias booleanas NO dicen «sin definir»: dicen el lado negativo, que
// es lo que significa un null aquí —«no tengo mascota» es la respuesta por
// omisión—, y se atenúan para distinguirlo de una respuesta dada.
test('las preferencias sin responder muestran su lado negativo', async () => {
  await pintar(PERFIL_VACIO);
  expect(screen.getByText('No tengo')).toBeTruthy();
  expect(screen.getByText('No fumo')).toBeTruthy();
});

test('y con ellas respondidas muestran el lado afirmativo', async () => {
  await pintar();
  expect(screen.getByText('Tengo')).toBeTruthy();
  expect(screen.getByText('Fumo')).toBeTruthy();
  expect(screen.getByText('10 km')).toBeTruthy();
});

// Sin nombre ni usuario, el encabezado no debe quedar con huecos: un expediente
// con el nombre en blanco se lee como un fallo de carga.
test('sin nombre ni usuario pone marcadores, no huecos', async () => {
  await pintar(PERFIL_VACIO);
  expect(screen.getByText('Sin nombre')).toBeTruthy();
  expect(screen.getByText('@—')).toBeTruthy();
});

// La universidad se oculta entera si falta, en vez de dejar el icono de birrete
// junto a una línea vacía.
test('sin universidad no se pinta esa línea', async () => {
  await pintar(PERFIL_VACIO);
  expect(screen.queryByText('UTVT')).toBeNull();
});

test('con universidad sí se pinta', async () => {
  await pintar();
  expect(screen.getByText('UTVT')).toBeTruthy();
});

// El «EXPEDIENTE ABC1» salió de la cabecera (17/10/2026): era membrete de documento y no le servía a nadie.
test('la cabecera ya no lleva folio de expediente', async () => {
  await pintar();
  expect(screen.queryByText(/EXPEDIENTE/)).toBeNull();
  expect(screen.getByText('Perfil')).toBeTruthy();
});

// ── La foto ──────────────────────────────────────────────────────────────────

// El lado CON foto: la etiqueta del botón cambia, porque «Agregar» y «Cambiar»
// no son la misma acción para quien la escucha en un lector de pantalla.
test('con foto el botón dice cambiar, no agregar', async () => {
  await pintar({ ...PERFIL_COMPLETO, foto_url: 'u1/foto.jpg' });
  expect(screen.getByLabelText('Cambiar tu foto de perfil')).toBeTruthy();
  expect(screen.queryByLabelText('Agregar una foto de perfil')).toBeNull();
});

test('sin foto dice agregar', async () => {
  await pintar();
  expect(screen.getByLabelText('Agregar una foto de perfil')).toBeTruthy();
});

// ── La biografía ─────────────────────────────────────────────────────────────

// `biografia: null` en la base. Si no se normalizara a cadena vacía,
// `biografiaCambiada` daría true al montar y el sello de guardar aparecería sin
// que nadie hubiera escrito nada.
test('una biografía nula no marca «sin guardar» al abrir', async () => {
  await pintar(PERFIL_VACIO);
  expect(screen.queryByText('Sin guardar')).toBeNull();
  expect(screen.queryByLabelText('Guardar biografía')).toBeNull();
});
