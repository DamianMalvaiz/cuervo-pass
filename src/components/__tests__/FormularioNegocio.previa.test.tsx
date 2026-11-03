import { act, fireEvent, render, screen } from '@testing-library/react-native';

// La vista previa de la web: el formulario manda afuera nombre, dirección y la portada (la primera foto: la ya guardada, ya firmada). Aparte de las demás pruebas del formulario.

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() } }));
jest.mock('@/hooks/queries/useMisNegocios', () => ({
  ErrorParcial: class extends Error {},
  useGuardarNegocio: () => ({ mutate: jest.fn(), isPending: false }),
  useBorrarNegocio: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock('@/hooks/queries/usePlanes', () => ({ useMiSuscripcion: () => ({ suscripcion: null }) }));
jest.mock('@/hooks/queries/useServicios', () => ({ useCategoriasServicio: () => ({ categorias: [], fallo: false, reintentar: jest.fn() }) }));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({ urls: new Map([['negocios/n1/a.jpg', 'https://f.test/a']]) }) }));
jest.mock('@/lib/geocoding', () => ({ geocodificarDireccion: jest.fn() }));
jest.mock('expo-image-picker', () => ({ requestMediaLibraryPermissionsAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }) }));

import { FormularioNegocio } from '../FormularioNegocio';

const NEGOCIO = {
  id: 'n1', categoria_id: 'comida', nombre: 'Tacos', descripcion: '', direccion: 'Calle 1, Centro, Lerma', latitud: 19.3, longitud: -99.4, rango_precio: 1,
  horario: null, fotos: ['negocios/n1/a.jpg'], destacado: false, origen: 'solicitud', activo: true, oculto_por_reportes: false, usuario_id: 'u1', creado_en: 'x',
};

it('manda nombre, dirección y la portada ya firmada, y se actualiza al escribir', async () => {
  const previa = jest.fn();
  await render(<FormularioNegocio inicial={{ negocio: NEGOCIO as never, items: [] }} onVistaPrevia={previa} />);
  expect(previa.mock.calls.at(-1)![0]).toEqual({ nombre: 'Tacos', direccion: 'Calle 1, Centro, Lerma', fotoUri: 'https://f.test/a' });
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText('Nombre del negocio'), 'Tacos El Güero');
  });
  expect(previa.mock.calls.at(-1)![0].nombre).toBe('Tacos El Güero');
});

it('un negocio nuevo, sin fotos, no manda portada; sin la prop no pasa nada', async () => {
  const previa = jest.fn();
  await render(<FormularioNegocio onVistaPrevia={previa} />);
  expect(previa.mock.calls.at(-1)![0]).toEqual({ nombre: '', direccion: '', fotoUri: undefined });
  await render(<FormularioNegocio />);
});
