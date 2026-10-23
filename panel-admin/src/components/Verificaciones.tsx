import { useCallback, useEffect, useState } from 'react';

import type { ApiAdmin, DocumentoAdmin, VerificacionPendiente } from '../lib/api';
import { ErrorAdmin, MENSAJE_ERROR_ADMIN, type TipoErrorAdmin } from '../lib/errores';

const LECTURA_ROSTRO: Record<string, string> = {
  coincide: 'la selfie parece la misma persona de la INE y una cara viva',
  no_coincide: 'la selfie no se parece lo bastante a la foto de la INE (una INE vieja o con reflejos también lo causa)',
  no_vivo: 'la selfie pudo ser una foto de otra pantalla o papel, o salió mal',
  repetir_selfie: 'no se pudo medir ninguna selfie; no es una señal contra la persona',
  sin_rostro_ine: 'no se detectó la cara en la foto de la INE',
  pendiente_de_foto: 'se reservó un intento, pero no hay resultado',
};

const tipoDe = (e: unknown): TipoErrorAdmin => (e instanceof ErrorAdmin ? e.tipo : 'desconocido');

type Modo = 'reposo' | 'confirmarDocumentos' | 'confirmarAprobar' | 'rechazando';

function Tarjeta({ v, api, alResolver }: { v: VerificacionPendiente; api: ApiAdmin; alResolver: () => void }) {
  const [modo, setModo] = useState<Modo>('reposo');
  const [documentos, setDocumentos] = useState<DocumentoAdmin[] | null>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState(false);

  async function verDocumentos() {
    setModo('reposo');
    setError(null);
    setOcupada(true);
    try {
      setDocumentos(await api.documentos(v.usuario_id, v.rol));
    } catch (e) {
      setError(MENSAJE_ERROR_ADMIN[tipoDe(e)]);
    } finally {
      setOcupada(false);
    }
  }

  async function decidir(aprobar: boolean, texto: string | null) {
    setError(null);
    setOcupada(true);
    try {
      await api.resolver(v.usuario_id, v.rol, aprobar, texto);
      alResolver();
    } catch (e) {
      const tipo = tipoDe(e);
      setError(MENSAJE_ERROR_ADMIN[tipo]);
      // Si ya no está pendiente (otra persona la resolvió) la lista cambió: se actualiza.
      if (tipo === 'no_pendiente') alResolver();
      setModo('reposo');
    } finally {
      setOcupada(false);
    }
  }

  function confirmarRechazo() {
    if (motivo.trim().length < 3) return setError(MENSAJE_ERROR_ADMIN.motivo_requerido);
    void decidir(false, motivo.trim());
  }

  return (
    <article className="tarjeta verificacion">
      <h3>{v.nombre_legal}</h3>
      <p className="suave">{`@${v.nombre_usuario} · ${v.rol} · aviso ${v.version_aviso}`}</p>
      <p>{v.direccion}</p>
      <p className="suave">{`${v.fotos_del_lugar} ${v.fotos_del_lugar === 1 ? 'foto' : 'fotos'} del lugar · enviada ${new Date(v.enviada_en).toLocaleDateString('es-MX')}`}</p>
      {v.rostro_estado && (
        <p className="suave">{`Comparación de rostro: ${LECTURA_ROSTRO[v.rostro_estado] ?? v.rostro_estado}. Es una ayuda, no una decisión.`}</p>
      )}

      {documentos && (
        <div className="documentos">
          {documentos.length === 0 && <p className="suave">No hay documentos disponibles (la INE pudo borrarse ya).</p>}
          {documentos.map((d) => (
            <figure key={d.etiqueta}>
              <figcaption>{d.etiqueta}</figcaption>
              {d.url ? <img src={d.url} alt={d.etiqueta} referrerPolicy="no-referrer" /> : <p className="suave">(no disponible)</p>}
            </figure>
          ))}
          <p className="suave">Los enlaces caducan a los 10 minutos.</p>
        </div>
      )}

      {modo === 'confirmarDocumentos' && (
        <div className="confirmar">
          <p>{`Vas a ver los documentos de identidad de ${v.nombre_legal}. Quedará registrado que los viste.`}</p>
          <button type="button" className="primario" onClick={() => void verDocumentos()}>Ver</button>
          <button type="button" onClick={() => setModo('reposo')}>Cancelar</button>
        </div>
      )}
      {modo === 'confirmarAprobar' && (
        <div className="confirmar">
          <p>{`¿Aprobar a ${v.nombre_legal} como ${v.rol}? Empieza su prueba gratis de 15 días.`}</p>
          <button type="button" className="primario" disabled={ocupada} onClick={() => void decidir(true, null)}>Sí, aprobar</button>
          <button type="button" onClick={() => setModo('reposo')}>Cancelar</button>
        </div>
      )}
      {modo === 'rechazando' && (
        <div className="confirmar">
          <label htmlFor={`motivo-${v.usuario_id}-${v.rol}`}>Motivo del rechazo</label>
          <textarea id={`motivo-${v.usuario_id}-${v.rol}`} rows={3} maxLength={400} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <button type="button" className="peligro" disabled={ocupada} onClick={confirmarRechazo}>Confirmar rechazo</button>
          <button type="button" onClick={() => setModo('reposo')}>Cancelar</button>
        </div>
      )}

      {error && <p role="alert" className="error">{error}</p>}

      {modo === 'reposo' && (
        <div className="acciones">
          {!documentos && <button type="button" disabled={ocupada} onClick={() => { setError(null); setModo('confirmarDocumentos'); }}>Ver documentos</button>}
          <button type="button" className="primario" disabled={ocupada} onClick={() => { setError(null); setModo('confirmarAprobar'); }}>Aprobar</button>
          <button type="button" disabled={ocupada} onClick={() => { setError(null); setModo('rechazando'); }}>Rechazar</button>
        </div>
      )}
    </article>
  );
}

type Lista = { fase: 'cargando' } | { fase: 'ok'; lista: VerificacionPendiente[] } | { fase: 'error'; tipo: TipoErrorAdmin };

export function Verificaciones({ api }: { api: ApiAdmin }) {
  const [estado, setEstado] = useState<Lista>({ fase: 'cargando' });

  const cargar = useCallback(() => {
    setEstado({ fase: 'cargando' });
    api.verificaciones().then(
      (lista) => setEstado({ fase: 'ok', lista }),
      (e: unknown) => setEstado({ fase: 'error', tipo: tipoDe(e) }),
    );
  }, [api]);

  useEffect(() => cargar(), [cargar]);

  return (
    <section aria-labelledby="titulo-verificaciones">
      <h2 id="titulo-verificaciones">Verificaciones</h2>
      {estado.fase === 'cargando' && <p className="suave">Cargando…</p>}
      {estado.fase === 'error' && (
        <div className="tarjeta">
          <p role="alert" className="error">{MENSAJE_ERROR_ADMIN[estado.tipo]}</p>
          <button type="button" className="primario" onClick={cargar}>Reintentar</button>
        </div>
      )}
      {estado.fase === 'ok' && estado.lista.length === 0 && <p className="suave">No hay verificaciones pendientes.</p>}
      {estado.fase === 'ok' && estado.lista.map((v) => <Tarjeta key={`${v.usuario_id}-${v.rol}`} v={v} api={api} alResolver={cargar} />)}
    </section>
  );
}
