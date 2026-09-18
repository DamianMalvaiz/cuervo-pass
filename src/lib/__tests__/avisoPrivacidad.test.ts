import { readFileSync } from 'fs';
import { join } from 'path';

import { CORREO_RESPONSABLE, SECCIONES } from '../avisoPrivacidad';

// Documento maestro v5 · §33.1 aplicado al aviso de privacidad.
//
// El aviso existe dos veces a propósito: docs/aviso-privacidad.md es el
// entregable con historial en Git, y src/lib/avisoPrivacidad.ts es lo que la
// app muestra en pantalla. Duplicar un documento legal es exactamente el tipo
// de cosa que se desincroniza en silencio: alguien corrige el .md antes de la
// entrega, nadie toca el .ts, y la app queda mostrando un aviso viejo mientras
// el repositorio muestra el nuevo.
//
// Esta prueba no puede comparar el texto completo (el .md lleva tablas y saltos
// de línea que la pantalla reestructura), pero sí lo que identifica al
// documento: sus secciones y el contacto del responsable. Si divergen, falla en
// CI antes de que llegue a la entrega.

const RUTA_MD = join(__dirname, '..', '..', '..', 'docs', 'aviso-privacidad.md');
const markdown = readFileSync(RUTA_MD, 'utf-8');

test('las secciones del .md y las de la pantalla coinciden', () => {
  const enMarkdown = [...markdown.matchAll(/^## (\d+)\. (.+)$/gm)].map((m) => ({
    numero: Number(m[1]),
    titulo: m[2].trim(),
  }));

  const enPantalla = SECCIONES.map((s) => ({ numero: s.numero, titulo: s.titulo }));

  expect(enPantalla).toEqual(enMarkdown);
});

test('el correo del responsable es el mismo en ambos', () => {
  expect(markdown).toContain(CORREO_RESPONSABLE);
});

// El aviso promete cosas concretas que el resto del sistema tiene que cumplir.
// Si alguien reescribe la sección de IA quitando la frase del consentimiento,
// esto lo detecta: la casilla sin premarcar es una promesa, no una redacción.
test('el aviso sigue afirmando que la casilla de IA no viene premarcada', () => {
  const seccionIa = SECCIONES.find((s) => s.numero === 4);
  const texto = JSON.stringify(seccionIa);
  expect(texto).toContain('no viene premarcada');
  expect(markdown).toContain('no viene premarcada');
});

test('ninguna sección quedó vacía', () => {
  for (const seccion of SECCIONES) {
    expect(seccion.bloques.length).toBeGreaterThan(0);
  }
});
