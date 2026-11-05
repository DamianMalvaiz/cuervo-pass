import { fireEvent, render, screen } from '@testing-library/react-native';

// La página «no encontrada»: en español, con dos salidas, y SIN el mapa de rutas que traía la de Expo («Unmatched Route» + «Sitemap»).

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) }, Redirect: ({ href }: { href: string }) => require('react').createElement(require('react-native').Text, null, `REDIRECT ${href}`) }));
jest.mock('@/components/web/EnMarcoWeb', () => ({ EnMarcoWeb: ({ titulo, children }: { titulo?: string; children: React.ReactNode }) => require('react').createElement(require('react-native').View, null, require('react').createElement(require('react-native').Text, null, `TITULO ${titulo}`), children) }));

import NoEncontrada from '../+not-found';
import Sitemap from '../_sitemap';

beforeEach(() => jest.clearAllMocks());

it('dice qué pasó, en español, con su título', async () => {
  await render(<NoEncontrada />);
  expect(screen.getByText('TITULO No encontramos esa página')).toBeTruthy();
  expect(screen.getByText(/enlace esté mal escrito/)).toBeTruthy();
  expect(screen.queryByText(/Unmatched|Sitemap|Go back/)).toBeNull();
});

it('da dos salidas: el inicio y los departamentos', async () => {
  await render(<NoEncontrada />);
  await fireEvent.press(screen.getByLabelText('Ir al inicio'));
  expect(mockReplace).toHaveBeenLastCalledWith('/');
  await fireEvent.press(screen.getByLabelText('Ver departamentos'));
  expect(mockReplace).toHaveBeenLastCalledWith('/departamentos');
});

it('/_sitemap ya no enseña el mapa de rutas: manda al inicio', async () => {
  await render(<Sitemap />);
  expect(screen.getByText('REDIRECT /')).toBeTruthy();
});
