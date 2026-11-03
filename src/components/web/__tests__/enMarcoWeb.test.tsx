import { render, screen } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

// EnMarcoWeb: en el navegador pone la pantalla dentro del marco de la web; en la app la deja tal cual.

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
