import { act, fireEvent, render, screen } from '@testing-library/react-native';

// Servicios · Cuervo 360. La vista del módulo «Servicios» de Inicio: categorías, destacados y la lista de negocios.
// Lo que se fija: el filtro de categoría y la búsqueda se piden al SERVIDOR (van como argumentos del hook), «falló»
// no se pinta como «no hay negocios», y los negocios sembrados se rotulan «Negocio de ejemplo».

const mockPush = jest.fn();
const mockNegocios = jest.fn();
const mockCategorias = jest.fn();

jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/queries/useServicios', () => ({
  useNegocios: (...a: unknown[]) => mockNegocios(...a),
  useCategoriasServicio: (...a: unknown[]) => mockCategorias(...a),
}));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({ urls: new Map(), fallo: null }) }));
jest.mock('@/lib/tacto', () => ({ toque: jest.fn(), sello: jest.fn() }));

import { VistaServicios } from '../vistas/VistaServicios';

const CATEGORIAS = [
  { id: 'comida', nombre: 'Comida', icono: 'restaurant-outline', orden: 1 },
  { id: 'cafes', nombre: 'Cafés', icono: 'cafe-outline', orden: 2 },
];
const negocio = (extra: Record<string, unknown> = {}) => ({
  id: 'n1', categoria_id: 'comida', nombre: 'Tacos La Esquina', descripcion: null, direccion: 'Calle 1',
  latitud: null, longitud: null, rango_precio: 1, horario: 'Lun a sáb · 6 pm a 11 pm', fotos: [], destacado: false,
  origen: 'sembrado', ...extra,
});
const estado = (extra: Record<string, unknown> = {}) => ({
  negocios: [negocio()], cargando: false, fallo: false, refrescando: false, reintentar: jest.fn(), ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCategorias.mockReturnValue({ categorias: CATEGORIAS, cargando: false, fallo: false, reintentar: jest.fn() });
  mockNegocios.mockReturnValue(estado());
});

test('pinta el título, las categorías y los negocios', async () => {
  await render(<VistaServicios />);
  expect(screen.getByText('¿Qué necesitas hoy?')).toBeTruthy();
  expect(screen.getByLabelText('Comida')).toBeTruthy();
  expect(screen.getByLabelText('Cafés')).toBeTruthy();
  expect(screen.getByText('Tacos La Esquina')).toBeTruthy();
});

test('pinta el selector que le pasa Inicio', async () => {
  const { Text } = require('react-native');
  await render(<VistaServicios selector={<Text>SELECTOR</Text>} />);
  expect(screen.getByText('SELECTOR')).toBeTruthy();
});

test('un negocio sembrado se rotula «Negocio de ejemplo»; uno real no', async () => {
  mockNegocios.mockReturnValue(estado({ negocios: [negocio(), negocio({ id: 'n2', nombre: 'Real', origen: 'solicitud' })] }));
  await render(<VistaServicios />);
  expect(screen.getAllByText('Negocio de ejemplo')).toHaveLength(1);
});

test('el rango de precio se dice con signos de pesos', async () => {
  mockNegocios.mockReturnValue(estado({ negocios: [negocio({ rango_precio: 2 }), negocio({ id: 'n2', nombre: 'Sin dato', rango_precio: null })] }));
  await render(<VistaServicios />);
  expect(screen.getAllByText(/\$\$/)).toHaveLength(1);
});

test('tocar una categoría la pide al servidor; tocarla otra vez la quita', async () => {
  await render(<VistaServicios />);
  expect(mockNegocios).toHaveBeenLastCalledWith({ categoriaId: undefined, texto: '', soloAbiertos: false });

  await act(async () => { fireEvent.press(screen.getByLabelText('Cafés')); });
  expect(mockNegocios).toHaveBeenLastCalledWith({ categoriaId: 'cafes', texto: '', soloAbiertos: false });
  expect(screen.getByLabelText('Cafés').props.accessibilityState?.selected).toBe(true);

  await act(async () => { fireEvent.press(screen.getByLabelText('Cafés')); });
  expect(mockNegocios).toHaveBeenLastCalledWith({ categoriaId: undefined, texto: '', soloAbiertos: false });
});

test('la búsqueda se envía al terminar de escribir, no en cada letra', async () => {
  await render(<VistaServicios />);
  const campo = screen.getByLabelText('Buscar un negocio o servicio');
  await act(async () => { fireEvent.changeText(campo, 'taco'); });
  expect(mockNegocios).not.toHaveBeenCalledWith(expect.objectContaining({ texto: 'taco' }));
  await act(async () => { fireEvent(campo, 'submitEditing'); });
  expect(mockNegocios).toHaveBeenLastCalledWith({ categoriaId: undefined, texto: 'taco', soloAbiertos: false });
});

test('mientras carga no dice que no hay nada', async () => {
  mockNegocios.mockReturnValue(estado({ negocios: [], cargando: true }));
  await render(<VistaServicios />);
  expect(screen.queryByText(/No encontramos/)).toBeNull();
  expect(screen.getByLabelText('Cargando')).toBeTruthy();
});

test('un fallo se dice como fallo y ofrece reintentar, no como «no hay negocios»', async () => {
  const reintentar = jest.fn();
  mockNegocios.mockReturnValue(estado({ negocios: [], fallo: true, reintentar }));
  await render(<VistaServicios />);
  expect(screen.getByText('No pudimos cargar los negocios')).toBeTruthy();
  expect(screen.queryByText(/No encontramos/)).toBeNull();
  await act(async () => { fireEvent.press(screen.getByLabelText('Reintentar')); });
  expect(reintentar).toHaveBeenCalled();
});

test('sin resultados lo dice', async () => {
  mockNegocios.mockReturnValue(estado({ negocios: [] }));
  await render(<VistaServicios />);
  expect(screen.getByText(/No encontramos negocios/)).toBeTruthy();
});

test('los destacados salen solo sin filtro ni búsqueda', async () => {
  mockNegocios.mockReturnValue(estado({ negocios: [negocio({ destacado: true }), negocio({ id: 'n2', nombre: 'Otro' })] }));
  await render(<VistaServicios />);
  expect(screen.getByText('Destacados cerca de ti')).toBeTruthy();

  await act(async () => { fireEvent.press(screen.getByLabelText('Comida')); });
  expect(screen.queryByText('Destacados cerca de ti')).toBeNull();
});

test('tocar un negocio abre su ficha con su id', async () => {
  await render(<VistaServicios />);
  await act(async () => { fireEvent.press(screen.getByLabelText(/Tacos La Esquina/)); });
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/negocio/[id]', params: { id: 'n1' } });
});

test('«Abierto ahora» se pide al servidor y se puede quitar', async () => {
  await render(<VistaServicios />);
  await act(async () => { fireEvent.press(screen.getByLabelText('Abierto ahora')); });
  expect(mockNegocios).toHaveBeenLastCalledWith({ categoriaId: undefined, texto: '', soloAbiertos: true });
  expect(screen.getByLabelText('Abierto ahora').props.accessibilityState?.selected).toBe(true);
  await act(async () => { fireEvent.press(screen.getByLabelText('Abierto ahora')); });
  expect(mockNegocios).toHaveBeenLastCalledWith({ categoriaId: undefined, texto: '', soloAbiertos: false });
});

test('sin resultados con «Abierto ahora» explica que solo cuentan los que tienen horario', async () => {
  mockNegocios.mockReturnValue(estado({ negocios: [] }));
  await render(<VistaServicios />);
  await act(async () => { fireEvent.press(screen.getByLabelText('Abierto ahora')); });
  expect(screen.getByText(/Solo cuentan los que tienen horario registrado/)).toBeTruthy();
});
