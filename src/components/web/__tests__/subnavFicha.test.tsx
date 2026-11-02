import { fireEvent, render, screen } from '@testing-library/react-native';

import { SubnavFichaWeb } from '../SubnavFichaWeb';

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
