import { render, screen } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

// EnMarcoWeb: en el navegador pone la pantalla dentro del marco de la web; en la app la deja tal cual.

const mockHead = jest.fn();
jest.mock('expo-router/head', () => ({ __esModule: true, default: (props: unknown) => { mockHead(props); return null; } }));
jest.mock('@/components/web/MarcoSesionWeb', () => {
  const { View, Text: T } = require('react-native');
  return { MarcoSesionWeb: ({ children }: { children: React.ReactNode }) => <View><T>MARCO WEB</T>{children}</View> };
});

import { EnMarcoWeb } from '../EnMarcoWeb';

afterEach(() => jest.restoreAllMocks());

it('en la web envuelve la pantalla con el marco de la web', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  await render(<EnMarcoWeb><Text>PANTALLA</Text></EnMarcoWeb>);
  expect(screen.getByText('MARCO WEB')).toBeTruthy();
  expect(screen.getByText('PANTALLA')).toBeTruthy();
});

it('en la app no hay marco: solo la pantalla', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  await render(<EnMarcoWeb><Text>PANTALLA</Text></EnMarcoWeb>);
  expect(screen.queryByText('MARCO WEB')).toBeNull();
  expect(screen.getByText('PANTALLA')).toBeTruthy();
});

it('con `titulo` devuelve el nombre que la cabecera de la app ponía: encabezado de la página y título de la pestaña', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  await render(<EnMarcoWeb titulo="Configuración"><Text>PANTALLA</Text></EnMarcoWeb>);
  expect(screen.getByText('Configuración')).toBeTruthy();
  const titulos = mockHead.mock.calls.map((c) => (c[0] as { children: { props: { children: string } } }).children.props.children);
  expect(titulos).toContain('Configuración · Cuervo 360');
});

it('sin `titulo` no pone encabezado (la pantalla ya trae el suyo)', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  await render(<EnMarcoWeb><Text>PANTALLA</Text></EnMarcoWeb>);
  expect(screen.queryByRole('header')).toBeNull();
});

it('en la app el título no se pinta: la cabecera de la app lo trae', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  await render(<EnMarcoWeb titulo="Configuración"><Text>PANTALLA</Text></EnMarcoWeb>);
  expect(screen.queryByText('Configuración')).toBeNull();
});
