import { render, screen } from '@testing-library/react-native';

// Los esqueletos de carga de la web. Dicen que se está CARGANDO (para el lector de pantalla y para quien mira), reservan el lugar de lo que viene (cuántas tarjetas, del ancho de la tarjeta real) y no afirman nada
// del contenido: son formas, no texto.

import { EsqueletoFilasWeb, EsqueletoTarjetasWeb } from '../EsqueletoWeb';

describe('EsqueletoTarjetasWeb', () => {
  it('se anuncia como carga y reserva tantas tarjetas como se piden', async () => {
    await render(<EsqueletoTarjetasWeb cuantas={4} ancho={260} />);
    expect(screen.getByLabelText('Cargando')).toBeTruthy();
    expect(screen.getAllByTestId('esqueleto-tarjeta')).toHaveLength(4);
  });

  it('cada tarjeta tiene el ancho de la tarjeta real (la rejilla no brinca al llegar los datos)', async () => {
    await render(<EsqueletoTarjetasWeb cuantas={1} ancho={260} />);
    expect(screen.getByTestId('esqueleto-tarjeta').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: 260 })]));
  });
});

describe('EsqueletoFilasWeb', () => {
  it('se anuncia como carga y reserva las filas pedidas', async () => {
    await render(<EsqueletoFilasWeb filas={5} />);
    expect(screen.getByLabelText('Cargando')).toBeTruthy();
    expect(screen.getAllByTestId('esqueleto-fila')).toHaveLength(5);
  });
});
