import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// La vista previa EN LA APP: el formulario ocupa toda la pantalla, una barra fija ofrece «Ver cómo se verá» y la hoja enseña lo ÚLTIMO que el formulario contó (o la vista vacía si aún no contó nada); se cierra con «Cerrar».

import { ConVistaPreviaApp } from '../ConVistaPreviaApp';

type Dato = { nombre: string };

function Formulario({ alVistaPrevia }: { alVistaPrevia: (v: Dato) => void }) {
  return (
    <>
      <Text>FORMULARIO</Text>
      <Text onPress={() => alVistaPrevia({ nombre: 'Tacos' })}>ESCRIBIR_TACOS</Text>
      <Text onPress={() => alVistaPrevia({ nombre: 'Tortas' })}>ESCRIBIR_TORTAS</Text>
    </>
  );
}

const pintar = async () =>
  render(
    <ConVistaPreviaApp<Dato> boton="Ver cómo se verá" titulo="Así se verá" vista={(v) => <Text>{`VISTA:${v ? v.nombre : 'vacía'}`}</Text>}>
      {(alVistaPrevia) => <Formulario alVistaPrevia={alVistaPrevia} />}
    </ConVistaPreviaApp>
  );

it('monta el formulario y ofrece el botón; la hoja no se ve hasta tocarlo', async () => {
  await pintar();
  expect(screen.getByText('FORMULARIO')).toBeTruthy();
  expect(screen.getByLabelText('Ver cómo se verá')).toBeTruthy();
  expect(screen.queryByText(/^VISTA:/)).toBeNull();
});

it('sin que el formulario haya contado nada, la hoja enseña la vista vacía (no inventa datos)', async () => {
  await pintar();
  await fireEvent.press(screen.getByLabelText('Ver cómo se verá'));
  expect(screen.getByText('VISTA:vacía')).toBeTruthy();
  expect(screen.getByText('Así se verá')).toBeTruthy();
});

it('enseña lo ÚLTIMO que contó el formulario', async () => {
  await pintar();
  await fireEvent.press(screen.getByText('ESCRIBIR_TACOS'));
  await fireEvent.press(screen.getByText('ESCRIBIR_TORTAS'));
  await fireEvent.press(screen.getByLabelText('Ver cómo se verá'));
  expect(screen.getByText('VISTA:Tortas')).toBeTruthy();
  expect(screen.queryByText('VISTA:Tacos')).toBeNull();
});

it('«Cerrar» esconde la hoja y el formulario sigue ahí', async () => {
  await pintar();
  await fireEvent.press(screen.getByLabelText('Ver cómo se verá'));
  await fireEvent.press(screen.getByLabelText('Cerrar la vista previa'));
  expect(screen.queryByText(/^VISTA:/)).toBeNull();
  expect(screen.getByText('FORMULARIO')).toBeTruthy();
});
