import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

// END-10 · Sin clave de Google, el MapView de Android pinta un rectángulo GRIS
// (o, según la versión, tumba la pantalla al montar). En vez de eso, la ficha
// debe decir dónde está y dejar abrir la app de mapas del teléfono, que no
// necesita nuestra clave.

import { MapaUbicacion, hayMapaIntegrado } from '../MapaUbicacion';

const base = {
  latitud: 19.43,
  longitud: -99.13,
  titulo: 'Depa centro',
  direccion: 'Calle 5 #12, Col. Centro',
};

beforeEach(() => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

test('con mapa integrado disponible, pinta el mapa y no el sustituto', async () => {
  await render(<MapaUbicacion {...base} mapaIntegrado />);

  expect(screen.getByTestId('mapa')).toBeTruthy();
  expect(screen.queryByLabelText('Abrir en Maps')).toBeNull();
});

test('sin mapa integrado, NO monta el MapView y muestra la dirección', async () => {
  await render(<MapaUbicacion {...base} mapaIntegrado={false} />);

  expect(screen.queryByTestId('mapa')).toBeNull();
  expect(screen.getByText('Calle 5 #12, Col. Centro')).toBeTruthy();
});

test('el botón abre la ubicación exacta en la app de mapas', async () => {
  await render(<MapaUbicacion {...base} mapaIntegrado={false} />);

  await fireEvent.press(screen.getByLabelText('Abrir en Maps'));

  expect(Linking.openURL).toHaveBeenCalledWith(
    'https://www.google.com/maps/search/?api=1&query=19.43,-99.13'
  );
});

test('si no hay app que abra el enlace, no revienta', async () => {
  (Linking.openURL as jest.Mock).mockRejectedValue(new Error('sin app'));
  await render(<MapaUbicacion {...base} mapaIntegrado={false} />);

  await expect(
    fireEvent.press(screen.getByLabelText('Abrir en Maps'))
  ).resolves.not.toThrow();
});

describe('hayMapaIntegrado', () => {
  test('iOS usa Apple Maps: no necesita clave', () => {
    expect(hayMapaIntegrado('ios', undefined)).toBe(true);
  });
  test('Android sin clave: no hay mapa', () => {
    expect(hayMapaIntegrado('android', undefined)).toBe(false);
    expect(hayMapaIntegrado('android', '')).toBe(false);
    expect(hayMapaIntegrado('android', '   ')).toBe(false);
  });
  test('Android con clave: hay mapa', () => {
    expect(hayMapaIntegrado('android', 'AIza-algo')).toBe(true);
  });
  // La web (panel de admin) no tiene mapa nativo: `MapaNativo.web.tsx` no dibuja nada, así que NUNCA debe elegirse el mapa integrado ahí, con o sin clave.
  it('en web nunca hay mapa integrado: se usa el enlace a Maps', () => {
    expect(hayMapaIntegrado('web', undefined)).toBe(false);
    expect(hayMapaIntegrado('web', 'AIza-algo')).toBe(false);
  });
});
