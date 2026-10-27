import { Redirect } from 'expo-router';

import { RutasWeb } from '@/lib/rutasWeb';

// La dirección que se usó el primer día para la lista de lugares: ahora vive en `/departamentos`. Se conserva como redireccionamiento para que un enlace viejo no se rompa.
export default function ExplorarAntiguo() {
  return <Redirect href={RutasWeb.departamentos} />;
}
