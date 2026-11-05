import { useCallback, useState } from 'react';

import type { ApiAdmin, ItemModeracion } from '../lib/api';
import { ErrorAdmin, MENSAJE_ERROR_ADMIN } from '../lib/errores';
import { useCarga } from '../lib/useCarga';

type Modo = 'reposo' | 'ocultando' | 'restaurando';

function Tarjeta({ item, api, alCambiar }: { item: ItemModeracion; api: ApiAdmin; alCambiar: () => void }) {
  const [modo, setModo] = useState<Modo>('reposo');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState(false);
  const idMotivo = `motivo-${item.tipo}-${item.id}`;

  async function moderar(ocultar: boolean, texto: string | null) {
    setError(null);
    setOcupada(true);
    try {
      await api.moderar(item.tipo, item.id, ocultar, texto);
      alCambiar();
    } catch (e) {
      setError(MENSAJE_ERROR_ADMIN[e instanceof ErrorAdmin ? e.tipo : 'desconocido']);
      setModo('reposo');
    } finally {
      setOcupada(false);
    }
  }

  function confirmarOcultar() {
    if (motivo.trim().length < 3) return setError(MENSAJE_ERROR_ADMIN.motivo_requerido);
    void moderar(true, motivo.trim());
  }

  return (
    <article className="tarjeta verificacion">
      <p className="etiqueta">{item.tipo === 'resena' ? 'Reseña' : 'Negocio'}</p>
      <h3>{item.titulo}</h3>
      {item.texto && <p>{item.texto}</p>}
      <p className="suave">{`de ${item.autor} · ${item.reportes} ${item.reportes === 1 ? 'reporte' : 'reportes'}`}</p>
      <p><strong>{item.oculto ? 'Oculto' : 'Visible'}</strong></p>

      {modo === 'ocultando' && (
        <div className="confirmar">
          <label htmlFor={idMotivo}>Motivo</label>
          <textarea id={idMotivo} rows={3} maxLength={400} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <button type="button" className="peligro" disabled={ocupada} onClick={confirmarOcultar}>Confirmar ocultar</button>
          <button type="button" onClick={() => setModo('reposo')}>Cancelar</button>
        </div>
      )}
      {modo === 'restaurando' && (
        <div className="confirmar">
          <p>Volverá a verse para todos.</p>
          <button type="button" className="primario" disabled={ocupada} onClick={() => void moderar(false, null)}>Sí, restaurar</button>
          <button type="button" onClick={() => setModo('reposo')}>Cancelar</button>
        </div>
      )}

      {error && <p role="alert" className="error">{error}</p>}

      {modo === 'reposo' && (
        <div className="acciones">
          {item.oculto ? (
            <button type="button" disabled={ocupada} onClick={() => { setError(null); setModo('restaurando'); }}>Restaurar</button>
          ) : (
            <button type="button" disabled={ocupada} onClick={() => { setError(null); setModo('ocultando'); }}>Ocultar</button>
          )}
        </div>
      )}
    </article>
  );
}

export function Moderacion({ api }: { api: ApiAdmin }) {
  const pedir = useCallback(() => api.moderacion(), [api]);
  const { estado, recargar } = useCarga(pedir);

  return (
    <section aria-labelledby="titulo-moderacion">
      <h2 id="titulo-moderacion">Moderación</h2>
      {estado.fase === 'cargando' && <p className="suave">Cargando…</p>}
      {estado.fase === 'error' && (
        <div className="tarjeta">
          <p role="alert" className="error">{MENSAJE_ERROR_ADMIN[estado.tipo]}</p>
          <button type="button" className="primario" onClick={recargar}>Reintentar</button>
        </div>
      )}
      {estado.fase === 'ok' && estado.datos.length === 0 && <p className="suave">No hay nada que moderar.</p>}
      {estado.fase === 'ok' && estado.datos.map((i) => <Tarjeta key={`${i.tipo}-${i.id}`} item={i} api={api} alCambiar={recargar} />)}
    </section>
  );
}
