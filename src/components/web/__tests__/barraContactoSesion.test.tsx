import { fireEvent, render, screen } from '@testing-library/react-native';

// La barra fija de la ficha en teléfono, con sesión: el precio, «Escribir» (lo principal) y un botón de WhatsApp (lo segundo). Mismas reglas que la tarjeta de escritorio.

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'yo' } } }) }));
const mockC = { cargando: false, fallo: null as string | null, reintentar: jest.fn(), esMia: false, puedeEscribir: true, escribir: jest.fn(), abriendo: false, verContacto: jest.fn(), revelando: false };
jest.mock('@/hooks/use-contacto-publicacion', () => ({ useContactoPublicacion: () => mockC }));

import { BarraContactoWeb } from '../BarraContactoWeb';

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockC, { cargando: false, fallo: null, esMia: false, puedeEscribir: true });
});

describe('BarraContactoWeb con sesión', () => {
  it('«Escribir» abre la conversación y WhatsApp pide el contacto', async () => {
    await render(<BarraContactoWeb precio={2900} publicacionId="p1" titulo="Cuarto" />);
    expect(screen.getByText(/2,900/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Escribir en la app'));
    expect(mockC.escribir).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Ver contacto'));
    expect(mockC.verContacto).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Iniciar sesión para escribir')).toBeNull();
  });

  it('una cuenta restringida solo ve el contacto', async () => {
    mockC.puedeEscribir = false;
    await render(<BarraContactoWeb precio={2900} publicacionId="p1" titulo="Cuarto" />);
    expect(screen.queryByLabelText('Escribir en la app')).toBeNull();
    expect(screen.getByLabelText('Ver contacto')).toBeTruthy();
  });

  it('en tu propia publicación lo dice y no ofrece contacto', async () => {
    mockC.esMia = true;
    await render(<BarraContactoWeb precio={2900} publicacionId="p1" titulo="Cuarto" />);
    expect(screen.getByText('Es tu publicación')).toBeTruthy();
    expect(screen.queryByLabelText('Ver contacto')).toBeNull();
  });

  it('un fallo al leer se dice y se puede reintentar', async () => {
    Object.assign(mockC, { fallo: 'x' });
    await render(<BarraContactoWeb precio={2900} publicacionId="p1" titulo="Cuarto" />);
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    expect(mockC.reintentar).toHaveBeenCalled();
    expect(screen.queryByLabelText('Escribir en la app')).toBeNull();
  });
});
