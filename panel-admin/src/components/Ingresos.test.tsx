import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import type { ApiAdmin, IngresosAdmin } from '../lib/api';
import { ErrorAdmin } from '../lib/errores';
import { Ingresos } from './Ingresos';

const BASE: IngresosAdmin = {
  por_semana: Array.from({ length: 8 }, (_, i) => ({ semana: `2026-09-${String(i * 7 + 1).padStart(2, '0')}`, mercadopago_centavos: i === 7 ? 19800 : 0, simulado_centavos: 0 })),
  ingresos_30d: { mercadopago_centavos: 19800, simulado_centavos: 19900, pagos_mercadopago: 2, pagos_simulados: 1 },
  suscripciones: { activas: 3, en_prueba: 4, vencidas: 1, por_vencer_7d: 2 },
  por_plan: [
    { plan_id: 'comerciante_basico', nombre: 'Básico', rol: 'comerciante', activas: 2, mercadopago_30d_centavos: 19800, simulado_30d_centavos: 0 },
    { plan_id: 'arrendador_plus', nombre: 'Plus', rol: 'arrendador', activas: 1, mercadopago_30d_centavos: 0, simulado_30d_centavos: 9900 },
  ],
  ordenes_30d: { creada: 1, pendiente: 1, pagada: 2, rechazada: 0 },
  ultimos_pagos: [
    { creado_en: '2026-10-22T16:00:00Z', origen: 'mercadopago', plan: 'Básico', monto_centavos: 9900, usuario: 'vend_t' },
    { creado_en: '2026-10-12T16:00:00Z', origen: 'simulado', plan: 'Destacado', monto_centavos: 19900, usuario: null },
  ],
};

function fabricar(datos: IngresosAdmin | Error = BASE) {
  const api = { ingresos: vi.fn(async () => { if (datos instanceof Error) throw datos; return datos; }) };
  return { api, props: { api: api as unknown as ApiAdmin } };
}

describe('Ingresos', () => {
  test('el dinero de Mercado Pago y lo simulado salen SEPARADOS, y lo simulado dice que no es dinero', async () => {
    render(<Ingresos {...fabricar().props} />);
    const real = (await screen.findByText('Mercado Pago · 30 días')).closest('article')!;
    expect(within(real).getByText('$198.00')).toBeInTheDocument();
    expect(within(real).getByText('2 pagos')).toBeInTheDocument();
    const sim = screen.getByText('Simulados · 30 días').closest('article')!;
    expect(within(sim).getByText('$199.00')).toBeInTheDocument();
    expect(within(sim).getByText(/no es dinero/)).toBeInTheDocument();
    expect(screen.queryByText('$397.00')).not.toBeInTheDocument();
  });

  test('suscripciones: activas, en prueba, por vencer y vencidas', async () => {
    render(<Ingresos {...fabricar().props} />);
    for (const [titulo, valor] of [['Activas', '3'], ['En prueba', '4'], ['Por vencer (7 días)', '2'], ['Vencidas', '1']]) {
      const t = (await screen.findByText(titulo)).closest('article')!;
      expect(within(t).getByText(valor)).toBeInTheDocument();
    }
  });

  test('la gráfica semanal es de lo cobrado por Mercado Pago', async () => {
    render(<Ingresos {...fabricar().props} />);
    expect(await screen.findByRole('img', { name: /Cobrado por semana \(Mercado Pago\)/ })).toBeInTheDocument();
  });

  test('por plan: nombre, función, activas y dinero real y simulado en columnas distintas', async () => {
    render(<Ingresos {...fabricar().props} />);
    const tabla = await screen.findByRole('table', { name: 'Ingresos por plan' });
    const fila = within(tabla).getByText('Básico').closest('tr')!;
    expect(within(fila).getByText('comerciante')).toBeInTheDocument();
    expect(within(fila).getByText('$198.00')).toBeInTheDocument();
    const plus = within(tabla).getByText('Plus').closest('tr')!;
    expect(within(plus).getByText('$99.00')).toBeInTheDocument();
  });

  test('embudo de órdenes: cuenta cada estado y calcula la conversión (pagadas entre el total de órdenes)', async () => {
    render(<Ingresos {...fabricar().props} />);
    const e = (await screen.findByText('Conversión de órdenes')).closest('article')!;
    for (const [estado, n] of [['Creadas', '1'], ['Pendientes', '1'], ['Pagadas', '2'], ['Rechazadas', '0']]) {
      expect(within(e).getByText(estado).parentElement).toHaveTextContent(n);
    }
    expect(within(e).getByText('50 %')).toBeInTheDocument(); // 2 pagadas de 4 órdenes
  });

  test('sin órdenes la conversión es una raya, no 0 % ni NaN', async () => {
    render(<Ingresos {...fabricar({ ...BASE, ordenes_30d: { creada: 0, pendiente: 0, pagada: 0, rechazada: 0 } }).props} />);
    const e = (await screen.findByText('Conversión de órdenes')).closest('article')!;
    expect(within(e).getByText('—')).toBeInTheDocument();
    expect(e.textContent).not.toContain('NaN');
  });

  test('últimos pagos: origen legible, monto y usuario (raya si no hay)', async () => {
    render(<Ingresos {...fabricar().props} />);
    const tabla = await screen.findByRole('table', { name: 'Últimos pagos' });
    expect(within(tabla).getByText('Mercado Pago')).toBeInTheDocument();
    expect(within(tabla).getByText('Simulado')).toBeInTheDocument();
    expect(within(tabla).getByText('vend_t')).toBeInTheDocument();
    expect(within(tabla).getByText('—')).toBeInTheDocument();
  });

  test('sin pagos lo dice', async () => {
    render(<Ingresos {...fabricar({ ...BASE, ultimos_pagos: [] }).props} />);
    expect(await screen.findByText('Todavía no hay pagos.')).toBeInTheDocument();
  });

  test('un fallo se dice y se reintenta: nunca ceros', async () => {
    const { api, props } = fabricar(new ErrorAdmin('red'));
    render(<Ingresos {...props} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar');
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    api.ingresos.mockResolvedValueOnce(BASE);
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Mercado Pago · 30 días')).toBeInTheDocument();
  });
});
