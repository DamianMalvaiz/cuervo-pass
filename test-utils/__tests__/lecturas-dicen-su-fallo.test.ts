import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// «Falló la conexión» y «no hay datos» son estados DISTINTOS (invariante 2). Una pantalla que usa un hook de lectura y no mira su `fallo` pinta el fallo como
// «sin conversaciones», «nadie busca roomie» o «sin verificar»: alarmante y falso (detectado el 24/10/2026: una cuenta que parecía borrada por un error de conexión).
//
// Regla: todo archivo de `src/app` o `src/components` que llame a un hook que expone `fallo` también lo lee. Una excepción se escribe en `OMITE_A_PROPOSITO`
// CON su motivo: callar el fallo tiene que ser una decisión, no un descuido.

const raiz = join(__dirname, '..', '..');

const OMITE_A_PROPOSITO: Record<string, string> = {
  'src/components/GrupoMiPlan.tsx': 'sin leer las funciones el grupo «Mi plan» simplemente no aparece: no afirma nada falso',
  'src/app/(tabs)/_layout.tsx': 'sin leer las funciones o el perfil activo cae a la barra de estudiante de siempre, que no afirma nada nuevo',
  'src/components/SeccionParecidas.tsx': 'sección accesoria: si no carga, no se pinta (y el motivo está dicho en el hook)',
  'src/components/ConteoFavoritos.tsx': 'cifra accesoria: sin dato no se pinta (nunca un cero)',
  'src/components/BotonFavorito.tsx': 'un corazón que no puede leer su estado no afirma nada; el fallo al guardar sí se dice',
  'src/components/BotonFavoritoNegocio.tsx': 'igual que BotonFavorito',
  'src/components/web/CuentaWeb.tsx': 'igual que (tabs)/_layout: sin leer el perfil o las funciones, el menú ofrece lo de estudiante de siempre (perfil, favoritos, configuración) y no afirma nada nuevo; nunca enseña el panel de un vendedor sin saberlo',
  'src/components/web/BarraInferiorWeb.tsx': 'igual que (tabs)/_layout: sin leer el perfil la barra cae a la de estudiante de siempre; el panel del vendedor solo aparece cuando se sabe que lo es',
  'src/components/web/TarjetaPublicacionWeb.tsx': 'una foto que no cargó deja el recuadro gris y la tarjeta sigue diciendo título, zona y precio: no afirma nada falso',
  'src/components/web/MosaicoNegociosWeb.tsx': 'igual que TarjetaPublicacionWeb: la foto que no cargó deja el recuadro gris y el mosaico sigue diciendo el nombre y si está abierto',
  'src/components/web/FilaProductoWeb.tsx': 'igual que TarjetaPublicacionWeb: la foto del producto que no cargó no se pinta y la fila sigue diciendo nombre y precio',
  'src/components/web/TarjetaNegocioWeb.tsx': 'igual que TarjetaPublicacionWeb: la foto que no cargó deja el recuadro gris y la tarjeta sigue diciendo el nombre y si está abierto',
  'src/components/ficha/Calificacion.tsx': 'es una casilla de presentación, no lee de la red',
  'src/components/EditorMenu.tsx': 'usa el plan solo para el tope de productos: sin él rige la cota técnica y la base hace cumplir el plan (CP009)',
  'src/app/perfil/crear-vendedor.tsx': 'solo lee las funciones para no pedir dos veces la misma; si falla, el servidor decide al continuar',
};

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === '__tests__' ? [] : archivos(ruta);
    return /\.tsx$/.test(nombre) ? [ruta] : [];
  });
}

/** Los hooks de lectura de `src/hooks/queries` cuyo cuerpo expone `fallo`. */
function hooksConFallo(): string[] {
  const dir = join(raiz, 'src', 'hooks', 'queries');
  const nombres: string[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
    const trozos = readFileSync(join(dir, f), 'utf8').split(/\nexport function /).slice(1);
    for (const t of trozos) {
      const nombre = /^(use[A-Za-z]+)\(/.exec(t)?.[1];
      if (nombre && /\bfallo\b/.test(t.split(/\nexport function /)[0])) nombres.push(nombre);
    }
  }
  return nombres;
}

test('toda pantalla que usa un hook de lectura con `fallo` lo lee', () => {
  const hooks = hooksConFallo();
  expect(hooks.length).toBeGreaterThan(10);
  const sinLeer: string[] = [];
  for (const ruta of [...archivos(join(raiz, 'src', 'app')), ...archivos(join(raiz, 'src', 'components'))]) {
    const rel = relative(raiz, ruta);
    if (rel in OMITE_A_PROPOSITO) continue;
    const texto = readFileSync(ruta, 'utf8');
    const usa = hooks.filter((h) => new RegExp(`\\b${h}\\(`).test(texto));
    if (usa.length > 0 && !/\b(fallo|falloRoles|isError)\b/.test(texto)) sinLeer.push(`${rel} usa ${usa.join(', ')}`);
  }
  expect(sinLeer).toEqual([]);
});

test('cada excepción sigue existiendo (una excepción de un archivo que ya no está es ruido)', () => {
  for (const ruta of Object.keys(OMITE_A_PROPOSITO)) {
    expect(() => statSync(join(raiz, ruta))).not.toThrow();
  }
});
