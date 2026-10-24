// END-10 · Lo que `app.json` no puede hacer.
//
// `app.json` es JSON estático: no puede leer una variable de entorno. La clave de
// Google Maps tiene que salir de `.env` —no del repositorio, que es PÚBLICO— así
// que la configuración pasa a ser dinámica. `app.json` se conserva como base
// legible y aquí solo se añade lo que depende del entorno o lo que faltaba.
//
// Expo lee ESTE archivo cuando existe y recibe el contenido de `app.json` en
// `config`. Nada de lo que ya estaba se reescribe a mano.

const fs = require('node:fs');

/**
 * Qué archivo de Firebase usa Android. Sin `google-services.json` dentro del APK, `getExpoPushTokenAsync` falla con «Default FirebaseApp is not initialized» y NINGÚN aviso llega como
 * notificación. El archivo va por EAS como variable de tipo ARCHIVO (`GOOGLE_SERVICES_JSON`, cuyo valor es la ruta del archivo durante la compilación) y NO en el repositorio: lleva claves de API
 * de Firebase que `gitleaks` marca por su forma. Para compilar en local sirve un `./google-services.json`, que `.gitignore` ignora.
 */
function rutaGoogleServices({ env, existe }) {
  const deEas = env.GOOGLE_SERVICES_JSON?.trim();
  if (deEas) return { ruta: deEas, origen: 'EAS' };
  if (existe('./google-services.json')) return { ruta: './google-services.json', origen: 'local' };
  return { ruta: undefined, origen: null };
}

function construir(config, { env, existe }) {
  const claveMapas = env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
  const { ruta: googleServicesFile } = rutaGoogleServices({ env, existe });

  // Igual que con la clave de Maps: no se detiene la compilación (una app sin push es mejor que una que no compila), pero se hace RUIDO para descubrirlo al compilar y no delante del evaluador.
  if (!googleServicesFile) {
    console.warn(
      '\n  ⚠  No hay google-services.json (ni la variable GOOGLE_SERVICES_JSON de EAS).' +
        '\n     Las notificaciones push NO funcionarán en Android: ni siquiera se obtiene el token.' +
        '\n     Ver docs/firebase-push.md.\n'
    );
  }

  // Sin clave, el `MapView` de la ficha pinta un rectángulo GRIS en Android: sin
  // error, sin mensaje, sin nada que indique por qué. Ese silencio es el fallo
  // —END-10—, no la falta de clave.
  //
  // No se detiene la compilación: una app que no se puede armar por no tener
  // mapa es peor que una app con el mapa apagado, y el resto funciona entero.
  // Lo que sí se hace es RUIDO, aquí y en `verificar.mjs`, para que la ausencia
  // se descubra al compilar y no delante del evaluador.
  if (!claveMapas) {
    console.warn(
      '\n  ⚠  EXPO_PUBLIC_GOOGLE_MAPS_KEY no está definida.' +
        '\n     El mapa de la ficha saldrá GRIS en Android, sin mensaje de error.' +
        '\n     Ver .env.example para obtenerla y restringirla.\n'
    );
  }

  return {
    ...config,

    ios: {
      ...config.ios,
      // Sin esto iOS no compila: EAS no puede firmar sin identificador de
      // paquete. Es el mismo que Android ya declaraba en `android.package`,
      // porque son la misma app.
      bundleIdentifier: 'mx.cuervopass.app',
    },

    android: {
      ...config.android,
      // Ausente es ausente: ni una cadena vacía (Expo intentaría leer un archivo llamado «») ni una ruta inventada.
      ...(googleServicesFile ? { googleServicesFile } : {}),
      config: {
        ...config.android?.config,
        // `apiKey: undefined` es deliberado y no un descuido: si se pusiera una
        // cadena vacía, el SDK de Maps la trataría como clave inválida y fallaría
        // distinto que sin clave. Ausente es ausente.
        googleMaps: { apiKey: claveMapas },
      },
    },

    // Ruta de reversión OTA. `appVersion` ata cada actualización a la versión
    // nativa que la puede recibir: sin política de runtime, una actualización
    // pensada para un binario nuevo puede caer en uno viejo y reventar en
    // arranque, que es el peor momento posible para romperse.
    runtimeVersion: { policy: 'appVersion' },
    updates: {
      url: `https://u.expo.dev/${config.extra?.eas?.projectId}`,
      // Si la actualización no llega en 10 s, se arranca con lo que ya hay. Una
      // pantalla de carga indefinida el día de la demo es peor que una versión
      // con un día de retraso.
      fallbackToCacheTimeout: 10_000,
    },
  };
}

module.exports = ({ config }) => construir(config, { env: process.env, existe: fs.existsSync });
// Para las pruebas (`test-utils/__tests__/app-config-google-services.test.ts`): la decisión es pura y se prueba sin tocar el disco ni el entorno.
module.exports.rutaGoogleServices = rutaGoogleServices;
module.exports.construir = construir;
