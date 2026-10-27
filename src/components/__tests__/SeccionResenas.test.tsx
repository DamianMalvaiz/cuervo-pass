import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

// Reseñas · la sección de una ficha. Lo que se fija: quien es dueño responde pero no reseña; quien no, reseña UNA y reporta las
// ajenas; todo se valida antes de tocar la red; cada fallo se dice por su código; y «sin reseñas» no se pinta como un cero.

const mockResenas = jest.fn();
const mockMia = jest.fn();
const mockGuardar = jest.fn();
const mockBorrar = jest.fn();
const mockResponder = jest.fn();
const mockReportar = jest.fn();
const mockExito = jest.fn();
const mockError = jest.fn();
let mockMiId: string | undefined = 'u1';

jest.mock('@/hooks/queries/useResenas', () => ({
  useResenas: (...a: unknown[]) => mockResenas(...a),
  useMiResena: (...a: unknown[]) => mockMia(...a),
  useGuardarResena: () => ({ mutate: (...a: unknown[]) => mockGuardar(...a), isPending: false }),
  useBorrarResena: () => ({ mutate: (...a: unknown[]) => mockBorrar(...a), isPending: false }),
  useResponderResena: () => ({ mutate: (...a: unknown[]) => mockResponder(...a), isPending: false }),
  useReportarResena: () => ({ mutate: (...a: unknown[]) => mockReportar(...a), isPending: false }),
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: mockMiId ? { user: { id: mockMiId } } : null }),
}));
jest.mock('@/lib/toast', () => ({
  toast: { exito: (...a: unknown[]) => mockExito(...a), error: (...a: unknown[]) => mockError(...a), info: jest.fn() },
}));

import { SeccionResenas } from '../SeccionResenas';

const NEG = { negocioId: 'n1' } as const;
const resena = (extra: Record<string, unknown> = {}) => ({
  id: 'r1', negocio_id: 'n1', publicacion_id: null, estrellas: 4, texto: 'Muy rico', respuesta: null, respondida_en: null,
  creado_en: '2026-10-10T12:00:00Z', autor: 'ana', es_mia: false, ...extra,
});
const lista = (rs: unknown[] = [resena()], extra: Record<string, unknown> = {}) => ({ resenas: rs, cargando: false, fallo: false, reintentar: jest.fn(), ...extra });
const montar = (extra: Record<string, unknown> = {}) =>
  render(<SeccionResenas objetivo={NEG} esDueno={false} calificacion={4} numResenas={1} {...extra} />);
const pulsar = async (e: string | RegExp) => { await act(async () => { fireEvent.press(screen.getByLabelText(e)); }); };
const escribir = async (e: string | RegExp, t: string) => { await act(async () => { fireEvent.changeText(screen.getByLabelText(e), t); }); };
const confirmar = (texto: string) => {
  const botones = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[];
  botones.find((b) => b.text === texto)?.onPress?.();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockMiId = 'u1';
  mockResenas.mockReturnValue(lista());
  mockMia.mockReturnValue({ miResena: null, cargando: false, fallo: false, reintentar: jest.fn() });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('qué se ve', () => {
  it('muestra el promedio calculado y la lista, con la autora, el texto y las estrellas', async () => {
    await montar();
    expect(screen.getByText('Reseñas')).toBeTruthy();
    expect(screen.getByLabelText('4.0 de 5 estrellas, 1 reseña')).toBeTruthy();
    expect(screen.getByText('@ana')).toBeTruthy();
    expect(screen.getByText('Muy rico')).toBeTruthy();
    expect(screen.getByLabelText('4 estrellas')).toBeTruthy();
  });

  it('sin reseñas dice «Todavía no hay reseñas» y NO inventa una calificación', async () => {
    mockResenas.mockReturnValue(lista([]));
    await montar({ calificacion: null, numResenas: 0 });
    expect(screen.getByText('Todavía no hay reseñas.')).toBeTruthy();
    expect(screen.getByText('Sin reseñas todavía')).toBeTruthy();
  });

  it('mientras carga no dice que no hay nada', async () => {
    mockResenas.mockReturnValue(lista([], { cargando: true }));
    await montar();
    expect(screen.getByLabelText('Cargando')).toBeTruthy();
    expect(screen.queryByText('Todavía no hay reseñas.')).toBeNull();
  });

  it('un fallo se dice y reintenta, no se pinta como «no hay reseñas»', async () => {
    const reintentar = jest.fn();
    mockResenas.mockReturnValue(lista([], { fallo: true, reintentar }));
    await montar();
    expect(screen.queryByText('Todavía no hay reseñas.')).toBeNull();
    await pulsar('Reintentar');
    expect(reintentar).toHaveBeenCalled();
  });

  it('la respuesta del dueño se ve con su título', async () => {
    mockResenas.mockReturnValue(lista([resena({ respuesta: 'Gracias por venir' })]));
    await montar();
    expect(screen.getByText('Respuesta del negocio')).toBeTruthy();
    expect(screen.getByText('Gracias por venir')).toBeTruthy();
  });

  it('en una vivienda la respuesta es «del anunciante»', async () => {
    mockResenas.mockReturnValue(lista([resena({ respuesta: 'Ok' })]));
    await render(<SeccionResenas objetivo={{ publicacionId: 'p1' }} esDueno={false} calificacion={4} numResenas={1} />);
    expect(screen.getByText('Respuesta del anunciante')).toBeTruthy();
  });

  it('mi reseña no se repite en la lista de las demás', async () => {
    mockResenas.mockReturnValue(lista([resena({ id: 'rm', autor: 'yo', es_mia: true, texto: 'La mía' })]));
    mockMia.mockReturnValue({ miResena: { id: 'rm', estrellas: 5, texto: 'La mía' }, cargando: false, fallo: false, reintentar: jest.fn() });
    await montar();
    expect(screen.getAllByText('La mía')).toHaveLength(1);
    expect(screen.queryByText('@yo')).toBeNull();
  });
});

describe('escribir mi reseña', () => {
  it('quien no es dueña ve «Escribir mi reseña»', async () => {
    await montar();
    expect(screen.getByLabelText('Escribir mi reseña')).toBeTruthy();
  });

  it('el dueño NO puede reseñar lo suyo: no se le ofrece', async () => {
    await montar({ esDueno: true });
    expect(screen.queryByLabelText('Escribir mi reseña')).toBeNull();
  });

  it('sin sesión no se ofrece reseñar ni reportar', async () => {
    mockMiId = undefined;
    await montar();
    expect(screen.queryByLabelText('Escribir mi reseña')).toBeNull();
    expect(screen.queryByLabelText(/Reportar la reseña/)).toBeNull();
  });

  it('sin elegir estrellas NO se guarda y lo dice', async () => {
    await montar();
    await pulsar('Escribir mi reseña');
    await pulsar('Guardar reseña');
    expect(mockGuardar).not.toHaveBeenCalled();
    expect(screen.getByText('Elige de 1 a 5 estrellas')).toBeTruthy();
  });

  it('con estrellas y texto guarda, y avisa', async () => {
    mockGuardar.mockImplementation((_d, { onSuccess }) => onSuccess());
    await montar();
    await pulsar('Escribir mi reseña');
    await pulsar('5 estrellas');
    await escribir('Cuéntanos tu experiencia (opcional)', 'Excelente');
    await pulsar('Guardar reseña');
    expect(mockGuardar.mock.calls[0][0]).toEqual({ id: undefined, estrellas: 5, texto: 'Excelente' });
    expect(mockExito).toHaveBeenCalledWith('Gracias por tu reseña');
  });

  it('el texto es opcional', async () => {
    await montar();
    await pulsar('Escribir mi reseña');
    await pulsar('3 estrellas');
    await pulsar('Guardar reseña');
    expect(mockGuardar.mock.calls[0][0]).toMatchObject({ estrellas: 3, texto: '' });
  });

  it('un duplicado (23505) se explica por código: ya reseñaste', async () => {
    mockGuardar.mockImplementation((_d, { onError }) => onError({ code: '23505' }));
    await montar();
    await pulsar('Escribir mi reseña');
    await pulsar('3 estrellas');
    await pulsar('Guardar reseña');
    expect(String(mockError.mock.calls[0][0])).toMatch(/Ya dejaste una reseña/);
  });

  it('un objetivo no permitido (42501) se explica por código', async () => {
    mockGuardar.mockImplementation((_d, { onError }) => onError({ code: '42501' }));
    await montar();
    await pulsar('Escribir mi reseña');
    await pulsar('3 estrellas');
    await pulsar('Guardar reseña');
    expect(String(mockError.mock.calls[0][0])).toMatch(/No puedes reseñar esto/);
  });

  it('un fallo de red se dice como fallo, sin éxito', async () => {
    mockGuardar.mockImplementation((_d, { onError }) => onError(new Error('Network request failed')));
    await montar();
    await pulsar('Escribir mi reseña');
    await pulsar('3 estrellas');
    await pulsar('Guardar reseña');
    expect(String(mockError.mock.calls[0][0])).toMatch(/conexión/);
    expect(mockExito).not.toHaveBeenCalled();
  });

  it('cancelar cierra el formulario sin guardar', async () => {
    await montar();
    await pulsar('Escribir mi reseña');
    await pulsar('Cancelar');
    expect(screen.getByLabelText('Escribir mi reseña')).toBeTruthy();
    expect(mockGuardar).not.toHaveBeenCalled();
  });
});

describe('mi reseña ya escrita', () => {
  beforeEach(() => {
    mockMia.mockReturnValue({ miResena: { id: 'rm', estrellas: 5, texto: 'Muy bueno' }, cargando: false, fallo: false, reintentar: jest.fn() });
    mockResenas.mockReturnValue(lista([]));
  });

  it('se muestra con «Editar» y «Borrar», y ya no se ofrece escribir otra', async () => {
    await montar();
    expect(screen.getByText('Tu reseña')).toBeTruthy();
    expect(screen.getByText('Muy bueno')).toBeTruthy();
    expect(screen.queryByLabelText('Escribir mi reseña')).toBeNull();
  });

  it('editar abre el formulario con lo escrito y guarda sobre la MISMA reseña', async () => {
    await montar();
    await pulsar('Editar mi reseña');
    expect(screen.getByDisplayValue('Muy bueno')).toBeTruthy();
    await pulsar('2 estrellas');
    await pulsar('Guardar reseña');
    expect(mockGuardar.mock.calls[0][0]).toEqual({ id: 'rm', estrellas: 2, texto: 'Muy bueno' });
  });

  it('borrar pide confirmación y NO borra de inmediato', async () => {
    await montar();
    await pulsar('Borrar mi reseña');
    expect(mockBorrar).not.toHaveBeenCalled();
    expect((Alert.alert as jest.Mock).mock.calls[0][0]).toBe('Borrar mi reseña');
  });

  it('confirmar borra la reseña', async () => {
    mockBorrar.mockImplementation((_id, { onSuccess }) => onSuccess());
    await montar();
    await pulsar('Borrar mi reseña');
    confirmar('Borrar');
    expect(mockBorrar.mock.calls[0][0]).toBe('rm');
    expect(mockExito).toHaveBeenCalledWith('Reseña borrada');
  });

  it('si el borrado falla lo dice', async () => {
    mockBorrar.mockImplementation((_id, { onError }) => onError(new Error('x')));
    await montar();
    await pulsar('Borrar mi reseña');
    confirmar('Borrar');
    expect(String(mockError.mock.calls[0][0])).toMatch(/No pudimos borrar/);
  });
});

describe('reportar', () => {
  it('pide confirmación y NO reporta de inmediato', async () => {
    await montar();
    await pulsar('Reportar la reseña de @ana');
    expect(mockReportar).not.toHaveBeenCalled();
    expect(String((Alert.alert as jest.Mock).mock.calls[0][1])).toMatch(/tres personas/);
  });

  it('confirmar reporta con el id y un motivo', async () => {
    mockReportar.mockImplementation((_d, { onSuccess }) => onSuccess());
    await montar();
    await pulsar('Reportar la reseña de @ana');
    confirmar('Reportar');
    expect(mockReportar.mock.calls[0][0]).toEqual({ id: 'r1', motivo: 'Contenido inapropiado' });
    expect(mockExito).toHaveBeenCalled();
  });

  it('si el reporte falla lo dice', async () => {
    mockReportar.mockImplementation((_d, { onError }) => onError(new Error('x')));
    await montar();
    await pulsar('Reportar la reseña de @ana');
    confirmar('Reportar');
    expect(String(mockError.mock.calls[0][0])).toMatch(/No pudimos enviar tu reporte/);
  });

  it('el dueño no reporta: ve «Responder» en su lugar', async () => {
    await montar({ esDueno: true });
    expect(screen.queryByLabelText(/Reportar la reseña/)).toBeNull();
    expect(screen.getByLabelText('Responder a @ana')).toBeTruthy();
  });
});

describe('responder (el dueño)', () => {
  it('abre el campo, y envía la respuesta con el id de la reseña', async () => {
    mockResponder.mockImplementation((_d, { onSuccess }) => onSuccess());
    await montar({ esDueno: true });
    await pulsar('Responder a @ana');
    await escribir('Tu respuesta', 'Gracias por venir');
    await pulsar('Enviar respuesta');
    expect(mockResponder.mock.calls[0][0]).toEqual({ id: 'r1', texto: 'Gracias por venir' });
    expect(mockExito).toHaveBeenCalledWith('Respuesta publicada');
  });

  it('con una respuesta existente ofrece editarla, y vaciarla la QUITA', async () => {
    mockResenas.mockReturnValue(lista([resena({ respuesta: 'Antes' })]));
    mockResponder.mockImplementation((_d, { onSuccess }) => onSuccess());
    await montar({ esDueno: true });
    await pulsar('Editar mi respuesta a @ana');
    expect(screen.getByDisplayValue('Antes')).toBeTruthy();
    await escribir('Tu respuesta', '');
    await pulsar('Enviar respuesta');
    expect(mockResponder.mock.calls[0][0]).toEqual({ id: 'r1', texto: '' });
    expect(mockExito).toHaveBeenCalledWith('Respuesta quitada');
  });

  it('una respuesta demasiado larga NO se envía y lo dice', async () => {
    await montar({ esDueno: true });
    await pulsar('Responder a @ana');
    await act(async () => { fireEvent.changeText(screen.getByLabelText('Tu respuesta'), 'a'.repeat(601)); });
    await pulsar('Enviar respuesta');
    expect(mockResponder).not.toHaveBeenCalled();
    expect(screen.getByText(/demasiado larga/)).toBeTruthy();
  });

  it('42501 se explica por código: no es tu reseña', async () => {
    mockResponder.mockImplementation((_d, { onError }) => onError({ code: '42501' }));
    await montar({ esDueno: true });
    await pulsar('Responder a @ana');
    await escribir('Tu respuesta', 'Hola');
    await pulsar('Enviar respuesta');
    expect(String(mockError.mock.calls[0][0])).toMatch(/No puedes responder/);
  });

  it('un fallo de red se dice como fallo', async () => {
    mockResponder.mockImplementation((_d, { onError }) => onError(new Error('x')));
    await montar({ esDueno: true });
    await pulsar('Responder a @ana');
    await escribir('Tu respuesta', 'Hola');
    await pulsar('Enviar respuesta');
    expect(String(mockError.mock.calls[0][0])).toMatch(/conexión/);
  });

  it('cancelar cierra el campo sin enviar', async () => {
    await montar({ esDueno: true });
    await pulsar('Responder a @ana');
    await pulsar('Cancelar respuesta');
    expect(screen.getByLabelText('Responder a @ana')).toBeTruthy();
    expect(mockResponder).not.toHaveBeenCalled();
  });
});

// 0082 · una cuenta restringida no ve lo que la base va a rechazar. `useCuentaRestringida` está simulado por omisión en jest.setup.js (false).
const { useCuentaRestringida } = jest.requireMock('@/hooks/queries/useCuentaRestringida');
afterEach(() => useCuentaRestringida.mockReturnValue(false));

describe('cuenta restringida · 0082', () => {
  it('no ofrece reseñar ni reportar, y dice por qué', async () => {
    useCuentaRestringida.mockReturnValue(true);
    await montar();
    expect(screen.queryByLabelText('Escribir mi reseña')).toBeNull();
    expect(screen.queryByLabelText(/Reportar la reseña/)).toBeNull();
    expect(screen.getByText(/Para reseñar necesitas/i)).toBeTruthy();
    // Lo que SÍ se ve: las reseñas de los demás.
    expect(screen.getByText('Muy rico')).toBeTruthy();
  });

  it('una cuenta normal conserva las dos acciones', async () => {
    await montar();
    expect(screen.getByLabelText('Escribir mi reseña')).toBeTruthy();
    expect(screen.getByLabelText(/Reportar la reseña/)).toBeTruthy();
  });
});
