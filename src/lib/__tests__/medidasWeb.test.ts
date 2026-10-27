import { HUECO_WEB, medidasWeb } from '../medidasWeb';

// Las medidas de la web pública según el ancho de la ventana: cuántas columnas caben, cuánto mide cada tarjeta y qué relleno queda a los lados. Auto-ajustable de un teléfono a un monitor muy ancho.

describe('columnas', () => {
  it.each([
    [320, 1],
    [479, 1],
    [480, 2],
    [699, 2],
    [700, 3],
    [999, 3],
    [1000, 4],
    [1359, 4],
    [1360, 5],
    [2560, 5],
  ])('con %i px caben %i columnas', (ancho, columnas) => {
    expect(medidasWeb(ancho).columnas).toBe(columnas);
  });
});

describe('escritorio y relleno', () => {
  it('escritorio desde 1000 px; antes, diseño angosto', () => {
    expect(medidasWeb(999).escritorio).toBe(false);
    expect(medidasWeb(1000).escritorio).toBe(true);
  });

  it('el relleno de los lados es menor en un teléfono', () => {
    expect(medidasWeb(390).relleno).toBeLessThan(medidasWeb(1280).relleno);
  });
});

describe('las tarjetas llenan el ancho disponible sin pasarse', () => {
  it.each([390, 560, 800, 1280, 1920, 2560])('con %i px, las columnas caben en una fila', (ancho) => {
    const m = medidasWeb(ancho);
    const usado = m.anchoTarjeta * m.columnas + HUECO_WEB * (m.columnas - 1);
    expect(usado).toBeLessThanOrEqual(m.interior);
    // y no sobra más que el redondeo de cada tarjeta
    expect(m.interior - usado).toBeLessThan(m.columnas);
  });

  it('el contenido no pasa del ancho máximo aunque la ventana sea enorme', () => {
    expect(medidasWeb(3840).interior).toBe(medidasWeb(2560).interior);
  });

  it('el mosaico de negocios son cuatro celdas de ancho (la grande ocupa dos)', () => {
    const m = medidasWeb(1920);
    expect(m.anchoMosaico * 4 + HUECO_WEB * 3).toBeLessThanOrEqual(m.interior);
    expect(m.interior - (m.anchoMosaico * 4 + HUECO_WEB * 3)).toBeLessThan(4);
  });

  it('en pantalla angosta el mosaico usa el ancho de la tarjeta', () => {
    const m = medidasWeb(390);
    expect(m.anchoMosaico).toBe(m.anchoTarjeta);
  });
});
