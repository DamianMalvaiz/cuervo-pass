import { readFileSync } from 'fs';
import { join } from 'path';

import { LONGITUD_MINIMA, evaluarPassword } from '../password';

// La validación del cliente y la del servidor tienen que decir LO MISMO.
//
// Si divergen, el usuario ve una lista de requisitos en pantalla, los cumple
// todos, y Supabase lo rechaza igual con un mensaje en inglés que no explica
// nada. Ese fallo es invisible en desarrollo —donde uno usa siempre la misma
// contraseña— y aparece el día de la demo.
//
// Estas pruebas leen supabase/config.toml, que es lo que `supabase config push`
// empuja al proyecto real, así que cambiar una de las dos partes sin la otra
// rompe el CI.

const config = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'config.toml'), 'utf-8');

function valorDeConfig(clave: string): string {
  const m = config.match(new RegExp(`^\\s*${clave}\\s*=\\s*"?([^"\\n#]+)"?`, 'm'));
  if (!m) throw new Error(`no encontré ${clave} en supabase/config.toml`);
  return m[1].trim();
}

test('la longitud mínima del cliente es la misma que la del servidor', () => {
  expect(LONGITUD_MINIMA).toBe(Number(valorDeConfig('minimum_password_length')));
});

test('el servidor exige minúsculas, mayúsculas y dígitos, y el cliente también', () => {
  expect(valorDeConfig('password_requirements')).toBe('lower_upper_letters_digits');

  // Cada una por separado: si el cliente dejara de comprobar las mayúsculas, el
  // servidor rechazaría una contraseña que la pantalla dio por buena.
  expect(evaluarPassword('abcdefghij1').incumplidas.map((r) => r.id)).toContain('mayuscula');
  expect(evaluarPassword('ABCDEFGHIJ1').incumplidas.map((r) => r.id)).toContain('minuscula');
  expect(evaluarPassword('Abcdefghijk').incumplidas.map((r) => r.id)).toContain('digito');
});

test('rechaza lo que la regla de min(6) dejaba pasar', () => {
  // Lo que aceptaba la validación anterior del registro.
  for (const debil of ['123456', 'qwerty', 'abc123', 'Aa1bcd']) {
    expect(evaluarPassword(debil).valida).toBe(false);
  }
});

test('rechaza una contraseña construida con los datos de la propia cuenta', () => {
  const contexto = { email: 'damian@ejemplo.mx', nombreUsuario: 'damianml', nombre: 'Damian' };

  // Cumple longitud, mayúscula, minúscula y dígito — y aun así es mala, porque
  // el primer intento de cualquier atacante son los datos del propio titular.
  const evaluacion = evaluarPassword('Damianml2026', contexto);
  expect(evaluacion.incumplidas.map((r) => r.id)).toContain('sin-datos-propios');
  expect(evaluacion.valida).toBe(false);
});

test('rechaza contraseñas de las listas conocidas aunque cumplan la composición', () => {
  expect(evaluarPassword('Password123').valida).toBe(false);
  expect(evaluarPassword('CuervoPass1').valida).toBe(false);
});

test('acepta una contraseña razonable', () => {
  const evaluacion = evaluarPassword('Tlacuache7Verde', {
    email: 'alguien@ejemplo.mx',
    nombreUsuario: 'alguien',
    nombre: 'Alguien',
  });
  expect(evaluacion.incumplidas).toEqual([]);
  expect(evaluacion.valida).toBe(true);
});

// Un fragmento de tres letras aparece dentro de casi cualquier cosa: sin el
// mínimo de longitud, un usuario llamado "ana" no podría usar ninguna
// contraseña que contuviera esas tres letras seguidas.
test('los fragmentos personales muy cortos no producen falsos positivos', () => {
  const evaluacion = evaluarPassword('Manantial99', { nombreUsuario: 'ana' });
  expect(evaluacion.incumplidas.map((r) => r.id)).not.toContain('sin-datos-propios');
});
