import { fireEvent, render, screen } from '@testing-library/react-native';

import { Estrellas } from '../Estrellas';
import { SelectorEstrellas } from '../SelectorEstrellas';

describe('Estrellas', () => {
  it('dice la calificación y cuántas reseñas son', async () => {
    await render(<Estrellas calificacion={4.5} numResenas={12} />);
    expect(screen.getByText('4.5')).toBeTruthy();
    expect(screen.getByText('12 reseñas')).toBeTruthy();
  });

  it('la etiqueta accesible lleva el valor y el conteo, no solo «estrellas»', async () => {
    await render(<Estrellas calificacion={4.5} numResenas={12} />);
    expect(screen.getByLabelText('4.5 de 5 estrellas, 12 reseñas')).toBeTruthy();
  });

  it('con una sola reseña lo dice en singular', async () => {
    await render(<Estrellas calificacion={5} numResenas={1} />);
    expect(screen.getByText('1 reseña')).toBeTruthy();
  });

  it('sin reseñas NO inventa una calificación', async () => {
    await render(<Estrellas calificacion={null} numResenas={0} />);
    expect(screen.getByText('Sin reseñas todavía')).toBeTruthy();
    expect(screen.queryByText('0.0')).toBeNull();
  });

  it('un promedio con cero reseñas tampoco se muestra', async () => {
    await render(<Estrellas calificacion={4} numResenas={0} />);
    expect(screen.getByText('Sin reseñas todavía')).toBeTruthy();
  });

  it('compacta: una estrella y «4.5 (12)»; sin reseñas, nada', async () => {
    await render(<Estrellas calificacion={4.5} numResenas={12} compacta />);
    expect(screen.getByText('4.5')).toBeTruthy();
    expect(screen.getByText('(12)')).toBeTruthy();
  });

  it('compacta sin reseñas no pinta nada (una tarjeta no ensucia con «sin reseñas»)', async () => {
    const { toJSON } = await render(<Estrellas calificacion={null} numResenas={0} compacta />);
    expect(toJSON()).toBeNull();
  });
});

describe('SelectorEstrellas', () => {
  it('ofrece las cinco, cada una con su etiqueta', async () => {
    await render(<SelectorEstrellas valor={0} onCambiar={() => {}} />);
    expect(screen.getByLabelText('1 estrella')).toBeTruthy();
    for (const n of [2, 3, 4, 5]) expect(screen.getByLabelText(`${n} estrellas`)).toBeTruthy();
  });

  it('marca la elegida como seleccionada', async () => {
    await render(<SelectorEstrellas valor={3} onCambiar={() => {}} />);
    expect(screen.getByLabelText('3 estrellas').props.accessibilityState?.selected).toBe(true);
    expect(screen.getByLabelText('4 estrellas').props.accessibilityState?.selected).toBe(false);
  });

  it('tocar una estrella la elige', async () => {
    const onCambiar = jest.fn();
    await render(<SelectorEstrellas valor={0} onCambiar={onCambiar} />);
    fireEvent.press(screen.getByLabelText('4 estrellas'));
    expect(onCambiar).toHaveBeenCalledWith(4);
  });
});
