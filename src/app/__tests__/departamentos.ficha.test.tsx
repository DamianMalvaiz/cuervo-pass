import { fireEvent, render, screen } from '@testing-library/react-native';

// Ficha pública de un depa (sin cuenta): datos reducidos. Lo que se fija: enseña lo que hay (precio, zona, características, calificación), NO enseña ni pide dirección,
// teléfono ni quién publica; lo que requiere cuenta (escribir, guardar) lleva a entrar; «no existe» y «falló la lectura» son estados distintos (END-11).

const mockHead = jest.fn();
jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockHead(props);
    return null;
  },
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), canGoBack: () => true, back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'p1' }),
}));

const mockPub = { publicacion: null as unknown, cargando: false, fallo: false, reintentar: jest.fn() };
const mockFotos = { fotos: [] as string[], cargando: false, fallo: false };
jest.mock('@/hooks/queries/useExplorar', () => ({
  usePublicacionPublica: () => mockPub,
  useFotosPublicas: () => mockFotos,
}));

import FichaPublica from '../departamentos/[id]';

const DEPA = {
  id: 'p1', titulo_publico: 'Cuarto en Santa María', tipo: 'cuarto', precio_renta: 2900, recamaras: 1, amueblado: true, permite_mascotas: false,
  servicios_incluidos: true, zona: 'Santa María, Lerma, México, CP 52000', num_fotos: 0, destacado: true, calificacion: 4.9, num_resenas: 3,
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockPub, { publicacion: DEPA, cargando: false, fallo: false });
});

test('enseña precio, zona, características y calificación', async () => {
  await render(<FichaPublica />);
  expect(screen.getByText('Cuarto en Santa María')).toBeTruthy();
  expect(screen.getByText(/2,900/)).toBeTruthy();
  expect(screen.getByText('Santa María, Lerma')).toBeTruthy();
  expect(screen.queryByText(/CP 52000/)).toBeNull();
  expect(screen.getByText(/Amueblado/)).toBeTruthy();
  expect(screen.getByText(/Servicios incluidos/)).toBeTruthy();
  expect(screen.getByText(/4\.9/)).toBeTruthy();
});

test('lo que necesita cuenta lleva a entrar o crearla', async () => {
  await render(<FichaPublica />);
  await fireEvent.press(screen.getByLabelText('Iniciar sesión para escribir'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
  // «Crear cuenta» está en la barra y en la tarjeta: los dos llevan al registro.
  const crear = screen.getAllByLabelText('Crear cuenta');
  expect(crear).toHaveLength(2);
  for (const boton of crear) {
    mockPush.mockClear();
    await fireEvent.press(boton);
    expect(mockPush).toHaveBeenCalledWith('/(auth)/registro');
  }
});

test('sin servicios incluidos, no lo dice (ni inventa cuáles)', async () => {
  Object.assign(mockPub, { publicacion: { ...DEPA, servicios_incluidos: false } });
  await render(<FichaPublica />);
  expect(screen.queryByText(/Servicios incluidos/)).toBeNull();
});

test('explica por qué no hay dirección exacta, sin inventar una', async () => {
  await render(<FichaPublica />);
  expect(screen.getByText(/dirección exacta/i)).toBeTruthy();
});

test('si no existe o ya no es visible, lo dice', async () => {
  Object.assign(mockPub, { publicacion: null });
  await render(<FichaPublica />);
  expect(screen.getByText(/ya no está disponible/i)).toBeTruthy();
});

test('si la lectura falla, ofrece reintentar y NO dice que no existe', async () => {
  Object.assign(mockPub, { publicacion: null, fallo: true });
  await render(<FichaPublica />);
  expect(screen.queryByText(/ya no está disponible/i)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Reintentar'));
  expect(mockPub.reintentar).toHaveBeenCalled();
});

describe('la pestaña del navegador', () => {
  it('lleva el nombre del lugar y el del sitio', async () => {
    mockHead.mockClear();
    await render(<FichaPublica />);
    const titulos = mockHead.mock.calls.map((c) => (c[0] as { children: { props: { children: string } } }).children.props.children);
    expect(titulos).toContain('Cuarto en Santa María · Cuervo 360');
  });
});

describe('el diseño nuevo de la ficha', () => {
  it('con fotos, la galería las enseña todas, cada una con su número', async () => {
    Object.assign(mockPub, { publicacion: { ...DEPA, num_fotos: 3 } });
    Object.assign(mockFotos, { fotos: ['https://f/1', 'https://f/2', 'https://f/3'] });
    await render(<FichaPublica />);
    expect(screen.getAllByLabelText(/Cuarto en Santa María, foto \d de 3/)).toHaveLength(3);
    Object.assign(mockFotos, { fotos: [] });
  });

  it('sin fotos lo dice', async () => {
    await render(<FichaPublica />);
    expect(screen.getByText('Este lugar todavía no tiene fotos')).toBeTruthy();
  });

  it('el ajuste con este lugar está BLOQUEADO y no inventa cifras: pide entrar', async () => {
    await render(<FichaPublica />);
    expect(screen.getByText('Por qué podría encajar contigo')).toBeTruthy();
    expect(screen.getByText(/Entra para ver tu ajuste con este lugar/)).toBeTruthy();
    expect(screen.queryByText(/\d+ de ajuste/)).toBeNull();
  });

  it('«Dónde estarás» dice la zona y que la dirección exacta se ve con cuenta', async () => {
    await render(<FichaPublica />);
    expect(screen.getByText('Dónde estarás')).toBeTruthy();
    expect(screen.getAllByText('Santa María, Lerma').length).toBeGreaterThan(0);
    expect(screen.getByText(/dirección exacta/i)).toBeTruthy();
  });

  it('las reseñas dicen cuántas son; sin calificación no ponen una', async () => {
    await render(<FichaPublica />);
    expect(screen.getByText(/4\.9 · 3 reseñas/)).toBeTruthy();
    Object.assign(mockPub, { publicacion: { ...DEPA, calificacion: null, num_resenas: null } });
    const { unmount } = await render(<FichaPublica />);
    expect(screen.queryByText(/reseñas/)).toBeNull();
    await unmount();
  });

  it('trae la barra con «Volver»', async () => {
    await render(<FichaPublica />);
    expect(screen.getByLabelText('Volver')).toBeTruthy();
  });
});
