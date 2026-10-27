import { fireEvent, render, screen } from '@testing-library/react-native';

// Las piezas de las fichas públicas (vivienda y negocio). Lo que se fija: la galería se acomoda a CUANTAS fotos hay (ni huecos ni fotos inventadas), todo lo que necesita cuenta lleva a entrar,
// el horario dice cuál es HOY y «Cerrado» donde no hay turnos, y un producto sin precio dice «Consulta el precio» (nunca un cero).

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockPuedeVolver = { valor: true };
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: () => mockBack(), canGoBack: () => mockPuedeVolver.valor },
}));
jest.mock('@/hooks/queries/useExplorar', () => ({ useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }) }));

import { BarraFichaWeb } from '../BarraFichaWeb';
import { FilaProductoWeb } from '../FilaProductoWeb';
import { GaleriaWeb } from '../GaleriaWeb';
import { HorarioWeb } from '../HorarioWeb';
import { TarjetaEntrarWeb } from '../TarjetaEntrarWeb';
import type { HorarioExplorar, ProductoExplorar } from '@/services/explorar.service';

beforeEach(() => {
  jest.clearAllMocks();
  mockPuedeVolver.valor = true;
});

describe('GaleriaWeb', () => {
  const urls = (n: number) => Array.from({ length: n }, (_, i) => `https://f/${i}`);

  it('pone una foto por cada una que hay, cada una con su número', async () => {
    await render(<GaleriaWeb fotos={urls(5)} titulo="Cuarto en Toluca" escritorio />);
    expect(screen.getAllByLabelText(/Cuarto en Toluca, foto \d de 5/)).toHaveLength(5);
  });

  it('con tres, cuatro o una sola, no inventa fotos ni deja huecos', async () => {
    for (const n of [1, 3, 4]) {
      const { unmount } = await render(<GaleriaWeb fotos={urls(n)} titulo="Lugar" escritorio />);
      expect(screen.getAllByLabelText(new RegExp(`Lugar, foto \\d de ${n}`))).toHaveLength(n);
      await unmount();
    }
  });

  it('sin fotos lo dice, en vez de un recuadro mudo', async () => {
    await render(<GaleriaWeb fotos={[]} titulo="Lugar" escritorio />);
    expect(screen.getByText('Este lugar todavía no tiene fotos')).toBeTruthy();
  });

  it('en pantalla angosta se desliza y dice en cuál va', async () => {
    await render(<GaleriaWeb fotos={urls(4)} titulo="Lugar" escritorio={false} />);
    expect(screen.getByText('1 / 4')).toBeTruthy();
    expect(screen.getAllByLabelText(/Lugar, foto \d de 4/)).toHaveLength(4);
  });
});

describe('TarjetaEntrarWeb', () => {
  it('lleva a entrar y a crear cuenta', async () => {
    await render(<TarjetaEntrarWeb mensaje="Entra para escribir" />);
    await fireEvent.press(screen.getByLabelText('Iniciar sesión para escribir'));
    expect(mockPush).toHaveBeenLastCalledWith('/(auth)/login');
    await fireEvent.press(screen.getByLabelText('Crear cuenta'));
    expect(mockPush).toHaveBeenLastCalledWith('/(auth)/registro');
  });

  it('enseña el precio solo si lo hay, y el mensaje y la garantía que se le pasan', async () => {
    const { unmount } = await render(<TarjetaEntrarWeb precio={3006} mensaje="Entra para escribir" garantia="La conversación se queda en la app." />);
    expect(screen.getByText(/3,006/)).toBeTruthy();
    expect(screen.getByText('Entra para escribir')).toBeTruthy();
    expect(screen.getByText('La conversación se queda en la app.')).toBeTruthy();
    await unmount();
    await render(<TarjetaEntrarWeb mensaje="Hola" />);
    expect(screen.queryByText(/\$/)).toBeNull();
  });
});

describe('HorarioWeb', () => {
  const lunes: HorarioExplorar = { negocio_id: 'n', dia: 1, abre: '09:00:00', cierra: '18:00:00' };

  it('enseña los siete días; sin turnos dice «Cerrado»', async () => {
    await render(<HorarioWeb horario={[lunes]} hoy={3} />);
    for (const d of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) expect(screen.getByText(d)).toBeTruthy();
    expect(screen.getAllByText('Cerrado')).toHaveLength(6);
    expect(screen.getByText(/9 am a 6 pm/)).toBeTruthy();
  });

  it('marca cuál es hoy para el lector de pantalla', async () => {
    await render(<HorarioWeb horario={[lunes]} hoy={1} />);
    expect(screen.getByLabelText(/Lunes, hoy/)).toBeTruthy();
    expect(screen.queryByLabelText(/Martes, hoy/)).toBeNull();
  });
});

describe('FilaProductoWeb', () => {
  const prod = (extra: Partial<ProductoExplorar> = {}) => ({ id: 'i1', negocio_id: 'n', nombre: 'Capuchino', precio: 45, seccion: null, descripcion: null, num_fotos: 0, estrella: false, orden: 1, ...extra }) as ProductoExplorar;

  it('nombre y precio', async () => {
    await render(<FilaProductoWeb p={prod()} />);
    expect(screen.getByText('Capuchino')).toBeTruthy();
    expect(screen.getByText('$45')).toBeTruthy();
  });

  it('sin precio dice «Consulta el precio», no inventa uno', async () => {
    await render(<FilaProductoWeb p={prod({ precio: null })} />);
    expect(screen.getByText('Consulta el precio')).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('la descripción sale solo si la hay', async () => {
    const { unmount } = await render(<FilaProductoWeb p={prod({ descripcion: 'Doble shot' })} />);
    expect(screen.getByText('Doble shot')).toBeTruthy();
    await unmount();
    await render(<FilaProductoWeb p={prod()} />);
    expect(screen.queryByText('Doble shot')).toBeNull();
  });
});

describe('BarraFichaWeb', () => {
  it('lleva a entrar y a crear cuenta', async () => {
    await render(<BarraFichaWeb escritorio />);
    await fireEvent.press(screen.getByLabelText('Iniciar sesión'));
    expect(mockPush).toHaveBeenLastCalledWith('/(auth)/login');
    await fireEvent.press(screen.getByLabelText('Crear cuenta'));
    expect(mockPush).toHaveBeenLastCalledWith('/(auth)/registro');
  });

  it('«Volver» regresa si hay a dónde; si se llegó por un enlace directo, va a la portada', async () => {
    await render(<BarraFichaWeb escritorio />);
    await fireEvent.press(screen.getByLabelText('Volver'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    mockPuedeVolver.valor = false;
    await fireEvent.press(screen.getByLabelText('Volver'));
    expect(mockPush).toHaveBeenLastCalledWith('/explorar');
  });
});
