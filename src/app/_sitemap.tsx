import { Redirect } from 'expo-router';

import { RutasWeb } from '@/lib/rutasWeb';

// Expo Router genera por omisión una página `/_sitemap` con TODAS las rutas del sitio (también las internas), y la exporta a producción. Aquí se sustituye: quien llegue a esa dirección va al inicio. La página «no encontrada» ya no la enlaza.
export default function Sitemap() {
  return <Redirect href={RutasWeb.inicio} />;
}
