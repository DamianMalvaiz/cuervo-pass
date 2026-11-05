import { readFileSync } from 'node:fs';

// Notificaciones push en Android = Firebase. Sin `google-services.json` dentro del APK, `getExpoPushTokenAsync` falla con «Default FirebaseApp is not initialized» y NINGÚN aviso llega como notificación
// (así salió en «Salud de la app»). El archivo va por EAS (variable de tipo archivo) y no en el repositorio: lleva claves de API de Firebase que `gitleaks` (el job `secretos` del CI) marca por su forma.
// Como con la clave de Maps, si falta NO se detiene la compilación —una app sin push es mejor que una que no compila—, pero se hace ruido.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require('../../app.config.js') as {
  rutaGoogleServices: (v: { env: Record<string, string | undefined>; existe: (ruta: string) => boolean }) => { ruta: string | undefined; origen: 'EAS' | 'local' | null };
  construir: (c: Record<string, unknown>, v: { env: Record<string, string | undefined>; existe: (ruta: string) => boolean }) => { android?: Record<string, unknown> };
};

const nada = () => false;
const local = (ruta: string) => ruta === './google-services.json';

describe('rutaGoogleServices', () => {
  test('con la variable de EAS usa ESA ruta, aunque también haya un archivo local', () => {
    expect(config.rutaGoogleServices({ env: { GOOGLE_SERVICES_JSON: '/tmp/eas/g.json' }, existe: local })).toEqual({ ruta: '/tmp/eas/g.json', origen: 'EAS' });
  });
  test('sin la variable, usa el archivo local si existe', () => {
    expect(config.rutaGoogleServices({ env: {}, existe: local })).toEqual({ ruta: './google-services.json', origen: 'local' });
  });
  test('sin ninguno, no hay ruta (y no se inventa una)', () => {
    expect(config.rutaGoogleServices({ env: {}, existe: nada })).toEqual({ ruta: undefined, origen: null });
  });
  test.each(['', '   ', '\n'])('una variable vacía (%j) cuenta como ausente', (valor) => {
    expect(config.rutaGoogleServices({ env: { GOOGLE_SERVICES_JSON: valor }, existe: nada }).ruta).toBeUndefined();
  });
});

describe('construir', () => {
  const base = { android: { package: 'mx.cuervopass.app' }, extra: { eas: { projectId: 'p' } } };
  let aviso: jest.SpyInstance;
  beforeEach(() => { aviso = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => aviso.mockRestore());

  test('con archivo: android.googleServicesFile lo lleva y conserva el resto de android', () => {
    const c = config.construir(base, { env: { GOOGLE_SERVICES_JSON: '/tmp/g.json' }, existe: nada });
    expect(c.android?.googleServicesFile).toBe('/tmp/g.json');
    expect(c.android?.package).toBe('mx.cuervopass.app');
  });

  test('sin archivo: no pone la clave (ni una cadena vacía) y avisa a gritos de que el push no funcionará', () => {
    const c = config.construir(base, { env: {}, existe: nada });
    expect(c.android).not.toHaveProperty('googleServicesFile');
    const texto = aviso.mock.calls.map((a) => String(a[0])).join('\n');
    expect(texto).toMatch(/google-services\.json/);
    expect(texto).toMatch(/push/i);
  });

  test('con archivo no avisa de nada sobre Firebase', () => {
    config.construir(base, { env: { GOOGLE_SERVICES_JSON: '/tmp/g.json' }, existe: nada });
    expect(aviso.mock.calls.map((a) => String(a[0])).join('\n')).not.toMatch(/google-services/);
  });

  test('la clave de Maps y el resto de la configuración siguen intactos', () => {
    const c = config.construir(base, { env: { GOOGLE_SERVICES_JSON: '/tmp/g.json', EXPO_PUBLIC_GOOGLE_MAPS_KEY: 'AIza-prueba' }, existe: nada });
    expect((c.android?.config as { googleMaps: { apiKey: string } }).googleMaps.apiKey).toBe('AIza-prueba');
    expect(c).toHaveProperty('runtimeVersion');
  });
});

describe('.gitignore protege los secretos de Firebase', () => {
  const ignore = readFileSync('.gitignore', 'utf8').split('\n').map((l) => l.trim());
  test.each(['google-services.json', '*-firebase-adminsdk-*.json', '*service-account*.json'])('ignora %s', (patron) => {
    expect(ignore).toContain(patron);
  });
});
