// Worker de la web de la app: solo reescribe las fichas (`/departamentos/<id>` y `/servicios/<id>`) a su plantilla. Todo lo demás lo sirven los archivos estáticos.
import { rutaDePlantilla } from './rutas.mjs';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const plantilla = rutaDePlantilla(url.pathname);
    if (!plantilla) return env.ASSETS.fetch(request);
    return env.ASSETS.fetch(new Request(new URL(plantilla, url.origin), request));
  },
};
