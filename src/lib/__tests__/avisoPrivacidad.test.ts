import { readFileSync } from 'fs';
import { join } from 'path';

import {
  CORREO_RESPONSABLE,
  DOMICILIO_RESPONSABLE,
  SECCIONES,
} from '../avisoPrivacidad';

// Documento maestro v5 · §33.1 aplicado al aviso de privacidad.
//
// El aviso existe dos veces a propósito: docs/aviso-privacidad.md es el
// entregable con historial en Git, y src/lib/avisoPrivacidad.ts es lo que la
// app muestra en pantalla. Duplicar un documento legal es exactamente el tipo
// de cosa que se desincroniza en silencio: alguien corrige el .md antes de la
// entrega, nadie toca el .ts, y la app queda mostrando un aviso viejo mientras
// el repositorio muestra el nuevo.
//
// Estas pruebas no comparan el texto completo (el .md lleva tablas y saltos de
// línea que la pantalla reestructura), pero sí lo que identifica al documento y
// lo que la LFPDPPP exige que contenga.

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

// Art. 16 fracción I de la LFPDPPP: identidad Y domicilio. Un correo no cubre
// esa fracción, y un aviso sin responsable localizable no cumple la ley. Esta
// prueba falla mientras quede el marcador, que es justo lo que se quiere: que
// no se pueda entregar con el hueco dentro.
test('el domicilio del responsable está completo, no es un marcador', () => {
  expect(DOMICILIO_RESPONSABLE).not.toMatch(/PENDIENTE|<|>/);
  expect(markdown).not.toMatch(/PENDIENTE|<DOMICILIO>/);
  expect(markdown).toContain(DOMICILIO_RESPONSABLE);
});

// Los elementos que el art. 16 de la LFPDPPP y el art. 30 de su Reglamento
// exigen. Si alguien recorta el aviso, esto dice cuál fracción quedó fuera.
describe('elementos exigidos por la LFPDPPP', () => {
  const exigidos: [string, RegExp][] = [
    ['identidad del responsable', /Angel Damian Malvaiz Gonzalez/],
    ['finalidades primarias', /[Pp]rimarias/],
    ['finalidades secundarias y cómo negarse', /[Ss]ecundaria/],
    ['medio para limitar el uso o divulgación', /no viene premarcada/],
    ['transferencias', /[Tt]ransferencias/],
    ['encargados', /[Ee]ncargado/],
    ['procedimiento para ejercer derechos ARCO', /ARCO/],
    ['plazos de respuesta', /20 días\s+hábiles/],
    ['autoridad (INAI)', /INAI/],
    ['revocación del consentimiento', /[Rr]evoca/],
    ['datos sensibles', /[Ss]ensibles/],
    ['procedimiento de cambios al aviso', /Cambios a este aviso/],
    ['fecha de última actualización', /Última actualización/],
  ];

  test.each(exigidos)('el .md incluye: %s', (_nombre, patron) => {
    expect(markdown).toMatch(patron);
  });
});

// El aviso promete cosas concretas que el resto del sistema tiene que cumplir.
// Si alguien reescribe la sección de IA quitando la frase del consentimiento,
// esto lo detecta: la casilla sin premarcar es una promesa, no una redacción.
test('el aviso sigue afirmando que la casilla de IA no viene premarcada', () => {
  const seccionIa = SECCIONES.find((s) => s.numero === 4);
  expect(JSON.stringify(seccionIa)).toContain('no viene premarcada');
  expect(markdown).toContain('no viene premarcada');
});

// §9 del aviso describe medidas de seguridad concretas. Decir "ciframos tus
// fotos" sería falso —están en un bucket privado con enlaces firmados, que no
// es lo mismo— y un aviso que exagera sus medidas es una declaración falsa.
test('la sección de seguridad no afirma que las fotos estén cifradas de extremo a extremo', () => {
  const seguridad = JSON.stringify(SECCIONES.find((s) => s.numero === 9));
  expect(seguridad).toContain('no están cifradas de extremo a extremo');
  expect(seguridad).toContain('bcrypt');
  expect(markdown).toContain('no están cifradas de extremo a extremo');
});

test('ninguna sección quedó vacía', () => {
  for (const seccion of SECCIONES) {
    expect(seccion.bloques.length).toBeGreaterThan(0);
  }
});
