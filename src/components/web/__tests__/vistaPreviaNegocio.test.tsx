import { fireEvent, render, screen } from '@testing-library/react-native';

// La vista previa del negocio: la MISMA tarjeta que verán los estudiantes; no es un negocio real (no navega, no se guarda) y no inventa lo que no sabe.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/queries/useExplorar', () => ({ useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }) }));

import { VistaPreviaNegocioWeb } from '../VistaPreviaNegocioWeb';

beforeEach(() => jest.clearAllMocks());

it('enseña el nombre y la zona (la dirección SIN su primer tramo)', async () => {
  await render(<VistaPreviaNegocioWeb v={{ nombre: 'Café La Parada', direccion: 'Calle Hidalgo 12, Centro, Lerma, México' }} />);
  expect(screen.getByText('Café La Parada')).toBeTruthy();
  expect(screen.getByText('Centro, Lerma')).toBeTruthy();
  // La calle y el número no se enseñan a quien solo explora.
  expect(screen.queryByText(/Hidalgo/)).toBeNull();
});

it('sin datos no inventa: «Tu negocio», sin zona', async () => {
  await render(<VistaPreviaNegocioWeb v={null} />);
  expect(screen.getByText('Tu negocio')).toBeTruthy();
});

it('una dirección sin comas no tiene zona que decir (no enseña la calle)', async () => {
  await render(<VistaPreviaNegocioWeb v={{ nombre: 'Tacos', direccion: 'Calle Hidalgo 12' }} />);
  expect(screen.queryByText(/Hidalgo/)).toBeNull();
});

it('no es un negocio real: no navega, no se guarda y no dice «Abierto ahora»', async () => {
  await render(<VistaPreviaNegocioWeb v={{ nombre: 'Tacos', direccion: 'A, B, C' }} />);
  await fireEvent.press(screen.getByLabelText('Tacos'));
  expect(mockPush).not.toHaveBeenCalled();
  expect(screen.queryByLabelText(/Guardar/)).toBeNull();
  expect(screen.queryByText('Abierto ahora')).toBeNull();
  expect(screen.queryByText('Cerrado ahora')).toBeNull();
});

it('dice que es aproximada', async () => {
  await render(<VistaPreviaNegocioWeb v={null} />);
  expect(screen.getByText(/vista aproximada/i)).toBeTruthy();
});
