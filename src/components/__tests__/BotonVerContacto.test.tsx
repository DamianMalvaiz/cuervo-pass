import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

// EL SELLO · v5 §25. Es la ÚNICA acción de toda la app que compromete algo:
// revela un teléfono ajeno, consume cuota diaria y deja una fila en `contactos`.
// Por eso es la única que lleva ámbar, y por eso merece más red que cualquier
// otro botón del producto. Tenía 5 de 6 ramas sin cubrir.
//
// El modelo de privacidad que hay detrás: antes el número viajaba INCRUSTADO en
// la publicación que el cliente se bajaba, así que un solo `select` sobre
// `publicaciones` bajaba la base de teléfonos completa. Ahora la vista pública
// no trae esa columna y el número se pide de uno en uno a `revelar_contacto()`.
// Las pruebas de aquí son las que impiden que ese diseño se deshaga por accidente.

const mockSello = jest.fn();
jest.mock('@/lib/tacto', () => ({ sello: (...a: unknown[]) => mockSello(...a), toque: jest.fn() }));

import { BotonVerContacto } from '../BotonVerContacto';

const pintar = async (
  onRevelar: jest.Mock,
  props: { score?: number | null; titulo?: string } = {}
) => {
  const onError = jest.fn();
  await render(
    <BotonVerContacto
      publicacionId="p1"
      titulo={props.titulo ?? 'Depa centro'}
      score={props.score ?? 0.87}
      onRevelar={onRevelar}
      onError={onError}
    />
  );
  return { onError };
};

const pulsar = async () => {
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Ver contacto'));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

// ── El camino feliz ──────────────────────────────────────────────────────────

test('revela y abre WhatsApp con el número devuelto', async () => {
  const onRevelar = jest.fn().mockResolvedValue('7221234567');
  await pintar(onRevelar);
  await pulsar();

  await waitFor(() => expect(Linking.openURL).toHaveBeenCalled());
  const url = (Linking.openURL as jest.Mock).mock.calls[0][0] as string;
  // AUD-17 · El prefijo 52 fija México. Es una decisión de alcance declarada en
  // el README y en docs/modelo-amenazas.md, no un descuido, y una prueba es lo
  // que la vuelve deliberada en vez de accidental.
  expect(url).toContain('https://wa.me/527221234567?text=');
});

// El número que devuelve la RPC puede venir con espacios, guiones o paréntesis:
// se guarda como lo escribió una persona. `wa.me` solo acepta dígitos.
test('limpia lo que no es dígito antes de armar el enlace', async () => {
  const onRevelar = jest.fn().mockResolvedValue('(722) 123-45 67');
  await pintar(onRevelar);
  await pulsar();

  await waitFor(() => expect(Linking.openURL).toHaveBeenCalled());
  expect((Linking.openURL as jest.Mock).mock.calls[0][0]).toContain('wa.me/527221234567?');
});

// El título va codificado. Uno con `&` o con acentos partiría la query y el
// mensaje llegaría truncado a WhatsApp.
test('el mensaje va codificado, con el título dentro', async () => {
  const onRevelar = jest.fn().mockResolvedValue('7221234567');
  await pintar(onRevelar, { titulo: 'Cuarto céntrico & amueblado' });
  await pulsar();

  await waitFor(() => expect(Linking.openURL).toHaveBeenCalled());
  const url = (Linking.openURL as jest.Mock).mock.calls[0][0] as string;
  expect(url).not.toContain('&amueblado');
  expect(decodeURIComponent(url.split('?text=')[1])).toContain('Cuarto céntrico & amueblado');
});

// El score viaja para que quede registrado con qué afinidad se pidió el
// contacto: es lo que permite medir después si el motor acierta.
test('manda el id y el score a la revelación', async () => {
  const onRevelar = jest.fn().mockResolvedValue('7221234567');
  await pintar(onRevelar, { score: 0.42 });
  await pulsar();
  expect(onRevelar).toHaveBeenCalledWith('p1', 0.42);
});

// ── El sello, y CUÁNDO se estampa ────────────────────────────────────────────

// END-37 · Se estampa DESPUÉS de que la revelación ocurrió, no al tocar. Vibrar
// al tocar confirmaría el toque; esto confirma el HECHO — que quedó una fila y
// se gastó cuota. La diferencia solo se ve cuando falla, y ahí es donde importa.
test('el sello se estampa cuando la revelación ya ocurrió', async () => {
  const onRevelar = jest.fn().mockResolvedValue('7221234567');
  await pintar(onRevelar);
  await pulsar();
  await waitFor(() => expect(mockSello).toHaveBeenCalledTimes(1));
});

test('y NO se estampa si la revelación falla', async () => {
  const onRevelar = jest.fn().mockRejectedValue(new Error('caído'));
  await pintar(onRevelar);
  await pulsar();

  await waitFor(() => expect(onRevelar).toHaveBeenCalled());
  // Si vibrara aquí, confirmaría algo que no pasó.
  expect(mockSello).not.toHaveBeenCalled();
  expect(Linking.openURL).not.toHaveBeenCalled();
});

// ── La cuota ─────────────────────────────────────────────────────────────────

// END-27 · Por CÓDIGO y no por subcadena. `includes('cuota')` dependía del texto
// del error —que cambia por versión y por locale— y además habría coincidido con
// cualquier mensaje que mencionara la palabra. El error de esta prueba trae el
// texto en inglés a propósito.
test('la cuota agotada se reconoce por código, no por el texto', async () => {
  const onRevelar = jest.fn().mockRejectedValue({ code: 'CP001', message: 'daily quota exceeded' });
  const { onError } = await pintar(onRevelar);
  await pulsar();

  await waitFor(() => expect(onError).toHaveBeenCalled());
  expect(onError.mock.calls[0][0]).toBe('Llegaste al límite de contactos por hoy. Vuelve mañana.');
});

// Y un fallo cualquiera NO se presenta como cuota: decirle «vuelve mañana» a
// quien tuvo un fallo de red le hace esperar un día por nada.
test('otro fallo da el mensaje genérico, no el de la cuota', async () => {
  const onRevelar = jest.fn().mockRejectedValue(new Error('network request failed'));
  const { onError } = await pintar(onRevelar);
  await pulsar();

  await waitFor(() => expect(onError).toHaveBeenCalled());
  expect(onError.mock.calls[0][0]).toContain('Intenta de nuevo');
  expect(onError.mock.calls[0][0]).not.toContain('mañana');
});

// ── La doble pulsación · LA prueba de este archivo ───────────────────────────

// Cada revelación consume cuota y escribe una fila. Dos toques seguidos mientras
// la primera viaja gastarían dos de las del día por un solo contacto.
//
// Esto fija la PROPIEDAD, no un mecanismo, y a propósito: hay DOS guardias
// —`disabled={cargando}` en el `Pressable` y el `if (cargando) return` al entrar
// en `abrir`— y está medido que cualquiera de los dos basta. Quitando uno solo,
// esta prueba sigue pasando; solo falla al quitar los dos.
//
// Queda escrito porque la redundancia es deliberada y conviene que nadie la
// «limpie» creyendo que la prueba cubre la otra mitad: la cubre, pero entonces
// deja de haber margen. Y porque mi primera versión de este comentario afirmaba
// que el `return` era «lo único que lo impide», que es falso — lo comprobé
// borrando cada uno por separado.
test('dos toques seguidos revelan UNA sola vez', async () => {
  let resolver!: (v: string) => void;
  const onRevelar = jest.fn(() => new Promise<string>((r) => { resolver = r; }));
  await pintar(onRevelar);

  await pulsar();
  await pulsar();
  await pulsar();
  expect(onRevelar).toHaveBeenCalledTimes(1);

  await act(async () => { resolver('7221234567'); });
  await waitFor(() => expect(Linking.openURL).toHaveBeenCalledTimes(1));
});

// El botón se anuncia ocupado mientras trabaja: sin eso, un lector de pantalla
// no da ninguna pista de que el toque se registró.
test('mientras revela se anuncia ocupado', async () => {
  let resolver!: (v: string) => void;
  const onRevelar = jest.fn(() => new Promise<string>((r) => { resolver = r; }));
  await pintar(onRevelar);
  await pulsar();

  const boton = screen.getByLabelText('Ver contacto');
  expect(boton.props.accessibilityState).toMatchObject({ busy: true, disabled: true });

  await act(async () => { resolver('7221234567'); });
});

// El `finally`. Sin él, un fallo deja `cargando` en true para siempre: el sello
// queda deshabilitado y no hay forma de reintentar sin salir de la pantalla.
test('tras un fallo se puede reintentar', async () => {
  const onRevelar = jest
    .fn()
    .mockRejectedValueOnce(new Error('caído'))
    .mockResolvedValue('7221234567');
  const { onError } = await pintar(onRevelar);

  await pulsar();
  await waitFor(() => expect(onError).toHaveBeenCalled());

  await pulsar();
  await waitFor(() => expect(onRevelar).toHaveBeenCalledTimes(2));
  expect(Linking.openURL).toHaveBeenCalledTimes(1);
});
