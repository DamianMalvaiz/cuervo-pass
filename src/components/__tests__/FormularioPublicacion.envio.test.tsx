import { createRef } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Las pruebas de ENVIO viven aparte de las de rellenado, y no por gusto.
//
// Corriendo en el mismo archivo, cualquier prueba posterior a un `enviar()` por
// el ref se quedaba sin pintar: `render` devolvia en 1 ms y todas las consultas
// fallaban. Aisladas, esas mismas pruebas pasan en ~190 ms. Se probaron
// `cleanup()` explicito entre pruebas y drenar microtareas con
// `await act(async () => {})` despues del envio; ninguna de las dos lo arregla.
//
// Esto CONTIENE el sintoma, no explica la causa. Queda escrito para que quien
// vuelva aqui no gaste otra vez la media hora que costo acotarlo: el reparto en
// dos archivos es deliberado, no casual, y juntarlos otra vez lo reproduce.
//
// Editar estaba ROTO de una forma que se veia como otra cosa.
//
// La direccion se guarda como UNA cadena y el formulario la pide en OCHO
// campos. Al editar, esos ocho nacian vacios, y como siete son obligatorios la
// validacion de Zod fallaba en silencio: no se podia guardar NINGUN cambio.
// Desde fuera parecia "cuando cambio la foto se borran todos los datos".
//
// src/lib/direccion.ts tiene 11 pruebas de la ida y la vuelta como funciones
// puras. Lo que faltaba es esto: que el FORMULARIO las use al rellenarse.

const mockBuscarPorCodigoPostal = jest.fn();
const mockBuscarCalles = jest.fn();

jest.mock('@/lib/direccionMx', () => ({
  buscarPorCodigoPostal: (...a: unknown[]) => mockBuscarPorCodigoPostal(...a),
}));
jest.mock('@/lib/mapboxAutocomplete', () => ({
  buscarCalles: (...a: unknown[]) => mockBuscarCalles(...a),
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  MediaTypeOptions: { Images: 'Images' },
}));

import { FormularioPublicacion, type ControlPublicacion } from '../FormularioPublicacion';

// El formato canonico es el que produce armarDireccion, y lleva el prefijo
// "CP" en el ultimo trozo. Sin el, partirDireccion no reconoce la cadena y la
// prueba estaria midiendo el caso ilegible sin saberlo.
const DIRECCION =
  'Calle Zapata 224, Guadalupe, San Mateo Atenco, San Mateo Atenco, México, CP 52104';

const INICIALES = {
  titulo: 'Depa de 1 recámara',
  tipo: 'depa' as const,
  direccion: DIRECCION,
  precioRenta: '2500',
  descripcion: 'Cerca del campus',
  permiteMascotas: false,
  amueblado: true,
  serviciosIncluidos: false,
  recamaras: '1',
  whatsapp: '7221599193',
};

// Desmontar a mano entre pruebas. Las dos que llaman a `enviar()` por el ref
// dejan trabajo asincrono en vuelo —validacion de Zod y el setEnviando(false)
// posterior—, y sin este desmontaje el `render` de la prueba SIGUIENTE se
// quedaba sin pintar: devolvia en 1 ms y todas las consultas fallaban. Aislada,
// esa misma prueba pasaba en 178 ms. Un fallo que solo aparece acompanado es el
// que mas tiempo cuesta si no se nombra.
afterEach(cleanup);

beforeEach(() => {
  jest.clearAllMocks();
  mockBuscarCalles.mockResolvedValue([]);
  mockBuscarPorCodigoPostal.mockResolvedValue(null);
});

const valorDe = (etiqueta: string) => screen.getByLabelText(etiqueta).props.value;

test('al editar, los ocho campos de direccion nacen llenos', async () => {
  await render(
    <FormularioPublicacion onGuardar={jest.fn()} textoBoton="Guardar" valoresIniciales={INICIALES} />
  );
  // Calle y Colonia son desplegables: pintan texto, no son TextInput con
  // `value`, asi que se comprueban por lo que se ve.
  expect(await screen.findByText('Calle Zapata', {}, { timeout: 5000 })).toBeTruthy();
  expect(await screen.findByText('Guadalupe', {}, { timeout: 5000 })).toBeTruthy();
  expect(valorDe('Número exterior')).toBe('224');
  expect(valorDe('Código postal')).toBe('52104');
  expect(valorDe('Localidad')).toBe('San Mateo Atenco');
  expect(valorDe('Municipio')).toBe('San Mateo Atenco');
  expect(valorDe('Estado')).toBe('México');
});

test('el resto de los campos tambien se rellenan', async () => {
  await render(
    <FormularioPublicacion onGuardar={jest.fn()} textoBoton="Guardar" valoresIniciales={INICIALES} />
  );
  expect(valorDe('Título de la publicación')).toBe('Depa de 1 recámara');
  expect(valorDe('Precio de renta mensual en pesos')).toBe('2500');
  expect(valorDe('Número de WhatsApp, 10 dígitos')).toBe('7221599193');
  expect(valorDe('Número de recámaras')).toBe('1');
});

// LA prueba: enviar sin tocar nada tiene que funcionar y devolver la MISMA
// direccion. Si la ida y la vuelta no cuadran, editar una foto reescribe la
// direccion con basura, y eso es peor que fallar.
test('guardar sin cambiar nada conserva la direccion intacta', async () => {
  const onGuardar = jest.fn().mockResolvedValue(undefined);
  const control = createRef<ControlPublicacion>();
  await render(
    <FormularioPublicacion
      ref={control}
      onGuardar={onGuardar}
      textoBoton="Guardar"
      valoresIniciales={INICIALES}
      botonEnPie
    />
  );
  await act(async () => { await control.current?.enviar(); });
  await waitFor(() => expect(onGuardar).toHaveBeenCalled());
  expect(onGuardar.mock.calls[0][0].direccion).toBe(DIRECCION);
  await act(async () => {});
});

test('cambiar solo el precio no toca la direccion', async () => {
  const onGuardar = jest.fn().mockResolvedValue(undefined);
  const control = createRef<ControlPublicacion>();
  await render(
    <FormularioPublicacion
      ref={control}
      onGuardar={onGuardar}
      textoBoton="Guardar"
      valoresIniciales={INICIALES}
      botonEnPie
    />
  );
  fireEvent.changeText(screen.getByLabelText('Precio de renta mensual en pesos'), '3100');
  await act(async () => { await control.current?.enviar(); });
  await waitFor(() => expect(onGuardar).toHaveBeenCalled());
  const datos = onGuardar.mock.calls[0][0];
  expect(datos.precioRenta).toBe('3100');
  expect(datos.direccion).toBe(DIRECCION);
  await act(async () => {});
});

