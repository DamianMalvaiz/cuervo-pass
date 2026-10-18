import { crearSumideroRemoto, iniciarCapturaGlobal } from '../telemetria';

// El sumidero que lleva los errores de la app a la base (migración 0068). Lo que se fija: nunca lanza, nunca se bucla, no repite lo mismo en una ventana,
// tiene tope por sesión, no manda nada sin sesión, y el detalle va acotado.

const evento = (extra: Record<string, unknown> = {}) => ({ nivel: 'error' as const, mensaje: 'No se pudo cargar la lista', ...extra });
const montar = (opts: Partial<Parameters<typeof crearSumideroRemoto>[0]> = {}) => {
  const enviar = jest.fn().mockResolvedValue(undefined);
  let t = 1_000_000;
  const avanzar = (ms: number) => { t += ms; };
  const sumidero = crearSumideroRemoto({ enviar, version: '1.0.0', plataforma: 'android', haySesion: () => true, ahora: () => t, ...opts });
  return { sumidero, enviar, avanzar };
};

describe('crearSumideroRemoto', () => {
  it('envía nivel, mensaje, versión y plataforma', () => {
    const { sumidero, enviar } = montar();
    sumidero(evento());
    expect(enviar).toHaveBeenCalledWith({ nivel: 'error', mensaje: 'No se pudo cargar la lista', detalle: null, version: '1.0.0', plataforma: 'android' });
  });

  it('el detalle junta el texto del error y los datos, y se acota a 500', () => {
    const { sumidero, enviar } = montar();
    sumidero(evento({ error: new Error('sin red'), datos: { codigo: 'X1' } }));
    expect(enviar.mock.calls[0][0].detalle).toBe('sin red | {"codigo":"X1"}');
    sumidero(evento({ mensaje: 'otro', error: new Error('y'.repeat(2000)) }));
    expect(enviar.mock.calls[1][0].detalle.length).toBe(500);
  });

  it('el mismo mensaje no se repite dentro de la ventana, y sí después', () => {
    const { sumidero, enviar, avanzar } = montar();
    sumidero(evento()); sumidero(evento()); sumidero(evento());
    expect(enviar).toHaveBeenCalledTimes(1);
    avanzar(10 * 60 * 1000 + 1);
    sumidero(evento());
    expect(enviar).toHaveBeenCalledTimes(2);
  });

  it('mensajes distintos sí pasan', () => {
    const { sumidero, enviar } = montar();
    sumidero(evento({ mensaje: 'a' })); sumidero(evento({ mensaje: 'b' }));
    expect(enviar).toHaveBeenCalledTimes(2);
  });

  it('tiene tope por sesión (un bucle de errores no inunda la red)', () => {
    const { sumidero, enviar } = montar({ maxPorSesion: 3 });
    for (let i = 0; i < 10; i++) sumidero(evento({ mensaje: `error ${i}` }));
    expect(enviar).toHaveBeenCalledTimes(3);
  });

  it('sin sesión no manda nada (el servidor solo acepta cuentas con sesión)', () => {
    const { sumidero, enviar } = montar({ haySesion: () => false });
    sumidero(evento());
    expect(enviar).not.toHaveBeenCalled();
  });

  it('si el envío falla NO lanza ni produce otro registro (registrar un error no puede producir otro)', async () => {
    const enviar = jest.fn().mockRejectedValue(new Error('sin red'));
    const sumidero = crearSumideroRemoto({ enviar, version: '1', plataforma: 'ios', haySesion: () => true });
    expect(() => sumidero(evento())).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it('si enviar lanza de forma síncrona tampoco rompe', () => {
    const sumidero = crearSumideroRemoto({ enviar: () => { throw new Error('boom'); }, version: '1', plataforma: 'ios', haySesion: () => true });
    expect(() => sumidero(evento())).not.toThrow();
  });
});

describe('iniciarCapturaGlobal', () => {
  const fake = () => {
    let manejador: ((e: unknown, fatal?: boolean) => void) | null = null;
    const previo = jest.fn();
    const utils = { getGlobalHandler: () => previo, setGlobalHandler: (h: typeof manejador) => { manejador = h; } };
    return { utils, previo, disparar: (e: unknown, fatal?: boolean) => manejador?.(e, fatal) };
  };

  it('un error no capturado se registra Y se entrega al manejador anterior (no se traga)', () => {
    const { utils, previo, disparar } = fake();
    const registro = jest.fn();
    iniciarCapturaGlobal(utils, registro);
    const e = new Error('revienta');
    disparar(e, true);
    expect(registro).toHaveBeenCalledWith('Error fatal no capturado', undefined, e);
    expect(previo).toHaveBeenCalledWith(e, true);
  });

  it('uno no fatal lo dice distinto', () => {
    const { utils, disparar } = fake();
    const registro = jest.fn();
    iniciarCapturaGlobal(utils, registro);
    disparar(new Error('x'), false);
    expect(registro.mock.calls[0][0]).toBe('Error no capturado');
  });

  it('si registrar falla, el manejador anterior igual se ejecuta', () => {
    const { utils, previo, disparar } = fake();
    iniciarCapturaGlobal(utils, () => { throw new Error('el registro revienta'); });
    expect(() => disparar(new Error('x'), true)).not.toThrow();
    expect(previo).toHaveBeenCalled();
  });

  it('sin ErrorUtils (web o pruebas) no hace nada ni rompe', () => {
    expect(() => iniciarCapturaGlobal(undefined, jest.fn())).not.toThrow();
  });
});
