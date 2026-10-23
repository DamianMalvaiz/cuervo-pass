import { useCallback } from 'react';

import type { ApiAdmin, IngresosAdmin } from '../lib/api';
import { MENSAJE_ERROR_ADMIN } from '../lib/errores';
import { useCarga } from '../lib/useCarga';
import { GraficaBarras } from './GraficaBarras';

const pesos = (centavos: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(centavos / 100);
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

// «2026-09-01» → «01 sep», sin pasar por `Date` (una fecha sola se interpretaría en UTC y podría caer en el día anterior).
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const etiquetaDeSemana = (iso: string) => { const [, m, d] = iso.split('-'); return `${d} ${MESES[Number(m) - 1] ?? m}`; };
const fecha = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Mexico_City' });

function Cifra({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <article className="tarjeta cifra">
      <p className="etiqueta">{titulo}</p>
      <p className="valor">{valor}</p>
      {nota && <p className="suave">{nota}</p>}
    </article>
  );
}

function Contenido({ d }: { d: IngresosAdmin }) {
  const o = d.ordenes_30d;
  const totalOrdenes = o.creada + o.pendiente + o.pagada + o.rechazada;
  const conversion = totalOrdenes > 0 ? `${Math.round((o.pagada / totalOrdenes) * 100)} %` : '—';

  return (
    <>
      <p className="suave">
        Mercado Pago y lo simulado van siempre por separado. «Simulado» es el modo demostración: no es dinero. Lo de Mercado Pago es dinero real solo si se cobró con credenciales de producción.
      </p>
      <div className="rejilla">
        <Cifra titulo="Mercado Pago · 30 días" valor={pesos(d.ingresos_30d.mercadopago_centavos)} nota={plural(d.ingresos_30d.pagos_mercadopago, 'pago', 'pagos')} />
        <Cifra titulo="Simulados · 30 días" valor={pesos(d.ingresos_30d.simulado_centavos)} nota={`${plural(d.ingresos_30d.pagos_simulados, 'pago', 'pagos')} (no es dinero)`} />
      </div>

      <h3 className="subtitulo">Suscripciones</h3>
      <div className="rejilla">
        <Cifra titulo="Activas" valor={String(d.suscripciones.activas)} />
        <Cifra titulo="En prueba" valor={String(d.suscripciones.en_prueba)} />
        <Cifra titulo="Por vencer (7 días)" valor={String(d.suscripciones.por_vencer_7d)} />
        <Cifra titulo="Vencidas" valor={String(d.suscripciones.vencidas)} />
      </div>

      <div className="rejilla separada">
        <article className="tarjeta ancha">
          <h3>Cobrado por semana (Mercado Pago)</h3>
          <GraficaBarras titulo="Cobrado por semana (Mercado Pago)" datos={d.por_semana.map((w) => ({ etiqueta: etiquetaDeSemana(w.semana), valor: w.mercadopago_centavos / 100 }))} />
          <p className="suave">Pesos por semana, de lunes a domingo.</p>
        </article>
        <article className="tarjeta ancha tabla">
          <h3>Por plan</h3>
          <p className="suave">El dinero es el de los últimos 30 días.</p>
          <table aria-label="Ingresos por plan">
            <thead>
              <tr><th scope="col">Plan</th><th scope="col">Función</th><th scope="col">Suscripciones activas</th><th scope="col">Mercado Pago</th><th scope="col">Simulado</th></tr>
            </thead>
            <tbody>
              {d.por_plan.map((p) => (
                <tr key={p.plan_id}>
                  <th scope="row">{p.nombre}</th>
                  <td>{p.rol}</td>
                  <td>{p.activas}</td>
                  <td>{pesos(p.mercadopago_30d_centavos)}</td>
                  <td>{pesos(p.simulado_30d_centavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className="tarjeta ancha">
          <h3>Órdenes (30 días)</h3>
          <dl className="embudo">
            <div><dt>Creadas</dt><dd>{o.creada}</dd></div>
            <div><dt>Pendientes</dt><dd>{o.pendiente}</dd></div>
            <div><dt>Pagadas</dt><dd>{o.pagada}</dd></div>
            <div><dt>Rechazadas</dt><dd>{o.rechazada}</dd></div>
          </dl>
          <p><span className="suave">Conversión de órdenes</span> <strong>{conversion}</strong></p>
          <p className="suave">Pagadas entre el total de órdenes de los últimos 30 días.</p>
        </article>
        <article className="tarjeta ancha tabla">
          <h3>Últimos pagos</h3>
          {d.ultimos_pagos.length === 0 ? (
            <p className="suave">Todavía no hay pagos.</p>
          ) : (
            <table aria-label="Últimos pagos">
              <thead>
                <tr><th scope="col">Fecha</th><th scope="col">Origen</th><th scope="col">Plan</th><th scope="col">Monto</th><th scope="col">Usuario</th></tr>
              </thead>
              <tbody>
                {d.ultimos_pagos.map((u, i) => (
                  <tr key={`${u.creado_en}-${i}`}>
                    <td>{fecha(u.creado_en)}</td>
                    <td>{u.origen === 'mercadopago' ? 'Mercado Pago' : 'Simulado'}</td>
                    <td>{u.plan}</td>
                    <td>{pesos(u.monto_centavos)}</td>
                    <td>{u.usuario ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </div>
    </>
  );
}

export function Ingresos({ api }: { api: ApiAdmin }) {
  const pedir = useCallback(() => api.ingresos(), [api]);
  const { estado, recargar } = useCarga(pedir);

  return (
    <section aria-labelledby="titulo-ingresos">
      <h2 id="titulo-ingresos">Ingresos y planes</h2>
      {estado.fase === 'cargando' && <p className="suave">Cargando…</p>}
      {estado.fase === 'error' && (
        <div className="tarjeta">
          <p role="alert" className="error">{MENSAJE_ERROR_ADMIN[estado.tipo]}</p>
          <button type="button" className="primario" onClick={recargar}>Reintentar</button>
        </div>
      )}
      {estado.fase === 'ok' && <Contenido d={estado.datos} />}
    </section>
  );
}
