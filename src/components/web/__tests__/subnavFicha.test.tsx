import { fireEvent, render, screen } from '@testing-library/react-native';

import { SubnavFichaWeb, anclaActiva } from '../SubnavFichaWeb';

// La barra de anclas de la ficha: un enlace por sección, y tocarlo lleva a esa sección (con «reducir movimiento», sin desplazamiento suave).

const anclas = [
  { id: 'ficha-fotos', etiqueta: 'Fotos' },
  { id: 'ficha-zona', etiqueta: 'Dónde estarás' },
];

describe('SubnavFichaWeb', () => {
  const salto = jest.fn();
  const g = globalThis as unknown as Record<string, unknown>;
  const ponerDocumento = (hay: boolean) => {
    g.document = { getElementById: () => (hay ? { scrollIntoView: salto } : null) };
  };
  const ponerMovimiento = (reducir: boolean) => {
    g.window = { matchMedia: () => ({ matches: reducir }) };
  };
  beforeEach(() => salto.mockClear());
  afterEach(() => {
    delete g.document;
    delete g.window;
  });

  it('enseña un enlace por sección', async () => {
    await render(<SubnavFichaWeb anclas={anclas} />);
    expect(screen.getByLabelText('Fotos')).toBeTruthy();
    expect(screen.getByLabelText('Dónde estarás')).toBeTruthy();
  });

  it('tocar uno salta a su sección, suave si no se pidió reducir movimiento', async () => {
    await render(<SubnavFichaWeb anclas={anclas} />);
    ponerDocumento(true);
    ponerMovimiento(false);
    await fireEvent.press(screen.getByLabelText('Dónde estarás'));
    expect(salto).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('con «reducir movimiento» el salto es directo', async () => {
    await render(<SubnavFichaWeb anclas={anclas} />);
    ponerDocumento(true);
    ponerMovimiento(true);
    await fireEvent.press(screen.getByLabelText('Fotos'));
    expect(salto).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('si la sección no existe, no falla', async () => {
    await render(<SubnavFichaWeb anclas={anclas} />);
    ponerDocumento(false);
    ponerMovimiento(false);
    await fireEvent.press(screen.getByLabelText('Fotos'));
    expect(salto).not.toHaveBeenCalled();
  });
});

describe('anclaActiva', () => {
  const sec = (id: string, top: number, bottom: number) => ({ id, top, bottom });
  it('arriba de todo marca la primera', () => {
    expect(anclaActiva([sec('a', 300, 700), sec('b', 800, 1200), sec('c', 1300, 1500)], 900)).toBe('a');
  });
  it('marca la última cuyo borde ya pasó la línea de lectura', () => {
    expect(anclaActiva([sec('a', -600, -100), sec('b', 100, 600), sec('c', 700, 1100)], 900)).toBe('b');
  });
  it('si la última se ve entera (final de página) marca la última, aunque no haya llegado a la línea', () => {
    expect(anclaActiva([sec('a', -900, -400), sec('b', -300, 300), sec('c', 426, 880)], 900)).toBe('c');
  });
  it('una sola sección, o ninguna, no inventa nada', () => {
    expect(anclaActiva([], 900)).toBeNull();
    expect(anclaActiva([sec('a', 500, 800)], 900)).toBe('a');
  });
});
