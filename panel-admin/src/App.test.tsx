import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { App } from './App';
import type { ClienteApp } from './lib/cliente';

// El guard del panel: sin sesión pide login; con sesión pregunta AL SERVIDOR si es admin (el 403 decide, no la pantalla); un fallo de red nunca se
// pinta como cifras en cero.

const RESUMEN = {
  verificaciones_pendientes: 2, resenas_reportadas: 1, resenas_ocultas: 3, negocios_ocultos: 0, cuentas: 106, negocios_activos: 26, modo_demo: false,
};

const DETALLE = {
  altas_por_semana: Array.from({ length: 8 }, (_, i) => ({ semana: `2026-09-${String(i * 7 + 1).padStart(2, '0')}`, cuentas: i })),
  roles_por_estado: [{ rol: 'comerciante', estado: 'aprobado', total: 4 }, { rol: 'arrendador', estado: 'pendiente', total: 2 }],
  publicaciones: { total: 10, activas: 7 },
  negocios: { total: 12, activos: 9 },
  conversaciones: 5,
  mensajes_7d: 31,
};

const VERIFICACION = {
  usuario_id: 'a3b1c2d4-0000-4000-8000-123456789abc', rol: 'comerciante', nombre_usuario: 'ana', nombre_legal: 'Ana Pérez', direccion: 'Calle 1, Toluca',
  enviada_en: '2026-10-20T10:00:00Z', version_aviso: 'v3', fotos_del_lugar: 2, rostro_estado: null,
};

const INGRESOS_VACIOS = {
  por_semana: Array.from({ length: 8 }, (_, i) => ({ semana: `2026-09-${String(i * 7 + 1).padStart(2, '0')}`, mercadopago_centavos: 0, simulado_centavos: 0 })),
  ingresos_30d: { mercadopago_centavos: 0, simulado_centavos: 0, pagos_mercadopago: 0, pagos_simulados: 0 },
  suscripciones: { activas: 0, en_prueba: 0, vencidas: 0, por_vencer_7d: 0 },
  por_plan: [],
  ordenes_30d: { creada: 0, pendiente: 0, pagada: 0, rechazada: 0 },
  ultimos_pagos: [],
};

interface Opciones {
  sesion?: boolean;
  invoke?: ReturnType<typeof vi.fn>;
  login?: ReturnType<typeof vi.fn>;
}

function cliente({ sesion = false, invoke, login }: Opciones = {}) {
  let hay = sesion;
  const salir = vi.fn(async () => { hay = false; return { error: null }; });
  const c = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: hay ? { user: { id: 'u1' } } : null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: login ?? vi.fn(async () => { hay = true; return { data: { session: {} }, error: null }; }),
      signOut: salir,
    },
    functions: { invoke: invoke ?? vi.fn(async (_n: string, o: { body: { accion: string } }) => ({ data: o.body.accion === 'resumen_detalle' ? { detalle: DETALLE } : o.body.accion === 'verificaciones' ? { verificaciones: [VERIFICACION] } : o.body.accion === 'moderacion' ? { moderacion: [] } : o.body.accion === 'auditoria' ? { auditoria: [] } : o.body.accion === 'modo_demo' ? { modo_demo: (o.body as { activo?: boolean }).activo } : o.body.accion === 'ingresos' ? { ingresos: INGRESOS_VACIOS } : o.body.accion === 'salud' ? { salud: { ia: { estado: 'ok', latencia_ms: 50, api_llm_configurada: true, commit: null }, mercadopago: { configurado: true } } } : o.body.accion === 'eventos_pago' ? { eventos_pago: { total_24h: 0, alertas_24h: 0, eventos: [] } } : o.body.accion === 'errores' ? { errores: [] } : { resumen: RESUMEN }, error: null })) },
  };
  return { c: c as unknown as ClienteApp, salir };
}

describe('App', () => {
  test('sin sesión muestra el login y no pregunta nada al servidor', async () => {
    const invoke = vi.fn();
    render(<App cliente={cliente({ invoke }).c} />);
    expect(await screen.findByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  test('mientras lee la sesión, espera', () => {
    render(<App cliente={cliente().c} />);
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  test('con sesión de admin muestra el panel con las cifras del servidor', async () => {
    render(<App cliente={cliente({ sesion: true }).c} />);
    expect(await screen.findByText('Panel de administración')).toBeInTheDocument();
    expect(await screen.findByText('106')).toBeInTheDocument();
  });

  test('entrar con correo y contraseña lleva al panel', async () => {
    const login = vi.fn(async () => ({ data: { session: {} }, error: null }));
    const { c } = cliente({ login });
    render(<App cliente={c} />);
    await userEvent.type(await screen.findByLabelText('Correo electrónico'), 'a@b.mx');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Secreta#123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(login).toHaveBeenCalledWith({ email: 'a@b.mx', password: 'Secreta#123' });
    await waitFor(() => expect(c.functions.invoke).toHaveBeenCalled());
  });

  test('credenciales malas: lo dice en español, sin enseñar el mensaje en inglés', async () => {
    const login = vi.fn(async () => ({ data: { session: null }, error: { message: 'Invalid login credentials', status: 400 } }));
    render(<App cliente={cliente({ login }).c} />);
    await userEvent.type(await screen.findByLabelText('Correo electrónico'), 'a@b.mx');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos');
    expect(screen.queryByText(/Invalid/)).not.toBeInTheDocument();
  });

  test('una cuenta que no es admin (403) ve «Sin acceso», ninguna cifra, y puede salir', async () => {
    const invoke = vi.fn(async () => ({ data: null, error: { context: { status: 403, json: async () => ({ error: 'prohibido' }) } } }));
    const { c, salir } = cliente({ sesion: true, invoke });
    render(<App cliente={c} />);
    expect(await screen.findByText(/No tienes acceso/)).toBeInTheDocument();
    expect(screen.queryByText('106')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(salir).toHaveBeenCalled();
  });

  test('un fallo de red se dice como fallo y ofrece reintentar: nunca cifras en cero', async () => {
    const invoke = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    render(<App cliente={cliente({ sesion: true, invoke }).c} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  test('reintentar vuelve a preguntar y, si ahora responde, muestra el panel', async () => {
    const invoke = vi.fn().mockRejectedValueOnce(new TypeError('x')).mockResolvedValue({ data: { resumen: RESUMEN }, error: null });
    render(<App cliente={cliente({ sesion: true, invoke }).c} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('106')).toBeInTheDocument();
  });

  test('muestra el detalle: gráfica de altas, vendedores por estado y cifras de actividad', async () => {
    render(<App cliente={cliente({ sesion: true }).c} />);
    expect(await screen.findByRole('img', { name: /Altas por semana/ })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /Vendedores por estado/ })).toBeInTheDocument();
    expect(screen.getByText('Mensajes (7 días)')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
    expect(screen.getByText('7 de 10')).toBeInTheDocument();
  });

  test('si el detalle falla pero el resumen no: las cifras básicas siguen, el detalle dice su fallo y se reintenta solo él', async () => {
    let detalleOk = false;
    const invoke = vi.fn(async (_n: string, o: { body: { accion: string } }) => {
      if (o.body.accion === 'resumen') return { data: { resumen: RESUMEN }, error: null };
      if (!detalleOk) throw new TypeError('fetch failed');
      return { data: { detalle: DETALLE }, error: null };
    });
    render(<App cliente={cliente({ sesion: true, invoke }).c} />);
    expect(await screen.findByText('106')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar');
    expect(screen.queryByRole('img', { name: /Altas por semana/ })).not.toBeInTheDocument();
    detalleOk = true;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar detalle' }));
    expect(await screen.findByRole('img', { name: /Altas por semana/ })).toBeInTheDocument();
    expect(screen.getByText('106')).toBeInTheDocument();
  });

  test('el menú lleva a Verificaciones y muestra cuántas hay pendientes', async () => {
    render(<App cliente={cliente({ sesion: true }).c} />);
    const enlace = await screen.findByRole('link', { name: /Verificaciones/ });
    expect(enlace).toHaveTextContent('2');
    await userEvent.click(enlace);
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.queryByText('Panel de administración')).not.toBeInTheDocument();
    window.location.hash = '';
  });

  test.each([
    ['Moderación', 'No hay nada que moderar.'],
    ['Auditoría', 'Todavía no hay acciones registradas.'],
  ])('el menú lleva a «%s»', async (nombre, vacio) => {
    render(<App cliente={cliente({ sesion: true }).c} />);
    await userEvent.click(await screen.findByRole('link', { name: new RegExp(nombre) }));
    expect(await screen.findByText(vacio)).toBeInTheDocument();
  });

  test('las insignias del menú se actualizan al navegar (no se quedan con la cifra de la primera carga)', async () => {
    let pendientes = 2;
    const invoke = vi.fn(async (_n: string, o: { body: { accion: string } }) => {
      if (o.body.accion === 'resumen') return { data: { resumen: { ...RESUMEN, verificaciones_pendientes: pendientes } }, error: null };
      if (o.body.accion === 'resumen_detalle') return { data: { detalle: DETALLE }, error: null };
      return { data: { verificaciones: [], moderacion: [], auditoria: [] }, error: null };
    });
    render(<App cliente={cliente({ sesion: true, invoke }).c} />);
    const enlace = await screen.findByRole('link', { name: /Verificaciones/ });
    expect(enlace).toHaveTextContent('2');
    pendientes = 0;
    await userEvent.click(screen.getByRole('link', { name: /Auditoría/ }));
    await waitFor(() => expect(screen.getByRole('link', { name: /Verificaciones/ })).not.toHaveTextContent('2'));
    expect(screen.getByRole('link', { name: 'Verificaciones' })).toBeInTheDocument();
    // Sin pantalla de «Cargando…» a pantalla completa mientras se refresca: el menú sigue ahí.
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
  });

  test('al volver a «Resumen» las cifras se piden de nuevo, y la primera carga no las pide dos veces', async () => {
    let cuentas = 106;
    const invoke = vi.fn(async (_n: string, o: { body: { accion: string } }) => {
      if (o.body.accion === 'resumen') return { data: { resumen: { ...RESUMEN, cuentas } }, error: null };
      if (o.body.accion === 'resumen_detalle') return { data: { detalle: DETALLE }, error: null };
      return { data: { auditoria: [] }, error: null };
    });
    render(<App cliente={cliente({ sesion: true, invoke }).c} />);
    expect(await screen.findByText('106')).toBeInTheDocument();
    const pedidosAlEntrar = invoke.mock.calls.filter(([, o]) => o.body.accion === 'resumen').length;
    expect(pedidosAlEntrar).toBe(1);
    await userEvent.click(screen.getByRole('link', { name: /Auditoría/ }));
    cuentas = 107;
    await userEvent.click(await screen.findByRole('link', { name: 'Resumen' }));
    expect(await screen.findByText('107')).toBeInTheDocument();
  });

  test('el menú lleva a «Ingresos y planes»', async () => {
    render(<App cliente={cliente({ sesion: true }).c} />);
    await userEvent.click(await screen.findByRole('link', { name: /Ingresos/ }));
    expect(await screen.findByText('Todavía no hay pagos.')).toBeInTheDocument();
  });

  test('el menú lleva a «Salud de la app»', async () => {
    render(<App cliente={cliente({ sesion: true }).c} />);
    await userEvent.click(await screen.findByRole('link', { name: /Salud de la app/ }));
    expect(await screen.findByText('Todavía no hay avisos de pago.')).toBeInTheDocument();
  });

  describe('modo de demostración', () => {
    const llamadasModoDemo = (invoke: ReturnType<typeof vi.fn>) => invoke.mock.calls.filter(([, o]) => o.body.accion === 'modo_demo');
    const clienteConDemo = (encendido: boolean, extra: { fallaModoDemo?: boolean } = {}) => {
      const invoke = vi.fn(async (_n: string, o: { body: { accion: string; activo?: boolean } }) => {
        if (o.body.accion === 'resumen') return { data: { resumen: { ...RESUMEN, modo_demo: encendido } }, error: null };
        if (o.body.accion === 'resumen_detalle') return { data: { detalle: DETALLE }, error: null };
        if (o.body.accion === 'modo_demo') {
          if (extra.fallaModoDemo) return { data: null, error: { context: { status: 403, json: async () => ({ error: 'prohibido' }) } } };
          return { data: { modo_demo: o.body.activo }, error: null };
        }
        return { data: {}, error: null };
      });
      return { invoke, c: cliente({ sesion: true, invoke }).c };
    };

    test('encender pide confirmación y avisa que los pagos de TODAS las cuentas serán simulados', async () => {
      const { invoke, c } = clienteConDemo(false);
      render(<App cliente={c} />);
      expect(await screen.findByText('Apagado')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Encender' }));
      expect(screen.getByText(/Los pagos de TODAS las cuentas serán simulados/)).toBeInTheDocument();
      expect(llamadasModoDemo(invoke)).toHaveLength(0);
      await userEvent.click(screen.getByRole('button', { name: 'Sí, encender' }));
      expect(await screen.findByText('Encendido')).toBeInTheDocument();
      expect(llamadasModoDemo(invoke)).toHaveLength(1);
      expect(llamadasModoDemo(invoke)[0][1].body).toEqual({ accion: 'modo_demo', activo: true });
    });

    test('cancelar no llama al servidor ni cambia nada', async () => {
      const { invoke, c } = clienteConDemo(false);
      render(<App cliente={c} />);
      await userEvent.click(await screen.findByRole('button', { name: 'Encender' }));
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(llamadasModoDemo(invoke)).toHaveLength(0);
      expect(screen.getByText('Apagado')).toBeInTheDocument();
      expect(screen.queryByText(/Los pagos de TODAS/)).not.toBeInTheDocument();
    });

    test('con el modo encendido se ofrece apagarlo, con su propio aviso', async () => {
      const { invoke, c } = clienteConDemo(true);
      render(<App cliente={c} />);
      expect(await screen.findByText('Encendido')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Apagar' }));
      expect(screen.getByText(/Los pagos simulados dejarán de funcionar/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Sí, apagar' }));
      expect(await screen.findByText('Apagado')).toBeInTheDocument();
      expect(llamadasModoDemo(invoke)[0][1].body).toEqual({ accion: 'modo_demo', activo: false });
    });

    test('si el servidor lo rechaza lo dice y NO cambia el estado mostrado', async () => {
      const { c } = clienteConDemo(false, { fallaModoDemo: true });
      render(<App cliente={c} />);
      await userEvent.click(await screen.findByRole('button', { name: 'Encender' }));
      await userEvent.click(screen.getByRole('button', { name: 'Sí, encender' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('no tiene permiso');
      expect(screen.getByText('Apagado')).toBeInTheDocument();
    });
  });
});
