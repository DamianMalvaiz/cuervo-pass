import { useEffect, useMemo, useRef, useState } from 'react';

import { Estado } from './components/Estado';
import { Login } from './components/Login';
import { Auditoria } from './components/Auditoria';
import { Ingresos } from './components/Ingresos';
import { Moderacion } from './components/Moderacion';
import { Resumen, type EstadoDetalle } from './components/Resumen';
import { Salud } from './components/Salud';
import { Verificaciones } from './components/Verificaciones';
import { crearApi, type ResumenAdmin } from './lib/api';
import { ORIGEN_SUPABASE, type ClienteApp } from './lib/cliente';
import { ErrorAdmin, MENSAJE_ERROR_ADMIN, type TipoErrorAdmin } from './lib/errores';

type Ruta = 'resumen' | 'verificaciones' | 'moderacion' | 'ingresos' | 'salud' | 'auditoria';
const RUTAS: Ruta[] = ['resumen', 'verificaciones', 'moderacion', 'ingresos', 'salud', 'auditoria'];
const rutaDeHash = (): Ruta => RUTAS.find((r) => window.location.hash === `#${r}`) ?? 'resumen';

type Sesion = 'cargando' | 'no' | 'si';
type Panel = { fase: 'comprobando' } | { fase: 'ok'; resumen: ResumenAdmin } | { fase: 'error'; tipo: TipoErrorAdmin };

/**
 * El guard del panel. Sin sesión pide login. Con sesión NO decide la pantalla: se pregunta al servidor (la función `admin` comprueba el rol en la base) y un 403 es
 * «Sin acceso». Un fallo de red se dice como fallo y deja reintentar: jamás se pinta como cifras en cero.
 */
export function App({ cliente }: { cliente: ClienteApp }) {
  const api = useMemo(() => crearApi(cliente, { origenArchivos: ORIGEN_SUPABASE }), [cliente]);
  const [sesion, setSesion] = useState<Sesion>('cargando');
  const [panel, setPanel] = useState<Panel>({ fase: 'comprobando' });
  const [intento, setIntento] = useState(0);
  const [ruta, setRuta] = useState<Ruta>(rutaDeHash);
  const [detalle, setDetalle] = useState<EstadoDetalle>({ fase: 'cargando' });
  const [intentoDetalle, setIntentoDetalle] = useState(0);

  useEffect(() => {
    const alCambiar = () => setRuta(rutaDeHash());
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);

  useEffect(() => {
    let vivo = true;
    void cliente.auth.getSession().then(({ data }) => {
      if (vivo) setSesion(data.session ? 'si' : 'no');
    });
    const { data } = cliente.auth.onAuthStateChange((_evento, s) => setSesion(s ? 'si' : 'no'));
    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, [cliente]);

  useEffect(() => {
    if (sesion !== 'si') return;
    let vivo = true;
    setPanel({ fase: 'comprobando' });
    api.resumen().then(
      (resumen) => vivo && setPanel({ fase: 'ok', resumen }),
      (e: unknown) => vivo && setPanel({ fase: 'error', tipo: e instanceof ErrorAdmin ? e.tipo : 'desconocido' }),
    );
    return () => {
      vivo = false;
    };
  }, [api, sesion, intento]);

  // El detalle se pide APARTE: si falla, las cifras básicas siguen a la vista y solo él dice su fallo.
  const hayPanel = panel.fase === 'ok';
  useEffect(() => {
    if (sesion !== 'si' || !hayPanel) return;
    let vivo = true;
    setDetalle({ fase: 'cargando' });
    api.resumenDetalle().then(
      (datos) => vivo && setDetalle({ fase: 'ok', datos }),
      (e: unknown) => vivo && setDetalle({ fase: 'error', tipo: e instanceof ErrorAdmin ? e.tipo : 'desconocido' }),
    );
    return () => {
      vivo = false;
    };
  }, [api, sesion, hayPanel, intentoDetalle]);

  // Las insignias del menú y las cifras del Resumen salen del resumen: se refresca AL CAMBIAR de sección, SIN volver a la pantalla de «Cargando…» (y un fallo aquí no tumba
  // nada: se queda la cifra anterior). La primera carga ya trae su propio resumen: `rutaPrevia` evita pedirlo dos veces.
  const rutaPrevia = useRef(ruta);
  useEffect(() => {
    if (rutaPrevia.current === ruta) return;
    rutaPrevia.current = ruta;
    if (sesion !== 'si' || !hayPanel) return;
    let vivo = true;
    if (ruta === 'resumen') setIntentoDetalle((n) => n + 1);
    api.resumen().then(
      (resumen) => vivo && setPanel((p) => (p.fase === 'ok' ? { fase: 'ok', resumen } : p)),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [api, sesion, hayPanel, ruta]);

  const salir = () => {
    void cliente.auth.signOut().then(() => setSesion('no'));
  };

  if (sesion === 'cargando') return <Estado titulo="Cargando…" />;
  if (sesion === 'no') return <Login cliente={cliente} onEntrar={() => setSesion('si')} />;
  if (panel.fase === 'comprobando') return <Estado titulo="Cargando…" />;

  if (panel.fase === 'error') {
    if (panel.tipo === 'prohibido') {
      return (
        <Estado titulo="Sin acceso">
          <p>No tienes acceso al panel de administración.</p>
          <button type="button" onClick={salir}>Cerrar sesión</button>
        </Estado>
      );
    }
    return (
      <Estado titulo="No se pudo cargar">
        <p role="alert" className="error">{MENSAJE_ERROR_ADMIN[panel.tipo]}</p>
        <button type="button" className="primario" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
        <button type="button" onClick={salir}>Cerrar sesión</button>
      </Estado>
    );
  }

  return (
    <div className="marco">
      <header className="barra">
        <strong>Cuervo 360 · Administración</strong>
        <button type="button" onClick={salir}>Cerrar sesión</button>
      </header>
      <nav aria-label="Secciones" className="menu">
        <a href="#resumen" aria-current={ruta === 'resumen' ? 'page' : undefined}>Resumen</a>
        <a href="#verificaciones" aria-current={ruta === 'verificaciones' ? 'page' : undefined}>
          Verificaciones
          {panel.resumen.verificaciones_pendientes > 0 && <span className="insignia">{panel.resumen.verificaciones_pendientes}</span>}
        </a>
        <a href="#moderacion" aria-current={ruta === 'moderacion' ? 'page' : undefined}>
          Moderación
          {panel.resumen.resenas_reportadas > 0 && <span className="insignia">{panel.resumen.resenas_reportadas}</span>}
        </a>
        <a href="#ingresos" aria-current={ruta === 'ingresos' ? 'page' : undefined}>Ingresos y planes</a>
        <a href="#salud" aria-current={ruta === 'salud' ? 'page' : undefined}>Salud de la app</a>
        <a href="#auditoria" aria-current={ruta === 'auditoria' ? 'page' : undefined}>Auditoría</a>
      </nav>
      <main className="contenido">
        {ruta === 'resumen' ? (
          <>
            <h1>Panel de administración</h1>
            <Resumen resumen={panel.resumen} detalle={detalle} onReintentarDetalle={() => setIntentoDetalle((n) => n + 1)} />
          </>
        ) : ruta === 'verificaciones' ? (
          <Verificaciones api={api} />
        ) : ruta === 'moderacion' ? (
          <Moderacion api={api} />
        ) : ruta === 'ingresos' ? (
          <Ingresos api={api} />
        ) : ruta === 'salud' ? (
          <Salud api={api} />
        ) : (
          <Auditoria api={api} />
        )}
      </main>
    </div>
  );
}
