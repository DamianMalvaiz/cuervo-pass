import { render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

// «Editar publicación» en la web: con una ventana ancha enseña la vista previa de la tarjeta al lado del formulario, ya con la foto de portada GUARDADA (firmada: la ruta de Storage no se puede pintar). En una ventana angosta o en la app, no hay previa.

const mockPantalla = { ancho: 1440 };
jest.mock('@/hooks/use-tamano-pantalla', () => ({ useTamanoPantalla: () => ({ ancho: mockPantalla.ancho, alto: 900, clase: mockPantalla.ancho >= 700 ? 'amplia' : 'normal', anchoContenido: 560, anchoLista: 800, altoApretado: false, escalaTitulo: 1 }) }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({ id: 'pub1' }) }));
jest.mock('@/components/web/EnMarcoWeb', () => ({ EnMarcoWeb: ({ children }: { children: React.ReactNode }) => children }));
const mockObtener = jest.fn();
jest.mock('@/services/publicaciones.service', () => ({ obtenerMiPublicacion: (...a: unknown[]) => mockObtener(...a), actualizarPublicacion: jest.fn() }));
jest.mock('@/lib/direccionMx', () => ({ buscarPorCodigoPostal: jest.fn() }));
jest.mock('@/lib/mapboxAutocomplete', () => ({ buscarCalles: jest.fn() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn(), requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }), MediaTypeOptions: { Images: 'Images' } }));
const RUTA = 'publicaciones/u1/portada.jpg';
const FIRMADA = 'https://firmada.test/portada.jpg?token=9';
const mockFirmar = jest.fn();
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: (r: unknown) => { mockFirmar(r); return { urls: new Map([[RUTA, FIRMADA]]), fallo: null }; } }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }) }));
jest.mock('@/hooks/queries/useExplorar', () => ({ useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }) }));
jest.mock('@/lib/registro', () => ({ aviso: jest.fn(), fallo: jest.fn() }));

import EditarPublicacionScreen from '../[id]';

const DIRECCION = 'Calle Zapata 224, Guadalupe, San Mateo Atenco, San Mateo Atenco, México, CP 52104';
const PUBLICACION = {
  id: 'pub1', usuario_id: 'u1', titulo: 'Depa de 1 recámara', tipo: 'depa', direccion: DIRECCION, latitud: 19.29, longitud: -99.56, precio_renta: 2500, descripcion: '',
  permite_mascotas: false, amueblado: true, servicios_incluidos: false, recamaras: 1, whatsapp: '5512345678', fotos: [RUTA], activa: true,
};
const montar = async () => {
  await render(<EditarPublicacionScreen />);
  await waitFor(() => expect(screen.queryByText('CONSULTANDO LA PUBLICACIÓN')).toBeNull());
};
const plataforma = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks();
  mockObtener.mockResolvedValue(PUBLICACION);
  mockPantalla.ancho = 1440;
});
afterEach(() => {
  Platform.OS = plataforma;
});

it('en la web ancha enseña la vista previa con lo que está guardado (título armado, municipio, precio)', async () => {
  Platform.OS = 'web';
  await montar();
  expect(screen.getByText('Así se verá en la lista')).toBeTruthy();
  expect(screen.getByText('Departamento en Guadalupe')).toBeTruthy();
  expect(screen.getByText(/2,500/)).toBeTruthy();
});

it('las fotos guardadas (rutas) se mandan a firmar, y la miniatura del formulario usa la URL firmada', async () => {
  Platform.OS = 'web';
  await montar();
  expect(mockFirmar).toHaveBeenCalledWith([RUTA]);
  const s = screen.getByLabelText('Foto 1').props.source as { uri?: string } | { uri?: string }[];
  expect(Array.isArray(s) ? s[0]?.uri : s?.uri).toBe(FIRMADA);
});

it('en una ventana angosta no hay vista previa (el formulario es lo que importa)', async () => {
  Platform.OS = 'web';
  mockPantalla.ancho = 800;
  await montar();
  expect(screen.queryByText('Así se verá en la lista')).toBeNull();
});

it('en la app no hay vista previa', async () => {
  Platform.OS = 'ios';
  await montar();
  expect(screen.queryByText('Así se verá en la lista')).toBeNull();
});
