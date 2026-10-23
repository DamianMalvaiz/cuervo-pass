// Construye la web pública (cuervo360.com) en `web-publica/dist`. Sin dependencias: HTML estático.
// El aviso de privacidad sale de `src/lib/avisoPrivacidad.ts`, la MISMA fuente que la app: una sola versión del texto que se acepta.
// Colores de `src/constants/theme.ts` (claro y oscuro). Uso: node scripts/construir-web-publica.mjs
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

import { AVISO_ACTUALIZACION, AVISO_INTRO, AVISO_TITULO, CORREO_RESPONSABLE, SECCIONES } from '../src/lib/avisoPrivacidad.ts';

const SALIDA = new URL('../web-publica/dist/', import.meta.url);

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const negritas = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
// Solo https: el aviso trae enlaces de datos propios, pero un esquema raro (javascript:) nunca se vuelve enlace.
const urlSegura = (u) => (/^https:\/\//i.test(u) ? esc(u) : null);

function bloque(b) {
  switch (b.tipo) {
    case 'parrafo': return `<p>${negritas(b.texto)}</p>`;
    case 'subtitulo': return `<h3>${esc(b.texto)}</h3>`;
    case 'lista': return `<ul>${b.puntos.map((p) => `<li>${negritas(p)}</li>`).join('')}</ul>`;
    case 'filas': return `<dl>${b.filas.map((f) => `<dt>${negritas(f.titulo)}</dt><dd>${negritas(f.detalle)}</dd>`).join('')}</dl>`;
    case 'enlace': {
      const u = urlSegura(b.url);
      return u ? `<p><a href="${u}" rel="noopener noreferrer">${esc(b.texto)}</a></p>` : `<p>${esc(b.texto)}</p>`;
    }
    default: return '';
  }
}

const ESTILO = `
:root{--fondo:#F4F6F2;--tarjeta:#FFFFFF;--texto:#171A18;--suave:#55605A;--acento:#2F5D3A;--lima:#A5D83E;--limatexto:#171A18;--filete:#D3DACF}
@media (prefers-color-scheme:dark){:root{--fondo:#171A18;--tarjeta:#232823;--texto:#F4F6F2;--suave:#A3ADA4;--acento:#A5D83E;--filete:#2C332C}}
*{box-sizing:border-box}body{margin:0;background:var(--fondo);color:var(--texto);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:46rem;margin:0 auto;padding:2rem 1rem 4rem}header{max-width:46rem;margin:0 auto;padding:1.25rem 1rem 0}
a{color:var(--acento)}h1{font-size:2rem;line-height:1.2;margin:1.5rem 0 .5rem}h2{font-size:1.25rem;margin:2rem 0 .5rem}h3{font-size:1.05rem;margin:1.25rem 0 .25rem}
.marca{font-weight:700;font-size:1.1rem;color:var(--texto);text-decoration:none}.suave{color:var(--suave)}
.boton{display:inline-block;min-height:44px;padding:.7rem 1.25rem;border-radius:.6rem;background:var(--lima);color:var(--limatexto);font-weight:700;text-decoration:none}
.tarjeta{background:var(--tarjeta);border:1px solid var(--filete);border-radius:.75rem;padding:1.25rem;margin:1.5rem 0}
dt{font-weight:700;margin-top:.75rem}dd{margin:0 0 .25rem}footer{max-width:46rem;margin:0 auto;padding:0 1rem 2rem;color:var(--suave);font-size:.9rem}
`;

const pagina = ({ titulo, descripcion, cuerpo, indexar = true }) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title><meta name="description" content="${esc(descripcion)}">
${indexar ? '' : '<meta name="robots" content="noindex">'}<meta name="color-scheme" content="light dark"><style>${ESTILO}</style></head>
<body><header><a class="marca" href="/">Cuervo 360</a></header><main>${cuerpo}</main>
<footer><a href="/privacidad">Aviso de privacidad</a> · <a href="mailto:${esc(CORREO_RESPONSABLE)}">Contacto</a></footer></body></html>`;

const paginas = {
  'index.html': pagina({
    titulo: 'Cuervo 360',
    descripcion: 'Encuentra departamento y roomies compatibles. Proyecto universitario de la UTVT.',
    cuerpo: `<h1>Departamento y roomies, sin adivinar.</h1>
<p class="suave">Cuervo 360 ayuda a estudiantes universitarios a encontrar un lugar donde vivir y a personas con quienes compartirlo. Es un proyecto de la Universidad Tecnológica del Valle de Toluca (UTVT).</p>
<div class="tarjeta"><strong>La app está en pruebas.</strong><p class="suave">Todavía no está en las tiendas. Si te dieron acceso, instálala desde el enlace que recibiste.</p></div>
<p><a class="boton" href="/privacidad">Aviso de privacidad</a></p>`,
  }),
  'privacidad.html': pagina({
    titulo: 'Aviso de privacidad · Cuervo 360',
    descripcion: 'Aviso de privacidad integral de Cuervo 360.',
    cuerpo: `<h1>${esc(AVISO_TITULO)}</h1><p class="suave">${esc(AVISO_ACTUALIZACION)}</p><p>${negritas(AVISO_INTRO)}</p>
${SECCIONES.map((s) => `<section><h2>${s.numero}. ${esc(s.titulo)}</h2>${s.bloques.map(bloque).join('')}</section>`).join('')}`,
  }),
  // Destino de los enlaces de los correos. Los códigos se escriben en la app: esta página nunca recibe ni procesa un código.
  'abrir-app.html': pagina({
    titulo: 'Vuelve a la app · Cuervo 360',
    descripcion: 'Vuelve a la app de Cuervo 360 para continuar.',
    indexar: false,
    cuerpo: `<h1>Vuelve a la app</h1><p>Abre Cuervo 360 en tu teléfono y escribe el código de 6 dígitos que te enviamos por correo.</p>
<p class="suave">Si no pediste este correo, puedes ignorarlo: no se cambia nada sin ese código.</p>`,
  }),
  '404.html': pagina({ titulo: 'No encontrada · Cuervo 360', descripcion: 'Página no encontrada.', indexar: false, cuerpo: '<h1>No encontramos esa página</h1><p><a href="/">Ir al inicio</a></p>' }),
  // Cabeceras de Cloudflare Pages. Sin scripts de nadie: la CSP prohíbe todo salvo estilos propios en línea.
  '_headers': `/*
  Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Strict-Transport-Security: max-age=31536000
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`,
  'robots.txt': 'User-agent: *\nAllow: /\nDisallow: /abrir-app\n',
};

rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(SALIDA, { recursive: true });
for (const [nombre, contenido] of Object.entries(paginas)) writeFileSync(new URL(nombre, SALIDA), contenido);
console.log(`web-publica/dist: ${Object.keys(paginas).length} archivos`);
