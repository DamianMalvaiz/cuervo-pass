import { fireEvent, render, screen } from '@testing-library/react-native';

// «Vistos recientemente»: sin vistos no ocupa lugar; con vistos enseña esas fichas en ese orden; si la lectura falla lo dice; «Borrar» lo vacía.

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const mockEstado = { crudo: '', fallo: false, cargando: false };
const mockOyentes = new Set<() => void>();
jest.mock('@/lib/vistos', () => {
  const real = jest.requireActual('@/lib/vistos');
  return {
    ...real,
    vistosCrudos: () => mockEstado.crudo,
    suscribirVistos: (f: () => void) => {
      mockOyentes.add(f);
      return () => mockOyentes.delete(f);
    },
    borrarVistos: () => {
      mockEstado.crudo = '';
      mockOyentes.forEach((f) => f());
    },
  };
});
jest.mock('@/hooks/queries/useExplorar', () => ({
  usePublicacionesPorIds: (ids: string[]) => ({
    publicaciones: mockEstado.fallo ? [] : ids.map((i) => ({ id: i, titulo_publico: `Lugar ${i.slice(-2)}`, tipo: 'cuarto', precio_renta: 3000, zona: 'Lerma, Edomex', num_fotos: 0 })),
    cargando: mockEstado.cargando,
    fallo: mockEstado.fallo,
    reintentar: jest.fn(),
  }),
}));
jest.mock('@/components/web/TarjetaPublicacionWeb', () => {
  const { Text } = require('react-native');
  return { TarjetaPublicacionWeb: ({ p }: { p: { titulo_publico: string } }) => <Text>{p.titulo_publico}</Text> };
});

import { VistosRecientesWeb } from '../VistosRecientesWeb';

const montar = () => render(<VistosRecientesWeb columnas={4} anchoTarjeta={200} compacta={false} />);
beforeEach(() => Object.assign(mockEstado, { crudo: '', fallo: false, cargando: false }));

it('sin vistos no pinta nada', async () => {
  await montar();
  expect(screen.queryByText('Vistos recientemente')).toBeNull();
});

it('con vistos enseña esas fichas, la más reciente primero', async () => {
  mockEstado.crudo = JSON.stringify([id(2), id(1)]);
  await montar();
  expect(screen.getByText('Vistos recientemente')).toBeTruthy();
  const titulos = screen.getAllByText(/^Lugar /).map((n) => n.props.children);
  expect(titulos).toEqual(['Lugar 02', 'Lugar 01']);
});

it('si la lectura falla, lo dice y no esconde el bloque', async () => {
  mockEstado.crudo = JSON.stringify([id(1)]);
  mockEstado.fallo = true;
  await montar();
  expect(screen.getByText('No pudimos cargar lo que viste')).toBeTruthy();
});

it('«Borrar» vacía el bloque', async () => {
  mockEstado.crudo = JSON.stringify([id(1)]);
  await montar();
  await fireEvent.press(screen.getByLabelText('Borrar vistos recientemente'));
  expect(screen.queryByText('Vistos recientemente')).toBeNull();
});
