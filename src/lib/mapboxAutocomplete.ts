// Sugerencias de calle mientras se escribe (Mapbox Geocoding v6, autocomplete=true,
// acotado a México). No reemplaza el campo de texto — solo lo complementa: se
// puede escribir libremente o tocar una sugerencia (nunca bloquea el flujo).
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
