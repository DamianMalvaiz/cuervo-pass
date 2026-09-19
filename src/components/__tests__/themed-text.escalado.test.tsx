import { render, screen } from '@testing-library/react-native';

import { ThemedText } from '../themed-text';

// END-34 · `PRODUCT.md` compromete «respecting the system's font-size scaling»
// y había **cero usos** de `maxFontSizeMultiplier` o `allowFontScaling` en toda
// la app. La promesa no estaba implementada: no es que estuviera mal ajustada,
// es que no existía.
//
// Lo que rompe al 200 % no es el texto corrido —ése crece y ya— sino las CIFRAS
// EN CASILLAS DE ANCHO FIJO. `cifraLista` mide 40/44 px con `numberOfLines={1}`
// y `adjustsFontSizeToFit`: al escalar, el texto no cabe, y
// `adjustsFontSizeToFit` lo ENCOGE hasta caber. Resultado: la calificación —el
// elemento que el sistema declara como el más importante— acaba más pequeña
// que el texto de al lado. La jerarquía se invierte exactamente para quien
// subió el tamaño porque le costaba leer.
//
// De ahí el reparto: el texto corrido escala, las cifras de casilla no.

const tope = async (type: Parameters<typeof ThemedText>[0]['type'], texto: string) => {
  await render(<ThemedText type={type}>{texto}</ThemedText>);
  return (await screen.findByText(texto, {}, { timeout: 5000 })).props.maxFontSizeMultiplier;
};

test('el texto corrido escala hasta 1.4', async () => {
  expect(await tope('default', 'cuerpo')).toBe(1.4);
  expect(await tope('small', 'pequeño')).toBe(1.4);
});

test('los titulos escalan menos, para no comerse la pantalla', async () => {
  expect(await tope('title', 'titulo')).toBe(1.2);
  expect(await tope('subtitle', 'subtitulo')).toBe(1.2);
});

// LA regla que evita la inversión de jerarquía.
test('las cifras de casilla NO escalan', async () => {
  expect(await tope('calificacion', '9.5')).toBe(1);
  expect(await tope('cifra', '$2,800')).toBe(1);
  expect(await tope('folio', 'FOLIO 1')).toBe(1);
  expect(await tope('etiqueta', 'AJUSTE')).toBe(1);
});

// Un tope declarado en el sitio de uso tiene que poder ganarle al del tipo:
// hay casos —un texto dentro de una fila de altura fija— que el tipo no conoce.
test('quien usa el componente puede bajar el tope, pero no por accidente', async () => {
  await render(<ThemedText type="default" maxFontSizeMultiplier={1}>fijo</ThemedText>);
  expect((await screen.findByText('fijo', {}, { timeout: 5000 })).props.maxFontSizeMultiplier).toBe(1);
});

// Nada lleva `allowFontScaling={false}`: apagar el escalado por completo es
// romper la promesa, no cumplirla a medias. Lo que se acota es CUÁNTO crece.
test('no se apaga el escalado en ningun tipo', async () => {
  for (const t of ['default', 'title', 'cifra', 'calificacion'] as const) {
    await render(<ThemedText type={t}>{`x-${t}`}</ThemedText>);
    const n = await screen.findByText(`x-${t}`, {}, { timeout: 5000 });
    expect(n.props.allowFontScaling).not.toBe(false);
  }
});
