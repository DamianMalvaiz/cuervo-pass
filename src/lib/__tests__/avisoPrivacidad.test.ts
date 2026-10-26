import { readFileSync } from 'fs';
import { join } from 'path';

import {
  AVISO_ACTUALIZACION,
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
    ['autoridad (Secretaría Anticorrupción y Buen Gobierno)', /Secretaría Anticorrupción y Buen Gobierno/],
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

// Plazos de borrado de la INE: el aviso los promete y el código los fija (migraciones 0049/0053/0057). Si alguien cambia un plazo en la
// base y no aquí, el aviso miente sobre el dato más sensible.
test('el aviso promete los mismos plazos de borrado de la INE que fija la base (30 días aprobada, 7 rechazada)', () => {
  const conservacion = JSON.stringify(SECCIONES.find((s) => s.numero === 6));
  expect(conservacion).toMatch(/INE de una verificación aprobada[^}]*30 días\*\*/);
  expect(conservacion).toMatch(/INE de una verificación rechazada[^}]*7 días\*\*/);
  const migracion = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'migrations', '0057_borrado_de_ine_rechazada.sql'), 'utf-8');
  expect(migracion).toContain("interval '7 days'");
  expect(migracion).toContain("interval '30 days'");
});

// Referencias que dejaron de ser ciertas: la ley de 2010 se abrogó y el INAI se extinguió. No deben volver a colarse.
test('el aviso no cita al INAI ni artículos de la ley abrogada', () => {
  const todo = JSON.stringify(SECCIONES) + markdown;
  expect(todo).not.toMatch(/INAI\)\*\*|home\.inai/);
  expect(todo).not.toMatch(/artículos 15, 16 y 17|artículos 24 a 30|artículo 3, fracción|artículo 36|artículo 37/);
});

test('el aviso es la versión 5 y lo dice en las dos copias', () => {
  expect(AVISO_ACTUALIZACION).toContain('Versión 5');
  expect(markdown).toContain('**Versión:** 5');
});

// ── v5 (26/10/2026): la web se explora SIN cuenta ───────────────────────────────────────────────────────────────────────────────────────────────
// Antes, nada de lo que alguien publicaba lo veía quien no tuviera sesión. Con la web, una parte sí: se dice cuál, y sobre todo cuál NO.
describe('el aviso v5 dice qué ve quien explora sin cuenta, en las dos copias', () => {
  const pantalla = JSON.stringify(SECCIONES);
  const md = markdown.replace(/\s+/g, ' ');

  it('nombra a quien no tiene cuenta como alguien que ve publicaciones y negocios', () => {
    for (const texto of [pantalla, md]) {
      expect(texto).toMatch(/Cualquier persona, sin cuenta/);
      expect(texto).toMatch(/sin la calle ni el número/);
      expect(texto).toMatch(/aproximad/);
    }
  });

  it('dice lo que NO ve: dirección exacta, teléfono, quién publica y la descripción de la vivienda', () => {
    for (const texto of [pantalla, md]) {
      expect(texto).toMatch(/dirección exacta/);
      expect(texto).toMatch(/teléfono/);
      expect(texto).toMatch(/quién publica/);
      expect(texto).toMatch(/descripción de una vivienda/);
    }
  });

  it('avisa que las fotos se ven con un enlace temporal', () => {
    for (const texto of [pantalla, md]) expect(texto).toMatch(/enlace temporal/);
  });
});

// ── v4 (26/10/2026): lo que dejó de ser cierto y lo que faltaba ─────────────────────────────────────────────────────────────────────────────────
describe('el aviso v4 dice lo que la app hace HOY, en las dos copias', () => {
  const pantalla = JSON.stringify(SECCIONES);
  // El .md parte las líneas a 80 columnas: se compara el contenido, no el formato.
  const md = markdown.replace(/\s+/g, ' ');

  it('ya no dice que los cobros son simulados: los pagos van por Mercado Pago, en modo de pruebas', () => {
    for (const texto of [pantalla, md]) {
      expect(texto).not.toMatch(/simulad/i);
      expect(texto).toMatch(/modo de pruebas de Mercado Pago/);
    }
  });

  it('dice qué se le manda a Mercado Pago, y el código manda exactamente eso', () => {
    for (const texto of [pantalla, md]) expect(texto).toMatch(/el plan, el monto y un número de orden/i);
    const politica = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'functions', 'crear-pago', 'politica.ts'), 'utf-8');
    const preferencia = politica.slice(politica.indexOf('export function construirPreferencia'), politica.indexOf('export type RespuestaPreferencia'));
    // Ni nombre ni correo: solo el artículo (plan y monto) y la referencia (número de orden).
    expect(preferencia).not.toMatch(/payer|email|name|surname|phone/i);
    expect(preferencia).toMatch(/unit_price/);
    expect(preferencia).toMatch(/external_reference/);
  });

  it('ya no manda a una descarga que no existe ni a pantallas que cambiaron de nombre', () => {
    for (const texto of [pantalla, md]) {
      expect(texto).not.toContain('Descargar mis datos');
      expect(texto).not.toContain('Editar mis preferencias');
      expect(texto).not.toMatch(/Mi perfil → Eliminar mi cuenta|Mi perfil\s+→ Eliminar mi cuenta|perfil → Eliminar mi cuenta/);
    }
  });

  it('las rutas que dice (Configuración → Eliminar mi cuenta, → Personalización, Mi perfil → Mis datos) existen en la app', () => {
    for (const texto of [pantalla, md]) {
      expect(texto).toContain('Configuración → Eliminar mi cuenta');
      expect(texto).toContain('Configuración → Personalización');
      expect(texto).toContain('Mi perfil → Mis datos');
    }
    const layout = readFileSync(join(__dirname, '..', '..', 'app', '_layout.tsx'), 'utf-8');
    expect(layout).toContain("title: 'Eliminar mi cuenta'");
    expect(layout).toContain("title: 'Personalización'");
    const perfil = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'perfil.tsx'), 'utf-8');
    expect(perfil).toContain('etiqueta="Mis datos"');
    const configuracion = readFileSync(join(__dirname, '..', '..', 'app', 'configuracion.tsx'), 'utf-8');
    expect(configuracion).toContain("'/eliminar-cuenta'");
    expect(configuracion).toContain("'/perfil/personalizacion'");
  });

  it('el acceso a los datos se pide por escrito: la app ya no trae una descarga', () => {
    const acceso = JSON.stringify(SECCIONES.find((s) => s.numero === 7));
    expect(acceso).toMatch(/acceso\*\* a tus datos se ejerce por escrito/);
    expect(md).toMatch(/acceso\*\* a tus datos se ejerce por escrito/);
  });

  it('lista lo nuevo: productos de la tienda, pagos, favoritos de negocios y avisos', () => {
    for (const texto of [pantalla, md]) {
      expect(texto).toMatch(/productos\*\* de tu tienda/);
      expect(texto).toMatch(/guardaron una publicación o un negocio/);
      expect(texto).toMatch(/Tus \*\*avisos\*\*/);
    }
    const conservacion = JSON.stringify(SECCIONES.find((s) => s.numero === 6));
    expect(conservacion).toMatch(/Productos de tu tienda/);
    expect(conservacion).toMatch(/Órdenes y pagos/);
    expect(md).toMatch(/Productos de tu tienda/);
    expect(md).toMatch(/Órdenes y pagos/);
  });

  it('nombra a Mercado Pago junto a los demás encargados', () => {
    const encargados = JSON.stringify(SECCIONES.find((s) => s.numero === 5));
    expect(encargados).toMatch(/Mercado Pago/);
    expect(md).toMatch(/Mercado Pago/);
  });
});

test('el aviso dice que hoy no se tratan datos biométricos, en las dos copias', () => {
  expect(JSON.stringify(SECCIONES)).toContain('Hoy no tratamos datos biométricos');
  expect(markdown).toContain('Hoy no tratamos datos biométricos');
});

// El aviso dice qué trae «Descargar mis datos». Lo que promete lo cumple `exportar_mis_datos` (0062): si alguien quita una sección de la función,
// esto falla en vez de dejar un aviso que describe una descarga que ya no existe.
test('el aviso describe las secciones que trae la exportación de datos (0062)', () => {
  const migracion = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'migrations', '0062_exportar_todos_mis_datos.sql'), 'utf-8');
  const acceso = JSON.stringify(SECCIONES.find((s) => s.numero === 7));
  const porSeccion: [string, RegExp][] = [
    ["'funciones'", /funciones/], ["'verificaciones'", /verificaci/], ["'negocios'", /negocios/], ["'menu'", /men[úu]/],
    ["'favoritos'", /favoritos/], ["'resenas'", /rese/], ["'suscripciones'", /suscripciones/], ["'pagos'", /pagos/],
  ];
  for (const [clave, patron] of porSeccion) {
    expect(migracion).toContain(clave);
    expect(acceso).toMatch(patron);
    expect(markdown).toMatch(patron);
  }
});
