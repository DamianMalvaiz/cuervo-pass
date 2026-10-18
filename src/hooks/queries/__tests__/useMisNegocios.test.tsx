import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockLista = jest.fn();
const mockUno = jest.fn();
const mockCrear = jest.fn();
const mockActualizar = jest.fn();
const mockMenu = jest.fn();
const mockBorrar = jest.fn();
const mockSubir = jest.fn();
const mockBorrarFotos = jest.fn();
jest.mock('@/services/negociosPropios.service', () => ({
  listarMisNegocios: (...a: unknown[]) => mockLista(...a),
  obtenerMiNegocio: (...a: unknown[]) => mockUno(...a),
  crearNegocio: (...a: unknown[]) => mockCrear(...a),
  actualizarNegocio: (...a: unknown[]) => mockActualizar(...a),
  guardarMenu: (...a: unknown[]) => mockMenu(...a),
  borrarNegocio: (...a: unknown[]) => mockBorrar(...a),
}));
jest.mock('@/lib/storage', () => ({
  subirFotoNegocio: (...a: unknown[]) => mockSubir(...a),
  borrarFotos: (...a: unknown[]) => mockBorrarFotos(...a),
}));

import { clienteDePrueba } from '@pruebas/consultas';
import { ErrorParcial, useBorrarNegocio, useGuardarNegocio, useMiNegocio, useMisNegocios } from '../useMisNegocios';

const envolver = () => {
  const cliente = clienteDePrueba({ queries: { retry: false } });
  const Envoltura = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  return { Envoltura, cliente };
};

const DATOS = {
  categoria_id: 'comida', nombre: 'Tacos', descripcion: null, direccion: 'Calle 1', latitud: null, longitud: null,
  rango_precio: 1, horario: null, activo: true,
};
const base = {
  datos: DATOS, fotosConservadas: [] as string[], fotosQuitadas: [] as string[], fotosNuevas: [] as string[],
  items: [{ nombre: ' Taco ', precio: '18' }, { id: 'i2', nombre: 'Revisión', precio: '' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCrear.mockResolvedValue('n-nuevo');
  mockActualizar.mockResolvedValue(undefined);
  mockMenu.mockResolvedValue(undefined);
  mockBorrar.mockResolvedValue(undefined);
  mockBorrarFotos.mockResolvedValue(undefined);
  mockSubir.mockImplementation(async (id: string) => `negocios/${id}/nueva.jpg`);
});

describe('lecturas', () => {
  it('useMisNegocios: lista, y un fallo no es «no tienes negocios»', async () => {
    mockLista.mockResolvedValue([{ id: 'n1' }]);
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useMisNegocios('u1'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.negocios).toHaveLength(1));

    mockLista.mockRejectedValue(new Error('sin red'));
    const roto = envolver();
    const r2 = await renderHook(() => useMisNegocios('u2'), { wrapper: roto.Envoltura });
    await waitFor(() => expect(r2.result.current.fallo).toBe(true));
    expect(r2.result.current.negocios).toEqual([]);
  });

  it('sin sesión no consulta y no se queda cargando', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useMisNegocios(undefined), { wrapper: Envoltura });
    expect(mockLista).not.toHaveBeenCalled();
    expect(result.current.cargando).toBe(false);
  });

  it('useMiNegocio: trae negocio y menú; uno ajeno es null, no fallo', async () => {
    mockUno.mockResolvedValue({ negocio: { id: 'n1' }, items: [{ id: 'i1' }] });
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useMiNegocio('n1'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.negocio).toEqual({ id: 'n1' }));
    expect(result.current.items).toEqual([{ id: 'i1' }]);

    mockUno.mockResolvedValue(null);
    const otro = envolver();
    const r2 = await renderHook(() => useMiNegocio('x'), { wrapper: otro.Envoltura });
    await waitFor(() => expect(r2.result.current.cargando).toBe(false));
    expect(r2.result.current.negocio).toBeNull();
    expect(r2.result.current.fallo).toBe(false);
  });
});

describe('useGuardarNegocio · nuevo', () => {
  it('crea, sube las fotos, escribe la lista final y guarda el menú ya parseado', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarNegocio('u1'), { wrapper: Envoltura });
    let id = '';
    await act(async () => { id = await result.current.mutateAsync({ ...base, fotosNuevas: ['file:///1.jpg'] }); });

    expect(id).toBe('n-nuevo');
    expect(mockCrear).toHaveBeenCalledWith('u1', DATOS);
    expect(mockSubir).toHaveBeenCalledWith('n-nuevo', 'file:///1.jpg');
    expect(mockActualizar).toHaveBeenCalledWith('n-nuevo', { fotos: ['negocios/n-nuevo/nueva.jpg'] });
    expect(mockMenu).toHaveBeenCalledWith('n-nuevo', [
      { id: undefined, nombre: 'Taco', precio: 18 },
      { id: 'i2', nombre: 'Revisión', precio: null },
    ]);
  });

  it('si falla un paso DESPUÉS de crear, avisa con el id para poder terminarlo', async () => {
    mockSubir.mockRejectedValueOnce(new Error('sin red'));
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarNegocio('u1'), { wrapper: Envoltura });
    let error: unknown;
    await act(async () => {
      try { await result.current.mutateAsync({ ...base, fotosNuevas: ['file:///1.jpg'] }); } catch (e) { error = e; }
    });
    expect(error).toBeInstanceOf(ErrorParcial);
    expect((error as ErrorParcial).idCreado).toBe('n-nuevo');
    expect(mockMenu).not.toHaveBeenCalled();
  });

  it('si falla crear, el error llega tal cual (con su código) y no se sube nada', async () => {
    mockCrear.mockRejectedValue({ code: 'CP008' });
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarNegocio('u1'), { wrapper: Envoltura });
    let error: unknown;
    await act(async () => {
      try { await result.current.mutateAsync({ ...base, fotosNuevas: ['file:///1.jpg'] }); } catch (e) { error = e; }
    });
    expect(error).toMatchObject({ code: 'CP008' });
    expect(mockSubir).not.toHaveBeenCalled();
  });

  it('sin sesión no hace nada', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarNegocio(undefined), { wrapper: Envoltura });
    await act(async () => { await expect(result.current.mutateAsync(base)).rejects.toThrow(); });
    expect(mockCrear).not.toHaveBeenCalled();
  });
});

describe('useGuardarNegocio · editar', () => {
  it('actualiza, conserva las fotos que siguen y borra de Storage las quitadas AL FINAL', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarNegocio('u1'), { wrapper: Envoltura });
    await act(async () => {
      await result.current.mutateAsync({
        ...base, id: 'n1', fotosConservadas: ['negocios/n1/a.jpg'], fotosQuitadas: ['negocios/n1/b.jpg'], fotosNuevas: ['file:///n.jpg'],
      });
    });
    expect(mockCrear).not.toHaveBeenCalled();
    expect(mockActualizar).toHaveBeenCalledWith('n1', DATOS);
    expect(mockActualizar).toHaveBeenCalledWith('n1', { fotos: ['negocios/n1/a.jpg', 'negocios/n1/nueva.jpg'] });
    expect(mockBorrarFotos).toHaveBeenCalledWith(['negocios/n1/b.jpg']);
    expect(mockMenu.mock.invocationCallOrder[0]).toBeLessThan(mockBorrarFotos.mock.invocationCallOrder[0]);
  });

  it('si no cambió ninguna foto no reescribe la lista', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarNegocio('u1'), { wrapper: Envoltura });
    await act(async () => { await result.current.mutateAsync({ ...base, id: 'n1', fotosConservadas: ['negocios/n1/a.jpg'] }); });
    expect(mockActualizar).toHaveBeenCalledTimes(1);
  });

  it('si falla el menú al editar, NO se borran las fotos quitadas y el error llega tal cual', async () => {
    mockMenu.mockRejectedValueOnce({ code: 'CP009' });
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarNegocio('u1'), { wrapper: Envoltura });
    let error: unknown;
    await act(async () => {
      try { await result.current.mutateAsync({ ...base, id: 'n1', fotosQuitadas: ['negocios/n1/b.jpg'] }); } catch (e) { error = e; }
    });
    expect(error).toMatchObject({ code: 'CP009' });
    expect(mockBorrarFotos).not.toHaveBeenCalled();
  });

  it('al terminar vuelve a pedir la lista, el negocio y la oferta pública', async () => {
    const { Envoltura, cliente } = envolver();
    const espia = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useGuardarNegocio('u1'), { wrapper: Envoltura });
    await act(async () => { await result.current.mutateAsync({ ...base, id: 'n1' }); });
    const claves = espia.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
    expect(claves).toEqual(expect.arrayContaining([
      JSON.stringify(['misNegocios', 'u1']), JSON.stringify(['miNegocio', 'n1']),
      JSON.stringify(['negocios']), JSON.stringify(['negocio', 'n1']),
    ]));
  });
});

describe('useBorrarNegocio', () => {
  it('borra con las fotos y refresca la lista', async () => {
    const { Envoltura, cliente } = envolver();
    const espia = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useBorrarNegocio('u1'), { wrapper: Envoltura });
    await act(async () => { await result.current.mutateAsync({ id: 'n1', fotos: ['negocios/n1/a.jpg'] }); });
    expect(mockBorrar).toHaveBeenCalledWith('n1', ['negocios/n1/a.jpg']);
    const claves = espia.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
    expect(claves).toContain(JSON.stringify(['misNegocios', 'u1']));
  });
});
