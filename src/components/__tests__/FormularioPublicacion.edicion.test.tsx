import { cleanup, render, screen } from '@testing-library/react-native';

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

import { FormularioPublicacion } from '../FormularioPublicacion';

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
  expect(screen.getByText('Calle Zapata')).toBeTruthy();
  expect(screen.getByText('Guadalupe')).toBeTruthy();
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

// Una direccion vieja que no se puede separar NO debe rellenar campos a la
// fuerza ni adivinar: se avisa y se pide reescribirla.
test('una direccion ilegible se avisa en vez de inventar campos', async () => {
  await render(
    <FormularioPublicacion
      onGuardar={jest.fn()}
      textoBoton="Guardar"
      valoresIniciales={{ ...INICIALES, direccion: 'Emiliano zapata 2838382' }}
    />
  );
  expect(screen.getByText(/No pudimos separar la dirección/)).toBeTruthy();
  expect(screen.getByText('Emiliano zapata 2838382')).toBeTruthy();
  // Ninguno de los campos se rellena a la fuerza: el de estado queda vacio.
  expect(valorDe('Estado') ?? '').toBe('');
});

// Las fotos que ya existen tienen que aparecer: si no, quien edita cree que las
// perdio y vuelve a subirlas.
test('las fotos existentes se muestran al editar', async () => {
  await render(
    <FormularioPublicacion
      onGuardar={jest.fn()}
      textoBoton="Guardar"
      valoresIniciales={INICIALES}
      fotosIniciales={['publicaciones/u1/p1/0.jpg', 'publicaciones/u1/p1/1.jpg']}
    />
  );
  expect(screen.getByLabelText('Quitar foto 1')).toBeTruthy();
  expect(screen.getByLabelText('Quitar foto 2')).toBeTruthy();
});
