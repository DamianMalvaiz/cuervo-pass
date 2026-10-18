import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

// Mi negocio · el formulario. Lo que se fija: valida antes de tocar la red, manda al hook exactamente lo que se puede
// escribir (nunca destacado/origen), geocodifica solo cuando la dirección cambió, y los fallos se dicen como fallos.

const mockMutate = jest.fn();
const mockBorrarMutate = jest.fn();
const mockGeocodificar = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPermiso = jest.fn();
const mockElegir = jest.fn();
const mockExito = jest.fn();
const mockError = jest.fn();
const mockInfo = jest.fn();

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: (...a: unknown[]) => mockBack(...a), replace: (...a: unknown[]) => mockReplace(...a), push: (...a: unknown[]) => mockPush(...a) },
}));
jest.mock('@/hooks/queries/useMisNegocios', () => {
  class ErrorParcial extends Error {
    idCreado: string;
    constructor(id: string) { super('parcial'); this.idCreado = id; }
  }
  return {
    ErrorParcial,
    useGuardarNegocio: () => ({ mutate: (...a: unknown[]) => mockMutate(...a), isPending: false }),
    useBorrarNegocio: () => ({ mutate: (...a: unknown[]) => mockBorrarMutate(...a), isPending: false }),
  };
});
jest.mock('@/hooks/queries/useServicios', () => ({
  useCategoriasServicio: () => ({
    categorias: [{ id: 'comida', nombre: 'Comida', icono: 'x', orden: 1 }, { id: 'cafes', nombre: 'Cafés', icono: 'x', orden: 2 }],
  }),
}));
jest.mock('@/hooks/use-fotos-firmadas', () => ({
  useFotosFirmadas: () => ({ urls: new Map([['negocios/n1/a.jpg', 'https://f.test/a'], ['negocios/n1/b.jpg', 'https://f.test/b']]) }),
}));
jest.mock('@/lib/geocoding', () => ({ geocodificarDireccion: (...a: unknown[]) => mockGeocodificar(...a) }));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...a: unknown[]) => mockPermiso(...a),
  launchImageLibraryAsync: (...a: unknown[]) => mockElegir(...a),
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/lib/toast', () => ({
  toast: { exito: (...a: unknown[]) => mockExito(...a), error: (...a: unknown[]) => mockError(...a), info: (...a: unknown[]) => mockInfo(...a) },
}));

import { ErrorParcial } from '@/hooks/queries/useMisNegocios';
import { FormularioNegocio } from '../FormularioNegocio';

const NEGOCIO = {
  id: 'n1', categoria_id: 'comida', nombre: 'Tacos', descripcion: 'Ricos', direccion: 'Calle 1, Lerma', latitud: 19.3, longitud: -99.4,
  rango_precio: 1, horario: 'Lun a sáb', fotos: ['negocios/n1/a.jpg', 'negocios/n1/b.jpg'], destacado: false, origen: 'solicitud',
  activo: true, oculto_por_reportes: false, usuario_id: 'u1', creado_en: 'x',
};
const ITEMS = [{ id: 'i1', negocio_id: 'n1', nombre: 'Taco', precio: 18, orden: 0 }, { id: 'i2', negocio_id: 'n1', nombre: 'Revisión', precio: null, orden: 1 }];

const pulsar = async (e: string | RegExp) => { await act(async () => { fireEvent.press(screen.getByLabelText(e)); }); };
const escribir = async (e: string, t: string) => { await act(async () => { fireEvent.changeText(screen.getByLabelText(e), t); }); };

const llenarNuevo = async () => {
  await escribir('Nombre del negocio', 'Café Nuevo');
  await pulsar('Categoría Cafés');
  await escribir('Dirección', 'Calle 5, Lerma');
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGeocodificar.mockResolvedValue({ lat: 19.32, lng: -99.45, proveedor: 'osm' });
  mockPermiso.mockResolvedValue({ granted: true });
  let n = 0;
  mockElegir.mockImplementation(async () => ({ canceled: false, assets: [{ uri: `file:///f-${++n}.jpg` }] }));
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('negocio nuevo', () => {
  it('con el formulario vacío NO guarda y dice qué falta', async () => {
    await render(<FormularioNegocio />);
    await pulsar('Publicar negocio');
    expect(mockMutate).not.toHaveBeenCalled();
    expect(mockGeocodificar).not.toHaveBeenCalled();
    expect(screen.getByText('Elige una categoría')).toBeTruthy();
    expect(screen.getByText('Escribe el nombre de tu negocio')).toBeTruthy();
    expect(screen.getByText('Escribe la dirección')).toBeTruthy();
  });

  it('completo, geocodifica y manda al hook SOLO columnas escribibles', async () => {
    await render(<FormularioNegocio />);
    await llenarNuevo();
    await pulsar('Rango de precio $$');
    await pulsar('Publicar negocio');
    expect(mockGeocodificar).toHaveBeenCalledWith('Calle 5, Lerma');
    const entrada = mockMutate.mock.calls[0][0];
    expect(entrada.id).toBeUndefined();
    expect(entrada.datos).toEqual({
      categoria_id: 'cafes', nombre: 'Café Nuevo', descripcion: null, direccion: 'Calle 5, Lerma',
      latitud: 19.32, longitud: -99.45, rango_precio: 2, horario: null, activo: true,
    });
    for (const prohibida of ['destacado', 'origen', 'oculto_por_reportes']) expect(entrada.datos).not.toHaveProperty(prohibida);
  });

  it('si no se puede ubicar la dirección, guarda igual y lo dice', async () => {
    mockGeocodificar.mockResolvedValue(null);
    await render(<FormularioNegocio />);
    await llenarNuevo();
    await pulsar('Publicar negocio');
    expect(mockInfo).toHaveBeenCalled();
    expect(mockMutate.mock.calls[0][0].datos).toMatchObject({ latitud: null, longitud: null });
  });

  it('al guardar bien avisa y vuelve atrás', async () => {
    mockMutate.mockImplementation((_e, { onSuccess }) => onSuccess('n9'));
    await render(<FormularioNegocio />);
    await llenarNuevo();
    await pulsar('Publicar negocio');
    expect(mockExito).toHaveBeenCalledWith('Tu negocio quedó publicado');
    expect(mockBack).toHaveBeenCalled();
  });

  it('CP008 se explica por código: ya tienes un negocio visible', async () => {
    mockMutate.mockImplementation((_e, { onError }) => onError({ code: 'CP008' }));
    await render(<FormularioNegocio />);
    await llenarNuevo();
    await pulsar('Publicar negocio');
    expect(String(mockError.mock.calls[0][0])).toMatch(/negocio visible/);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('CP012 se explica por código: tu plan permite menos fotos', async () => {
    mockMutate.mockImplementation((_e, { onError }) => onError({ code: 'CP012' }));
    await render(<FormularioNegocio />);
    await llenarNuevo();
    await pulsar('Publicar negocio');
    expect(String(mockError.mock.calls[0][0])).toMatch(/menos fotos/);
  });

  it('un fallo de red se dice como fallo, sin éxito', async () => {
    mockMutate.mockImplementation((_e, { onError }) => onError(new Error('Network request failed')));
    await render(<FormularioNegocio />);
    await llenarNuevo();
    await pulsar('Publicar negocio');
    expect(String(mockError.mock.calls[0][0])).toMatch(/conexión/);
    expect(mockExito).not.toHaveBeenCalled();
  });

  it('si el negocio se creó pero faltó algo, lleva a editarlo para terminarlo', async () => {
    mockMutate.mockImplementation((_e, { onError }) => onError(new ErrorParcial('n-creado', new Error('x'))));
    await render(<FormularioNegocio />);
    await llenarNuevo();
    await pulsar('Publicar negocio');
    expect(String(mockError.mock.calls[0][0])).toMatch(/faltó terminar/);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/negocio/editar/[id]', params: { id: 'n-creado' } });
  });

  it('un negocio nuevo no abre el menú todavía: dice que se agrega después de publicar', async () => {
    await render(<FormularioNegocio />);
    expect(screen.getByText(/podrás agregar su menú/)).toBeTruthy();
    expect(screen.queryByLabelText(/Editar el menú/)).toBeNull();
  });

  it('no hay botón de borrar en un negocio nuevo', async () => {
    await render(<FormularioNegocio />);
    expect(screen.queryByLabelText('Borrar mi negocio')).toBeNull();
  });
});

describe('fotos y menú', () => {
  it('agrega y quita fotos; al llegar al máximo ya no ofrece más', async () => {
    await render(<FormularioNegocio />);
    await pulsar('Agregar una foto del negocio');
    expect(screen.getByLabelText('Quitar la foto 1')).toBeTruthy();
    await pulsar('Quitar la foto 1');
    expect(screen.queryByLabelText('Quitar la foto 1')).toBeNull();
    for (let i = 0; i < 60; i++) await pulsar('Agregar una foto del negocio');
    expect(screen.queryByLabelText('Agregar una foto del negocio')).toBeNull();
  });

  it('sin permiso de galería no agrega nada', async () => {
    mockPermiso.mockResolvedValue({ granted: false, canAskAgain: true });
    await render(<FormularioNegocio />);
    await pulsar('Agregar una foto del negocio');
    expect(mockElegir).not.toHaveBeenCalled();
    expect(mockError).toHaveBeenCalled();
  });

  it('cancelar el selector no agrega nada', async () => {
    mockElegir.mockResolvedValue({ canceled: true });
    await render(<FormularioNegocio />);
    await pulsar('Agregar una foto del negocio');
    expect(screen.queryByLabelText('Quitar la foto 1')).toBeNull();
  });
});

describe('editar un negocio', () => {
  it('arranca con los datos reales y no en blanco', async () => {
    await render(<FormularioNegocio inicial={{ negocio: NEGOCIO as never, items: ITEMS as never }} />);
    expect(screen.getByDisplayValue('Tacos')).toBeTruthy();
    expect(screen.getByDisplayValue('Calle 1, Lerma')).toBeTruthy();
    expect(screen.getByLabelText('Quitar la foto 2')).toBeTruthy();
    expect(screen.getByLabelText('Guardar cambios')).toBeTruthy();
  });

  it('sin cambiar la dirección NO geocodifica y conserva las coordenadas', async () => {
    await render(<FormularioNegocio inicial={{ negocio: NEGOCIO as never, items: ITEMS as never }} />);
    await pulsar('Guardar cambios');
    expect(mockGeocodificar).not.toHaveBeenCalled();
    expect(mockMutate.mock.calls[0][0].datos).toMatchObject({ latitud: 19.3, longitud: -99.4 });
    expect(mockMutate.mock.calls[0][0].id).toBe('n1');
  });

  it('si cambió la dirección, geocodifica de nuevo', async () => {
    await render(<FormularioNegocio inicial={{ negocio: NEGOCIO as never, items: ITEMS as never }} />);
    await escribir('Dirección', 'Otra calle 9');
    await pulsar('Guardar cambios');
    expect(mockGeocodificar).toHaveBeenCalledWith('Otra calle 9');
  });

  it('distingue fotos conservadas, quitadas y nuevas', async () => {
    await render(<FormularioNegocio inicial={{ negocio: NEGOCIO as never, items: ITEMS as never }} />);
    await pulsar('Quitar la foto 2');
    await pulsar('Agregar una foto del negocio');
    await pulsar('Guardar cambios');
    const e = mockMutate.mock.calls[0][0];
    expect(e.fotosConservadas).toEqual(['negocios/n1/a.jpg']);
    expect(e.fotosQuitadas).toEqual(['negocios/n1/b.jpg']);
    expect(e.fotosNuevas).toEqual(['file:///f-1.jpg']);
  });

  it('el menú ya NO se edita aquí: hay un renglón que lo abre en su propia pantalla', async () => {
    await render(<FormularioNegocio inicial={{ negocio: NEGOCIO as never, items: ITEMS as never }} />);
    expect(screen.queryByLabelText('Agregar un producto al menú')).toBeNull();
    expect(screen.getByText('2 productos')).toBeTruthy();
    await pulsar('Editar el menú, 2 productos');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/negocio/menu/[id]', params: { id: 'n1' } });
  });

  it('lo que se manda al guardar ya no lleva productos', async () => {
    await render(<FormularioNegocio inicial={{ negocio: NEGOCIO as never, items: ITEMS as never }} />);
    await pulsar('Guardar cambios');
    expect(mockMutate.mock.calls[0][0]).not.toHaveProperty('items');
  });

  it('al guardar bien dice «Cambios guardados»', async () => {
    mockMutate.mockImplementation((_e, { onSuccess }) => onSuccess('n1'));
    await render(<FormularioNegocio inicial={{ negocio: NEGOCIO as never, items: ITEMS as never }} />);
    await pulsar('Guardar cambios');
    expect(mockExito).toHaveBeenCalledWith('Cambios guardados');
  });

  it('pausarlo manda activo = false', async () => {
    await render(<FormularioNegocio inicial={{ negocio: NEGOCIO as never, items: ITEMS as never }} />);
    await act(async () => { fireEvent(screen.getByLabelText('Visible para todos'), 'valueChange', false); });
    await pulsar('Guardar cambios');
    expect(mockMutate.mock.calls[0][0].datos.activo).toBe(false);
  });
});

describe('borrar', () => {
  const abrir = async () => {
    await render(<FormularioNegocio inicial={{ negocio: NEGOCIO as never, items: ITEMS as never }} />);
    await pulsar('Borrar mi negocio');
    return (Alert.alert as jest.Mock).mock.calls[0];
  };

  it('pide confirmación y NO borra de inmediato', async () => {
    await abrir();
    expect(mockBorrarMutate).not.toHaveBeenCalled();
  });

  it('la confirmación enumera lo que se pierde', async () => {
    const [titulo, cuerpo] = await abrir();
    expect(titulo).toBe('Borrar mi negocio');
    for (const cosa of ['menú', 'fotos']) expect(cuerpo).toContain(cosa);
    expect(cuerpo).toMatch(/no se puede deshacer/i);
  });

  it('confirmar borra con las fotos y vuelve atrás', async () => {
    mockBorrarMutate.mockImplementation((_a, { onSuccess }) => onSuccess());
    const botones = (await abrir())[2];
    botones.find((b: { style?: string }) => b.style === 'destructive').onPress();
    expect(mockBorrarMutate.mock.calls[0][0]).toEqual({ id: 'n1', fotos: ['negocios/n1/a.jpg', 'negocios/n1/b.jpg'] });
    expect(mockBack).toHaveBeenCalled();
  });

  it('si el borrado falla lo dice y NO vuelve atrás', async () => {
    mockBorrarMutate.mockImplementation((_a, { onError }) => onError(new Error('x')));
    const botones = (await abrir())[2];
    botones.find((b: { style?: string }) => b.style === 'destructive').onPress();
    expect(String(mockError.mock.calls[0][0])).toMatch(/No pudimos borrar/);
    expect(mockBack).not.toHaveBeenCalled();
  });
});
