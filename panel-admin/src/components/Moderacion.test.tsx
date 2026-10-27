import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import type { ApiAdmin, ItemModeracion } from '../lib/api';
import { ErrorAdmin } from '../lib/errores';
import { Moderacion } from './Moderacion';

const RESENA: ItemModeracion = { tipo: 'resena', id: 'c1', titulo: 'Tacos El Güero · 1 estrellas', texto: 'Mala atención', autor: 'eva', reportes: 2, oculto: false, creado_en: '2026-10-21T10:00:00Z' };
const NEGOCIO: ItemModeracion = { tipo: 'negocio', id: 'n1', titulo: 'Taller Pepe', texto: null, autor: 'pepe', reportes: 0, oculto: true, creado_en: '2026-10-20T10:00:00Z' };

function fabricar(lista: ItemModeracion[] | Error = [RESENA, NEGOCIO]) {
  const api = {
    moderacion: vi.fn(async () => { if (lista instanceof Error) throw lista; return lista; }),
    moderar: vi.fn(async () => undefined),
  };
  return { api, props: { api: api as unknown as ApiAdmin } };
}
const tarjetaDe = async (titulo: string) => (await screen.findByText(titulo)).closest('article')!;

describe('Moderacion', () => {
  test('sin nada que moderar lo dice', async () => {
    render(<Moderacion {...fabricar([]).props} />);
    expect(await screen.findByText('No hay nada que moderar.')).toBeInTheDocument();
  });

  test('un fallo NO se pinta como «no hay nada que moderar»: se dice y se reintenta', async () => {
    const { api, props } = fabricar(new ErrorAdmin('red'));
    render(<Moderacion {...props} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar');
    expect(screen.queryByText('No hay nada que moderar.')).not.toBeInTheDocument();
    api.moderacion.mockResolvedValueOnce([RESENA]);
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Tacos El Güero · 1 estrellas')).toBeInTheDocument();
  });

  test('cada elemento dice qué es, quién lo escribió, cuántos reportes y si está oculto', async () => {
    render(<Moderacion {...fabricar().props} />);
    const r = await tarjetaDe('Tacos El Güero · 1 estrellas');
    expect(within(r).getByText('Reseña')).toBeInTheDocument();
    expect(within(r).getByText(/de eva · 2 reportes/)).toBeInTheDocument();
    expect(within(r).getByText('Visible')).toBeInTheDocument();
    const n = await tarjetaDe('Taller Pepe');
    expect(within(n).getByText('Negocio')).toBeInTheDocument();
    expect(within(n).getByText('Oculto')).toBeInTheDocument();
  });

  test('el texto de otra persona se muestra como TEXTO, nunca como HTML', async () => {
    const malo = { ...RESENA, texto: '<img src=x onerror=alert(1)><b>negrita</b>' };
    const { container } = render(<Moderacion {...fabricar([malo]).props} />);
    expect(await screen.findByText(/<img src=x/)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });

  test('ocultar exige un motivo de al menos 3 letras y no llama sin él', async () => {
    const { api, props } = fabricar();
    render(<Moderacion {...props} />);
    const r = await tarjetaDe('Tacos El Güero · 1 estrellas');
    await userEvent.click(within(r).getByRole('button', { name: 'Ocultar' }));
    await userEvent.type(within(r).getByLabelText('Motivo'), 'ab');
    await userEvent.click(within(r).getByRole('button', { name: 'Confirmar ocultar' }));
    expect(await within(r).findByRole('alert')).toHaveTextContent('Escribe un motivo');
    expect(api.moderar).not.toHaveBeenCalled();
  });

  test('ocultar con motivo lo manda recortado y actualiza la lista', async () => {
    const { api, props } = fabricar();
    render(<Moderacion {...props} />);
    const r = await tarjetaDe('Tacos El Güero · 1 estrellas');
    await userEvent.click(within(r).getByRole('button', { name: 'Ocultar' }));
    await userEvent.type(within(r).getByLabelText('Motivo'), '  Insultos  ');
    await userEvent.click(within(r).getByRole('button', { name: 'Confirmar ocultar' }));
    expect(api.moderar).toHaveBeenCalledWith('resena', 'c1', true, 'Insultos');
    await waitFor(() => expect(api.moderacion).toHaveBeenCalledTimes(2));
  });

  test('restaurar pide confirmación, no pide motivo y manda ocultar=false', async () => {
    const { api, props } = fabricar();
    render(<Moderacion {...props} />);
    const n = await tarjetaDe('Taller Pepe');
    await userEvent.click(within(n).getByRole('button', { name: 'Restaurar' }));
    expect(within(n).getByText(/Volverá a verse/)).toBeInTheDocument();
    expect(api.moderar).not.toHaveBeenCalled();
    await userEvent.click(within(n).getByRole('button', { name: 'Sí, restaurar' }));
    expect(api.moderar).toHaveBeenCalledWith('negocio', 'n1', false, null);
  });

  test('un fallo al moderar deja la tarjeta y lo dice', async () => {
    const { api, props } = fabricar();
    api.moderar.mockRejectedValueOnce(new ErrorAdmin('no_existe'));
    render(<Moderacion {...props} />);
    const n = await tarjetaDe('Taller Pepe');
    await userEvent.click(within(n).getByRole('button', { name: 'Restaurar' }));
    await userEvent.click(within(n).getByRole('button', { name: 'Sí, restaurar' }));
    expect(await within(n).findByRole('alert')).toHaveTextContent('ya no existe');
  });
});
