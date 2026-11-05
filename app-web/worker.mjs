// Worker de la web de Cuervo 360 (`cuervo360.com`). Hace dos cosas: manda el subdominio viejo (`app.`) al dominio principal y reescribe las fichas (`/departamentos/<id>` y `/servicios/<id>`)
// a su plantilla. Todo lo demás lo sirven los archivos estáticos.
import { destinoDeRedireccion, rutaDePlantilla } from './rutas.mjs';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const destino = destinoDeRedireccion(request.url);
    if (destino) return Response.redirect(destino, 301);
    const plantilla = rutaDePlantilla(url.pathname);
    if (!plantilla) return env.ASSETS.fetch(request);
    return env.ASSETS.fetch(new Request(new URL(plantilla, url.origin), request));
  },
};
