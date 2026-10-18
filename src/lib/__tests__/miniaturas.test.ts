import { ANCHOS, fuenteMiniatura, rutaEsDelBucket } from '../miniaturas';

const BASE = 'https://proyecto.supabase.co';
const CLAVE = 'clave-publica';
const TOKEN = 'token-de-sesion';

describe('rutaEsDelBucket', () => {
  it('una ruta del bucket sí; una URL externa (fotos sembradas de Unsplash) no', () => {
    expect(rutaEsDelBucket('publicaciones/u/p/0.jpg')).toBe(true);
    expect(rutaEsDelBucket('https://images.unsplash.com/x.jpg')).toBe(false);
    expect(rutaEsDelBucket('http://x/y.jpg')).toBe(false);
  });
  it('vacío o nulo no', () => {
    expect(rutaEsDelBucket('')).toBe(false);
    expect(rutaEsDelBucket(null)).toBe(false);
    expect(rutaEsDelBucket(undefined)).toBe(false);
  });
});

describe('fuenteMiniatura', () => {
  it('arma la URL del endpoint de transformación AUTENTICADO, con ancho y calidad', () => {
    const f = fuenteMiniatura(BASE, CLAVE, TOKEN, 'publicaciones/u1/p1/0.jpg', 400);
    expect(f?.uri).toBe(`${BASE}/storage/v1/render/image/authenticated/fotos/publicaciones/u1/p1/0.jpg?width=400&quality=70`);
  });

  it('la autorización viaja en CABECERAS, nunca en la URL (la URL se guarda en caché y en registros)', () => {
    const f = fuenteMiniatura(BASE, CLAVE, TOKEN, 'a/b.jpg', 400);
    expect(f?.headers).toEqual({ Authorization: `Bearer ${TOKEN}`, apikey: CLAVE });
    expect(f?.uri).not.toContain(TOKEN);
  });

  it('codifica cada segmento de la ruta pero conserva las diagonales', () => {
    const f = fuenteMiniatura(BASE, CLAVE, TOKEN, 'negocios/n 1/ñandú?.jpg', 200);
    expect(f?.uri).toContain('/fotos/negocios/n%201/%C3%B1and%C3%BA%3F.jpg?');
  });

  it('una URL externa no se transforma: devuelve null para que se use tal cual', () => {
    expect(fuenteMiniatura(BASE, CLAVE, TOKEN, 'https://images.unsplash.com/x.jpg', 400)).toBeNull();
  });

  it.each([
    ['sin base', ['', CLAVE, TOKEN]],
    ['sin clave', [BASE, '', TOKEN]],
    ['sin sesión', [BASE, CLAVE, '']],
  ])('%s → null (se cae a la foto completa; nunca una URL a medias)', (_n, [b, c, t]) => {
    expect(fuenteMiniatura(b, c, t, 'a/b.jpg', 400)).toBeNull();
  });

  it('el ancho se acota a un rango razonable (no se pide una transformación de 100000 px)', () => {
    expect(fuenteMiniatura(BASE, CLAVE, TOKEN, 'a/b.jpg', 100000)?.uri).toContain('width=1280');
    expect(fuenteMiniatura(BASE, CLAVE, TOKEN, 'a/b.jpg', 1)?.uri).toContain('width=32');
    expect(fuenteMiniatura(BASE, CLAVE, TOKEN, 'a/b.jpg', NaN)?.uri).toContain(`width=${ANCHOS.media}`);
  });
});
