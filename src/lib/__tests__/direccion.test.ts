import { armarDireccion, partirDireccion } from '../direccion';

// Editar una publicación estaba ROTO: la dirección viajaba como una sola cadena
// y los ocho campos del formulario nacían vacíos. Como siete son obligatorios,
// la validación fallaba y no se podía guardar ningún cambio —ni una foto, ni el
// precio— sin volver a teclear la dirección entera.
//
// Estas pruebas fijan que partir e armar sean exactamente inversos. Si alguien
// cambia el formato de uno sin el otro, editar se rompe otra vez en silencio.

const completa = {
  calle: 'Av. Solidaridad',
  numeroExterior: '210',
  colonia: 'San Francisco Putla',
  localidad: 'San Mateo Atenco',
  municipio: 'San Mateo Atenco',
  estado: 'México',
  codigoPostal: '52104',
};

test('partir deshace exactamente lo que arma', () => {
  expect(partirDireccion(armarDireccion(completa))).toEqual({ ...completa, numeroInterior: undefined });
});

test('conserva el número interior cuando existe', () => {
  const conInterior = { ...completa, numeroInterior: '3B' };
  expect(partirDireccion(armarDireccion(conInterior))).toEqual(conInterior);
});

// El número exterior es el último token, no el primero: las calles llevan
// espacios y partir por el primero dejaría la calle en "Av." y el número en
// "Solidaridad 210".
test('una calle con espacios no se parte por el primer espacio', () => {
  const p = partirDireccion(armarDireccion(completa));
  expect(p?.calle).toBe('Av. Solidaridad');
  expect(p?.numeroExterior).toBe('210');
});

// Las publicaciones sembradas y las anteriores guardaron la dirección SIN
// localidad, en cinco trozos. Sin este caso, editar seguiría roto para las
// ciento seis que ya existen — que es justo el escenario que se quería arreglar.
test('lee las direcciones de cinco trozos que ya están en la base', () => {
  const p = partirDireccion('Calle Reforma 364, San Miguel Totocuitlapilco, Metepec, México, CP 52140');
  expect(p?.calle).toBe('Calle Reforma');
  expect(p?.numeroExterior).toBe('364');
  expect(p?.colonia).toBe('San Miguel Totocuitlapilco');
  expect(p?.municipio).toBe('Metepec');
  expect(p?.localidad).toBe('Metepec'); // sin localidad propia, se usa el municipio
  expect(p?.codigoPostal).toBe('52140');
});

test('lee una dirección real de seis trozos', () => {
  const p = partirDireccion('Calle Zapata 224, Guadalupe, San Mateo Atenco, San Mateo Atenco, México, CP 52104');
  expect(p?.calle).toBe('Calle Zapata');
  expect(p?.colonia).toBe('Guadalupe');
  expect(p?.codigoPostal).toBe('52104');
});

// Devolver null en vez de adivinar: el llamador enseña un aviso y deja los
// campos vacíos, que es honesto. Partes inventadas se guardarían como si
// fueran ciertas.
describe('devuelve null en vez de adivinar', () => {
  test.each([
    ['vacío', ''],
    ['nulo', null],
    ['sin código postal', 'Calle Zapata 224, Guadalupe, San Mateo, Lerma'],
    ['con un CP inválido', 'Calle Zapata 224, Guadalupe, San Mateo, Lerma, México, CP 52'],
    ['sin número', 'Zapata, Guadalupe, San Mateo, Lerma, México, CP 52104'],
    ['texto libre', 'por el centro, cerca del mercado'],
  ])('%s', (_caso, entrada) => {
    expect(partirDireccion(entrada as string)).toBeNull();
  });
});
