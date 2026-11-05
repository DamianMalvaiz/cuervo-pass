import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

// Lo que la ficha de una vivienda enseña SOLO con cuenta: la dirección exacta, la descripción y el ajuste contigo en palabras. Sin datos que de verdad se cumplan no se inventa ninguna razón (una razón inventada es peor
// que ninguna), y un fallo al leer NO se pinta como «no hay descripción» ni como una dirección vacía.

const mockFicha = {
  publicacion: { id: 'p1', direccion: 'Calle Hidalgo 12, Centro, Lerma', descripcion: 'Cuarto amplio con baño propio.', latitud: 19.28, longitud: -99.51 } as null | Record<string, unknown>,
  cargando: false,
  fallo: null as string | null,
  reintentar: jest.fn(),
};
const mockAfinidad = { valor: { scoreFinal: 0.8 } as null | { scoreFinal: number | null; parecidoA?: string | null } };
const mockNegocio = { negocio: { id: 'n1', direccion: 'Av. Juárez 40, Centro, Lerma', latitud: 19.28, longitud: -99.51 } as null | Record<string, unknown>, cargando: false, fallo: false, reintentar: jest.fn() };
jest.mock('@/hooks/queries/useServicios', () => ({ useNegocio: () => mockNegocio }));
jest.mock('@/hooks/queries/usePublicaciones', () => ({ usePublicacion: () => mockFicha, useAfinidad: () => mockAfinidad.valor }));
const mockPerfil = { valor: { presupuesto_max: 4000, distancia_max_km: 10, mascotas: false, latitud_universidad: 19.29, longitud_universidad: -99.5 } as null | Record<string, unknown> };
jest.mock('@/store/usePerfilStore', () => ({ usePerfilStore: (sel: (s: unknown) => unknown) => sel({ perfil: mockPerfil.valor, cargarPerfil: jest.fn() }) }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }) }));

import { AjusteConCuentaWeb, DescripcionConCuentaWeb, DireccionConCuentaWeb, UbicacionNegocioConCuentaWeb } from '../FichaConCuentaWeb';

const abrirUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockFicha, { publicacion: { id: 'p1', direccion: 'Calle Hidalgo 12, Centro, Lerma', descripcion: 'Cuarto amplio con baño propio.', latitud: 19.28, longitud: -99.51 }, cargando: false, fallo: null });
  Object.assign(mockNegocio, { negocio: { id: 'n1', direccion: 'Av. Juárez 40, Centro, Lerma', latitud: 19.28, longitud: -99.51 }, cargando: false, fallo: false });
  abrirUrl.mockResolvedValue(true);
  mockAfinidad.valor = { scoreFinal: 0.8 };
  mockPerfil.valor = { presupuesto_max: 4000, distancia_max_km: 10, mascotas: false, latitud_universidad: 19.29, longitud_universidad: -99.5 };
});

describe('DireccionConCuentaWeb', () => {
  it('enseña la dirección exacta', async () => {
    await render(<DireccionConCuentaWeb id="p1" zona="Centro, Lerma" />);
    expect(screen.getByText('Calle Hidalgo 12, Centro, Lerma')).toBeTruthy();
    expect(screen.queryByText(/se muestra al iniciar sesión/)).toBeNull();
  });

  it('«Ver en el mapa» abre el punto exacto de la vivienda', async () => {
    await render(<DireccionConCuentaWeb id="p1" zona="Centro, Lerma" />);
    await fireEvent.press(screen.getByLabelText('Ver en el mapa'));
    expect(abrirUrl).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=19.28,-99.51');
  });

  it('sin coordenadas no ofrece un mapa que no sabría a dónde ir', async () => {
    mockFicha.publicacion = { id: 'p1', direccion: 'Calle Hidalgo 12', latitud: null, longitud: null };
    await render(<DireccionConCuentaWeb id="p1" zona="Centro, Lerma" />);
    expect(screen.queryByLabelText('Ver en el mapa')).toBeNull();
  });

  it('un fallo al leer se dice y se puede reintentar: no deja la dirección en blanco', async () => {
    Object.assign(mockFicha, { publicacion: null, fallo: 'x' });
    await render(<DireccionConCuentaWeb id="p1" zona="Centro, Lerma" />);
    expect(screen.getByText('No pudimos cargar la dirección exacta')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    expect(mockFicha.reintentar).toHaveBeenCalled();
  });

  it('mientras carga, enseña la zona que ya se sabe', async () => {
    Object.assign(mockFicha, { publicacion: null, cargando: true });
    await render(<DireccionConCuentaWeb id="p1" zona="Centro, Lerma" />);
    expect(screen.getByText('Centro, Lerma')).toBeTruthy();
  });
});

describe('DescripcionConCuentaWeb', () => {
  it('enseña la descripción si la hay', async () => {
    await render(<DescripcionConCuentaWeb id="p1" />);
    expect(screen.getByText('Cuarto amplio con baño propio.')).toBeTruthy();
  });

  it('sin descripción no pinta nada (ni un título vacío)', async () => {
    mockFicha.publicacion = { id: 'p1', descripcion: '  ' };
    await render(<DescripcionConCuentaWeb id="p1" />);
    expect(screen.queryByText('Descripción')).toBeNull();
  });
});

describe('AjusteConCuentaWeb', () => {
  it('dice qué tan compatible es y las razones que SE CUMPLEN con tus datos', async () => {
    await render(<AjusteConCuentaWeb id="p1" precio={3500} permiteMascotas={false} />);
    expect(screen.getByText('Muy compatible contigo')).toBeTruthy();
    expect(screen.getByText('Está dentro de tu presupuesto')).toBeTruthy();
    expect(screen.queryByText('Acepta mascotas, como pediste')).toBeNull();
  });

  it('no inventa razones: fuera de tu presupuesto, no lo dice', async () => {
    await render(<AjusteConCuentaWeb id="p1" precio={9000} permiteMascotas={false} />);
    expect(screen.queryByText('Está dentro de tu presupuesto')).toBeNull();
  });

  it('con el score bajo y sin razones no pinta el bloque', async () => {
    mockAfinidad.valor = { scoreFinal: 0.3 };
    mockPerfil.valor = {};
    await render(<AjusteConCuentaWeb id="p1" precio={9000} permiteMascotas={false} />);
    expect(screen.queryByText('Por qué podría encajar contigo')).toBeNull();
  });
});

describe('UbicacionNegocioConCuentaWeb', () => {
  it('enseña la dirección exacta y «Cómo llegar» abre el mapa en ese punto', async () => {
    await render(<UbicacionNegocioConCuentaWeb id="n1" zona="Centro, Lerma" />);
    expect(screen.getByText('Av. Juárez 40, Centro, Lerma')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Cómo llegar'));
    expect(abrirUrl).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=19.28,-99.51');
  });

  it('sin coordenadas no ofrece un mapa que no sabría a dónde ir', async () => {
    mockNegocio.negocio = { id: 'n1', direccion: 'Av. Juárez 40', latitud: null, longitud: null };
    await render(<UbicacionNegocioConCuentaWeb id="n1" zona="Centro, Lerma" />);
    expect(screen.queryByLabelText('Cómo llegar')).toBeNull();
  });

  it('un fallo al leer se dice y se puede reintentar', async () => {
    Object.assign(mockNegocio, { negocio: null, fallo: true });
    await render(<UbicacionNegocioConCuentaWeb id="n1" zona="Centro, Lerma" />);
    expect(screen.getByText('No pudimos cargar la dirección exacta')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    expect(mockNegocio.reintentar).toHaveBeenCalled();
  });
});
