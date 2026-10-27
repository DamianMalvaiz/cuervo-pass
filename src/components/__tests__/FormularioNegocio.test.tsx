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
const mockSus = jest.fn();

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
jest.mock('@/hooks/queries/usePlanes', () => ({ useMiSuscripcion: (...a: unknown[]) => mockSus(...a) }));
const mockCategorias = jest.fn();
jest.mock('@/hooks/queries/useServicios', () => ({ useCategoriasServicio: (...a: unknown[]) => mockCategorias(...a) }));
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
  rango_precio: 1, horario: 'Lun a sáb · 8 am a 8 pm', fotos: ['negocios/n1/a.jpg', 'negocios/n1/b.jpg'], destacado: false, origen: 'solicitud',
  activo: true, oculto_por_reportes: false, usuario_id: 'u1', creado_en: 'x',
};
const ITEMS = [{ id: 'i1', negocio_id: 'n1', nombre: 'Taco', precio: 18, orden: 0 }, { id: 'i2', negocio_id: 'n1', nombre: 'Revisión', precio: null, orden: 1 }];

const pulsar = async (e: string | RegExp) => { await act(async () => { fireEvent.press(screen.getByLabelText(e)); }); };
const escribir = async (e: string | RegExp, t: string) => { await act(async () => { fireEvent.changeText(screen.getByLabelText(e), t); }); };

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** El horario es obligatorio: el lunes abre de 8 a 20 y el resto de la semana está cerrado, todo marcado a mano. */
const llenarHorario = async () => {
  await pulsar('Lunes: abierto');
  await escribir('Lunes, turno 1, abre', '08:00');
  await escribir('Lunes, turno 1, cierra', '20:00');
  for (const d of DIAS.slice(1)) await pulsar(`${d}: cerrado`);
};

/** El primer producto es obligatorio: se agrega con el mismo editor del menú. */
const agregarProducto = async (nombre = 'Café americano', precio = '35') => {
  await pulsar('Agregar un producto');
  await escribir('Nombre del producto', nombre);
  await escribir(/Precio/, precio);
  await pulsar('Guardar producto');
};

const llenarNuevo = async () => {
  await escribir('Nombre del negocio', 'Café Nuevo');
  await pulsar('Categoría Cafés');
  await escribir('Dirección', 'Calle 5, Lerma');
  await llenarHorario();
  await agregarProducto();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCategorias.mockReturnValue({
    categorias: [{ id: 'comida', nombre: 'Comida', icono: 'x', orden: 1 }, { id: 'cafes', nombre: 'Cafés', icono: 'x', orden: 2 }],
    cargando: false, fallo: false, reintentar: jest.fn(),
  });
  mockSus.mockReturnValue({ suscripcion: { max_fotos: 60, max_productos: 250 }, cargando: false, fallo: false });
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
    await pulsar('Publicar negocio');
    expect(mockGeocodificar).toHaveBeenCalledWith('Calle 5, Lerma');
    const entrada = mockMutate.mock.calls[0][0];
    expect(entrada.id).toBeUndefined();
    expect(entrada.datos).toEqual({
      categoria_id: 'cafes', nombre: 'Café Nuevo', descripcion: null, direccion: 'Calle 5, Lerma',
      latitud: 19.32, longitud: -99.45, horario: 'Lunes · 8 am a 8 pm', activo: true,
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

  it('un negocio nuevo no abre la pantalla del menú todavía: agrega sus productos aquí mismo', async () => {
    await render(<FormularioNegocio />);
    expect(screen.getByLabelText('Agregar un producto')).toBeTruthy();
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
  });

  // El máximo es el del PLAN. Antes esta prueba pulsaba 60 veces (el tope técnico), y cada pulsación repinta el formulario entero con la lista
  // creciendo: bajo la carga de la suite completa pasaba de los 15 s y fallaba sin que nada estuviera roto. Con 4 se comprueba lo mismo.
  it('al llegar al máximo del plan ya no ofrece más fotos', async () => {
    mockSus.mockReturnValue({ suscripcion: { max_fotos: 4, max_productos: 10 }, cargando: false, fallo: false });
    await render(<FormularioNegocio />);
    for (let i = 0; i < 4; i++) await pulsar('Agregar una foto del negocio');
    expect(screen.getByLabelText('Quitar la foto 4')).toBeTruthy();
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

// Cuervo 360 · el límite REAL del plan, a la vista (0053).
describe('el límite de fotos del plan', () => {
  it('el contador usa el límite del plan, no una cifra fija', async () => {
    mockSus.mockReturnValue({ suscripcion: { max_fotos: 4, max_productos: 10 }, cargando: false, fallo: false });
    await render(<FormularioNegocio />);
    expect(screen.getByText(/Fotos \(0\/4\)/)).toBeTruthy();
  });

  it('al llegar al límite del plan ya no ofrece agregar y lleva a los planes', async () => {
    mockSus.mockReturnValue({ suscripcion: { max_fotos: 2, max_productos: 10 }, cargando: false, fallo: false });
    await render(<FormularioNegocio />);
    await pulsar('Agregar una foto del negocio');
    await pulsar('Agregar una foto del negocio');
    expect(screen.queryByLabelText('Agregar una foto del negocio')).toBeNull();
    expect(screen.getByText(/Llegaste al límite de tu plan \(2\)/)).toBeTruthy();
    await pulsar('Ver planes para agregar más fotos');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/planes/[rol]', params: { rol: 'comerciante' } });
  });

  it('si aún no se sabe el plan, rige la cota técnica y NO se inventa un límite', async () => {
    mockSus.mockReturnValue({ suscripcion: null, cargando: true, fallo: false });
    await render(<FormularioNegocio />);
    expect(screen.getByText(/Fotos \(0\/60\)/)).toBeTruthy();
    expect(screen.queryByText(/Llegaste al límite/)).toBeNull();
  });

  it('un negocio con más fotos que su plan (bajó de plan) NO guarda y dice cuántas quitar', async () => {
    mockSus.mockReturnValue({ suscripcion: { max_fotos: 1, max_productos: 10 }, cargando: false, fallo: false });
    await render(<FormularioNegocio inicial={{ negocio: NEGOCIO as never, items: ITEMS as never }} />);
    await pulsar('Guardar cambios');
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/Tu plan permite hasta 1 fotos\. Quita 1 para guardar/)).toBeTruthy();
  });
});

describe('lo que vende (mínimo un producto)', () => {
  const inicial = (extra: Record<string, unknown> = {}, items: unknown[] = ITEMS) =>
    ({ negocio: { ...NEGOCIO, ...extra } as never, items: items as never });

  it('ya no hay «Rango de precio»: se publica lo que se vende, con su precio', async () => {
    await render(<FormularioNegocio />);
    expect(screen.queryByText('Rango de precio')).toBeNull();
    expect(screen.queryByLabelText(/Rango de precio/)).toBeNull();
  });

  it('un negocio nuevo sin productos NO se publica y dice qué hacer', async () => {
    await render(<FormularioNegocio />);
    await escribir('Nombre del negocio', 'Café Nuevo');
    await pulsar('Categoría Cafés');
    await escribir('Dirección', 'Calle 5, Lerma');
    await llenarHorario();
    await pulsar('Publicar negocio');
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Agrega al menos un producto para publicar tu negocio.')).toBeTruthy();
  });

  it('el producto agregado aparece en la lista, con su precio', async () => {
    await render(<FormularioNegocio />);
    await agregarProducto('Café americano', '35');
    expect(screen.getByText('Café americano')).toBeTruthy();
    expect(screen.getByText('$35')).toBeTruthy();
  });

  it('con un producto se publica y manda los productos junto con el negocio', async () => {
    await render(<FormularioNegocio />);
    await llenarNuevo();
    await pulsar('Publicar negocio');
    const e = mockMutate.mock.calls[0][0];
    expect(e.productos).toHaveLength(1);
    expect(e.productos[0]).toMatchObject({ nombre: 'Café americano', precio: '35' });
    expect(e.datos).not.toHaveProperty('rango_precio');
  });

  it('se puede quitar el producto agregado (y entonces ya no se publica)', async () => {
    await render(<FormularioNegocio />);
    await llenarNuevo();
    await pulsar('Quitar Café americano');
    await pulsar('Publicar negocio');
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Agrega al menos un producto para publicar tu negocio.')).toBeTruthy();
  });

  it('un negocio que ya existe sin productos tampoco se guarda visible', async () => {
    await render(<FormularioNegocio inicial={inicial({}, [])} />);
    await pulsar('Guardar cambios');
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Agrega al menos un producto para publicar tu negocio.')).toBeTruthy();
  });

  it('un negocio que ya existe con productos se guarda sin tocar su menú (tiene su propia pantalla)', async () => {
    await render(<FormularioNegocio inicial={inicial()} />);
    await pulsar('Guardar cambios');
    expect(mockMutate.mock.calls[0][0].productos).toBeUndefined();
  });
});

describe('horario obligatorio (0070)', () => {
  const inicial = (extra: Record<string, unknown> = {}, turnos?: unknown[]) =>
    ({ negocio: { ...NEGOCIO, ...extra } as never, items: ITEMS as never, turnos: turnos as never });

  it('no hay atajos de «mismo horario» ni se dice que es opcional: se llena a mano', async () => {
    await render(<FormularioNegocio />);
    expect(screen.queryByText(/Mismo horario/)).toBeNull();
    expect(screen.queryByText(/Horario \(opcional\)/)).toBeNull();
    for (const d of DIAS) expect(screen.getByText(d)).toBeTruthy();
  });

  it('sin decidir ningún día NO guarda y dice cuál falta, con el nombre completo', async () => {
    await render(<FormularioNegocio />);
    await escribir('Nombre del negocio', 'Café Nuevo');
    await pulsar('Categoría Cafés');
    await escribir('Dirección', 'Calle 5, Lerma');
    await pulsar('Publicar negocio');
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Te falta decidir el lunes.')).toBeTruthy();
  });

  it('con un día sin decidir NO guarda y nombra ese día', async () => {
    await render(<FormularioNegocio />);
    await escribir('Nombre del negocio', 'Café Nuevo');
    await pulsar('Categoría Cafés');
    await escribir('Dirección', 'Calle 5, Lerma');
    await pulsar('Lunes: abierto');
    await escribir('Lunes, turno 1, abre', '08:00');
    await escribir('Lunes, turno 1, cierra', '20:00');
    for (const d of DIAS.slice(1)) if (d !== 'Jueves') await pulsar(`${d}: cerrado`);
    await pulsar('Publicar negocio');
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Te falta decidir el jueves.')).toBeTruthy();
  });

  it('todos los días cerrados NO guarda: tiene que abrir al menos uno', async () => {
    await render(<FormularioNegocio />);
    await escribir('Nombre del negocio', 'Café Nuevo');
    await pulsar('Categoría Cafés');
    await escribir('Dirección', 'Calle 5, Lerma');
    for (const d of DIAS) await pulsar(`${d}: cerrado`);
    await pulsar('Publicar negocio');
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/al menos un día/)).toBeTruthy();
  });

  it('abrir un día no inventa horas: los campos nacen vacíos y hay que escribirlas', async () => {
    await render(<FormularioNegocio />);
    await pulsar('Lunes: abierto');
    expect(screen.getByLabelText('Lunes, turno 1, abre').props.value).toBe('');
    expect(screen.getByLabelText('Lunes, turno 1, cierra').props.value).toBe('');
  });

  it('abierto sin horas escritas NO guarda y pide revisarlas', async () => {
    await render(<FormularioNegocio />);
    await escribir('Nombre del negocio', 'Café Nuevo');
    await pulsar('Categoría Cafés');
    await escribir('Dirección', 'Calle 5, Lerma');
    await pulsar('Lunes: abierto');
    for (const d of DIAS.slice(1)) await pulsar(`${d}: cerrado`);
    await pulsar('Publicar negocio');
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/Revisa las horas/)).toBeTruthy();
  });

  it('completo manda los turnos y el resumen con los días completos', async () => {
    await render(<FormularioNegocio />);
    await llenarNuevo();
    await pulsar('Publicar negocio');
    const e = mockMutate.mock.calls[0][0];
    expect(e.turnos).toEqual([{ dia: 1, abre: '08:00', cierra: '20:00' }]);
    expect(e.datos.horario).toBe('Lunes · 8 am a 8 pm');
  });

  it('un texto regular se propone ya decidido (los días que no nombra quedan cerrados) y guarda sin tocar nada', async () => {
    await render(<FormularioNegocio inicial={inicial({ horario: 'Lun a vie · 9 am a 6 pm' })} />);
    await pulsar('Guardar cambios');
    const e = mockMutate.mock.calls[0][0];
    expect(e.turnos).toHaveLength(5);
    expect(e.datos.horario).toBe('Lunes a viernes · 9 am a 6 pm');
  });

  it('un negocio con turnos guardados los conserva y guarda sin tocar nada', async () => {
    await render(<FormularioNegocio inicial={inicial({ horario: 'x' }, [{ dia: 6, abre: '09:00', cierra: '18:00' }])} />);
    await pulsar('Guardar cambios');
    const e = mockMutate.mock.calls[0][0];
    expect(e.turnos).toEqual([{ dia: 6, abre: '09:00', cierra: '18:00' }]);
    expect(e.datos.horario).toBe('Sábado · 9 am a 6 pm');
  });

  it('un negocio de antes, con un horario sin horas, tiene que definirlo para poder guardar', async () => {
    await render(<FormularioNegocio inicial={inicial({ horario: 'Lunes a Sábado' })} />);
    await pulsar('Guardar cambios');
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Te falta decidir el lunes.')).toBeTruthy();
  });

  it('quitar el único turno de un día lo devuelve a «sin decidir»', async () => {
    await render(<FormularioNegocio inicial={inicial({ horario: 'x' }, [{ dia: 6, abre: '09:00', cierra: '18:00' }])} />);
    await pulsar('Quitar el turno 1 del Sábado');
    await pulsar('Guardar cambios');
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/Te falta decidir/)).toBeTruthy();
  });

  it('se puede añadir un segundo turno el mismo día', async () => {
    await render(<FormularioNegocio />);
    await pulsar('Lunes: abierto');
    await pulsar('Añadir otro turno al Lunes');
    expect(screen.getByLabelText('Lunes, turno 2, abre')).toBeTruthy();
  });

  it('una hora inválida bloquea el guardado y lo dice', async () => {
    await render(<FormularioNegocio />);
    await escribir('Nombre del negocio', 'Café Nuevo');
    await pulsar('Categoría Cafés');
    await escribir('Dirección', 'Calle 5, Lerma');
    await pulsar('Lunes: abierto');
    await escribir('Lunes, turno 1, abre', '25:99');
    await escribir('Lunes, turno 1, cierra', '20:00');
    for (const d of DIAS.slice(1)) await pulsar(`${d}: cerrado`);
    await pulsar('Publicar negocio');
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/Revisa las horas/)).toBeTruthy();
  });

  it('«8» al salir del campo queda como 08:00', async () => {
    await render(<FormularioNegocio />);
    await pulsar('Lunes: abierto');
    await escribir('Lunes, turno 1, abre', '8');
    await act(async () => { fireEvent(screen.getByLabelText('Lunes, turno 1, abre'), 'endEditing'); });
    expect(screen.getByDisplayValue('08:00')).toBeTruthy();
  });
});

describe('cuando FALLA la lectura de las categorías se dice, no queda una lista vacía sin explicación', () => {
  it('dice que no pudo cargarlas y ofrece reintentar', async () => {
    const reintentar = jest.fn();
    mockCategorias.mockReturnValue({ categorias: [], cargando: false, fallo: true, reintentar });
    await render(<FormularioNegocio />);
    expect(screen.getByText('No pudimos cargar las categorías')).toBeTruthy();
    await pulsar('Reintentar');
    expect(reintentar).toHaveBeenCalledTimes(1);
  });

  it('con las categorías cargadas no hay aviso', async () => {
    await render(<FormularioNegocio />);
    expect(screen.queryByText('No pudimos cargar las categorías')).toBeNull();
  });
});
