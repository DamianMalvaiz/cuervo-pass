import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import type { ApiAdmin, ErrorRegistrado, EventosPagoAdmin, SaludAdmin } from '../lib/api';
import { ErrorAdmin } from '../lib/errores';
import { Salud } from './Salud';

const SALUD: SaludAdmin = { ia: { estado: 'ok', latencia_ms: 120, api_llm_configurada: true, commit: 'a3b1c2d' }, mercadopago: { configurado: true } };
const EVENTOS: EventosPagoAdmin = {
  total_24h: 3, alertas_24h: 1,
  eventos: [
    { recibido_en: '2026-10-23T16:00:00Z', etiqueta: 'activado', nivel: 'info', status: 200, pago_id: '123456' },
    { recibido_en: '2026-10-23T15:00:00Z', etiqueta: 'credencial-rechazada', nivel: 'alerta', status: 500, pago_id: null },
    { recibido_en: '2026-10-23T14:00:00Z', etiqueta: 'etiqueta-futura', nivel: 'info', status: 200, pago_id: null },
  ],
};
const ERR: ErrorRegistrado = { id: 'e1', nivel: 'error', mensaje: 'TypeError: x is undefined', detalle: 'en inicio.tsx', version_app: 'v1.2', plataforma: 'android', conteo: 4, primera_vez: '2026-10-20T10:00:00Z', ultima_vez: '2026-10-23T10:00:00Z' };

function fabricar(over: { salud?: SaludAdmin | Error; eventos?: EventosPagoAdmin | Error; errores?: ErrorRegistrado[] | Error } = {}) {
  const v = (x: unknown) => async () => { if (x instanceof Error) throw x; return x; };
  const api = {
    salud: vi.fn(v(over.salud ?? SALUD)),
    eventosPago: vi.fn(v(over.eventos ?? EVENTOS)),
    errores: vi.fn(v(over.errores ?? [ERR])),
    borrarError: vi.fn(async () => undefined),
  };
  return { api, props: { api: api as unknown as ApiAdmin } };
}

describe('Salud · servicios', () => {
  test.each([
    ['ok', 'Funcionando'],
    ['cargando', 'Cargando el modelo'],
    ['caido', 'No responde'],
    ['sin_configurar', 'Sin configurar'],
  ] as const)('el servicio de IA «%s» se lee «%s»', async (estado, texto) => {
    render(<Salud {...fabricar({ salud: { ...SALUD, ia: { ...SALUD.ia, estado } } }).props} />);
    const t = (await screen.findByText('Servicio de IA')).closest('article')!;
    expect(within(t).getByText(texto)).toBeInTheDocument();
  });

  test('con la IA funcionando enseña latencia, versión y si la API del LLM está puesta', async () => {
    render(<Salud {...fabricar().props} />);
    const t = (await screen.findByText('Servicio de IA')).closest('article')!;
    expect(within(t).getByText(/120 ms/)).toBeInTheDocument();
    expect(within(t).getByText(/a3b1c2d/)).toBeInTheDocument();
    expect(within(t).getByText(/API del LLM: configurada/)).toBeInTheDocument();
  });

  test('Mercado Pago: dice si las credenciales están puestas, nunca su valor', async () => {
    render(<Salud {...fabricar().props} />);
    const t = (await screen.findByText('Mercado Pago')).closest('article')!;
    expect(within(t).getByText('Credenciales puestas')).toBeInTheDocument();
  });

  test('si faltan las credenciales de Mercado Pago lo dice como problema', async () => {
    render(<Salud {...fabricar({ salud: { ...SALUD, mercadopago: { configurado: false } } }).props} />);
    const t = (await screen.findByText('Mercado Pago')).closest('article')!;
    expect(within(t).getByText('Faltan credenciales')).toBeInTheDocument();
  });

  test('si no se puede medir la salud lo dice y se reintenta: nunca «todo bien»', async () => {
    const { api, props } = fabricar({ salud: new ErrorAdmin('red') });
    render(<Salud {...props} />);
    const aviso = await screen.findByText(/No pudimos conectar/);
    expect(aviso.closest('[role=alert]')).not.toBeNull();
    expect(screen.queryByText('Funcionando')).not.toBeInTheDocument();
    api.salud.mockResolvedValueOnce(SALUD);
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar servicios' }));
    expect(await screen.findByText('Funcionando')).toBeInTheDocument();
  });
});

describe('Salud · avisos de pago', () => {
  test('resumen de 24 horas y tabla con etiquetas legibles', async () => {
    render(<Salud {...fabricar().props} />);
    const tabla = await screen.findByRole('table', { name: 'Avisos de pago' });
    expect(within(tabla).getByText('Plan activado')).toBeInTheDocument();
    expect(within(tabla).getByText('Mercado Pago rechazó el token')).toBeInTheDocument();
    expect(within(tabla).getByText('123456')).toBeInTheDocument();
    expect(screen.getByText(/3 avisos en 24 horas · 1 alerta/)).toBeInTheDocument();
  });

  test('una etiqueta que no conoce se muestra tal cual, no se esconde', async () => {
    render(<Salud {...fabricar().props} />);
    expect(await screen.findByText('etiqueta-futura')).toBeInTheDocument();
  });

  test('una alerta se distingue de un aviso normal', async () => {
    render(<Salud {...fabricar().props} />);
    const tabla = await screen.findByRole('table', { name: 'Avisos de pago' });
    const fila = within(tabla).getByText('Mercado Pago rechazó el token').closest('tr')!;
    expect(within(fila).getByText('Alerta')).toBeInTheDocument();
  });

  test('sin avisos lo dice', async () => {
    render(<Salud {...fabricar({ eventos: { total_24h: 0, alertas_24h: 0, eventos: [] } }).props} />);
    expect(await screen.findByText('Todavía no hay avisos de pago.')).toBeInTheDocument();
  });

  test('si fallan, el resto de Salud sigue ahí (los bloques son independientes)', async () => {
    const { props } = fabricar({ eventos: new ErrorAdmin('no_disponible') });
    render(<Salud {...props} />);
    expect(await screen.findByText('Funcionando')).toBeInTheDocument();
    expect(await screen.findByText(/no está disponible/)).toBeInTheDocument();
    expect(screen.getByText('TypeError: x is undefined')).toBeInTheDocument();
  });
});

describe('Salud · errores de la app', () => {
  test('cada grupo dice el problema, cuántas veces, en qué versión y plataforma', async () => {
    render(<Salud {...fabricar().props} />);
    const t = (await screen.findByText('TypeError: x is undefined')).closest('article')!;
    expect(within(t).getByText('Error')).toBeInTheDocument();
    expect(within(t).getByText(/4 veces/)).toBeInTheDocument();
    expect(within(t).getByText(/v1\.2 · android/)).toBeInTheDocument();
    expect(within(t).getByText('en inicio.tsx')).toBeInTheDocument();
  });

  test('sin errores lo dice; un fallo NO se pinta como «sin errores»', async () => {
    render(<Salud {...fabricar({ errores: [] }).props} />);
    expect(await screen.findByText('No hay errores registrados esta semana.')).toBeInTheDocument();
  });

  test('si la lista de errores falla, no dice «sin errores»', async () => {
    render(<Salud {...fabricar({ errores: new ErrorAdmin('red') }).props} />);
    expect(await screen.findByRole('button', { name: 'Reintentar errores' })).toBeInTheDocument();
    expect(screen.queryByText('No hay errores registrados esta semana.')).not.toBeInTheDocument();
  });

  test('el texto de un error es TEXTO, nunca HTML', async () => {
    const malo = { ...ERR, mensaje: '<img src=x onerror=alert(1)>' };
    const { container } = render(<Salud {...fabricar({ errores: [malo] }).props} />);
    expect(await screen.findByText(/<img src=x/)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  test('borrar pide confirmación, manda el id y recarga la lista', async () => {
    const { api, props } = fabricar();
    render(<Salud {...props} />);
    const t = (await screen.findByText('TypeError: x is undefined')).closest('article')!;
    await userEvent.click(within(t).getByRole('button', { name: 'Borrar' }));
    expect(within(t).getByText(/Si vuelve a pasar, nacerá uno nuevo/)).toBeInTheDocument();
    expect(api.borrarError).not.toHaveBeenCalled();
    await userEvent.click(within(t).getByRole('button', { name: 'Sí, borrar' }));
    expect(api.borrarError).toHaveBeenCalledWith('e1');
    await waitFor(() => expect(api.errores).toHaveBeenCalledTimes(2));
  });

  test('un fallo al borrar deja el grupo y lo dice', async () => {
    const { api, props } = fabricar();
    api.borrarError.mockRejectedValueOnce(new ErrorAdmin('no_existe'));
    render(<Salud {...props} />);
    const t = (await screen.findByText('TypeError: x is undefined')).closest('article')!;
    await userEvent.click(within(t).getByRole('button', { name: 'Borrar' }));
    await userEvent.click(within(t).getByRole('button', { name: 'Sí, borrar' }));
    expect(await within(t).findByRole('alert')).toHaveTextContent('ya no existe');
  });
});
