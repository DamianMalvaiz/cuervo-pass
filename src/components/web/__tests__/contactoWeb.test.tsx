import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

// El contacto de una vivienda para una cuenta con sesión. «Escribir en la app» es el camino principal (la conversación se queda dentro, sin teléfonos); «Ver contacto» (WhatsApp) es el segundo, con su cuota diaria.
// No se ofrece lo que la base va a rechazar: en tu propia publicación o con una cuenta restringida. Y un fallo de lectura NO se pinta como «no hay a quién escribir».

const mockAbrirChat = jest.fn();
jest.mock('@/lib/abrirChat', () => ({ abrirChatCon: (...a: unknown[]) => mockAbrirChat(...a) }));
const mockRevelar = jest.fn();
jest.mock('@/services/publicaciones.service', () => ({ revelarContacto: (...a: unknown[]) => mockRevelar(...a) }));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({ toast: { error: (...a: unknown[]) => mockToast(...a) } }));
jest.mock('@/lib/tacto', () => ({ sello: jest.fn(), toque: jest.fn() }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'yo' } } }) }));

const mockFicha = { publicacion: { id: 'p1', usuario_id: 'otro' } as null | { id: string; usuario_id: string }, cargando: false, fallo: null as string | null, reintentar: jest.fn() };
jest.mock('@/hooks/queries/usePublicaciones', () => ({ usePublicacion: () => mockFicha }));
const mockRestringida = { valor: false };
jest.mock('@/hooks/queries/useCuentaRestringida', () => ({ useCuentaRestringida: () => mockRestringida.valor }));

import { ContactoWeb } from '../ContactoWeb';

const abrirUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

beforeEach(() => {
  jest.clearAllMocks();
  abrirUrl.mockResolvedValue(true);
  Object.assign(mockFicha, { publicacion: { id: 'p1', usuario_id: 'otro' }, cargando: false, fallo: null });
  mockRestringida.valor = false;
});

describe('ContactoWeb', () => {
  it('«Escribir en la app» abre la conversación con quien publicó', async () => {
    await render(<ContactoWeb publicacionId="p1" titulo="Cuarto" precio={2900} />);
    expect(screen.getByText(/2,900/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Escribir en la app'));
    expect(mockAbrirChat).toHaveBeenCalledWith('otro');
  });

  it('«Ver contacto» pide el número (sin mandar score: lo calcula el servidor) y abre WhatsApp con el mensaje', async () => {
    mockRevelar.mockResolvedValue('722 123 4567');
    await render(<ContactoWeb publicacionId="p1" titulo="Cuarto" precio={2900} />);
    await fireEvent.press(screen.getByLabelText('Ver contacto'));
    await waitFor(() => expect(abrirUrl).toHaveBeenCalled());
    expect(mockRevelar).toHaveBeenCalledWith('p1');
    expect(abrirUrl.mock.calls[0][0]).toMatch(/^https:\/\/wa\.me\/527221234567\?text=/);
  });

  it('con la cuota agotada lo dice, y no abre nada', async () => {
    mockRevelar.mockRejectedValue({ code: 'CP001', message: 'cuota agotada' });
    await render(<ContactoWeb publicacionId="p1" titulo="Cuarto" precio={2900} />);
    await fireEvent.press(screen.getByLabelText('Ver contacto'));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('límite de contactos')));
    expect(abrirUrl).not.toHaveBeenCalled();
  });

  it('en tu propia publicación no ofrece escribirte a ti mismo', async () => {
    mockFicha.publicacion = { id: 'p1', usuario_id: 'yo' };
    await render(<ContactoWeb publicacionId="p1" titulo="Cuarto" precio={2900} />);
    expect(screen.queryByLabelText('Escribir en la app')).toBeNull();
    expect(screen.queryByLabelText('Ver contacto')).toBeNull();
    expect(screen.getByText('Esta es tu publicación.')).toBeTruthy();
  });

  it('una cuenta restringida no abre conversaciones nuevas, pero sí puede ver el contacto', async () => {
    mockRestringida.valor = true;
    await render(<ContactoWeb publicacionId="p1" titulo="Cuarto" precio={2900} />);
    expect(screen.queryByLabelText('Escribir en la app')).toBeNull();
    expect(screen.getByLabelText('Ver contacto')).toBeTruthy();
  });

  it('un FALLO al leer la publicación se dice y se puede reintentar (no es «no hay a quién escribir»)', async () => {
    Object.assign(mockFicha, { publicacion: null, fallo: 'x' });
    await render(<ContactoWeb publicacionId="p1" titulo="Cuarto" precio={2900} />);
    expect(screen.getByText('No pudimos cargar el contacto')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    expect(mockFicha.reintentar).toHaveBeenCalled();
    expect(screen.queryByLabelText('Escribir en la app')).toBeNull();
  });

  it('mientras carga no ofrece nada que no pueda cumplir', async () => {
    Object.assign(mockFicha, { publicacion: null, cargando: true });
    await render(<ContactoWeb publicacionId="p1" titulo="Cuarto" precio={2900} />);
    expect(screen.getByText('Cargando…')).toBeTruthy();
    expect(screen.queryByLabelText('Escribir en la app')).toBeNull();
  });
});
