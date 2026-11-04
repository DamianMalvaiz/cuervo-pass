import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// El marco del editor de menú: con ventana ancha trae la vista previa y le da al editor cómo contarle lo que edita; con ventana angosta, solo el editor (sin `alVistaPrevia`).

const mockPantalla = { ancho: 1440 };
jest.mock('@/hooks/use-tamano-pantalla', () => ({ useTamanoPantalla: () => ({ ancho: mockPantalla.ancho, alto: 900, clase: 'amplia' }) }));
jest.mock('../VistaPreviaMenuWeb', () => ({ VistaPreviaMenuWeb: ({ v }: { v: { productos: unknown[] } | null }) => require('react').createElement(require('react-native').Text, null, `PREVIA ${v ? v.productos.length : 'vacía'}`) }));

import { MarcoMenuWeb } from '../MarcoMenuWeb';

it('con ventana ancha: editor y vista previa, y el editor recibe cómo contarle lo que edita', async () => {
  mockPantalla.ancho = 1440;
  let recibido: unknown;
  await render(<MarcoMenuWeb>{(alVistaPrevia) => { recibido = alVistaPrevia; return <Text>EDITOR</Text>; }}</MarcoMenuWeb>);
  expect(screen.getByText('EDITOR')).toBeTruthy();
  expect(screen.getByText('PREVIA vacía')).toBeTruthy();
  expect(typeof recibido).toBe('function');
});

it('con ventana angosta: solo el editor, sin vista previa ni callback', async () => {
  mockPantalla.ancho = 800;
  let recibido: unknown = 'sin llamar';
  await render(<MarcoMenuWeb>{(alVistaPrevia) => { recibido = alVistaPrevia; return <Text>EDITOR</Text>; }}</MarcoMenuWeb>);
  expect(screen.getByText('EDITOR')).toBeTruthy();
  expect(screen.queryByText(/PREVIA/)).toBeNull();
  expect(recibido).toBeUndefined();
});
