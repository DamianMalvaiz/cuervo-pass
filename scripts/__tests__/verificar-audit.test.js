// La puerta de `npm audit` con excepciones · hallazgo del 15/10/2026.
//
// El paso `npm audit --audit-level=high` del CI estaba en rojo y no podía ponerse en
// verde subiendo dependencias: de los avisos altos que quedaban, `braces` y
// `node-forge` ya están en su última versión publicada y el aviso cubre esa versión,
// o sea que NO EXISTE una corrección. Verificado además que no están en el bundle de
// producción de la app: son herramientas de compilación y de pruebas.
//
// Las dos salidas fáciles eran malas. Dejarlo en rojo entrena a ignorar el rojo, y
// bajar el umbral a `critical` deja pasar cualquier aviso alto futuro sin que nadie
// se entere. Esta puerta falla ante todo aviso alto o crítico NUEVO, permite los
// conocidos por nombre y con un motivo escrito, y se pone en rojo también cuando una
// excepción deja de ser válida: porque ya hay corrección, porque el aviso ya no
// aparece, o porque venció su fecha de revisión. Mismo espíritu que `.trivyignore`:
// una excepción que obliga a escribir el porqué es una decisión; una que se activa
// sola es un agujero.
//
// Se prueba el CLI de verdad, con los flags que sustituyen las tres fuentes de datos
// (`npm audit`, el registro de npm y el reloj) por archivos. Cada prueba de fallo
// comprueba además el TEXTO del mensaje: sin eso, un script que no existe también
// «falla» con código 1 y la prueba pasaría por el motivo equivocado.

const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const CLI = join(__dirname, '..', 'verificar-audit.mjs');

/** Una entrada de `npm audit --json` con un aviso propio (`via` de tipo objeto). */
const aviso = (paquete, ghsa, severidad, rango) => ({
  name: paquete,
  severity: severidad,
  via: [
    {
      source: Math.abs([...ghsa].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 1e7,
      name: paquete,
      title: `aviso de ${paquete}`,
      url: `https://github.com/advisories/${ghsa}`,
      severity: severidad,
      range: rango,
    },
  ],
});

/** Un paquete que solo arrastra el aviso de otro (`via` de tipo cadena). */
const arrastra = (paquete, origen, severidad) => ({ name: paquete, severity: severidad, via: [origen] });

const BRACES = ['braces', 'GHSA-vfj7-8cjw-p6xm', 'high', '<=3.0.3'];
const FORGE = ['node-forge', 'GHSA-86w9-cpqp-85rv', 'high', '<=1.4.0'];

const excepcion = (extra = {}) => ({
  advisory: 'GHSA-vfj7-8cjw-p6xm',
  paquete: 'braces',
  motivo: 'No hay versión corregida publicada y no está en el bundle de la app.',
  revisar: '2026-11-15',
  ...extra,
});

/**
 * Corre el CLI con datos de prueba. `versiones` es lo que el registro tiene publicado
 * de cada paquete; por omisión, solo la versión vulnerable (no hay corrección).
 */
function ejecutar({ auditoria, excepciones = [], versiones, hoy = '2026-10-15' }) {
  const dir = mkdtempSync(join(tmpdir(), 'audit-'));
  const archivo = (nombre, datos) => {
    const ruta = join(dir, nombre);
    writeFileSync(ruta, JSON.stringify(datos));
    return ruta;
  };
  const argumentos = [
    CLI,
    '--auditoria', archivo('auditoria.json', { vulnerabilities: auditoria, metadata: {} }),
    '--excepciones', archivo('excepciones.json', excepciones),
    '--versiones', archivo('versiones.json', versiones ?? { braces: ['3.0.3'], 'node-forge': ['1.4.0'] }),
    '--hoy', hoy,
  ];
  try {
    const salida = execFileSync('node', argumentos, { stdio: 'pipe', encoding: 'utf8' });
    return { codigo: 0, salida };
  } catch (e) {
    return { codigo: e.status ?? -1, salida: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('verificar-audit · pasa', () => {
  it('sin ningún aviso', () => {
    const r = ejecutar({ auditoria: {} });
    expect(r.codigo).toBe(0);
    expect(r.salida).toMatch(/sin avisos altos ni críticos/i);
  });

  it('con un aviso alto que tiene excepción vigente', () => {
    const r = ejecutar({
      auditoria: { braces: aviso(...BRACES), micromatch: arrastra('micromatch', 'braces', 'high') },
      excepciones: [excepcion()],
    });
    expect(r.codigo).toBe(0);
    expect(r.salida).toMatch(/permitido.*GHSA-vfj7-8cjw-p6xm.*braces/);
  });

  // Un mismo aviso aparece una vez por cada paquete de la cadena (68 paquetes eran 7
  // avisos). Contarlos por paquete exigiría una excepción por cada eslabón.
  it('cuenta el aviso UNA vez aunque lo arrastren muchos paquetes', () => {
    const r = ejecutar({
      auditoria: {
        braces: aviso(...BRACES),
        micromatch: arrastra('micromatch', 'braces', 'high'),
        metro: arrastra('metro', 'micromatch', 'high'),
        jest: arrastra('jest', 'metro', 'high'),
      },
      excepciones: [excepcion()],
    });
    expect(r.codigo).toBe(0);
  });

  // El umbral es `high`: lo moderado no rompe el CI (se ve en `npm audit`).
  it('un aviso MODERADO nuevo no falla', () => {
    const r = ejecutar({ auditoria: { uuid: aviso('uuid', 'GHSA-w5hq-g745-h8pq', 'moderate', '<11.1.1') } });
    expect(r.codigo).toBe(0);
  });
});

describe('verificar-audit · falla', () => {
  // LA prueba de la puerta. Es lo que `--audit-level=critical` dejaría pasar.
  it('ante un aviso ALTO nuevo, sin excepción', () => {
    const r = ejecutar({ auditoria: { braces: aviso(...BRACES), 'node-forge': aviso(...FORGE) }, excepciones: [excepcion()] });
    expect(r.codigo).toBe(1);
    expect(r.salida).toMatch(/FALLA.*GHSA-86w9-cpqp-85rv.*node-forge.*NUEVO/s);
  });

  it('ante un aviso CRÍTICO nuevo', () => {
    const r = ejecutar({ auditoria: { 'shell-quote': aviso('shell-quote', 'GHSA-pqg4-j6r4-53mv', 'critical', '>=1.8.4 <1.11.0') } });
    expect(r.codigo).toBe(1);
    expect(r.salida).toMatch(/FALLA.*GHSA-pqg4-j6r4-53mv.*NUEVO/s);
  });

  // Una excepción que sobrevive a su aviso es una deuda invisible: la lista de
  // excepciones solo sirve si dice la verdad.
  it('si una excepción ya no corresponde a ningún aviso', () => {
    const r = ejecutar({ auditoria: {}, excepciones: [excepcion()] });
    expect(r.codigo).toBe(1);
    expect(r.salida).toMatch(/FALLA.*GHSA-vfj7-8cjw-p6xm.*ya no aparece/s);
  });

  // La razón de ser de la excepción es que NO había corrección. Cuando la hay, hay
  // que subir la dependencia y quitar la excepción.
  it('si ya existe una versión corregida publicada', () => {
    const r = ejecutar({
      auditoria: { braces: aviso(...BRACES) },
      excepciones: [excepcion()],
      versiones: { braces: ['3.0.3', '3.0.4'] },
    });
    expect(r.codigo).toBe(1);
    expect(r.salida).toMatch(/FALLA.*GHSA-vfj7-8cjw-p6xm.*corrección.*3\.0\.4/s);
  });

  // Una versión previa (alfa, beta) no cuenta como corrección publicada.
  it('una prerrelease no cuenta como corrección', () => {
    const r = ejecutar({
      auditoria: { braces: aviso(...BRACES) },
      excepciones: [excepcion()],
      versiones: { braces: ['3.0.3', '4.0.0-beta.1'] },
    });
    expect(r.codigo).toBe(0);
  });

  it('si la excepción venció su fecha de revisión', () => {
    const r = ejecutar({ auditoria: { braces: aviso(...BRACES) }, excepciones: [excepcion()], hoy: '2026-11-16' });
    expect(r.codigo).toBe(1);
    expect(r.salida).toMatch(/FALLA.*GHSA-vfj7-8cjw-p6xm.*venció/s);
  });

  it('el mismo día de la fecha de revisión todavía vale', () => {
    const r = ejecutar({ auditoria: { braces: aviso(...BRACES) }, excepciones: [excepcion()], hoy: '2026-11-15' });
    expect(r.codigo).toBe(0);
  });

  it.each([
    ['sin motivo', { motivo: '' }],
    ['con un motivo en blanco', { motivo: '   ' }],
    ['sin fecha de revisión', { revisar: undefined }],
    ['con una fecha que no es una fecha', { revisar: 'pronto' }],
  ])('una excepción %s no es una excepción', (_, cambio) => {
    const r = ejecutar({ auditoria: { braces: aviso(...BRACES) }, excepciones: [excepcion(cambio)] });
    expect(r.codigo).toBe(1);
    expect(r.salida).toMatch(/FALLA.*GHSA-vfj7-8cjw-p6xm.*(motivo|revisar)/is);
  });
});
