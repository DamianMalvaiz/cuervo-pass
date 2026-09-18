import { render, screen } from '@testing-library/react-native';

import { TarjetaPublicacion } from '../TarjetaPublicacion';

test('muestra el precio formateado correctamente', async () => {
  await render(<TarjetaPublicacion titulo="Depa cerca del campus" precio={2800} direccion="San Mateo Atenco" />);
  expect(screen.getByText('$2,800/mes')).toBeTruthy();
});

test('muestra el título y la dirección', async () => {
  await render(<TarjetaPublicacion titulo="Depa cerca del campus" precio={2800} direccion="San Mateo Atenco" />);
  expect(screen.getByText('Depa cerca del campus')).toBeTruthy();
  expect(screen.getByText('San Mateo Atenco')).toBeTruthy();
});

// §17: el geocoding pudo fallar y la publicación se muestra igual, sin
// distancia. Antes se usaba `distanciaKm !== undefined`, que pintaba "0.0 km"
// cuando la función de Postgres devolvía null.
test('omite la distancia cuando la publicación no tiene coordenadas', async () => {
  await render(
    <TarjetaPublicacion titulo="Depa" precio={2800} direccion="San Mateo Atenco" distanciaKm={null} />
  );
  expect(screen.queryByText(/km de la universidad/)).toBeNull();
});
