import { useCallback, useState } from 'react';

import type { ApiAdmin, ErrorRegistrado, EventosPagoAdmin, SaludAdmin } from '../lib/api';
import { ErrorAdmin, MENSAJE_ERROR_ADMIN } from '../lib/errores';
import { useCarga } from '../lib/useCarga';

const ESTADO_IA: Record<SaludAdmin['ia']['estado'], string> = {
  ok: 'Funcionando',
  cargando: 'Cargando el modelo',
  caido: 'No responde',
  sin_configurar: 'Sin configurar',
};

// Lo que decide `mp-webhook` con cada aviso (ver `politica.ts` de esa función). Una etiqueta que no está aquí se muestra TAL CUAL: no se esconde lo que no se conoce.
const ETIQUETAS: Record<string, string> = {
  activado: 'Plan activado',
  duplicado: 'Aviso repetido (ya registrado)',
  pendiente: 'Pago pendiente',
  rechazado: 'Pago rechazado',
  ignorado: 'Estado ignorado',
  monto_distinto: 'Monto distinto (no activó el plan)',
  orden_inexistente: 'Orden inexistente',
  'pago-inexistente': 'Pago inexistente en Mercado Pago',
  'credencial-rechazada': 'Mercado Pago rechazó el token',
  'mp-no-disponible': 'Mercado Pago no disponible',
  'mp-inalcanzable': 'No se alcanzó a Mercado Pago',
  'consulta-rechazada': 'Mercado Pago rechazó la consulta',
  'consulta-mal-formada': 'Respuesta de Mercado Pago mal formada',
  'pago-ajeno': 'Pago de otro origen',
  'moneda-no-mxn': 'Moneda distinta de MXN',
  'monto-invalido': 'Monto inválido',
  'pago-mal-formado': 'Pago mal formado',
  'registro-fallido': 'Falló el registro en la base',
  'resultado-desconocido': 'Resultado desconocido',
};

const fecha = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Mexico_City' });
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function Bloque<T>({ titulo, reintento, estado, recargar, children }: {
  titulo: string; reintento: string; estado: ReturnType<typeof useCarga<T>>['estado']; recargar: () => void; children: (d: T) => React.ReactNode;
}) {
  return (
    <section aria-label={titulo} className="bloque">
      <h3 className="subtitulo">{titulo}</h3>
      {estado.fase === 'cargando' && <p className="suave">Cargando…</p>}
      {estado.fase === 'error' && (
        <div className="tarjeta">
          <p role="alert" className="error">{MENSAJE_ERROR_ADMIN[estado.tipo]}</p>
          <button type="button" className="primario" onClick={recargar}>{reintento}</button>
        </div>
      )}
      {estado.fase === 'ok' && children(estado.datos)}
    </section>
  );
}

function Servicios({ d }: { d: SaludAdmin }) {
  const ia = d.ia;
  return (
    <div className="rejilla">
      <article className="tarjeta cifra">
        <p className="etiqueta">Servicio de IA</p>
        <p className="valor">{ESTADO_IA[ia.estado]}</p>
        {ia.estado === 'ok' && (
          <p className="suave">
            {ia.latencia_ms !== null && `${ia.latencia_ms} ms`}{ia.commit && ` · versión ${ia.commit}`}
            <br />
            {`API del LLM: ${ia.api_llm_configurada ? 'configurada' : 'sin configurar'}`}
          </p>
        )}
      </article>
      <article className="tarjeta cifra">
        <p className="etiqueta">Mercado Pago</p>
        <p className="valor">{d.mercadopago.configurado ? 'Credenciales puestas' : 'Faltan credenciales'}</p>
      </article>
    </div>
  );
}

function AvisosDePago({ d }: { d: EventosPagoAdmin }) {
  return (
    <>
      <p className="suave">{`${plural(d.total_24h, 'aviso', 'avisos')} en 24 horas · ${plural(d.alertas_24h, 'alerta', 'alertas')}`}</p>
      {d.eventos.length === 0 ? (
        <p className="suave">Todavía no hay avisos de pago.</p>
      ) : (
        <div className="tarjeta tabla">
          <table aria-label="Avisos de pago">
            <thead>
              <tr><th scope="col">Fecha</th><th scope="col">Resultado</th><th scope="col">Nivel</th><th scope="col">Código</th><th scope="col">Pago</th></tr>
            </thead>
            <tbody>
              {d.eventos.map((e, i) => (
                <tr key={`${e.recibido_en}-${i}`}>
                  <td>{fecha(e.recibido_en)}</td>
                  <td>{ETIQUETAS[e.etiqueta] ?? e.etiqueta}</td>
                  <td>{e.nivel === 'alerta' ? <strong className="error">Alerta</strong> : 'Info'}</td>
                  <td>{e.status}</td>
                  <td>{e.pago_id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function TarjetaError({ e, api, alBorrar }: { e: ErrorRegistrado; api: ApiAdmin; alBorrar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState(false);

  async function borrar() {
    setError(null);
    setOcupada(true);
    try {
      await api.borrarError(e.id);
      alBorrar();
    } catch (x) {
      setError(MENSAJE_ERROR_ADMIN[x instanceof ErrorAdmin ? x.tipo : 'desconocido']);
      setConfirmando(false);
    } finally {
      setOcupada(false);
    }
  }

  return (
    <article className="tarjeta verificacion">
      <p className="etiqueta">{e.nivel === 'error' ? 'Error' : 'Aviso'}</p>
      <h3>{e.mensaje}</h3>
      {e.detalle && <p className="suave">{e.detalle}</p>}
      <p className="suave">{`${plural(e.conteo, 'vez', 'veces')} · ${e.version_app} · ${e.plataforma}`}</p>
      <p className="suave">{`Primera vez ${fecha(e.primera_vez)} · última vez ${fecha(e.ultima_vez)}`}</p>
      {confirmando ? (
        <div className="confirmar">
          <p>Si vuelve a pasar, nacerá uno nuevo. Queda en la auditoría.</p>
          <button type="button" className="peligro" disabled={ocupada} onClick={() => void borrar()}>Sí, borrar</button>
          <button type="button" onClick={() => setConfirmando(false)}>Cancelar</button>
        </div>
      ) : (
        <div className="acciones"><button type="button" onClick={() => { setError(null); setConfirmando(true); }}>Borrar</button></div>
      )}
      {error && <p role="alert" className="error">{error}</p>}
    </article>
  );
}

export function Salud({ api }: { api: ApiAdmin }) {
  const pedirSalud = useCallback(() => api.salud(), [api]);
  const pedirEventos = useCallback(() => api.eventosPago(), [api]);
  const pedirErrores = useCallback(() => api.errores(), [api]);
  const salud = useCarga(pedirSalud);
  const eventos = useCarga(pedirEventos);
  const errores = useCarga(pedirErrores);

  return (
    <section aria-labelledby="titulo-salud">
      <h2 id="titulo-salud">Salud de la app</h2>
      <Bloque titulo="Servicios" reintento="Reintentar servicios" estado={salud.estado} recargar={salud.recargar}>{(d) => <Servicios d={d} />}</Bloque>
      <Bloque titulo="Avisos de pago" reintento="Reintentar avisos" estado={eventos.estado} recargar={eventos.recargar}>{(d) => <AvisosDePago d={d} />}</Bloque>
      <Bloque titulo="Errores de la app (7 días)" reintento="Reintentar errores" estado={errores.estado} recargar={errores.recargar}>
        {(lista) =>
          lista.length === 0 ? (
            <p className="suave">No hay errores registrados esta semana.</p>
          ) : (
            lista.map((e) => <TarjetaError key={e.id} e={e} api={api} alBorrar={errores.recargar} />)
          )
        }
      </Bloque>
    </section>
  );
}
