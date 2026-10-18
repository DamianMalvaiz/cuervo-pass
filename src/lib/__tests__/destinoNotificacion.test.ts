import { rutaDeDestino } from '../destinoNotificacion';

// Un destino lo escribe la base, pero la app no confía: solo sigue las clases que conoce, con ids de forma conocida.
describe('rutaDeDestino', () => {
  it('negocio y publicación llevan a su ficha', () => {
    expect(rutaDeDestino('negocio:3f2a-1')).toEqual({ pathname: '/negocio/[id]', params: { id: '3f2a-1' } });
    expect(rutaDeDestino('publicacion:abc_DEF-9')).toEqual({ pathname: '/publicacion/[id]', params: { id: 'abc_DEF-9' } });
  });
  it('verificación lleva solo con un rol válido', () => {
    expect(rutaDeDestino('verificacion:comerciante')).toEqual({ pathname: '/verificacion/[rol]', params: { rol: 'comerciante' } });
    expect(rutaDeDestino('verificacion:arrendador')).toEqual({ pathname: '/verificacion/[rol]', params: { rol: 'arrendador' } });
    expect(rutaDeDestino('verificacion:admin')).toBeNull();
  });
  it.each([
    [null], [undefined], [''], ['sin-dos-puntos'], [':x'], ['chat:1'], ['negocio:'], ['negocio:con espacio'], ['negocio:../../admin'],
    ['negocio:' + 'a'.repeat(65)], ['http://evil.example/x'], ['negocio:a:b'],
  ])('«%s» no lleva a ningún lado', (d) => expect(rutaDeDestino(d as string | null | undefined)).toBeNull());
});
