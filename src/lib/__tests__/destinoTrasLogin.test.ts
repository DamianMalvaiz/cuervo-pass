import { destinoTrasLogin } from '../destinoTrasLogin';

// Tras iniciar sesión, el panel de admin web quiere volver a `/admin`. Es un parámetro que escribe quien arma el enlace, así que NO se obedece a
// ciegas: solo rutas del panel, nunca una dirección externa ni otra pantalla (redirección abierta).
describe('destinoTrasLogin', () => {
  test.each(['/admin', '/admin/verificaciones', '/admin/moderacion', '/admin/errores'])('acepta la ruta del panel %s', (ruta) => {
    expect(destinoTrasLogin(ruta, '/(tabs)/inicio')).toBe(ruta);
  });

  test.each([
    undefined, '', '/', '/perfil', '/administrador', '/admin/', '/admin/../perfil', '/admin/otra',
    'https://atacante.com', '//atacante.com', 'javascript:alert(1)', '/admin?x=1', ' /admin', '/ADMIN',
  ])('rechaza %p y usa el destino normal', (ruta) => {
    expect(destinoTrasLogin(ruta, '/(tabs)/inicio')).toBe('/(tabs)/inicio');
  });

  test('un parámetro repetido (arreglo) no se acepta', () => {
    expect(destinoTrasLogin(['/admin', '/admin'] as unknown as string, '/(tabs)/inicio')).toBe('/(tabs)/inicio');
  });
});
