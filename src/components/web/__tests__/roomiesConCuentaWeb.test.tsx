import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// La página de Roomies con cuenta. Lo que se fija: la lista con su compatibilidad; cuatro estados distintos (cargando, FALLÓ, vacío, lista; un fallo nunca es «no hay nadie»); el filtro de compatibilidad dice
// EXACTO lo que filtra («de tus mejores coincidencias»: filtra sobre las que ya llegaron, no sobre todas las personas); y tu ficha de roomie: activarla exige una descripción de 10 o más caracteres (con ella se ordena
// tu lista), y si guardar falla el interruptor vuelve a su sitio y se dice.

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));
jest.mock('@/hooks/use-tamano-pantalla', () => ({ useTamanoPantalla: () => ({ ancho: 1440, alto: 900, clase: 'amplia' }) }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'yo' } } }) }));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({ urls: new Map(), fallo: null }) }));
const mockToast = { info: jest.fn(), exito: jest.fn(), error: jest.fn() };
jest.mock('@/lib/toast', () => ({ toast: { info: (...a: unknown[]) => mockToast.info(...a), exito: (...a: unknown[]) => mockToast.exito(...a), error: (...a: unknown[]) => mockToast.error(...a) } }));
jest.mock('@/lib/registro', () => ({ aviso: jest.fn(), fallo: jest.fn() }));

const reintentar = jest.fn();
const mockRoom = { roomies: [] as { id: string; nombre_completo: string; compatibilidad: number | null; foto_url: null }[], cargando: false, fallo: null as string | null, reintentar };
const mockMi = { miRoomie: null as null | { descripcion_busqueda: string; estado: string }, cargando: false };
const mockGuardar = jest.fn();
jest.mock('@/hooks/queries/useRoomies', () => ({
  useRoomiesSugeridos: () => mockRoom,
  useMiRoomie: () => mockMi,
  useGuardarMiRoomie: () => ({ mutateAsync: (...a: unknown[]) => mockGuardar(...a), isPending: false }),
}));
jest.mock('../PaginaWeb', () => ({ PaginaWeb: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../TarjetaRoomieWeb', () => ({ TarjetaRoomieWeb: ({ r }: { r: { nombre_completo: string } }) => require('react').createElement(require('react-native').Text, null, `ROOMIE ${r.nombre_completo}`) }));

import { RoomiesConCuentaWeb } from '../RoomiesConCuentaWeb';

const r = (id: string, nombre: string, c: number | null) => ({ id, nombre_completo: nombre, compatibilidad: c, foto_url: null as null });

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockRoom, { roomies: [], cargando: false, fallo: null });
  Object.assign(mockMi, { miRoomie: null, cargando: false });
  mockGuardar.mockResolvedValue({});
});

describe('la lista', () => {
  it('enseña a las personas en el orden en que llegan, con cuántas son', async () => {
    mockRoom.roomies = [r('1', 'Valeria', 0.9), r('2', 'Jorge', 0.6)];
    await render(<RoomiesConCuentaWeb />);
    expect(screen.getByText('ROOMIE Valeria')).toBeTruthy();
    expect(screen.getByText('ROOMIE Jorge')).toBeTruthy();
    expect(screen.getByText('Mostrando 2 de tus 2 mejores coincidencias')).toBeTruthy();
  });

  it('un FALLO al leer no es «no hay nadie»: se dice y se puede reintentar', async () => {
    mockRoom.fallo = 'x';
    await render(<RoomiesConCuentaWeb />);
    expect(screen.getByText('No pudimos cargar los roomies')).toBeTruthy();
    expect(screen.queryByText(/Todavía no hay/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    expect(reintentar).toHaveBeenCalled();
  });

  it('sin personas lo dice; mientras carga reserva el lugar y no afirma nada', async () => {
    const { unmount } = await render(<RoomiesConCuentaWeb />);
    expect(screen.getByText(/Todavía no hay personas buscando roomie/)).toBeTruthy();
    await unmount();
    mockRoom.cargando = true;
    await render(<RoomiesConCuentaWeb />);
    expect(screen.getByLabelText('Cargando')).toBeTruthy();
    expect(screen.queryByText(/Todavía no hay personas/)).toBeNull();
  });
});

describe('el filtro de compatibilidad', () => {
  beforeEach(() => {
    mockRoom.roomies = [r('1', 'Valeria', 0.9), r('2', 'Jorge', 0.6), r('3', 'Ximena', null), r('4', 'Diego', 0.3)];
  });

  it('«Alta» deja solo a quien tiene 0.75 o más, y dice de cuántas filtra', async () => {
    await render(<RoomiesConCuentaWeb />);
    await fireEvent.press(screen.getByLabelText('Compatibilidad alta'));
    expect(screen.getByText('ROOMIE Valeria')).toBeTruthy();
    expect(screen.queryByText('ROOMIE Jorge')).toBeNull();
    expect(screen.getByText('Mostrando 1 de tus 4 mejores coincidencias')).toBeTruthy();
  });

  it('«Alta o media» suma a quien tiene 0.5 o más; quien no tiene dato no entra a ninguna', async () => {
    await render(<RoomiesConCuentaWeb />);
    await fireEvent.press(screen.getByLabelText('Compatibilidad alta o media'));
    expect(screen.getByText('ROOMIE Jorge')).toBeTruthy();
    expect(screen.queryByText('ROOMIE Ximena')).toBeNull();
    expect(screen.queryByText('ROOMIE Diego')).toBeNull();
  });

  it('si el filtro no deja a nadie NO afirma que no hay nadie: dice que no hay entre sus mejores coincidencias', async () => {
    mockRoom.roomies = [r('4', 'Diego', 0.3), r('5', 'Luis', 0.2)];
    await render(<RoomiesConCuentaWeb />);
    await fireEvent.press(screen.getByLabelText('Compatibilidad alta'));
    expect(screen.getByText('Ninguna de tus 2 mejores coincidencias tiene compatibilidad alta.')).toBeTruthy();
    expect(screen.queryByText(/no hay nadie/i)).toBeNull();
  });

  it('«Todas» vuelve a mostrar a todas', async () => {
    await render(<RoomiesConCuentaWeb />);
    await fireEvent.press(screen.getByLabelText('Compatibilidad alta'));
    await fireEvent.press(screen.getByLabelText('Todas las compatibilidades'));
    expect(screen.getByText('ROOMIE Diego')).toBeTruthy();
  });
});

describe('tu ficha de roomie', () => {
  it('se siembra una sola vez con lo guardado', async () => {
    mockMi.miRoomie = { descripcion_busqueda: 'Busco roomie para depa de 2 cuartos.', estado: 'activo' };
    await render(<RoomiesConCuentaWeb />);
    expect(screen.getByDisplayValue('Busco roomie para depa de 2 cuartos.')).toBeTruthy();
    expect(screen.getByLabelText('Búsqueda de roomie').props.accessibilityState.checked).toBe(true);
  });

  it('activarla sin describir qué buscas (menos de 10 caracteres) avisa y NO guarda', async () => {
    await render(<RoomiesConCuentaWeb />);
    await fireEvent.changeText(screen.getByLabelText('Qué buscas'), 'corto');
    await fireEvent.press(screen.getByLabelText('Búsqueda de roomie'));
    expect(mockToast.info).toHaveBeenCalledWith(expect.stringContaining('Falta tu descripción'));
    expect(mockGuardar).not.toHaveBeenCalled();
  });

  it('con descripción suficiente la activa y lo dice', async () => {
    await render(<RoomiesConCuentaWeb />);
    await fireEvent.changeText(screen.getByLabelText('Qué buscas'), 'Busco roomie tranquilo, sin mascotas.');
    await fireEvent.press(screen.getByLabelText('Búsqueda de roomie'));
    await waitFor(() => expect(mockGuardar).toHaveBeenCalledWith({ descripcionBusqueda: 'Busco roomie tranquilo, sin mascotas.', estado: 'activo' }));
    await waitFor(() => expect(mockToast.exito).toHaveBeenCalledWith('Búsqueda de roomie activada'));
  });

  it('si guardar falla, el interruptor vuelve a su sitio y se dice (no se finge que se activó)', async () => {
    mockGuardar.mockRejectedValue(new Error('red'));
    await render(<RoomiesConCuentaWeb />);
    await fireEvent.changeText(screen.getByLabelText('Qué buscas'), 'Busco roomie tranquilo, sin mascotas.');
    await fireEvent.press(screen.getByLabelText('Búsqueda de roomie'));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect(screen.getByLabelText('Búsqueda de roomie').props.accessibilityState.checked).toBe(false);
    expect(mockToast.exito).not.toHaveBeenCalled();
  });

  it('con la ficha activa, cambiar la descripción ofrece «Guardar descripción» y la guarda', async () => {
    mockMi.miRoomie = { descripcion_busqueda: 'Busco roomie para depa de 2 cuartos.', estado: 'activo' };
    await render(<RoomiesConCuentaWeb />);
    expect(screen.queryByLabelText('Guardar descripción')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Qué buscas'), 'Busco roomie que madrugue y no fume.');
    await fireEvent.press(screen.getByLabelText('Guardar descripción'));
    await waitFor(() => expect(mockGuardar).toHaveBeenCalledWith({ descripcionBusqueda: 'Busco roomie que madrugue y no fume.', estado: 'activo' }));
  });
});
