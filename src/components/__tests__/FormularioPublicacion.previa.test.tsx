import { fireEvent, render, screen } from '@testing-library/react-native';

// La vista previa de la web: el formulario manda afuera lo que se va escribiendo (tipo, colonia, municipio, precio, recámaras, amueblado) y la primera foto elegida EN ESTE dispositivo.
// Aparte de las demás pruebas del formulario por la misma razón que las de envío: no se mezclan.

jest.mock('@/lib/direccionMx', () => ({ buscarPorCodigoPostal: jest.fn() }));
jest.mock('@/lib/mapboxAutocomplete', () => ({ buscarCalles: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  MediaTypeOptions: { Images: 'Images' },
}));

import { FormularioPublicacion } from '../FormularioPublicacion';

const DIRECCION = 'Calle Zapata 224, Guadalupe, San Mateo Atenco, San Mateo Atenco, México, CP 52104';
const INICIALES = {
  titulo: 'Depa de 1 recámara', tipo: 'depa' as const, direccion: DIRECCION, precioRenta: '2500', descripcion: '', permiteMascotas: false, amueblado: true,
  serviciosIncluidos: false, recamaras: '1', whatsapp: '7221599193',
};

it('manda lo que hay al abrir y se actualiza al escribir', async () => {
  const previa = jest.fn();
  await render(<FormularioPublicacion textoBoton="Publicar" valoresIniciales={INICIALES} onVistaPrevia={previa} onGuardar={jest.fn()} />);
  const primera = previa.mock.calls.at(-1)![0];
  expect(primera).toMatchObject({ tipo: 'depa', precioRenta: '2500', recamaras: '1', amueblado: true });
  expect(primera.colonia).toBe('Guadalupe');
  expect(primera.municipio).toBe('San Mateo Atenco');
  expect(primera.fotoUri).toBeUndefined();

  await fireEvent.changeText(screen.getByLabelText('Precio de renta mensual en pesos'), '3200');
  expect(previa.mock.calls.at(-1)![0].precioRenta).toBe('3200');
  await fireEvent.changeText(screen.getByLabelText('Número de recámaras'), '3');
  expect(previa.mock.calls.at(-1)![0].recamaras).toBe('3');
});

it('una foto ya guardada NO se manda (necesita firmarse); sin la prop no pasa nada', async () => {
  const previa = jest.fn();
  await render(<FormularioPublicacion textoBoton="Guardar" valoresIniciales={INICIALES} fotosIniciales={['publicaciones/u/a.jpg']} onVistaPrevia={previa} onGuardar={jest.fn()} />);
  expect(previa.mock.calls.at(-1)![0].fotoUri).toBeUndefined();
  await render(<FormularioPublicacion textoBoton="Guardar" valoresIniciales={INICIALES} onGuardar={jest.fn()} />);
});
