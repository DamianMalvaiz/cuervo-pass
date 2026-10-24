import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import type { ApiAdmin, VerificacionPendiente } from '../lib/api';
import { ErrorAdmin } from '../lib/errores';
import { Verificaciones } from './Verificaciones';

const V: VerificacionPendiente = {
  usuario_id: 'a3b1c2d4-0000-4000-8000-123456789abc', rol: 'comerciante', nombre_usuario: 'ana', nombre_legal: 'Ana Pérez', direccion: 'Calle 1, Toluca',
  enviada_en: '2026-10-20T10:00:00Z', version_aviso: 'v3', fotos_del_lugar: 2, rostro_estado: 'coincide',
};

function fabricar(lista: VerificacionPendiente[] | Error = [V]) {
  const api = {
    verificaciones: vi.fn(async () => { if (lista instanceof Error) throw lista; return lista; }),
    documentos: vi.fn(async () => [{ etiqueta: 'INE (frente)', url: 'https://x.supabase.co/ine' }, { etiqueta: 'Foto 2', url: null }]),
    resolver: vi.fn(async () => undefined),
  };
  return { api, props: { api: api as unknown as ApiAdmin } };
}

describe('Verificaciones', () => {
  test('sin pendientes lo dice', async () => {
    render(<Verificaciones {...fabricar([]).props} />);
    expect(await screen.findByText('No hay verificaciones pendientes.')).toBeInTheDocument();
  });

  test('un fallo NO se pinta como «no hay pendientes»: se dice y se puede reintentar', async () => {
    const { api, props } = fabricar(new ErrorAdmin('red'));
    render(<Verificaciones {...props} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar');
    expect(screen.queryByText('No hay verificaciones pendientes.')).not.toBeInTheDocument();
    api.verificaciones.mockResolvedValueOnce([V]);
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
  });

  test('cada tarjeta enseña quién, qué función, dónde, cuántas fotos y la lectura del rostro como ayuda', async () => {
    render(<Verificaciones {...fabricar().props} />);
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText(/@ana · comerciante/)).toBeInTheDocument();
    expect(screen.getByText('Calle 1, Toluca')).toBeInTheDocument();
    expect(screen.getByText(/2 fotos del lugar/)).toBeInTheDocument();
    expect(screen.getByText(/Es una ayuda, no una decisión/)).toBeInTheDocument();
  });

  test('ver documentos pide confirmación (queda registrado) y no llama antes de confirmar', async () => {
    const { api, props } = fabricar();
    render(<Verificaciones {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ver documentos' }));
    expect(screen.getByText(/Quedará registrado que los viste/)).toBeInTheDocument();
    expect(api.documentos).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Ver' }));
    expect(api.documentos).toHaveBeenCalledWith(V.usuario_id, 'comerciante');
    expect(await screen.findByRole('img', { name: 'INE (frente)' })).toHaveAttribute('src', 'https://x.supabase.co/ine');
    expect(screen.getByText('(no disponible)')).toBeInTheDocument();
    expect(screen.getByText(/caducan a los 10 minutos/)).toBeInTheDocument();
  });

  test('cancelar la confirmación no pide nada', async () => {
    const { api, props } = fabricar();
    render(<Verificaciones {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ver documentos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.documentos).not.toHaveBeenCalled();
    expect(screen.queryByText(/Quedará registrado/)).not.toBeInTheDocument();
  });

  test('si los documentos fallan lo dice en la tarjeta', async () => {
    const { api, props } = fabricar();
    api.documentos.mockRejectedValueOnce(new ErrorAdmin('no_disponible'));
    render(<Verificaciones {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ver documentos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ver' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no está disponible');
  });

  test('aprobar pide confirmación, manda la decisión y retira la tarjeta', async () => {
    const { api, props } = fabricar();
    render(<Verificaciones {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    expect(screen.getByText(/Empieza su prueba gratis de 15 días/)).toBeInTheDocument();
    expect(api.resolver).not.toHaveBeenCalled();
    api.verificaciones.mockResolvedValue([]);
    await userEvent.click(screen.getByRole('button', { name: 'Sí, aprobar' }));
    expect(api.resolver).toHaveBeenCalledWith(V.usuario_id, 'comerciante', true, null);
    expect(await screen.findByText('No hay verificaciones pendientes.')).toBeInTheDocument();
  });

  test('rechazar exige un motivo de al menos 3 letras y no llama sin él', async () => {
    const { api, props } = fabricar();
    render(<Verificaciones {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    await userEvent.type(screen.getByLabelText('Motivo del rechazo'), 'ab');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe un motivo');
    expect(api.resolver).not.toHaveBeenCalled();
  });

  test('rechazar con motivo lo manda recortado', async () => {
    const { api, props } = fabricar();
    render(<Verificaciones {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    await userEvent.type(screen.getByLabelText('Motivo del rechazo'), '  INE ilegible  ');
    api.verificaciones.mockResolvedValue([]);
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));
    expect(api.resolver).toHaveBeenCalledWith(V.usuario_id, 'comerciante', false, 'INE ilegible');
  });

  test('si otra persona ya la resolvió (no_pendiente) lo dice y actualiza la lista', async () => {
    const { api, props } = fabricar();
    api.resolver.mockRejectedValueOnce(new ErrorAdmin('no_pendiente'));
    render(<Verificaciones {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    api.verificaciones.mockResolvedValue([]);
    await userEvent.click(screen.getByRole('button', { name: 'Sí, aprobar' }));
    await waitFor(() => expect(api.verificaciones).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('No hay verificaciones pendientes.')).toBeInTheDocument();
  });

  test('un fallo al decidir deja la tarjeta y lo dice', async () => {
    const { api, props } = fabricar();
    api.resolver.mockRejectedValueOnce(new ErrorAdmin('red'));
    render(<Verificaciones {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sí, aprobar' }));
    const tarjeta = (await screen.findByText('Ana Pérez')).closest('article')!;
    expect(await within(tarjeta).findByRole('alert')).toHaveTextContent('No pudimos conectar');
  });
});
