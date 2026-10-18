import { act, render } from '@testing-library/react-native';

// `(tabs)/_layout.tsx` estaba al 0 %. Lo di por «casi sin lógica» al anotarlo en
// la cola y me equivoqué: tiene el registro del token push, el enlace profundo
// desde una notificación, y la marca de tres señales de la pestaña activa. Y
// detrás tenía `lib/pushNotifications.ts`, también al 0 %, que pide un permiso
// del sistema, escribe en la base y navega. Ese módulo tiene ahora su propio
// archivo de pruebas; aquí va lo que es del layout.
//
// Lo que se fija:
//
//  · El token se registra CON sesión y no sin ella. Llamar sin id escribiría una
//    fila con `usuario_id` undefined, que RLS rechaza y deja un aviso en cada
//    arranque sin sesión.
//  · La marca de la pestaña activa no depende SOLO del color: icono relleno
//    frente a contorno, y una barra encima. Es la única parte del sistema visual
//    que se comprueba en código en vez de a ojo.
//  · La barra reserva su espacio siempre. Si apareciera solo al activarse, el
//    icono brincaría dos píxeles en cada cambio de pestaña.

const mockRegistrar = jest.fn();
const mockUsarNotificacion = jest.fn();

// `Tabs` se dobla por lo que ES: un contenedor cuyas `Tabs.Screen` no pintan
// nada, solo declaran. Guardarlas permite sacar el `tabBarIcon` de cada una y
// pintarlo aparte, que es la única forma de comprobar el icono sin un navegador
// de verdad montado.
const pantallas: { name: string; options: Record<string, unknown> }[] = [];
const opcionesTabs: Record<string, unknown>[] = [];

jest.mock('expo-router', () => {
  const React = require('react');
  const Tabs = ({ children, screenOptions }: { children: React.ReactNode; screenOptions: Record<string, unknown> }) => {
    opcionesTabs.push(screenOptions);
    return React.createElement(React.Fragment, null, children);
  };
  Tabs.displayName = 'Tabs';
  const Screen = ({ name, options }: { name: string; options: Record<string, unknown> }) => {
    pantallas.push({ name, options });
    return null;
  };
  Screen.displayName = 'Tabs.Screen';
  Tabs.Screen = Screen;
  return { Tabs };
});
// `Ionicons` se pinta como un `<Text>` con el GLIFO, no con el nombre: en el
// árbol aparece un carácter de la fuente y el nombre no está en ninguna parte.
// Doblándolo para que escriba su `name`, la aserción dice lo que quiere decir en
// vez de comparar dos codepoints indistinguibles a ojo.
// Se importa por familia (`@expo/vector-icons/Ionicons`) y no desde el paquete entero: el paquete trae TODAS las familias y Metro no las poda (6 MB de fuentes).
jest.mock('@expo/vector-icons/Ionicons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Ionicons = ({ name }: { name: string }) => React.createElement(Text, null, name);
  Ionicons.displayName = 'Ionicons';
  return { __esModule: true, default: Ionicons };
});
jest.mock('@/lib/pushNotifications', () => ({
  registrarTokenPush: (...a: unknown[]) => mockRegistrar(...a),
  useAbrirChatDesdeNotificacion: (...a: unknown[]) => mockUsarNotificacion(...a),
}));

// Cuervo 360 · «Publicar» depende de los roles de la cuenta.
const mockRoles: { valor: { roles: unknown[]; cargando: boolean; fallo: boolean } } = {
  valor: { roles: [], cargando: false, fallo: false },
};
jest.mock('@/hooks/queries/useRoles', () => ({
  useMisRoles: () => ({ ...mockRoles.valor, reintentar: jest.fn() }),
}));
const aprobado = (rol: string, estado = 'aprobado') => ({ usuario_id: 'u1', rol, estado, origen: 'solicitud', desde: 'x' });

const sesion: { id: string | undefined } = { id: 'u1' };
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ session: sesion.id ? { user: { id: sesion.id } } : null }),
}));

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Platform, StyleSheet } from 'react-native';

import { AltoBarraPestanas, Colors, DescuentoBarraIOS as DESCUENTO_IOS, Radios } from '@/constants/theme';
import TabsLayout from '../_layout';

const conInsetInferior = (bottom: number) =>
  (useSafeAreaInsets as jest.Mock).mockReturnValue({ top: 0, left: 0, right: 0, bottom });

beforeEach(() => {
  jest.clearAllMocks();
  pantallas.length = 0;
  opcionesTabs.length = 0;
  sesion.id = 'u1';
  mockRoles.valor = { roles: [], cargando: false, fallo: false };
  conInsetInferior(0);
});

// ── El token push ────────────────────────────────────────────────────────────

test('con sesión registra el token del usuario', async () => {
  await render(<TabsLayout />);
  expect(mockRegistrar).toHaveBeenCalledWith('u1');
});

// Sin sesión no se llama. El comentario del archivo dice que solo se llega aquí
// con sesión activa, y aun así el guardia existe — porque durante el cierre de
// sesión este layout se vuelve a pintar una vez con `session` ya en null.
test('sin sesión no registra nada', async () => {
  sesion.id = undefined;
  await render(<TabsLayout />);
  expect(mockRegistrar).not.toHaveBeenCalled();
});

// Una vez por montaje, no una por render: la dependencia es `[miId]`. Si el
// efecto se disparara en cada render, cada pintado pediría un token a Expo.
test('registra una sola vez, no una por render', async () => {
  const vista = await render(<TabsLayout />);
  await act(async () => {
    vista.rerender(<TabsLayout />);
    vista.rerender(<TabsLayout />);
  });
  expect(mockRegistrar).toHaveBeenCalledTimes(1);
});

test('engancha el enlace profundo de notificaciones', async () => {
  await render(<TabsLayout />);
  expect(mockUsarNotificacion).toHaveBeenCalled();
});

// ── Las cinco pestañas ───────────────────────────────────────────────────────

// El orden es el del producto: primero lo que se consulta, al final lo propio.
// Una pestaña de menos o en otro sitio es un cambio de navegación, y esto lo
// deja por escrito en vez de en la memoria de quien lo escribió.
test('declara las cinco pestañas en orden', async () => {
  await render(<TabsLayout />);
  expect(pantallas.map((p) => p.name)).toEqual(['inicio', 'favoritos', 'publicar', 'chats', 'perfil']);
  expect(pantallas.map((p) => p.options.title)).toEqual([
    'Inicio', 'Favoritos', 'Publicar', 'Chats', 'Perfil',
  ]);
});

// Sin barra de título: cada pantalla carga el suyo en el cuerpo, a cuerpo
// grande. Si volviera a true, todas las pantallas tendrían dos títulos.
test('no pinta barra de título', async () => {
  await render(<TabsLayout />);
  expect(opcionesTabs[0].headerShown).toBe(false);
});

// Un impreso separa con filete, no con sombra. En Android `elevation` pinta una
// sombra gris que este mundo no usa en ningún lado, así que se apaga a mano —y
// si alguien la quita, la barra deja de pertenecer al sistema visual.
test('la barra separa con filete y no con sombra', async () => {
  await render(<TabsLayout />);
  const barra = opcionesTabs[0].tabBarStyle as Record<string, unknown>;
  expect(barra.elevation).toBe(0);
  expect(barra.borderTopWidth).toBeGreaterThan(0);
  expect(opcionesTabs[0].headerShadowVisible).toBe(false);
});

// ── La marca de la pestaña activa ────────────────────────────────────────────

/** Pinta el `tabBarIcon` de una pestaña en uno de sus dos estados. */
const pintarIcono = async (nombre: string, focused: boolean) => {
  await render(<TabsLayout />);
  const pantalla = pantallas.find((p) => p.name === nombre);
  const Icono = pantalla?.options.tabBarIcon as (p: {
    focused: boolean; color: string; size: number;
  }) => React.ReactElement;
  return render(<Icono focused={focused} color="#111111" size={24} />);
};

// TRES señales y ninguna dependiente solo del color: el icono cambia de relleno
// a contorno, y eso es lo que se puede comprobar en código. Un usuario que no
// distingue el tono sigue viendo en qué pestaña está.
test('la pestaña activa lleva el icono relleno y la inactiva el de contorno', async () => {
  const activa = await pintarIcono('inicio', true);
  expect(activa.getByText('home')).toBeTruthy();

  const inactiva = await pintarIcono('inicio', false);
  expect(inactiva.getByText('home-outline')).toBeTruthy();
});

// Cada pestaña su par, y que el activo NO sea el `-outline`: copiar y pegar mal
// un par dejaría una pestaña que nunca parece activa.
test('cada pestaña tiene su par relleno/contorno', async () => {
  for (const [nombre, base] of [
    ['favoritos', 'heart'],
    ['publicar', 'add-circle'],
    ['chats', 'chatbubble'],
    ['perfil', 'person-circle'],
  ] as const) {
    const activa = await pintarIcono(nombre, true);
    const inactiva = await pintarIcono(nombre, false);
    expect(activa.getByText(base)).toBeTruthy();
    expect(activa.queryByText(`${base}-outline`)).toBeNull();
    expect(inactiva.getByText(`${base}-outline`)).toBeTruthy();
  }
});

// La pastilla reserva su espacio siempre, activa o no. Si apareciera solo al activarse, el icono brincaría en cada
// cambio de pestaña. Activa: fondo lima (relleno, nunca texto) con el icono en carbón; inactiva: transparente.
test('la pastilla ocupa su sitio esté activa o no, y solo la activa lleva lima', async () => {
  const activa = await pintarIcono('inicio', true);
  const inactiva = await pintarIcono('inicio', false);

  const pastilla = (vista: Awaited<ReturnType<typeof render>>) => {
    const raiz = vista.toJSON() as unknown as { props: { style: unknown } };
    return StyleSheet.flatten(raiz.props.style as never) as Record<string, unknown>;
  };
  const a1 = pastilla(activa);
  const i1 = pastilla(inactiva);
  expect(a1.width).toBe(i1.width);
  expect(a1.height).toBe(i1.height);
  expect(a1.borderRadius).toBe(Radios.full);
  expect(a1.backgroundColor).toBe(Colors.light.lima);
  expect(i1.backgroundColor).toBe('transparent');
});

// ── Área segura inferior ─────────────────────────────────────────────────────

// Reproducido en un Android real (17/10/2026): con navegación por gestos, los
// iconos de la barra quedaban pegados al borde y las etiquetas, cortadas por
// debajo de la pantalla. Un `height` fijo en `tabBarStyle` REEMPLAZA el que
// React Navigation calcula —49 más el área segura inferior—, y la barra del
// sistema se comía parte de esos 64 puntos. Con botones de tres teclas el inset
// es otro, y en iPhone con muesca también: la altura tiene que sumarlo, no
// suponerlo.
// En iPhone el área segura inferior (34 pt) deja la barra más alta de lo que se siente natural: probado en un
// iPhone real el 17/10/2026 («bajarla un poquito»). Se le resta `DESCUENTO_IOS`. En Android NO: ahí la barra
// del sistema se comía el icono y la etiqueta, y quitarle área segura lo volvería a romper.
test('en iPhone la barra suma el área segura inferior MENOS un pequeño descuento', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  conInsetInferior(34);
  await render(<TabsLayout />);
  const barra = opcionesTabs.at(-1)!.tabBarStyle as Record<string, number>;
  expect(barra.paddingBottom).toBe(34 - DESCUENTO_IOS);
  expect(barra.height).toBe(AltoBarraPestanas + 34 - DESCUENTO_IOS);
});

test('en Android la barra suma el área segura COMPLETA', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  conInsetInferior(34);
  await render(<TabsLayout />);
  const barra = opcionesTabs.at(-1)!.tabBarStyle as Record<string, number>;
  expect(barra.paddingBottom).toBe(34);
  expect(barra.height).toBe(AltoBarraPestanas + 34);
});

test('el descuento nunca deja el relleno negativo (iPhone sin área segura)', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  conInsetInferior(3);
  await render(<TabsLayout />);
  const barra = opcionesTabs.at(-1)!.tabBarStyle as Record<string, number>;
  expect(barra.paddingBottom).toBe(0);
});

test('sin área segura la barra conserva su alto base', async () => {
  conInsetInferior(0);
  await render(<TabsLayout />);
  const barra = opcionesTabs.at(-1)!.tabBarStyle as Record<string, number>;
  expect(barra.height).toBe(AltoBarraPestanas);
});

test('el alto base alcanza para la barra, el icono y la etiqueta', () => {
  // marca (Filete.grueso) + icono (22) + etiqueta (10 + interlineado) + holguras.
  expect(AltoBarraPestanas).toBeGreaterThanOrEqual(64);
});

// ── «Publicar» solo con una función aprobada ─────────────────────────────────

// `href: null` esconde la pestaña de la barra; `undefined` la deja. Fallar cerrado: si no se sabe
// (cargando, falló la lectura), NO se muestra. Es una regla de interfaz: la de la base llega con
// la verificación de vendedor.
const hrefDePublicar = () => pantallas.find((p) => p.name === 'publicar')?.options.href;

test('una cuenta sin funciones NO ve la pestaña Publicar', async () => {
  await render(<TabsLayout />);
  expect(hrefDePublicar()).toBeNull();
});

test('una función sin verificar tampoco la muestra', async () => {
  mockRoles.valor = { roles: [aprobado('arrendador', 'sin_verificar')], cargando: false, fallo: false };
  await render(<TabsLayout />);
  expect(hrefDePublicar()).toBeNull();
});

test('un arrendador aprobado SÍ la ve', async () => {
  mockRoles.valor = { roles: [aprobado('arrendador')], cargando: false, fallo: false };
  await render(<TabsLayout />);
  expect(hrefDePublicar()).toBeUndefined();
});

test('un comerciante aprobado SÍ la ve', async () => {
  mockRoles.valor = { roles: [aprobado('comerciante')], cargando: false, fallo: false };
  await render(<TabsLayout />);
  expect(hrefDePublicar()).toBeUndefined();
});

test('mientras se comprueba la oculta: ante la duda, cerrada', async () => {
  mockRoles.valor = { roles: [], cargando: true, fallo: false };
  await render(<TabsLayout />);
  expect(hrefDePublicar()).toBeNull();
});

test('si falló la lectura de roles la oculta', async () => {
  mockRoles.valor = { roles: [], cargando: false, fallo: true };
  await render(<TabsLayout />);
  expect(hrefDePublicar()).toBeNull();
});
