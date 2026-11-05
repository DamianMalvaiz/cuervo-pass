import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { GraficaBarras } from './GraficaBarras';

// Una gráfica hecha a mano con SVG (sin librería): se prueba lo que puede mentir — que la altura sea proporcional, que un cero se vea como cero y que
// ninguna cifra salga como NaN.
const barras = (c: HTMLElement) => [...c.querySelectorAll('rect[data-barra]')];
const alto = (r: Element) => Number(r.getAttribute('height'));

describe('GraficaBarras', () => {
  test('una barra por dato, con altura proporcional al valor', () => {
    const { container } = render(<GraficaBarras titulo="Altas" datos={[{ etiqueta: '01 sep', valor: 2 }, { etiqueta: '08 sep', valor: 4 }, { etiqueta: '15 sep', valor: 1 }]} />);
    const b = barras(container);
    expect(b).toHaveLength(3);
    expect(alto(b[1])).toBeGreaterThan(alto(b[0]));
    expect(alto(b[0])).toBeCloseTo(alto(b[1]) / 2, 5);
    expect(alto(b[2])).toBeCloseTo(alto(b[1]) / 4, 5);
  });

  test('todo en cero: sin barras visibles y ningún NaN', () => {
    const { container } = render(<GraficaBarras titulo="Altas" datos={[{ etiqueta: 'a', valor: 0 }, { etiqueta: 'b', valor: 0 }]} />);
    for (const r of barras(container)) expect(alto(r)).toBe(0);
    expect(container.innerHTML).not.toContain('NaN');
  });

  test('un valor pequeño frente a uno grande sigue siendo visible (no se redondea a cero)', () => {
    const { container } = render(<GraficaBarras titulo="Altas" datos={[{ etiqueta: 'a', valor: 1 }, { etiqueta: 'b', valor: 1000 }]} />);
    expect(alto(barras(container)[0])).toBeGreaterThanOrEqual(2);
  });

  test('es accesible: tiene nombre y cada valor aparece como texto', () => {
    render(<GraficaBarras titulo="Altas por semana" datos={[{ etiqueta: '01 sep', valor: 3 }, { etiqueta: '08 sep', valor: 0 }]} />);
    expect(screen.getByRole('img', { name: /Altas por semana/ })).toBeInTheDocument();
    expect(screen.getByText('01 sep')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('sin datos lo dice, no pinta una gráfica vacía', () => {
    render(<GraficaBarras titulo="Altas" datos={[]} />);
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
  });
});
