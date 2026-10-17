import { readFileSync, existsSync } from 'node:fs';

// Cuervo 360 · la marca en la configuración de la app.
//
// Dos cosas se pueden romper en silencio y salen caras: cambiar el `slug` o el paquete de Android
// desvincula el proyecto de EAS y crea OTRA app en el teléfono; y un ícono con el tamaño equivocado
// no falla al compilar, falla al revisarlo la tienda. El nombre en pantalla es «Cuervo 360»; el
// nombre técnico del repositorio, el slug y el paquete siguen siendo «Cuervo Pass».

const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;

/** Ancho y alto de un PNG, de su cabecera IHDR (bytes 16 a 24), sin depender de una librería. */
const medida = (ruta: string) => {
  const b = readFileSync(ruta);
  return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20), esPng: b.subarray(1, 4).toString() === 'PNG' };
};

test('el nombre en pantalla es Cuervo 360', () => {
  expect(app.name).toBe('Cuervo 360');
});

test('el slug y el paquete NO cambian: están atados al proyecto de EAS y a la app ya instalada', () => {
  expect(app.slug).toBe('cuervo-pass');
  expect(app.android.package).toBe('mx.cuervopass.app');
  expect(app.extra.eas.projectId).toBe('5f632696-f33c-4707-b977-3eeb6320c0ed');
});

describe.each([
  ['assets/images/icon.png', 1024, 1024],
  ['assets/images/android-icon-foreground.png', 1024, 1024],
  ['assets/images/android-icon-monochrome.png', 1024, 1024],
  ['assets/images/splash-icon.png', 1024, 1024],
  ['assets/images/favicon.png', 48, 48],
  ['assets/images/logo-app.png', 512, 512],
])('%s', (ruta, ancho, alto) => {
  test('existe, es PNG y mide lo que debe', () => {
    expect(existsSync(ruta)).toBe(true);
    expect(medida(ruta)).toEqual({ ancho, alto, esPng: true });
  });
});

test('el ícono adaptable usa un color sólido de fondo, no la imagen de la plantilla', () => {
  expect(app.android.adaptiveIcon.backgroundColor).toBe('#000000');
  expect(app.android.adaptiveIcon.backgroundImage).toBeUndefined();
  expect(app.android.adaptiveIcon.foregroundImage).toBe('./assets/images/android-icon-foreground.png');
  expect(app.android.adaptiveIcon.monochromeImage).toBe('./assets/images/android-icon-monochrome.png');
});

test('el ícono de iOS no apunta al de la plantilla de Expo', () => {
  expect(app.ios?.icon).toBeUndefined();
});

test('la portada va sobre el mismo negro del logo: sin caja visible', () => {
  const splash = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen') as [string, Record<string, unknown>];
  expect(splash[1].backgroundColor).toBe('#000000');
  expect(splash[1].image).toBe('./assets/images/splash-icon.png');
});

test('las notificaciones usan el verde lima de la marca, no el ámbar anterior', () => {
  const notif = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-notifications') as [string, Record<string, unknown>];
  expect(notif[1].color).toBe('#A5D83E');
});

test('el logo fuente queda en el repositorio, para poder regenerar los íconos', () => {
  expect(existsSync('assets/marca/logo-fuente.jpeg')).toBe(true);
  expect(existsSync('scripts/marca/generar-iconos.py')).toBe(true);
});
