import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// `FormularioCuestionario` · 530 líneas al 0 % en sentencias Y en ramas.
//
// Era el agujero más grande del repositorio, y no por tamaño: este componente
// produce TODOS los perfiles de la app. Lo que escribe aquí es lo que alimenta
// después el filtro duro de las sugerencias, el corte de distancia y el vector
// semántico. Un campo mal guardado no rompe nada visible — deja el motor
// filtrando por un dato equivocado, que es el modo de fallo de este proyecto.
//
// Y estaba al 0 % por una razón concreta: la prueba de su pantalla
// (`(auth)/__tests__/cuestionario.test.tsx`) lo MOCKEA entero. La pantalla
// quedaba probada y el formulario no, que es justo el reparto contrario al que
// conviene.
//
// El caso más caro de los de aquí es `universidadCoords`. Alimenta el corte de
// distancia; si una universidad conocida mandara `null`, el filtro se quedaría
// sin centro y las sugerencias saldrían mal ordenadas sin un solo error.

import { UNIVERSIDADES } from '@/lib/universidades';

import { FormularioCuestionario } from '../FormularioCuestionario';

const UTVT = UNIVERSIDADES[0];

const COMPLETO = {
  universidad: UTVT.nombre,
  presupuestoMin: 2000,
  presupuestoMax: 5000,
  distanciaMaxKm: 10,
  mascotas: false,
  fuma: false,
  nivelRuido: 'medio' as const,
  buscaRoomie: false,
  textoLibre: undefined,
  consienteIa: false,
};

const pintar = async (props: Partial<Parameters<typeof FormularioCuestionario>[0]> = {}) => {
  const onCompletar = jest.fn().mockResolvedValue(undefined);
  const vista = await render(
    <FormularioCuestionario valoresIniciales={COMPLETO} onCompletar={onCompletar} {...props} />
  );
  return { vista, onCompletar };
};

const enviar = async () => {
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Guardar y continuar'));
  });
};

const escribir = async (etiqueta: RegExp, texto: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText(etiqueta), texto);
  });
};

// ── §29 · El consentimiento ──────────────────────────────────────────────────

// Una casilla premarcada no es consentimiento. Es la clase de detalle que se
// «arregla» sin querer al refactorizar un `defaultValues`, y nadie lo nota
// porque la app sigue funcionando — solo que ahora analiza con IA los textos de
// gente que nunca dijo que sí.
test('el consentimiento de IA NO viene premarcado', async () => {
  const { onCompletar } = await pintar();
  await enviar();
  await waitFor(() => expect(onCompletar).toHaveBeenCalled());
  expect(onCompletar.mock.calls[0][0].consienteIa).toBe(false);
});

// Y si alguien ya lo había dado, se respeta: reabrir el formulario para cambiar
// el presupuesto no debe retirar un consentimiento en silencio.
test('un consentimiento ya dado se conserva al reabrir', async () => {
  const { onCompletar } = await pintar({ valoresIniciales: { ...COMPLETO, consienteIa: true } });
  await enviar();
  await waitFor(() => expect(onCompletar).toHaveBeenCalled());
  expect(onCompletar.mock.calls[0][0].consienteIa).toBe(true);
});

// ── Las coordenadas de la universidad ────────────────────────────────────────

// LA prueba de este archivo. Las coordenadas están verificadas a mano en
// `lib/universidades.ts` precisamente porque geocodificar «UTVT» como texto
// libre devuelve lugares no relacionados. Si el formulario no las mandara, el
// corte de distancia se quedaría sin centro.
test('una universidad conocida manda su nombre Y sus coordenadas', async () => {
  const { onCompletar } = await pintar();
  await enviar();
  await waitFor(() => expect(onCompletar).toHaveBeenCalled());

  const enviado = onCompletar.mock.calls[0][0];
  expect(enviado.universidad).toBe(UTVT.nombre);
  expect(enviado.universidadCoords).toEqual({ lat: UTVT.lat, lng: UTVT.lng });
});

// «Otra» no tiene coordenadas que mandar, y mandar unas inventadas sería peor:
// el `null` es lo que deja que el resto del sistema sepa que no hay centro.
test('«Otra» manda el nombre escrito y coordenadas nulas', async () => {
  const { onCompletar } = await pintar();

  await act(async () => {
    fireEvent.press(screen.getByLabelText(/Otra \(escribir\)/));
  });
  await escribir(/Universidad Tecnológica del Valle/, '  Instituto Politécnico Nacional  ');
  await enviar();

  await waitFor(() => expect(onCompletar).toHaveBeenCalled());
  const enviado = onCompletar.mock.calls[0][0];
  // Recortado: un nombre con espacios al final se guarda distinto del mismo
  // nombre sin ellos, y después no cuadra con nada.
  expect(enviado.universidad).toBe('Instituto Politécnico Nacional');
  expect(enviado.universidadCoords).toBeNull();
});

// Elegir «Otra» y no escribir nada dejaría un perfil con universidad vacía: ni
// centro de distancia ni forma de agrupar a nadie.
test('«Otra» sin nombre no envía', async () => {
  const { onCompletar } = await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText(/Otra \(escribir\)/));
  });
  await enviar();

  expect(await screen.findByText('Escribe el nombre completo de tu universidad')).toBeTruthy();
  expect(onCompletar).not.toHaveBeenCalled();
});

test('«Otra» con dos letras tampoco: el mínimo es tres', async () => {
  const { onCompletar } = await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText(/Otra \(escribir\)/));
  });
  await escribir(/Universidad Tecnológica del Valle/, 'IP');
  await enviar();
  expect(onCompletar).not.toHaveBeenCalled();
});

// ── El presupuesto ───────────────────────────────────────────────────────────

// La validación cruzada. Un rango invertido no es un error de captura inocente:
// el filtro duro usa los dos extremos, y con el máximo por debajo del mínimo
// ninguna publicación cabe — lista vacía sin explicación.
test('un presupuesto invertido no pasa, y lo dice', async () => {
  const { onCompletar } = await pintar();
  await escribir(/^5000$/, '1000');
  await enviar();

  expect(await screen.findByText('El máximo debe ser mayor o igual al mínimo')).toBeTruthy();
  expect(onCompletar).not.toHaveBeenCalled();
});

// Iguales SÍ pasan: quien tiene un presupuesto exacto no está equivocándose.
test('mínimo y máximo iguales sí pasan', async () => {
  const { onCompletar } = await pintar({
    valoresIniciales: { ...COMPLETO, presupuestoMin: 3000, presupuestoMax: 3000 },
  });
  await enviar();
  await waitFor(() => expect(onCompletar).toHaveBeenCalled());
});

test('un presupuesto con letras no pasa', async () => {
  const { onCompletar } = await pintar();
  await escribir(/^2000$/, 'dos mil');
  await enviar();
  expect(await screen.findByText('Solo números')).toBeTruthy();
  expect(onCompletar).not.toHaveBeenCalled();
});

// Se envían como NÚMEROS, no como las cadenas del formulario. Guardar '2000' en
// una columna numérica funciona por coerción hasta que alguien compara.
test('el presupuesto se envía como número', async () => {
  const { onCompletar } = await pintar();
  await enviar();
  await waitFor(() => expect(onCompletar).toHaveBeenCalled());
  const enviado = onCompletar.mock.calls[0][0];
  expect(enviado.presupuestoMin).toBe(2000);
  expect(enviado.presupuestoMax).toBe(5000);
  expect(typeof enviado.distanciaMaxKm).toBe('number');
});

// ── La distancia ─────────────────────────────────────────────────────────────

// §17 · El radio dejó de estar fijo en 5 km dentro del código; es del usuario y
// el filtro duro lo usa como corte real. Los dos extremos se prueban porque un
// 0 dejaría la lista vacía y un 500 la volvería inútil.
test('la distancia acepta el rango declarado y rechaza fuera de él', async () => {
  const { onCompletar } = await pintar();

  await escribir(/^5$/, '0');
  await enviar();
  expect(await screen.findByText('Entre 1 y 50 km')).toBeTruthy();
  expect(onCompletar).not.toHaveBeenCalled();

  await escribir(/^5$/, '51');
  await enviar();
  expect(onCompletar).not.toHaveBeenCalled();

  await escribir(/^5$/, '50');
  await enviar();
  await waitFor(() => expect(onCompletar).toHaveBeenCalled());
});

test('acepta decimales, que es para lo que sirve el campo', async () => {
  const { onCompletar } = await pintar();
  await escribir(/^5$/, '2.5');
  await enviar();
  await waitFor(() => expect(onCompletar).toHaveBeenCalled());
  expect(onCompletar.mock.calls[0][0].distanciaMaxKm).toBe(2.5);
});

// Los atajos existen porque teclear «5» en un campo numérico es peor que
// tocarlo. Si no escribieran en el campo, serían decoración.
test('un atajo de kilómetros fija el valor de verdad', async () => {
  const { onCompletar } = await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('3 kilómetros'));
  });
  await enviar();
  await waitFor(() => expect(onCompletar).toHaveBeenCalled());
  expect(onCompletar.mock.calls[0][0].distanciaMaxKm).toBe(3);
});

// ── El texto libre ───────────────────────────────────────────────────────────

// Vacío se manda como `undefined` y no como ''. La diferencia importa: una
// cadena vacía guardada genera un embedding de nada, y ese vector queda
// compitiendo en el ranking contra descripciones reales.
test('un texto libre vacío se manda como undefined, no como cadena vacía', async () => {
  const { onCompletar } = await pintar();
  await escribir(/Ej. soy tranquilo/, '   ');
  await enviar();
  await waitFor(() => expect(onCompletar).toHaveBeenCalled());
  expect(onCompletar.mock.calls[0][0].textoLibre).toBeUndefined();
});

test('y con contenido se manda recortado', async () => {
  const { onCompletar } = await pintar();
  await escribir(/Ej. soy tranquilo/, '  Soy tranquilo y tengo un gato.  ');
  await enviar();
  await waitFor(() => expect(onCompletar).toHaveBeenCalled());
  expect(onCompletar.mock.calls[0][0].textoLibre).toBe('Soy tranquilo y tengo un gato.');
});

// ── Las preferencias ─────────────────────────────────────────────────────────

// `FilaAjuste` con `valor`/`onCambiar` pinta un `Switch`, no un pulsable: se
// acciona con `valueChange` y no con `press`. Mi primera versión pulsaba y las
// casillas no se movían — la aserción estaba mal, no el componente.
test('las casillas llegan como booleanos al completar', async () => {
  const { onCompletar } = await pintar();
  await act(async () => {
    fireEvent(screen.getByLabelText('Tengo mascotas'), 'valueChange', true);
  });
  await act(async () => {
    fireEvent(screen.getByLabelText('Fumo'), 'valueChange', true);
  });
  await enviar();
  await waitFor(() => expect(onCompletar).toHaveBeenCalled());

  const enviado = onCompletar.mock.calls[0][0];
  expect(enviado.mascotas).toBe(true);
  expect(enviado.fuma).toBe(true);
  expect(enviado.buscaRoomie).toBe(false);
});

// ── El envío ─────────────────────────────────────────────────────────────────

// Un fallo al guardar se DICE. Sin esto la persona pulsa, no pasa nada visible y
// vuelve a pulsar: el cuestionario es la primera cosa que hace en la app.
test('un fallo al completar se muestra', async () => {
  const onCompletar = jest.fn().mockRejectedValue(new Error('no se pudo escribir el perfil'));
  await render(<FormularioCuestionario valoresIniciales={COMPLETO} onCompletar={onCompletar} />);
  await enviar();
  expect(await screen.findByText('no se pudo escribir el perfil')).toBeTruthy();
});

// El `finally`. Sin él, `enviando` se queda en true, el sello queda en estado de
// carga y no hay forma de reintentar sin reiniciar.
test('tras un fallo se puede reintentar', async () => {
  const onCompletar = jest
    .fn()
    .mockRejectedValueOnce(new Error('caído'))
    .mockResolvedValue(undefined);
  await render(<FormularioCuestionario valoresIniciales={COMPLETO} onCompletar={onCompletar} />);

  await enviar();
  expect(await screen.findByText('caído')).toBeTruthy();

  await enviar();
  await waitFor(() => expect(onCompletar).toHaveBeenCalledTimes(2));
});

// `onEstadoEnvio` es lo que usa la pantalla para poner su propio botón en
// «guardando». Si no avisara, el botón del pie se quedaría inerte mientras el
// formulario trabaja.
// El `onCompletar` se deja EN VUELO a propósito. Con uno que resuelve al
// instante, `setEnviando(true)` y `setEnviando(false)` caen en el mismo lote de
// React y el efecto solo ve el valor final: la prueba diría que nunca avisó de
// «guardando». En producción hay una escritura de red en medio, así que el
// estado sí existe — con una promesa pendiente se reproduce ese hueco.
test('avisa del estado de envío a quien lo aloja', async () => {
  const onEstadoEnvio = jest.fn();
  let resolver!: () => void;
  const onCompletar = jest.fn(() => new Promise<void>((r) => { resolver = r; }));
  await render(
    <FormularioCuestionario
      valoresIniciales={COMPLETO}
      onCompletar={onCompletar}
      onEstadoEnvio={onEstadoEnvio}
    />
  );
  await enviar();

  // Mientras la escritura viaja: guardando.
  await waitFor(() => expect(onEstadoEnvio.mock.calls.map(([v]) => v)).toContain(true));

  await act(async () => { resolver(); });
  await waitFor(() => expect(onEstadoEnvio.mock.calls.at(-1)?.[0]).toBe(false));
});

// El botón se puede sacar al pie de la pantalla que lo aloja (así lo usa
// `cuestionario-inicial`), y entonces NO debe pintarse otro dentro.
test('con el botón en el pie no se pinta el de dentro', async () => {
  await pintar({ botonEnPie: true });
  expect(screen.queryByLabelText('Guardar y continuar')).toBeNull();
});

test('el texto del botón se puede cambiar', async () => {
  await pintar({ textoBoton: 'Guardar cambios' });
  expect(screen.getByLabelText('Guardar cambios')).toBeTruthy();
});

// Sin valores iniciales —el caso del alta— la distancia arranca en 5 km, que es
// el valor por omisión declarado, y no en vacío.
test('sin valores iniciales la distancia arranca en 5', async () => {
  const onCompletar = jest.fn().mockResolvedValue(undefined);
  await render(<FormularioCuestionario onCompletar={onCompletar} />);
  expect(screen.getByPlaceholderText(/^5$/).props.value).toBe('5');
});

// ── El control imperativo ────────────────────────────────────────────────────

// `cuestionario-inicial` guarda desde SU botón a través del ref. Si el ref no
// expusiera `enviar`, ese botón no haría nada y el único camino de alta de la
// app quedaría muerto.
test('el ref expone enviar, que es como guarda la pantalla que lo aloja', async () => {
  const onCompletar = jest.fn().mockResolvedValue(undefined);
  const ref = { current: null as { enviar: () => void } | null };
  await render(
    <FormularioCuestionario ref={ref} valoresIniciales={COMPLETO} onCompletar={onCompletar} botonEnPie />
  );

  expect(ref.current?.enviar).toBeInstanceOf(Function);
  await act(async () => {
    ref.current?.enviar();
  });
  await waitFor(() => expect(onCompletar).toHaveBeenCalled());
});
