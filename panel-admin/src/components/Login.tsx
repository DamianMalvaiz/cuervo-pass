import { useState, type FormEvent } from 'react';

import type { ClienteApp } from '../lib/cliente';

/** El mensaje de Supabase viene en inglés. Se traduce lo único que de verdad puede estar pasando. */
function mensajeDeLogin(error: { message?: string }): string {
  return /invalid login credentials/i.test(error.message ?? '')
    ? 'Correo o contraseña incorrectos.'
    : 'No se pudo iniciar sesión. Intenta de nuevo.';
}

export function Login({ cliente, onEntrar }: { cliente: ClienteApp; onEntrar: () => void }) {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const { error: fallo } = await cliente.auth.signInWithPassword({ email: correo.trim(), password: clave });
      if (fallo) setError(mensajeDeLogin(fallo));
      else onEntrar();
    } catch {
      setError('No pudimos conectar. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="centrado">
      <form className="tarjeta login" onSubmit={enviar}>
        <p className="etiqueta">Cuervo 360</p>
        <h1>Administración</h1>
        <label htmlFor="correo">Correo electrónico</label>
        <input id="correo" type="email" autoComplete="username" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
        <label htmlFor="clave">Contraseña</label>
        <input id="clave" type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" className="primario" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  );
}
