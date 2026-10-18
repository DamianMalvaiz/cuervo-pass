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
const mockSubirProducto = jest.fn();
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
  subirFotoProducto: (...a: unknown[]) => mockSubirProducto(...a),
  borrarFotos: (...a: unknown[]) => mockBorrarFotos(...a),
}));

import { clienteDePrueba } from '@pruebas/consultas';
import { ErrorParcial, useBorrarNegocio, useGuardarMenu, useGuardarNegocio, useMiNegocio, useMisNegocios } from '../useMisNegocios';

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
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCrear.mockResolvedValue('n-nuevo');
  mockActualizar.mockResolvedValue(undefined);
  mockMenu.mockResolvedValue(undefined);
  mockBorrar.mockResolvedValue(undefined);
  mockBorrarFotos.mockResolvedValue(undefined);
  mockSubir.mockImplementation(async (id: string) => `negocios/${id}/nueva.jpg`);
  mockSubirProducto.mockImplementation(async (id: string) => `negocios/${id}/p/nueva.jpg`);
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
  it('crea, sube las fotos y escribe la lista final (el menú ya NO se guarda aquí)', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarNegocio('u1'), { wrapper: Envoltura });
    let id = '';
    await act(async () => { id = await result.current.mutateAsync({ ...base, fotosNuevas: ['file:///1.jpg'] }); });

    expect(id).toBe('n-nuevo');
    expect(mockCrear).toHaveBeenCalledWith('u1', DATOS);
    expect(mockSubir).toHaveBeenCalledWith('n-nuevo', 'file:///1.jpg');
    expect(mockActualizar).toHaveBeenCalledWith('n-nuevo', { fotos: ['negocios/n-nuevo/nueva.jpg'] });
    expect(mockMenu).not.toHaveBeenCalled();
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
  });

  it('si no cambió ninguna foto no reescribe la lista', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarNegocio('u1'), { wrapper: Envoltura });
    await act(async () => { await result.current.mutateAsync({ ...base, id: 'n1', fotosConservadas: ['negocios/n1/a.jpg'] }); });
    expect(mockActualizar).toHaveBeenCalledTimes(1);
  });

  it('si falla subir una foto al editar, NO se borran las quitadas y el error llega tal cual', async () => {
    mockSubir.mockRejectedValueOnce({ code: 'CP012' });
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarNegocio('u1'), { wrapper: Envoltura });
    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ ...base, id: 'n1', fotosQuitadas: ['negocios/n1/b.jpg'], fotosNuevas: ['file:///n.jpg'] });
      } catch (e) { error = e; }
    });
    expect(error).toMatchObject({ code: 'CP012' });
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

describe('useGuardarMenu', () => {
  const producto = (extra: Record<string, unknown> = {}) => ({
    clave: 'k', nombre: ' Taco ', precio: '18', seccion: ' Tacos ', descripcion: '', foto: null, fotoNueva: null, ...extra,
  });

  it('manda el menú entero parseado, en una sola llamada y con el orden de la lista', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarMenu('n1'), { wrapper: Envoltura });
    await act(async () => {
      await result.current.mutateAsync({
        productos: [producto({ id: 'i1' }), producto({ clave: 'k2', nombre: 'Revisión', precio: '', seccion: '' })],
        fotosAnteriores: [],
      });
    });
    expect(mockMenu).toHaveBeenCalledTimes(1);
    expect(mockMenu).toHaveBeenCalledWith('n1', [
      { id: 'i1', nombre: 'Taco', precio: 18, seccion: 'Tacos', descripcion: null, foto: null },
      { id: undefined, nombre: 'Revisión', precio: null, seccion: null, descripcion: null, foto: null },
    ]);
  });

  it('sube las fotos nuevas de productos y manda sus rutas', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarMenu('n1'), { wrapper: Envoltura });
    await act(async () => { await result.current.mutateAsync({ productos: [producto({ fotoNueva: 'file:///1.jpg' })], fotosAnteriores: [] }); });
    expect(mockSubirProducto).toHaveBeenCalledWith('n1', 'file:///1.jpg');
    expect(mockMenu.mock.calls[0][1][0].foto).toBe('negocios/n1/p/nueva.jpg');
  });

  it('borra al FINAL las fotos que ya nadie usa: las de productos quitados y las reemplazadas', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarMenu('n1'), { wrapper: Envoltura });
    await act(async () => {
      await result.current.mutateAsync({
        productos: [producto({ id: 'i1', foto: 'negocios/n1/p/sigue.jpg' }), producto({ clave: 'k2', id: 'i2', foto: 'negocios/n1/p/vieja.jpg', fotoNueva: 'file:///n.jpg' })],
        fotosAnteriores: ['negocios/n1/p/sigue.jpg', 'negocios/n1/p/vieja.jpg', 'negocios/n1/p/quitado.jpg'],
      });
    });
    expect(mockBorrarFotos).toHaveBeenCalledWith(['negocios/n1/p/vieja.jpg', 'negocios/n1/p/quitado.jpg']);
    expect(mockMenu.mock.invocationCallOrder[0]).toBeLessThan(mockBorrarFotos.mock.invocationCallOrder[0]);
  });

  it('si la llamada falla NO se borra ninguna foto (con su código: CP009 = tope del plan)', async () => {
    mockMenu.mockRejectedValueOnce({ code: 'CP009' });
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarMenu('n1'), { wrapper: Envoltura });
    let error: unknown;
    await act(async () => {
      try { await result.current.mutateAsync({ productos: [producto()], fotosAnteriores: ['negocios/n1/p/x.jpg'] }); } catch (e) { error = e; }
    });
    expect(error).toMatchObject({ code: 'CP009' });
    expect(mockBorrarFotos).not.toHaveBeenCalled();
  });

  it('si falla subir una foto NO se manda el menú', async () => {
    mockSubirProducto.mockRejectedValueOnce(new Error('sin red'));
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarMenu('n1'), { wrapper: Envoltura });
    await act(async () => { await expect(result.current.mutateAsync({ productos: [producto({ fotoNueva: 'file:///1.jpg' })], fotosAnteriores: [] })).rejects.toThrow('sin red'); });
    expect(mockMenu).not.toHaveBeenCalled();
  });

  it('sin negocio no hace nada', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarMenu(undefined), { wrapper: Envoltura });
    await act(async () => { await expect(result.current.mutateAsync({ productos: [], fotosAnteriores: [] })).rejects.toThrow(); });
    expect(mockMenu).not.toHaveBeenCalled();
  });

  it('al terminar vuelve a pedir el negocio y su ficha pública', async () => {
    const { Envoltura, cliente } = envolver();
    const espia = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useGuardarMenu('n1'), { wrapper: Envoltura });
    await act(async () => { await result.current.mutateAsync({ productos: [], fotosAnteriores: [] }); });
    const claves = espia.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
    expect(claves).toEqual(expect.arrayContaining([JSON.stringify(['miNegocio', 'n1']), JSON.stringify(['negocio', 'n1'])]));
  });
});
