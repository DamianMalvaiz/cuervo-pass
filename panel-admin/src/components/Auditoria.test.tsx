import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import type { ApiAdmin, EntradaAuditoria } from '../lib/api';
import { ErrorAdmin } from '../lib/errores';
import { Auditoria } from './Auditoria';

const E = (extra: Partial<EntradaAuditoria> = {}): EntradaAuditoria => ({
  accion: 'aprobar_verificacion', admin: 'ana_admin', objetivo_id: 'u1', objetivo: 'vend_t', detalle: 'comerciante', creado_en: '2026-10-22T16:30:00Z', ...extra,
});
const fabricar = (lista: EntradaAuditoria[] | Error) => {
  const api = { auditoria: vi.fn(async () => { if (lista instanceof Error) throw lista; return lista; }) };
  return { api, props: { api: api as unknown as ApiAdmin } };
};

describe('Auditoria', () => {
  test('sin acciones lo dice', async () => {
    render(<Auditoria {...fabricar([]).props} />);
    expect(await screen.findByText('Todavía no hay acciones registradas.')).toBeInTheDocument();
  });

  test('un fallo se dice y se reintenta: nunca «no hay acciones»', async () => {
    const { api, props } = fabricar(new ErrorAdmin('no_disponible'));
    render(<Auditoria {...props} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('no está disponible');
    expect(screen.queryByText('Todavía no hay acciones registradas.')).not.toBeInTheDocument();
    api.auditoria.mockResolvedValueOnce([E()]);
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Aprobó una verificación')).toBeInTheDocument();
  });

  test.each([
    ['aprobar_verificacion', 'Aprobó una verificación'],
    ['rechazar_verificacion', 'Rechazó una verificación'],
    ['ver_documentos', 'Vio documentos de identidad'],
    ['ocultar_resena', 'Ocultó una reseña'],
    ['restaurar_resena', 'Restauró una reseña'],
    ['ocultar_negocio', 'Ocultó un negocio'],
    ['restaurar_negocio', 'Restauró un negocio'],
    ['modo_demo', 'Cambió el modo de demostración'],
    ['borrar_error', 'Borró un error registrado'],
  ])('«%s» se lee como «%s»', async (accion, texto) => {
    render(<Auditoria {...fabricar([E({ accion })]).props} />);
    expect(await screen.findByText(texto)).toBeInTheDocument();
  });

  test('una acción que no conoce se muestra tal cual, no se esconde', async () => {
    render(<Auditoria {...fabricar([E({ accion: 'accion_futura' })]).props} />);
    expect(await screen.findByText('accion_futura')).toBeInTheDocument();
  });

  test('muestra quién actuó, sobre quién, el detalle y la fecha', async () => {
    render(<Auditoria {...fabricar([E({ accion: 'rechazar_verificacion', detalle: 'comerciante: INE ilegible' })]).props} />);
    expect(await screen.findByText('ana_admin')).toBeInTheDocument();
    expect(screen.getByText('vend_t')).toBeInTheDocument();
    expect(screen.getByText('comerciante: INE ilegible')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Acciones del panel' })).toBeInTheDocument();
  });

  test('sin objetivo ni detalle pone una raya, no «null»', async () => {
    const { container } = render(<Auditoria {...fabricar([E({ objetivo_id: null, objetivo: null, detalle: null })]).props} />);
    await screen.findByText('Aprobó una verificación');
    expect(container.textContent).not.toContain('null');
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  test('un texto con HTML se muestra como texto', async () => {
    const { container } = render(<Auditoria {...fabricar([E({ detalle: '<b>x</b>' })]).props} />);
    expect(await screen.findByText('<b>x</b>')).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
  });
});
