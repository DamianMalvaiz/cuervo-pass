// `useCuentaRestringida` solo decide qué se ofrece; la base es la que protege. Lo que se fija: restringida → true; normal → false; y un FALLO o
// la falta de sesión no esconden nada (false) ni se quedan colgados.

jest.unmock('@/hooks/queries/useCuentaRestringida');

const mockObtener = jest.fn();
jest.mock('@/services/usuarios.service', () => ({ obtenerCuentaRestringida: (...a: unknown[]) => mockObtener(...a) }));

import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { clienteDePrueba } from '@pruebas/consultas';

import { useCuentaRestringida } from '../useCuentaRestringida';

const envolver = () => {
  const cliente = clienteDePrueba({ queries: { retry: false } });
  const Envoltura = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  return Envoltura;
};

beforeEach(() => jest.clearAllMocks());

describe('useCuentaRestringida', () => {
  it('una cuenta restringida da true', async () => {
    mockObtener.mockResolvedValue(true);
    const { result } = await renderHook(() => useCuentaRestringida('u1'), { wrapper: envolver() });
    await waitFor(() => expect(result.current).toBe(true));
    expect(mockObtener).toHaveBeenCalledWith('u1');
  });

  it('una cuenta normal da false', async () => {
    mockObtener.mockResolvedValue(false);
    const { result } = await renderHook(() => useCuentaRestringida('u1'), { wrapper: envolver() });
    await waitFor(() => expect(mockObtener).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('un fallo de lectura NO esconde nada: false', async () => {
    mockObtener.mockRejectedValue(new Error('sin red'));
    const { result } = await renderHook(() => useCuentaRestringida('u1'), { wrapper: envolver() });
    await waitFor(() => expect(mockObtener).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('sin sesión no consulta', async () => {
    const { result } = await renderHook(() => useCuentaRestringida(undefined), { wrapper: envolver() });
    expect(mockObtener).not.toHaveBeenCalled();
    expect(result.current).toBe(false);
  });
});
