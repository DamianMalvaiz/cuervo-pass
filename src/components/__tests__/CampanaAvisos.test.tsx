import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockConteo = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/queries/useNotificaciones', () => ({ useAvisosNoLeidos: (...a: unknown[]) => mockConteo(...a) }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }) }));
jest.mock('@/lib/tacto', () => ({ toque: jest.fn(), sello: jest.fn() }));

import { CampanaAvisos } from '../CampanaAvisos';

beforeEach(() => jest.clearAllMocks());

it('sin avisos no pinta insignia', async () => {
  mockConteo.mockReturnValue(0);
  await render(<CampanaAvisos />);
  expect(screen.getByLabelText('Avisos')).toBeTruthy();
  expect(screen.queryByText('0')).toBeNull();
});
it('si no se sabe (null) tampoco pinta insignia: no es lo mismo que cero', async () => {
  mockConteo.mockReturnValue(null);
  await render(<CampanaAvisos />);
  expect(screen.getByLabelText('Avisos')).toBeTruthy();
});
it('con avisos, el número va en texto y en la etiqueta de accesibilidad', async () => {
  mockConteo.mockReturnValue(3);
  await render(<CampanaAvisos />);
  expect(screen.getByText('3')).toBeTruthy();
  expect(screen.getByLabelText('Avisos, 3 sin leer')).toBeTruthy();
});
it('más de 9 se dice «9+»', async () => {
  mockConteo.mockReturnValue(42);
  await render(<CampanaAvisos />);
  expect(screen.getByText('9+')).toBeTruthy();
});
it('tocarla abre el centro de avisos y pide el conteo de ESTA cuenta', async () => {
  mockConteo.mockReturnValue(1);
  await render(<CampanaAvisos />);
  expect(mockConteo).toHaveBeenCalledWith('u1');
  await fireEvent.press(screen.getByLabelText('Avisos, 1 sin leer'));
  expect(mockPush).toHaveBeenCalledWith('/notificaciones');
});
