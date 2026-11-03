// Junta las peticiones de «la primera foto» que hacen las tarjetas de una página y las manda en UNA llamada (antes era una por tarjeta: 20 tarjetas, 20 llamadas a la Edge Function).
//
// Cada tarjeta pide la suya con `primeraFoto(tipo, id)`; durante una ventana corta se juntan y salen juntas, por tipo. Una cosa sin fotos o no visible responde `[]` (es un hecho, no un fallo). Si la función aún no conoce los lotes
// (400, p. ej. mientras se despliega) se vuelve a pedir de una en una, así que desplegar la web antes que la función no deja tarjetas sin foto. Cualquier otro fallo llega a cada tarjeta como fallo (END-11) y NO se multiplica en llamadas sueltas.

import { ErrorLoteNoSoportado, fotosPublicas, fotosPublicasLote } from '@/services/explorar.service';

type Tipo = 'publicacion' | 'negocio' | 'producto';
interface Pendiente {
  resolver: (fotos: string[]) => void;
  rechazar: (e: unknown) => void;
}

export const VENTANA_LOTE_MS = 25;
// Cabe en lo que la función acepta por lote (50): más de eso sale en otro lote.
const MAX_POR_LOTE = 50;

const pendientes = new Map<Tipo, Map<string, Pendiente[]>>();

async function despachar(tipo: Tipo, porId: Map<string, Pendiente[]>) {
  const ids = [...porId.keys()];
  for (let i = 0; i < ids.length; i += MAX_POR_LOTE) {
    const grupo = ids.slice(i, i + MAX_POR_LOTE);
    try {
      const lote = await fotosPublicasLote(tipo, grupo);
      for (const id of grupo) for (const p of porId.get(id) ?? []) p.resolver(lote[id] ?? []);
    } catch (e) {
      if (e instanceof ErrorLoteNoSoportado) {
        await Promise.all(
          grupo.map(async (id) => {
            try {
              const fotos = await fotosPublicas(tipo, id);
              for (const p of porId.get(id) ?? []) p.resolver(fotos.slice(0, 1));
            } catch (err) {
              for (const p of porId.get(id) ?? []) p.rechazar(err);
            }
          })
        );
      } else {
        for (const id of grupo) for (const p of porId.get(id) ?? []) p.rechazar(e);
      }
    }
  }
}

/** La primera foto de algo (URL firmada), pedida junto con las demás de su ventana. `[]` si no tiene o no es visible. */
export function primeraFoto(tipo: Tipo, id: string): Promise<string[]> {
  return new Promise((resolver, rechazar) => {
    let porId = pendientes.get(tipo);
    if (!porId) {
      const nuevo = new Map<string, Pendiente[]>();
      porId = nuevo;
      pendientes.set(tipo, nuevo);
      setTimeout(() => {
        pendientes.delete(tipo);
        void despachar(tipo, nuevo);
      }, VENTANA_LOTE_MS);
    }
    porId.set(id, [...(porId.get(id) ?? []), { resolver, rechazar }]);
  });
}
