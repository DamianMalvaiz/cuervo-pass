import { execFileSync } from 'node:child_process';

// La web de la app (app.cuervo360.com): lógica pura de `scripts/app-web-reglas.mjs` y del enrutado del Worker (`app-web/rutas.mjs`). Se ejecutan con Node porque son .mjs.
// Lo que se protege: la CSP sin `unsafe-eval` ni scripts en línea sin hash y con conexiones solo al Supabase de producción; que el build RECHACE un bundle con una llave que no sea la
// pública (anon); y que el Worker solo sirva plantillas para ids con forma de id.

const PROD = 'https://vhkblnazibvuqgabsazx.supabase.co';
const correr = (modulo: string, cuerpo: string) =>
  execFileSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', `import * as m from './${modulo}'; ${cuerpo}`], { encoding: 'utf8' }).trim();
const reglas = (c: string) => correr('scripts/app-web-reglas.mjs', c);
const rutas = (c: string) => correr('app-web/rutas.mjs', c);

const csp = () => reglas(`console.log(m.construirCsp({ supabaseUrl: '${PROD}', hashes: new Set(["'sha256-AAA'"]) }))`);
const dir = (nombre: string) => csp().split('; ').find((d) => d.startsWith(nombre))!;

describe('CSP', () => {
  it('los scripts: propios y el en línea SOLO por su hash; nunca unsafe-inline ni unsafe-eval', () => {
    expect(dir('script-src')).toBe("script-src 'self' 'sha256-AAA'");
  });

  it('los estilos admiten en línea (la librería de la app pone estilos en los elementos), pero nada más', () => {
    expect(dir('style-src')).toBe("style-src 'self' 'unsafe-inline'");
  });

  it('imágenes y conexiones solo al Supabase de producción, sin comodines', () => {
    expect(dir('connect-src')).toBe(`connect-src 'self' ${PROD} wss://vhkblnazibvuqgabsazx.supabase.co`);
    expect(dir('img-src')).toBe(`img-src 'self' data: blob: ${PROD}`);
    expect(csp()).not.toMatch(/\*|https:(?!\/\/vhkbl)(?=[ ;]|$)/);
  });

  it('no se deja enmarcar, no envía formularios, no fija base y todo lo demás está cerrado', () => {
    const c = csp();
    for (const d of ["default-src 'none'", "frame-ancestors 'none'", "form-action 'none'", "base-uri 'none'"]) expect(c).toContain(d);
  });

  it('un Supabase que no es https (local) no genera cabeceras de producción', () => {
    expect(() => reglas("m.construirCsp({ supabaseUrl: 'http://127.0.0.1:54321', hashes: new Set() })")).toThrow();
  });
});

describe('cabeceras', () => {
  const h = () => reglas(`console.log(m.construirCabeceras({ supabaseUrl: '${PROD}', hashes: new Set() }))`);

  it('prohíben indexar, no guardan las páginas y cachean lo estático para siempre', () => {
    expect(h()).toContain('X-Robots-Tag: noindex, nofollow');
    expect(h()).toContain('Cache-Control: no-store');
      });

  // Cloudflare SUMA las cabeceras de todas las reglas que coinciden: sin quitar la general, un archivo estático salía con «no-store» Y «immutable» a la vez.
  it('en lo estático QUITA el no-store general antes de poner su caché (no se contradicen)', () => {
    const estatico = h().split('/_expo/static/*')[1].split('/assets/*')[0];
    expect(estatico).toMatch(/! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable/);
    expect(h().split('/assets/*')[1]).toMatch(/! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable/);
  });

  // Cloudflare inyecta en el HTML su Web Analytics (beacon.min.js) y sus detecciones de JavaScript (script en línea `__CF$cv$params`); la CSP los bloquea y deja 2 violaciones por página.
  // `no-transform` le dice a Cloudflare que no modifique la respuesta. Sin verificar hasta desplegarlo: depende de cómo Cloudflare trate la cabecera.
  it('las páginas llevan `no-transform` para que Cloudflare no les inyecte scripts', () => {
    const general = h().split('/_expo/static/*')[0];
    expect(general).toContain('Cache-Control: no-store, no-transform');
  });

  it('no se deja enmarcar ni adivinar el tipo, y exige https', () => {
    expect(h()).toContain('X-Frame-Options: DENY');
    expect(h()).toContain('X-Content-Type-Options: nosniff');
    expect(h()).toContain('Strict-Transport-Security: max-age=31536000');
  });
});

describe('rolesDeJwt: el bundle no puede llevar una llave que no sea la pública', () => {
  const jwt = (rol: string) => `eyJ${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ role: rol })).toString('base64url')}.firma`;
  const roles = (texto: string) => JSON.parse(reglas(`console.log(JSON.stringify(m.rolesDeJwt(${JSON.stringify(texto)})))`));

  it('encuentra el rol de cada JWT dentro de un texto', () => {
    expect(roles(`a="${jwt('anon')}";b='${jwt('service_role')}'`)).toEqual(['anon', 'service_role']);
  });

  it('sin JWT, lista vacía; lo que parece JWT pero no se decodifica se ignora', () => {
    expect(roles('nada que ver aquí')).toEqual([]);
    expect(roles('eyJxx.yy.zz')).toEqual([]);
  });
});

describe('nombreSinCorchetes: Cloudflare no sirve bien archivos con [ ] en el nombre', () => {
  const n = (r: string) => reglas(`console.log(m.nombreSinCorchetes(${JSON.stringify(r)}))`);
  it('cambia [id] por _id en cualquier tramo', () => {
    expect(n('explorar/[id].html')).toBe('explorar/_id.html');
    expect(n('explorar/negocio/[id].html')).toBe('explorar/negocio/_id.html');
  });
  it('lo demás no se toca', () => {
    expect(n('explorar.html')).toBe('explorar.html');
    expect(n('(tabs)/inicio.html')).toBe('(tabs)/inicio.html');
  });
});

describe('rutaDePlantilla: qué plantilla sirve el Worker', () => {
  const r = (p: string) => JSON.parse(rutas(`console.log(JSON.stringify(m.rutaDePlantilla(${JSON.stringify(p)})))`));
  const ID = '3b241101-e2bb-4255-8caf-4136c566a962';

  it('una vivienda y un negocio caen en la plantilla de SU sección', () => {
    expect(r(`/departamentos/${ID}`)).toBe('/departamentos/_id');
    expect(r(`/servicios/${ID}`)).toBe('/servicios/_id');
  });

  it('con barra final también', () => {
    expect(r(`/departamentos/${ID}/`)).toBe('/departamentos/_id');
  });

  it('lo que no es un id con forma de id no se sirve (404 normal)', () => {
    for (const p of ['/departamentos/../secreto', '/departamentos/a b', `/departamentos/${'x'.repeat(80)}`, '/departamentos/%2e%2e', '/servicios/a/b', '/servicios/../x']) expect(r(p)).toBeNull();
  });

  it('las páginas de cada sección (sin id) y las demás rutas no las toca el Worker', () => {
    for (const p of ['/', '/departamentos', '/departamentos/', '/servicios', '/roomies', '/login', '/_expo/static/js/web/x.js']) expect(r(p)).toBeNull();
  });

  it('las direcciones de antes (`/explorar/...`) ya no se reescriben: la raíz de la sección redirige y las fichas dejaron de existir ahí', () => {
    expect(r(`/explorar/${ID}`)).toBeNull();
    expect(r(`/explorar/negocio/${ID}`)).toBeNull();
  });
});
