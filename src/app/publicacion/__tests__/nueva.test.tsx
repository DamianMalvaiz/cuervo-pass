import { render } from '@testing-library/react-native';

// `publicacion/nueva.tsx` · alta de publicación. No tenía ninguna prueba.
//
// El formulario se sustituye por un doble que captura `onGuardar`: lo que es de
// ESTA pantalla es lo que ocurre cuando el formulario ya validó —crear, confirmar
// y navegar—, no cómo se llena. Eso se prueba en los archivos del formulario.
//
// Paso 3 del toast · antes, publicar terminaba con una vibración y un salto a la
// ficha, sin decir nada. La vibración confirma al tacto; el aviso, a la vista y al
// lector de pantalla.

const mockCrear = jest.fn();
const mockReplace = jest.fn();
const mockSello = jest.fn();
const capturado: {
  onGuardar?: (datos: unknown) => Promise<void>;
  desplazador?: { alNodo?: unknown };
} = {};

jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a), push: jest.fn() } }));
// Cuervo 360 · la pantalla pasa por `GuardaPublicar`; estas pruebas son del formulario, así que se le
// da una cuenta con una función aprobada. La guarda tiene sus propias pruebas.
jest.mock('@/hooks/queries/useRoles', () => ({
  useMisRoles: () => ({
    roles: [{ usuario_id: 'u1', rol: 'arrendador', estado: 'aprobado', origen: 'solicitud', desde: 'x' }],
    cargando: false, fallo: false, reintentar: jest.fn(),
  }),
}));
jest.mock('@/components/FormularioPublicacion', () => ({
  FormularioPublicacion: (props: {
    onGuardar: (datos: unknown) => Promise<void>;
    desplazador?: { alNodo?: unknown };
  }) => {
    capturado.onGuardar = props.onGuardar;
    capturado.desplazador = props.desplazador;
    return null;
  },
}));
jest.mock('@/services/publicaciones.service', () => ({
  crearPublicacion: (...a: unknown[]) => mockCrear(...a),
}));
jest.mock('@/lib/tacto', () => ({ sello: () => mockSello(), toque: jest.fn() }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: { session: unknown }) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));

import { useToastStore } from '@/store/useToastStore';

import NuevaPublicacionScreen from '../nueva';

const DATOS = {
  titulo: 'Depa',
  tipo: 'depa',
  direccion: 'Calle 1',
  precioRenta: '3000',
  descripcion: '',
  permiteMascotas: false,
  amueblado: true,
  serviciosIncluidos: false,
  recamaras: '1',
  whatsapp: '7221234567',
  fotos: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  useToastStore.setState({ actual: null });
  capturado.onGuardar = undefined;
  capturado.desplazador = undefined;
  mockCrear.mockResolvedValue({ id: 'p1' });
});

test('al publicar bien, avisa, vibra y lleva a la ficha', async () => {
  await render(<NuevaPublicacionScreen />);
  await capturado.onGuardar?.(DATOS);

  expect(mockCrear).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: 'u1', titulo: 'Depa', precioRenta: 3000 }));
  expect(useToastStore.getState().actual).toMatchObject({ tipo: 'exito', mensaje: 'Publicación creada' });
  expect(mockSello).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith('/publicacion/p1');
});

// Si crear falla, el error sube hasta el formulario, que ya lo avisa. Aquí no
// puede haber un aviso de ÉXITO, ni vibración de «quedó registrado», ni salto.
test('si crear falla no hay aviso de éxito, ni vibración, ni navegación', async () => {
  mockCrear.mockRejectedValue(new Error('límite alcanzado'));
  await render(<NuevaPublicacionScreen />);

  await expect(capturado.onGuardar?.(DATOS)).rejects.toThrow('límite alcanzado');

  expect(useToastStore.getState().actual).toBeNull();
  expect(mockSello).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

// Scroll al primer error. El ScrollView es de ESTA pantalla y el formulario no
// puede moverlo: sin el `desplazador`, un envío inválido solo avisaría y la vista
// se quedaría donde estaba, a veces a varias pantallas del error.
test('le pasa al formulario un desplazador para llevar la vista al error', async () => {
  await render(<NuevaPublicacionScreen />);
  expect(typeof capturado.desplazador?.alNodo).toBe('function');
});
