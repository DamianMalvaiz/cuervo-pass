import { useCallback } from 'react';

import type { ApiAdmin } from '../lib/api';
import { MENSAJE_ERROR_ADMIN } from '../lib/errores';
import { useCarga } from '../lib/useCarga';

const ACCIONES: Record<string, string> = {
  aprobar_verificacion: 'Aprobó una verificación',
  rechazar_verificacion: 'Rechazó una verificación',
  ver_documentos: 'Vio documentos de identidad',
  ocultar_resena: 'Ocultó una reseña',
  restaurar_resena: 'Restauró una reseña',
  ocultar_negocio: 'Ocultó un negocio',
  restaurar_negocio: 'Restauró un negocio',
  modo_demo: 'Cambió el modo de demostración',
  borrar_error: 'Borró un error registrado',
};

// Hora de la Ciudad de México, que es donde se mira el panel.
const fecha = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Mexico_City' });

export function Auditoria({ api }: { api: ApiAdmin }) {
  const pedir = useCallback(() => api.auditoria(), [api]);
  const { estado, recargar } = useCarga(pedir);

  return (
    <section aria-labelledby="titulo-auditoria">
      <h2 id="titulo-auditoria">Auditoría</h2>
      <p className="suave">Lo que se hizo en el panel, de lo más reciente a lo más antiguo.</p>
      {estado.fase === 'cargando' && <p className="suave">Cargando…</p>}
      {estado.fase === 'error' && (
        <div className="tarjeta">
          <p role="alert" className="error">{MENSAJE_ERROR_ADMIN[estado.tipo]}</p>
          <button type="button" className="primario" onClick={recargar}>Reintentar</button>
        </div>
      )}
      {estado.fase === 'ok' && estado.datos.length === 0 && <p className="suave">Todavía no hay acciones registradas.</p>}
      {estado.fase === 'ok' && estado.datos.length > 0 && (
        <div className="tarjeta tabla">
          <table aria-label="Acciones del panel">
            <thead>
              <tr><th scope="col">Fecha</th><th scope="col">Quién</th><th scope="col">Acción</th><th scope="col">Sobre</th><th scope="col">Detalle</th></tr>
            </thead>
            <tbody>
              {estado.datos.map((e, i) => (
                <tr key={`${e.creado_en}-${e.accion}-${i}`}>
                  <td>{fecha(e.creado_en)}</td>
                  <td>{e.admin}</td>
                  <td>{ACCIONES[e.accion] ?? e.accion}</td>
                  <td>{e.objetivo ?? '—'}</td>
                  <td>{e.detalle ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
