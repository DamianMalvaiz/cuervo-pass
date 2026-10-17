import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

// Cuervo 360 · el sello deja de ser ámbar.
//
// Hay DOS cosas distintas, y las dos se llamaban «sello»:
//
//  · El botón PRIMARIO de la app (guardar, entrar, crear cuenta, reintentar): es
//    `Sello` en `ficha/Sello.tsx` y se usa en 14 pantallas. Pasa a lima con texto
//    carbón.
//  · EL sello: la única acción que compromete algo (hoy «Ver contacto»; mañana
//    «Contratar plan»). Pasa a carbón con texto lima en claro y a blanco hueso con
//    texto carbón en oscuro.
//
// Lo que se fija aquí es que NUNCA se parezcan: si el sello se pintara igual que el
// botón primario, dejaría de señalar «esto compromete».

const mockModo = { valor: 'light' as 'light' | 'dark' };
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => mockModo.valor }));
jest.mock('@/lib/tacto', () => ({ sello: jest.fn(), toque: jest.fn() }));

import { Colors } from '@/constants/theme';
import { Sello } from '../ficha/Sello';
import { BotonVerContacto } from '../BotonVerContacto';
import { Casilla } from '../Casilla';
import { MapaUbicacion } from '../MapaUbicacion';

type Estilo = { backgroundColor?: string; color?: string };
const estiloDe = (el: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(el.props.style as never) ?? {}) as Estilo;
const fondo = (el: { props: { style?: unknown } }) => estiloDe(el).backgroundColor;
const colorTexto = (el: { props: { style?: unknown } }) => estiloDe(el).color;

describe.each(['light', 'dark'] as const)('modo %s', (modo) => {
  const t = Colors[modo];
  beforeEach(() => {
    mockModo.valor = modo;
  });

  test('el botón primario es lima con texto carbón', async () => {
    await render(<Sello onPress={() => {}}>Guardar</Sello>);
    expect(fondo(screen.getByLabelText('Guardar'))).toBe(t.lima);
    expect(colorTexto(screen.getByText('Guardar'))).toBe(t.limaTexto);
  });

  test('«Ver contacto» usa el sello', async () => {
    await render(
      <BotonVerContacto publicacionId="p1" titulo="Depa" onRevelar={jest.fn()} onError={jest.fn()} />
    );
    expect(fondo(screen.getByLabelText('Ver contacto'))).toBe(t.sello);
    expect(colorTexto(screen.getByText('Ver contacto'))).toBe(t.selloTexto);
  });

  test('el sello NO se parece al botón primario', () => {
    expect(t.sello.toLowerCase()).not.toBe(t.lima.toLowerCase());
  });

  test('la casilla marcada usa el verde bosque, que sí se distingue del fondo', async () => {
    await render(<Casilla etiqueta="Acepto" valor onCambiar={() => {}} />);
    const caja = screen.getByLabelText('Acepto').children[0] as unknown as { props: { style?: unknown } };
    expect(fondo(caja)).toBe(t.bosque);
  });

  test('sin mapa integrado, «Abrir en Maps» es el botón primario, no un botón propio', async () => {
    await render(
      <MapaUbicacion latitud={19.4} longitud={-99.1} titulo="Depa" direccion="Calle 1" mapaIntegrado={false} />
    );
    expect(fondo(screen.getByLabelText('Abrir en Maps'))).toBe(t.lima);
  });
});

test('el ámbar del sello anterior ya no está en ningún token', () => {
  const tema = require('node:fs').readFileSync('src/constants/theme.ts', 'utf8') as string;
  expect(tema).not.toMatch(/sello: '#E8A33D'/i);
  expect(tema).not.toMatch(/AppColors = \{[^}]*sello:/);
});

test('se pulsa el botón primario sin romperse', async () => {
  mockModo.valor = 'light';
  const onPress = jest.fn();
  await render(<Sello onPress={onPress}>Entrar</Sello>);
  await fireEvent.press(screen.getByLabelText('Entrar'));
  expect(onPress).toHaveBeenCalledTimes(1);
});
