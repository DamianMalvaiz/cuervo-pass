import { render, screen } from '@testing-library/react-native';

import { TarjetaPublicacion } from '../TarjetaPublicacion';

test('muestra el precio formateado correctamente', async () => {
  await render(<TarjetaPublicacion precio={2800} direccion="San Mateo Atenco" />);
  expect(screen.getByText('$2,800/mes')).toBeTruthy();
});

test('muestra la dirección', async () => {
  await render(<TarjetaPublicacion precio={2800} direccion="San Mateo Atenco" />);
  expect(screen.getByText('San Mateo Atenco')).toBeTruthy();
});
