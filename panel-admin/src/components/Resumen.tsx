import type { DetalleAdmin, ResumenAdmin } from '../lib/api';
import { MENSAJE_ERROR_ADMIN, type TipoErrorAdmin } from '../lib/errores';
import { GraficaBarras } from './GraficaBarras';

const CIFRAS: { clave: keyof Omit<ResumenAdmin, 'modo_demo'>; titulo: string }[] = [
  { clave: 'cuentas', titulo: 'Cuentas' },
  { clave: 'verificaciones_pendientes', titulo: 'Verificaciones pendientes' },
  { clave: 'resenas_reportadas', titulo: 'Reseñas reportadas' },
  { clave: 'resenas_ocultas', titulo: 'Reseñas ocultas' },
  { clave: 'negocios_ocultos', titulo: 'Negocios ocultos' },
];

const ESTADOS = [
  { clave: 'sin_verificar', titulo: 'Sin verificar' },
  { clave: 'pendiente', titulo: 'Pendiente' },
  { clave: 'aprobado', titulo: 'Aprobado' },
  { clave: 'rechazado', titulo: 'Rechazado' },
];
const ROLES = [
  { clave: 'comerciante', titulo: 'Comerciantes' },
  { clave: 'arrendador', titulo: 'Arrendadores' },
];

export type EstadoDetalle = { fase: 'cargando' } | { fase: 'ok'; datos: DetalleAdmin } | { fase: 'error'; tipo: TipoErrorAdmin };

/** «2026-09-01» → «01 sep», sin pasar por `Date` (una fecha sola se interpretaría en UTC y podría caer en el día anterior). */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function etiquetaDeSemana(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d} ${MESES[Number(m) - 1] ?? m}`;
}

function Detalle({ datos }: { datos: DetalleAdmin }) {
  const total = (rol: string, estado: string) => datos.roles_por_estado.find((r) => r.rol === rol && r.estado === estado)?.total ?? 0;
  return (
    <>
      <article className="tarjeta ancha">
        <h3>Altas por semana</h3>
        <GraficaBarras titulo="Altas por semana" datos={datos.altas_por_semana.map((a) => ({ etiqueta: etiquetaDeSemana(a.semana), valor: a.cuentas }))} />
      </article>
      <article className="tarjeta ancha">
        <h3>Vendedores por estado</h3>
        <table aria-label="Vendedores por estado">
          <thead>
            <tr><th scope="col">Función</th>{ESTADOS.map((e) => <th key={e.clave} scope="col">{e.titulo}</th>)}</tr>
          </thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r.clave}>
                <th scope="row">{r.titulo}</th>
                {ESTADOS.map((e) => <td key={e.clave}>{total(r.clave, e.clave)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      <article className="tarjeta cifra"><p className="etiqueta">Publicaciones activas</p><p className="valor">{datos.publicaciones.activas} de {datos.publicaciones.total}</p></article>
      <article className="tarjeta cifra"><p className="etiqueta">Negocios activos</p><p className="valor">{datos.negocios.activos} de {datos.negocios.total}</p></article>
      <article className="tarjeta cifra"><p className="etiqueta">Conversaciones</p><p className="valor">{datos.conversaciones}</p></article>
      <article className="tarjeta cifra"><p className="etiqueta">Mensajes (7 días)</p><p className="valor">{datos.mensajes_7d}</p></article>
    </>
  );
}

export function Resumen({ resumen, detalle, onReintentarDetalle }: { resumen: ResumenAdmin; detalle: EstadoDetalle; onReintentarDetalle: () => void }) {
  return (
    <section aria-labelledby="titulo-resumen">
      <h2 id="titulo-resumen">Resumen</h2>
      <div className="rejilla">
        {CIFRAS.map(({ clave, titulo }) => (
          <article key={clave} className="tarjeta cifra">
            <p className="etiqueta">{titulo}</p>
            <p className="valor">{resumen[clave]}</p>
          </article>
        ))}
        <article className="tarjeta cifra">
          <p className="etiqueta">Modo de demostración</p>
          <p className="valor">{resumen.modo_demo ? 'Encendido' : 'Apagado'}</p>
        </article>
      </div>
      <h2>Actividad</h2>
      <div className="rejilla">
        {detalle.fase === 'cargando' && <p className="suave">Cargando…</p>}
        {detalle.fase === 'error' && (
          <article className="tarjeta ancha">
            <p role="alert" className="error">{MENSAJE_ERROR_ADMIN[detalle.tipo]}</p>
            <button type="button" onClick={onReintentarDetalle}>Reintentar detalle</button>
          </article>
        )}
        {detalle.fase === 'ok' && <Detalle datos={detalle.datos} />}
      </div>
    </section>
  );
}
