import { useEffect, useMemo, useState } from 'react';

import { Estado } from './components/Estado';
import { Login } from './components/Login';
import { Resumen } from './components/Resumen';
import { crearApi, type ResumenAdmin } from './lib/api';
import type { ClienteApp } from './lib/cliente';
import { ErrorAdmin, MENSAJE_ERROR_ADMIN, type TipoErrorAdmin } from './lib/errores';

type Sesion = 'cargando' | 'no' | 'si';
type Panel = { fase: 'comprobando' } | { fase: 'ok'; resumen: ResumenAdmin } | { fase: 'error'; tipo: TipoErrorAdmin };

/**
 * El guard del panel. Sin sesión pide login. Con sesión NO decide la pantalla: se pregunta al servidor (la función `admin` comprueba el rol en la base) y un 403 es
 * «Sin acceso». Un fallo de red se dice como fallo y deja reintentar: jamás se pinta como cifras en cero.
 */
export function App({ cliente }: { cliente: ClienteApp }) {
  const api = useMemo(() => crearApi(cliente), [cliente]);
  const [sesion, setSesion] = useState<Sesion>('cargando');
  const [panel, setPanel] = useState<Panel>({ fase: 'comprobando' });
  const [intento, setIntento] = useState(0);

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
        <a href="#resumen" aria-current="page">Resumen</a>
      </nav>
      <main className="contenido">
        <h1>Panel de administración</h1>
        <Resumen resumen={panel.resumen} />
      </main>
    </div>
  );
}
