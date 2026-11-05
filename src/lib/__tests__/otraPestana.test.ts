import { alCambiarEnOtraPestana } from '../otraPestana';

// El aviso de otra pestaña: solo por SU clave (o al vaciar todo), y se puede dejar de escuchar.

type Oyente = (e: Event) => void;
const g = globalThis as unknown as { addEventListener?: unknown; removeEventListener?: unknown };
let oyentes: Oyente[] = [];
beforeEach(() => {
  oyentes = [];
  g.addEventListener = (t: string, f: Oyente) => t === 'storage' && oyentes.push(f);
  g.removeEventListener = (t: string, f: Oyente) => {
    if (t === 'storage') oyentes = oyentes.filter((x) => x !== f);
  };
});
afterEach(() => {
  delete g.addEventListener;
  delete g.removeEventListener;
});
const emitir = (key: string | null) => oyentes.forEach((f) => f({ key } as unknown as Event));

it('avisa cuando cambia SU clave, no otra', () => {
  const f = jest.fn();
  alCambiarEnOtraPestana('mia', f);
  emitir('otra');
  expect(f).not.toHaveBeenCalled();
  emitir('mia');
  expect(f).toHaveBeenCalledTimes(1);
});

it('también avisa cuando se vacía todo el almacenamiento (key null)', () => {
  const f = jest.fn();
  alCambiarEnOtraPestana('mia', f);
  emitir(null);
  expect(f).toHaveBeenCalledTimes(1);
});

it('dejar de escuchar funciona', () => {
  const f = jest.fn();
  const baja = alCambiarEnOtraPestana('mia', f);
  baja();
  emitir('mia');
  expect(f).not.toHaveBeenCalled();
});

it('sin navegador no hace nada ni falla', () => {
  delete g.addEventListener;
  delete g.removeEventListener;
  const baja = alCambiarEnOtraPestana('mia', jest.fn());
  expect(() => baja()).not.toThrow();
});
