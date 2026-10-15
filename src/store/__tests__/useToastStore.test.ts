// El toast propio · paso 1 · el estado.
//
// Un solo toast a la vez, a propósito. Con una cola, tres errores seguidos se
// vuelven nueve segundos de pantalla ocupada con mensajes que ya no son lo que
// pasó; con reemplazo, siempre se ve lo más reciente.

import { DURACION_MS, useToastStore } from '../useToastStore';
import { toast } from '@/lib/toast';

beforeEach(() => {
  useToastStore.setState({ actual: null });
});

test('mostrar deja el aviso como el actual', () => {
  useToastStore.getState().mostrar('exito', 'Guardado');
  expect(useToastStore.getState().actual).toMatchObject({ tipo: 'exito', mensaje: 'Guardado' });
});

test('uno nuevo REEMPLAZA al anterior: no hay cola', () => {
  useToastStore.getState().mostrar('exito', 'Primero');
  useToastStore.getState().mostrar('error', 'Segundo');
  expect(useToastStore.getState().actual).toMatchObject({ tipo: 'error', mensaje: 'Segundo' });
});

test('cada aviso trae un id distinto, para poder reiniciar su temporizador', () => {
  const a = useToastStore.getState().mostrar('info', 'Hola');
  const b = useToastStore.getState().mostrar('info', 'Hola');
  expect(b).not.toBe(a);
  expect(useToastStore.getState().actual?.id).toBe(b);
});

// Un error se lee más despacio y cuesta más perderse: tiene que durar más.
test('el error dura más que el éxito', () => {
  expect(DURACION_MS.error).toBeGreaterThan(DURACION_MS.exito);
  expect(DURACION_MS.error).toBeGreaterThanOrEqual(DURACION_MS.info);
});

test('la duración propia manda sobre la de por omisión', () => {
  useToastStore.getState().mostrar('exito', 'Largo', { duracionMs: 10_000 });
  expect(useToastStore.getState().actual?.duracionMs).toBe(10_000);
});

test('sin duración propia usa la del tipo', () => {
  useToastStore.getState().mostrar('error', 'Falló');
  expect(useToastStore.getState().actual?.duracionMs).toBe(DURACION_MS.error);
});

test('descartar sin id quita el actual', () => {
  useToastStore.getState().mostrar('info', 'Hola');
  useToastStore.getState().descartar();
  expect(useToastStore.getState().actual).toBeNull();
});

// El temporizador de un aviso viejo no puede llevarse al nuevo: sin esta guarda,
// el cierre automático del primero borraría el segundo a medio leer.
test('descartar con el id de uno anterior NO quita el actual', () => {
  const viejo = useToastStore.getState().mostrar('exito', 'Viejo');
  useToastStore.getState().mostrar('error', 'Nuevo');
  useToastStore.getState().descartar(viejo);
  expect(useToastStore.getState().actual).toMatchObject({ mensaje: 'Nuevo' });
});

test('un mensaje vacío no muestra un recuadro vacío', () => {
  useToastStore.getState().mostrar('error', '   ');
  expect(useToastStore.getState().actual).toBeNull();
});

describe('toast.*', () => {
  test('toast.exito, toast.error y toast.info mandan su tipo', () => {
    toast.exito('A');
    expect(useToastStore.getState().actual?.tipo).toBe('exito');
    toast.error('B');
    expect(useToastStore.getState().actual?.tipo).toBe('error');
    toast.info('C');
    expect(useToastStore.getState().actual?.tipo).toBe('info');
  });

  test('toast.descartar quita el actual', () => {
    toast.exito('A');
    toast.descartar();
    expect(useToastStore.getState().actual).toBeNull();
  });
});
