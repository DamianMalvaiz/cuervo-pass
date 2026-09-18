// Sugerencias de calle mientras se escribe (Mapbox Geocoding v6, autocomplete=true,
// acotado a México). No reemplaza el campo de texto — solo lo complementa: se
// puede escribir libremente o tocar una sugerencia (nunca bloquea el flujo).
//
// Este es el ÚNICO uso de Mapbox que queda, y es legítimo: AUD-02 explica que la
// capa gratuita cubre la geocodificación TEMPORAL —resultados que se usan al
// vuelo y no se almacenan— y prohíbe guardar los resultados. Aquí solo se usa el
// texto de la calle para rellenar el formulario; ninguna coordenada de Mapbox
// llega a la base de datos. Las que sí se guardan vienen de Nominatim/OSM, desde
// el servidor (src/lib/geocoding.ts).
//
// El token debe tener restricción de URL en el panel de Mapbox: va dentro del
// APK, y un token público sin restricción es una factura abierta al mundo.
const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

export interface SugerenciaCalle {
  texto: string;
}

export async function buscarCalles(query: string, opts?: { proximity?: { lat: number; lng: number } }): Promise<SugerenciaCalle[]> {
  if (!TOKEN || query.trim().length < 4) return [];
  try {
    const params = new URLSearchParams({
      q: query,
      access_token: TOKEN,
      country: 'mx',
      types: 'address,street',
      language: 'es',
      limit: '5',
      autocomplete: 'true',
    });
    if (opts?.proximity) {
      params.set('proximity', `${opts.proximity.lng},${opts.proximity.lat}`);
    }
    const respuesta = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`);
    if (!respuesta.ok) return [];
    const datos = await respuesta.json();
    const nombres = new Set<string>();
    for (const feature of datos.features ?? []) {
      const nombre = feature.properties?.name || feature.properties?.address_line1;
      if (nombre) nombres.add(nombre);
    }
    return Array.from(nombres).map((texto) => ({ texto }));
  } catch (e) {
    console.warn('Autocompletado de calle falló:', e);
    return [];
  }
}
