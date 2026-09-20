// END-10 · Lo que `app.json` no puede hacer.
//
// `app.json` es JSON estático: no puede leer una variable de entorno. La clave de
// Google Maps tiene que salir de `.env` —no del repositorio, que es PÚBLICO— así
// que la configuración pasa a ser dinámica. `app.json` se conserva como base
// legible y aquí solo se añade lo que depende del entorno o lo que faltaba.
//
// Expo lee ESTE archivo cuando existe y recibe el contenido de `app.json` en
// `config`. Nada de lo que ya estaba se reescribe a mano.

module.exports = ({ config }) => {
  const claveMapas = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;

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
};
