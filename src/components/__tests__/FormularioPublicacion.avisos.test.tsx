import { createRef } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

// Toast propio · paso 2 · el formulario de publicación avisa.
//
// El defecto: con el botón «Publicar» en un pie fijo y un formulario de dieciséis
// campos, tocarlo con un campo inválido no mostraba NADA a la vista. El error de
// cada campo sale en rojo bajo su campo, que puede estar fuera de pantalla. Y el
// error de envío se pinta al FINAL de todo el formulario. La persona tocaba el
// botón y parecía que no había pasado nada.
//
// Aquí se comprueba lo que se le dice. El error junto al campo se queda: el aviso
// dice DÓNDE mirar, el campo dice QUÉ está mal.
//
// Lleva `afterEach(cleanup)` como FormularioPublicacion.envio.test.tsx. Si hace
// falta aquí no se comprobó: se conserva por precaución, porque ese archivo
// cuenta que sin él las pruebas siguientes a un `enviar()` por el ref salían sin
// pintar.

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

import { useToastStore } from '@/store/useToastStore';

import { FormularioPublicacion, type ControlPublicacion } from '../FormularioPublicacion';

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

const aviso = () => useToastStore.getState().actual;

afterEach(cleanup);

beforeEach(() => {
  jest.clearAllMocks();
  useToastStore.setState({ actual: null });
  mockBuscarCalles.mockResolvedValue([]);
  mockBuscarPorCodigoPostal.mockResolvedValue(null);
  (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
});

// `fireEvent` es ASÍNCRONO en RNTL 14: se espera con `await`. Envolverlo en un
// `act` sin esperar dejaba llamadas a `act()` solapadas y rompía el entorno de
// TODAS las pruebas siguientes del archivo —«overlapping act() calls», y los
// `render` posteriores salían sin pintar—. Ése fue el síntoma que aquí se
// confundió con el arrastre que describe FormularioPublicacion.envio.test.tsx.
// Comprobado: con el `await`, el orden de las pruebas no importa.

// ── Sin el ref ───────────────────────────────────────────────────────────────

test('el botón dentro del formulario avisa igual', async () => {
  await render(
    <FormularioPublicacion onGuardar={jest.fn()} textoBoton="Guardar" valoresIniciales={INICIALES} />
  );
  await fireEvent.changeText(screen.getByLabelText('Precio de renta mensual en pesos'), 'abc');

  await fireEvent.press(screen.getByLabelText('Guardar'));

  await waitFor(() => expect(aviso()).not.toBeNull());
  expect(aviso()?.mensaje).toBe('Revisa el campo: Precio');
  await act(async () => {});
});

test('el error junto al campo sigue ahí', async () => {
  await render(
    <FormularioPublicacion onGuardar={jest.fn()} textoBoton="Guardar" valoresIniciales={INICIALES} />
  );
  await fireEvent.changeText(screen.getByLabelText('Precio de renta mensual en pesos'), 'abc');
  await fireEvent.press(screen.getByLabelText('Guardar'));

  expect(await screen.findByText('Solo números')).toBeTruthy();
  await act(async () => {});
});

test('con muchos campos vacíos, nombra tres y cuenta el resto', async () => {
  await render(<FormularioPublicacion onGuardar={jest.fn()} textoBoton="Guardar" />);

  await fireEvent.press(screen.getByLabelText('Guardar'));

  await waitFor(() => expect(aviso()).not.toBeNull());
  expect(aviso()?.mensaje).toMatch(/^Revisa \d+ campos: Título, Calle, Número exterior y \d+ más$/);
  await act(async () => {});
});

test('sin permiso para las fotos, avisa', async () => {
  (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
  await render(<FormularioPublicacion onGuardar={jest.fn()} textoBoton="Guardar" />);

  await fireEvent.press(screen.getByLabelText('Agregar foto'));

  await waitFor(() => expect(aviso()).not.toBeNull());
  expect(aviso()).toMatchObject({
    tipo: 'error',
    mensaje: 'Necesitamos permiso para acceder a tus fotos',
  });
});

// ── Por el ref: AL FINAL ─────────────────────────────────────────────────────

test('enviar con campos inválidos avisa CUÁLES, en el orden de la pantalla', async () => {
  const onGuardar = jest.fn();
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
  // El orden en que se rompen NO es el de la pantalla: whatsapp primero.
  await fireEvent.changeText(screen.getByLabelText('Número de WhatsApp, 10 dígitos'), '123');
  await fireEvent.changeText(screen.getByLabelText('Precio de renta mensual en pesos'), 'abc');

  await act(async () => { await control.current?.enviar(); });

  await waitFor(() => expect(aviso()).not.toBeNull());
  expect(aviso()).toMatchObject({ tipo: 'error', mensaje: 'Revisa 2 campos: Precio y WhatsApp' });
  expect(onGuardar).not.toHaveBeenCalled();
  await act(async () => {});
});

test('un formulario válido no muestra ningún aviso', async () => {
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

  expect(aviso()).toBeNull();
  await act(async () => {});
});

// ── Falla el guardado ────────────────────────────────────────────────────────

test('si guardar falla, avisa el motivo y lo deja también en el formulario', async () => {
  const onGuardar = jest.fn().mockRejectedValue(new Error('No se pudo subir la foto'));
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

  await waitFor(() => expect(aviso()).not.toBeNull());
  expect(aviso()).toMatchObject({ tipo: 'error', mensaje: 'No se pudo subir la foto' });
  expect(await screen.findByText('No se pudo subir la foto')).toBeTruthy();
  await act(async () => {});
});

// ── Permiso de fotos ─────────────────────────────────────────────────────────
