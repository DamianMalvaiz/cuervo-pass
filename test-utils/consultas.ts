// Cliente de react-query para pruebas · V.7
//
// ── EL PROBLEMA ────────────────────────────────────────────────────────────
//
// Un `QueryClient` con datos en caché programa temporizadores de recolección
// (`gcTime`, cinco minutos por omisión). En una app eso es correcto; en Jest,
// esos temporizadores mantienen vivo el bucle de eventos de Node y el proceso
// NO SALE al terminar las pruebas.
//
// No era cosmético, aunque solo se viera como un aviso. Medido el 26/09/2026,
// archivo por archivo, con `/usr/bin/time`:
//
//   pantallas.humo.test.tsx      6 pruebas en 0.8 s → el proceso colgaba 200 s
//   detalle.test.tsx             igual
//   perfil.eliminar.test.tsx     igual
//   consultas.test.tsx           igual
//   use-fotos-firmadas.test.tsx  igual
//
// Cinco de los seis archivos que crean un cliente. Jest acababa forzando la
// salida del worker, y forzar la salida mientras otra suite escribe su
// cobertura puede dejar el informe incompleto — y los `coverageThreshold` se
// evalúan sobre ese informe.
//
// ── POR QUÉ NO SE APAGA LA RECOLECCIÓN ─────────────────────────────────────
//
// Lo obvio sería `gcTime: 0`. Se probó: baja de 200 s a 1.8 s. Y rompe la
// prueba «dentro del staleTime, remontar NO vuelve a consultar»
// (`consultas.test.tsx`), que desmonta y remonta esperando que el dato
// SOBREVIVA. Con recolección inmediata la consulta desaparece al desmontar, se
// vuelve a pedir, y la prueba dejaría de comprobar lo que dice comprobar.
//
// ── LO QUE NO FUNCIONÓ, Y POR QUÉ SE ESCRIBE ───────────────────────────────
//
// El primer intento fue liberar los clientes en un `afterEach` global:
// `cliente.clear()` y `cliente.unmount()`. NO sirve. Comprobado midiendo los
// recursos vivos de Node con `process.getActiveResourcesInfo()` justo después
// de liberar: quedaban `{"Timeout": 9}`, y tres más por cada prueba. El
// registro se llenaba y se vaciaba correctamente —también comprobado— así que
// `clear()` sencillamente no cancela esos temporizadores.
//
// Se probaron antes otras dos explicaciones y las dos eran falsas: que el
// `afterEach` corriera antes del desmontaje de RNTL (se forzó el orden: sigue
// colgando) y que el setup y las pruebas cargaran dos instancias distintas del
// módulo (se unificó el especificador: sigue colgando).
//
// ── LO QUE SÍ FUNCIONA ─────────────────────────────────────────────────────
//
// No programar el temporizador. React Query solo agenda recolección cuando
// `gcTime` es un número finito: con `0` descarta en cuanto no quedan
// observadores, y con `Infinity` no recolecta nunca. **Ninguno de los dos crea
// un `setTimeout`**, y una prueba no necesita el punto medio.
//
// El valor por omisión aquí es `0`. La única prueba que necesita que el dato
// SOBREVIVA al desmontaje —«dentro del staleTime, remontar NO vuelve a
// consultar»— pide `Infinity` explícitamente, que retiene sin agendar nada.
//
// ── POR QUÉ UN AYUDANTE Y NO SEIS ARREGLOS ─────────────────────────────────
//
// Se intentó envolver el constructor de `QueryClient` desde `jest.setup.js`
// para que esto no dependiera de que nadie se acuerde. No se puede: el espacio
// de nombres del módulo es de solo lectura y la asignación se ignora en
// silencio (comprobado). De ahí el guardia de
// `test-utils/__tests__/clientes-registrados.test.ts`, que rompe el build si
// una prueba nueva crea su cliente por su cuenta.

import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';

import { crearClienteConsultas } from '../src/lib/consultas';

const vivos = new Set<QueryClient>();

/**
 * El mismo cliente que usa la app, registrado para poder soltarlo después.
 *
 * Usa `crearClienteConsultas` a propósito y no un `new QueryClient` a mano: una
 * prueba que configura su propio cliente deja de comprobar la configuración
 * real, y entonces `staleTime`, `retry` y `refetchOnWindowFocus` no los
 * verifica nadie.
 */
export function clienteDePrueba(extra?: QueryClientConfig['defaultOptions']): QueryClient {
  const cliente = crearClienteConsultas({
    ...extra,
    // `gcTime: 0` salvo que la prueba pida otra cosa. Lo único que no se puede
    // pasar aquí es un número finito distinto de cero: eso agenda el
    // temporizador que cuelga el proceso. Para retener, `Infinity`.
    queries: { gcTime: 0, ...extra?.queries },
  });
  vivos.add(cliente);
  return cliente;
}

/** Lo llama el `afterEach` global de `jest.setup.js`. */
export function liberarClientesDePrueba(): void {
  for (const cliente of vivos) {
    // `clear()` vacía la caché y con ella cancela sus temporizadores.
    // `unmount()` suelta los oyentes de foco y de conexión.
    cliente.clear();
    cliente.unmount();
  }
  vivos.clear();
}
