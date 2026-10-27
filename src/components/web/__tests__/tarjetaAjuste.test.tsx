import { render, screen } from '@testing-library/react-native';

// La tarjeta de vivienda con lo que solo existe con cuenta: la etiqueta de ajuste (en palabras, no en cifras) sobre la foto y la razón que la explica debajo. Sin ellas, la tarjeta es la de siempre.

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/hooks/queries/useExplorar', () => ({ useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }) }));

import { TarjetaPublicacionWeb } from '../TarjetaPublicacionWeb';
import type { PublicacionExplorar } from '@/services/explorar.service';

const P = { id: 'p1', titulo_publico: 'Cuarto en Capultitlán', tipo: 'cuarto', precio_renta: 3459, zona: 'Capultitlán, Toluca, México', num_fotos: 0, destacado: false, calificacion: null, num_resenas: null } as unknown as PublicacionExplorar;

describe('TarjetaPublicacionWeb con ajuste', () => {
  it('enseña la etiqueta sobre la foto y la razón bajo el precio', async () => {
    await render(<TarjetaPublicacionWeb p={P} ancho={260} etiqueta="Muy compatible contigo" razon="Está dentro de tu presupuesto" />);
    expect(screen.getByText('Muy compatible contigo')).toBeTruthy();
    expect(screen.getByText('Está dentro de tu presupuesto')).toBeTruthy();
  });

  it('sin etiqueta ni razón no pinta nada de eso (no inventa ajuste)', async () => {
    await render(<TarjetaPublicacionWeb p={P} ancho={260} />);
    expect(screen.queryByText(/compatible/i)).toBeNull();
    expect(screen.queryByText(/presupuesto/i)).toBeNull();
  });

  it('la etiqueta forma parte del nombre accesible de la tarjeta', async () => {
    await render(<TarjetaPublicacionWeb p={P} ancho={260} etiqueta="Compatible contigo" />);
    expect(screen.getByLabelText(/Cuarto en Capultitlán.*Compatible contigo/)).toBeTruthy();
  });
});
