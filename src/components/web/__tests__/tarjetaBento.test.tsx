import { fireEvent, render, screen } from '@testing-library/react-native';

// La variante «bento» de la tarjeta (la de «Para ti»): la foto llena la tarjeta y el texto va encima. Dice lo mismo que la tarjeta de siempre (título, municipio y detalles, precio, ajuste en palabras y la razón que se cumple) y lleva a la misma ficha.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/queries/useExplorar', () => ({ useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }) }));

import { TarjetaPublicacionWeb } from '../TarjetaPublicacionWeb';
import type { PublicacionExplorar } from '@/services/explorar.service';

const PUB = { id: 'p1', titulo_publico: 'Cuarto en Capultitlán', tipo: 'cuarto', precio_renta: 3459, recamaras: 2, amueblado: true, zona: 'Capultitlán, Toluca, México, CP 50296', num_fotos: 0, destacado: false, calificacion: null, num_resenas: null } as PublicacionExplorar;

beforeEach(() => jest.clearAllMocks());

it('enseña título, municipio con detalles, precio, etiqueta y razón', async () => {
  await render(<TarjetaPublicacionWeb p={PUB} bento={{ ancho: 280, alto: 236 }} etiqueta="Compatible contigo" razon="Está dentro de tu presupuesto" />);
  expect(screen.getByText('Cuarto en Capultitlán')).toBeTruthy();
  expect(screen.getByText('Toluca · 2 recámaras · Amueblado')).toBeTruthy();
  expect(screen.getByText('Compatible contigo')).toBeTruthy();
  expect(screen.getByText('Está dentro de tu presupuesto')).toBeTruthy();
  expect(screen.getByText(/\$3,459/)).toBeTruthy();
});

it('sin etiqueta ni razón no las inventa', async () => {
  await render(<TarjetaPublicacionWeb p={PUB} bento={{ ancho: 280, alto: 236 }} />);
  expect(screen.queryByText('Compatible contigo')).toBeNull();
  expect(screen.queryByText(/dentro de tu presupuesto/)).toBeNull();
});

it('lleva a la ficha de ESA vivienda, también el destacado grande', async () => {
  const r = await render(<TarjetaPublicacionWeb p={PUB} bento={{ ancho: 280, alto: 236 }} />);
  await fireEvent.press(screen.getByLabelText(/Cuarto en Capultitlán, 3,459 pesos al mes/));
  expect(mockPush).toHaveBeenLastCalledWith('/departamentos/p1');
  await r.rerender(<TarjetaPublicacionWeb p={PUB} bento={{ ancho: 580, alto: 488, grande: true }} />);
  await fireEvent.press(screen.getByLabelText(/Cuarto en Capultitlán, 3,459 pesos al mes/));
  expect(mockPush).toHaveBeenCalledTimes(2);
});

it('lleva su corazón para guardar (sin cuenta pide entrar)', async () => {
  await render(<TarjetaPublicacionWeb p={PUB} bento={{ ancho: 280, alto: 236 }} />);
  expect(screen.getByLabelText(/Guardar/)).toBeTruthy();
});
