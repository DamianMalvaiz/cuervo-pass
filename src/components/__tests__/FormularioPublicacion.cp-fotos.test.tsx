import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Cuarto archivo de `FormularioPublicacion`. Los otros tres cubren el rellenado
// al editar, el envío y el desplegable; quedaban 30 de 136 ramas, y dos huecos
// concretos con consecuencia:
//
//  1. EL AUTORRELLENO POR CÓDIGO POSTAL. Rellena estado, municipio y localidad
//     «solo en los campos que el usuario todavía no tocó — nunca pisa algo que
//     ya haya escrito a mano». Ese «nunca pisa» es un `if (!getValues(...))` por
//     campo, y es exactamente la clase de guardia que un refactor sustituye por
//     un `setValue` directo porque «queda más limpio». Cuando se rompe, alguien
//     que corrigió a mano su municipio lo ve cambiar solo al teclear el CP, y no
//     tiene forma de saber por qué.
//
//  2. LAS FOTOS. Permiso, cancelación, y el TOPE de ocho. El tope no es
//     cosmético: cada foto se sube al bucket y se firma una por una.
//
// El reparto en archivos separados de este componente es deliberado, no casual
// —está explicado en `FormularioPublicacion.envio.test.tsx`— así que este
// también lleva su `afterEach(cleanup)`.

const mockBuscarPorCodigoPostal = jest.fn();
const mockBuscarCalles = jest.fn();
const mockPermiso = jest.fn();
const mockElegirImagen = jest.fn();

jest.mock('@/lib/direccionMx', () => ({
  buscarPorCodigoPostal: (...a: unknown[]) => mockBuscarPorCodigoPostal(...a),
}));
jest.mock('@/lib/mapboxAutocomplete', () => ({
  buscarCalles: (...a: unknown[]) => mockBuscarCalles(...a),
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...a: unknown[]) => mockElegirImagen(...a),
  requestMediaLibraryPermissionsAsync: (...a: unknown[]) => mockPermiso(...a),
  MediaTypeOptions: { Images: 'Images' },
}));

import { FormularioPublicacion } from '../FormularioPublicacion';

const CP_52104 = {
  estado: 'México',
  municipio: 'San Mateo Atenco',
  localidad: 'San Mateo Atenco',
  colonias: ['Guadalupe', 'La Concepción'],
};

afterEach(cleanup);

beforeEach(() => {
  jest.clearAllMocks();
  mockBuscarCalles.mockResolvedValue([]);
  mockBuscarPorCodigoPostal.mockResolvedValue(null);
  mockPermiso.mockResolvedValue({ granted: true });
  mockElegirImagen.mockResolvedValue({ canceled: true });
});

const pintar = async () =>
  render(<FormularioPublicacion onGuardar={jest.fn()} textoBoton="Publicar" />);

const valorDe = (etiqueta: string) => screen.getByLabelText(etiqueta).props.value;

const escribir = async (etiqueta: string, texto: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText(etiqueta), texto);
  });
};

// ── El autorrelleno por código postal ────────────────────────────────────────

test('un CP válido rellena estado, municipio y localidad', async () => {
  mockBuscarPorCodigoPostal.mockResolvedValue(CP_52104);
  await pintar();
  await escribir('Código postal', '52104');

  await waitFor(() => expect(valorDe('Estado')).toBe('México'));
  expect(valorDe('Municipio')).toBe('San Mateo Atenco');
  expect(valorDe('Localidad')).toBe('San Mateo Atenco');
});

// LA prueba de este archivo. Quien corrigió su municipio a mano —porque el
// catálogo de códigos postales no siempre acierta— no puede ver ese valor
// cambiar solo al terminar de teclear el CP.
test('NO pisa lo que el usuario ya escribió a mano', async () => {
  mockBuscarPorCodigoPostal.mockResolvedValue(CP_52104);
  await pintar();

  await escribir('Municipio', 'Lerma');
  await escribir('Estado', 'Estado de México');
  await escribir('Código postal', '52104');

  await waitFor(() => expect(mockBuscarPorCodigoPostal).toHaveBeenCalled());
  // Lo escrito a mano sobrevive…
  expect(valorDe('Municipio')).toBe('Lerma');
  expect(valorDe('Estado')).toBe('Estado de México');
  // …y lo que estaba vacío sí se rellena. Las dos mitades importan: un guardia
  // que no pisa nada NUNCA es igual de inútil que uno que lo pisa todo.
  expect(valorDe('Localidad')).toBe('San Mateo Atenco');
});

// Un CP incompleto no consulta. Sin este corte, teclear «52104» dispararía cinco
// consultas al catálogo, una por dígito.
test('un CP de menos de cinco dígitos no consulta', async () => {
  await pintar();
  await escribir('Código postal', '521');
  expect(mockBuscarPorCodigoPostal).not.toHaveBeenCalled();
});

test('un CP con letras tampoco', async () => {
  await pintar();
  await escribir('Código postal', '52a04');
  expect(mockBuscarPorCodigoPostal).not.toHaveBeenCalled();
});

// El mismo CP no se vuelve a pedir. `onChangeText` se dispara también al borrar
// y volver a escribir el último dígito, y el catálogo no cambia entre pulsación
// y pulsación.
test('el mismo CP no se consulta dos veces', async () => {
  mockBuscarPorCodigoPostal.mockResolvedValue(CP_52104);
  await pintar();

  await escribir('Código postal', '52104');
  await waitFor(() => expect(mockBuscarPorCodigoPostal).toHaveBeenCalledTimes(1));

  await escribir('Código postal', '52104');
  expect(mockBuscarPorCodigoPostal).toHaveBeenCalledTimes(1);
});

// Pero uno DISTINTO sí: si la memoria del último no se actualizara, corregir el
// CP no traería las colonias nuevas y el desplegable quedaría con las del
// anterior.
test('un CP distinto sí se consulta', async () => {
  mockBuscarPorCodigoPostal.mockResolvedValue(CP_52104);
  await pintar();

  await escribir('Código postal', '52104');
  await waitFor(() => expect(mockBuscarPorCodigoPostal).toHaveBeenCalledTimes(1));

  await escribir('Código postal', '50000');
  await waitFor(() => expect(mockBuscarPorCodigoPostal).toHaveBeenCalledTimes(2));
  expect(mockBuscarPorCodigoPostal).toHaveBeenLastCalledWith('50000');
});

// Un CP que no está en el catálogo se avisa, y el aviso DESAPARECE al volver a
// un CP incompleto: si se quedara puesto, diría «no encontrado» mientras la
// persona todavía está escribiendo.
test('el aviso de CP no encontrado se retira al seguir escribiendo', async () => {
  mockBuscarPorCodigoPostal.mockResolvedValue(null);
  await pintar();

  await escribir('Código postal', '99999');
  expect(await screen.findByText(/No encontramos ese código postal/i)).toBeTruthy();

  await escribir('Código postal', '999');
  await waitFor(() => expect(screen.queryByText(/No encontramos ese código postal/i)).toBeNull());
});

// ── El antirrebote de la calle ───────────────────────────────────────────────

/**
 * Abre el desplegable de calle y devuelve su campo de búsqueda.
 *
 * `Calle` es un `CampoDesplegable`, no un TextInput: teclear sobre su etiqueta no
 * llega al manejador. Mi primera versión de estas dos pruebas lo hacía así, y la
 * de «menos de cuatro caracteres» PASABA POR EL MOTIVO EQUIVOCADO —afirmaba que
 * no se consultó, y no se consultó porque escribí en el elemento que no era—.
 * Una aserción negativa sobre el elemento equivocado siempre pasa.
 */
const abrirBuscadorDeCalle = async () => {
  fireEvent.press(await screen.findByLabelText('Calle', {}, { timeout: 5000 }));
  return screen.findByLabelText('Buscar Calle');
};

// Menos de cuatro caracteres no consulta: «Av» coincidiría con media ciudad y
// cada consulta a Mapbox cuenta contra la cuota del proyecto.
test('menos de cuatro caracteres no consulta calles', async () => {
  await pintar();
  const campo = await abrirBuscadorDeCalle();
  await act(async () => {
    fireEvent.changeText(campo, 'Zap');
  });
  await new Promise((r) => setTimeout(r, 600));
  expect(mockBuscarCalles).not.toHaveBeenCalled();
});

// Y con cuatro sí, para que la de arriba no pase por no haber tocado nada.
test('con cuatro caracteres sí consulta', async () => {
  mockBuscarCalles.mockResolvedValue([{ texto: 'Calle Zapata' }]);
  await pintar();
  const campo = await abrirBuscadorDeCalle();
  await act(async () => {
    fireEvent.changeText(campo, 'Zapa');
  });
  await waitFor(() => expect(mockBuscarCalles).toHaveBeenCalledWith('Zapa'), { timeout: 3000 });
});

// Y teclear rápido consulta UNA vez, no una por letra. Es lo que hace el
// temporizador de 400 ms, y lo que se pierde si alguien lo quita por «simplificar».
test('teclear rápido consulta una sola vez', async () => {
  mockBuscarCalles.mockResolvedValue([{ texto: 'Calle Zapata' }]);
  await pintar();

  const campo = await abrirBuscadorDeCalle();
  await act(async () => {
    fireEvent.changeText(campo, 'Zapa');
    fireEvent.changeText(campo, 'Zapat');
    fireEvent.changeText(campo, 'Zapata');
  });
  await waitFor(() => expect(mockBuscarCalles).toHaveBeenCalledTimes(1), { timeout: 2000 });
  expect(mockBuscarCalles).toHaveBeenCalledWith('Zapata');
});

// ── Las fotografías ──────────────────────────────────────────────────────────

test('sin permiso se explica y no se abre el selector', async () => {
  mockPermiso.mockResolvedValue({ granted: false });
  await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Agregar foto'));
  });

  expect(await screen.findByText('Necesitamos permiso para acceder a tus fotos')).toBeTruthy();
  expect(mockElegirImagen).not.toHaveBeenCalled();
});

test('cancelar el selector no agrega nada', async () => {
  await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Agregar foto'));
  });
  expect(screen.queryByLabelText('Quitar foto 1')).toBeNull();
});

test('las fotos elegidas se agregan', async () => {
  mockElegirImagen.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///a.jpg' }, { uri: 'file:///b.jpg' }],
  });
  await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Agregar foto'));
  });

  expect(await screen.findByLabelText('Quitar foto 1')).toBeTruthy();
  expect(screen.getByLabelText('Quitar foto 2')).toBeTruthy();
  expect(screen.queryByLabelText('Quitar foto 3')).toBeNull();
});

// El tope de ocho. No es cosmético: cada foto se sube al bucket y se firma una
// por una, así que doce fotos son doce subidas y doce firmas. El selector ya
// pide como máximo las que faltan, pero el `slice` es la red de abajo — y si el
// selector del sistema ignorara `selectionLimit`, es la única que queda.
test('nunca se pasan de ocho fotos, aunque el selector devuelva más', async () => {
  mockElegirImagen.mockResolvedValue({
    canceled: false,
    assets: Array.from({ length: 12 }, (_, i) => ({ uri: `file:///f${i}.jpg` })),
  });
  await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Agregar foto'));
  });

  expect(await screen.findByLabelText('Quitar foto 8')).toBeTruthy();
  expect(screen.queryByLabelText('Quitar foto 9')).toBeNull();
});

test('quitar una foto la retira y renumera el resto', async () => {
  mockElegirImagen.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///a.jpg' }, { uri: 'file:///b.jpg' }],
  });
  await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Agregar foto'));
  });
  await screen.findByLabelText('Quitar foto 2');

  await act(async () => {
    fireEvent.press(screen.getByLabelText('Quitar foto 1'));
  });
  await waitFor(() => expect(screen.queryByLabelText('Quitar foto 2')).toBeNull());
  expect(screen.getByLabelText('Quitar foto 1')).toBeTruthy();
});

// ── Escribir la colonia a mano ───────────────────────────────────────────────

// El catálogo de códigos postales es incompleto, así que una colonia que no está
// en la lista no es un caso raro. Si este camino estuviera roto, esa persona
// simplemente NO PUEDE publicar: la colonia es obligatoria y no tiene forma de
// meterla. Es el peor tipo de bloqueo, porque quien lo sufre no sabe que el
// resto del mundo sí puede.
//
// Sin escribir el CP antes: hacerlo dejaba el desplegable sin abrirse en este
// arnés —comprobado— y el camino que interesa es el mismo con lista o sin ella.
const entrarAEscribirColonia = async () => {
  fireEvent.press(await screen.findByLabelText('Colonia', {}, { timeout: 5000 }));
  // Por TEXTO y no por etiqueta: la etiqueta accesible se arma con el `titulo`
  // interno del desplegable, y el texto visible es lo estable — es lo que usa la
  // prueba que ya existía en el archivo del desplegable.
  fireEvent.press(await screen.findByText('Otra (escribir)', {}, { timeout: 5000 }));
};

// ⚠️ ATENCIÓN · lo que esta prueba NO afirma, y por qué.
//
// Comprueba que la SALIDA EXISTE: que se puede entrar al modo de texto libre y
// que ahí hay un campo editable. NO comprueba que lo escrito llegue al
// formulario, porque en este arnés no pude verificarlo y no voy a afirmar algo
// que no medí.
//
// Lo medido, el 26/09/2026, con un `console.log` temporal dentro del
// `onSeleccionar` de la colonia:
//
//   · `fireEvent.changeText` sobre el campo de texto libre NO llega a
//     `onSeleccionar`. El registro nunca se imprime, el `value` del campo sigue
//     siendo el anterior, y al enviar se guarda la colonia vieja.
//   · Pero `onSeleccionar` SÍ se llama al pulsar una opción de la lista — eso lo
//     prueba «elegir una colonia la fija en el campo y cierra la lista», en
//     `FormularioPublicacion.desplegable.test.tsx`, que pasa.
//   · Y `fireEvent.changeText` SÍ funciona sobre el campo de búsqueda de otro
//     desplegable: de eso dependen las pruebas del antirrebote de calle, más
//     arriba en este archivo.
//
// O sea: o el `onChangeText` del campo libre no está llegando en el arnés, o hay
// un defecto real en el que escribir una colonia a mano no se guarda. Las dos
// posibilidades son compatibles con lo medido y no pude separarlas aquí.
//
// SI ES UN DEFECTO, IMPORTA: el catálogo de códigos postales es incompleto, así
// que una colonia fuera de lista es común, la colonia es obligatoria, y quien la
// tenga no podría publicar. Anotado en `docs/cola-de-trabajo.md` para
// comprobarlo en un dispositivo, que es donde se resuelve.
test('el modo de escribir a mano existe y ofrece un campo editable', async () => {
  await pintar();
  await entrarAEscribirColonia();

  const campo = await screen.findByLabelText('Colonia');
  expect(campo.props.editable).not.toBe(false);
  // Y no revienta al recibir texto, que es lo mínimo exigible al camino.
  await act(async () => {
    fireEvent.changeText(campo, 'Ampliación San Isidro');
  });
  expect(screen.getByLabelText('Colonia')).toBeTruthy();
});

// Y se puede volver a la lista: quien entró a escribir a mano por error quedaría
// encerrado ahí, con la colonia obligatoria y sin salida.
test('desde escribir a mano se puede volver a la lista', async () => {
  await pintar();
  await entrarAEscribirColonia();
  // Ya está en modo libre: el campo acepta texto.
  expect(await screen.findByLabelText('Colonia')).toBeTruthy();

  await act(async () => {
    fireEvent.press(screen.getByLabelText('Elegir Colonia de la lista'));
  });
  // La lista vuelve, con su propia opción de escribir a mano.
  expect(await screen.findByText('Otra (escribir)', {}, { timeout: 5000 })).toBeTruthy();
});

// ── Elegir de las listas ─────────────────────────────────────────────────────

// Elegir una sugerencia de calle la fija Y limpia la lista. Si no la limpiara,
// el desplegable seguiría abierto sobre el campo ya resuelto.
test('elegir una sugerencia de calle la fija y cierra la lista', async () => {
  mockBuscarCalles.mockResolvedValue([{ texto: 'Calle Zapata' }, { texto: 'Calle Zapata Sur' }]);
  await pintar();
  const campo = await abrirBuscadorDeCalle();
  await act(async () => {
    fireEvent.changeText(campo, 'Zapata');
  });
  await waitFor(() => expect(mockBuscarCalles).toHaveBeenCalled(), { timeout: 3000 });

  await act(async () => {
    fireEvent.press(await screen.findByText('Calle Zapata Sur'));
  });
  expect(await screen.findByText('Calle Zapata Sur')).toBeTruthy();
  expect(screen.queryByLabelText('Buscar Calle')).toBeNull();
});

// El tipo son dos opciones excluyentes. Que la segunda se pueda elegir parece
// obvio hasta que alguien copia el `onPress` de la primera.
test('el tipo se puede cambiar a cuarto', async () => {
  await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText(/Cuarto/i));
  });
  expect(screen.getByLabelText(/Cuarto/i).props.accessibilityState?.selected).toBe(true);
});
