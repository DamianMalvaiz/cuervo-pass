import { render, screen } from '@testing-library/react-native';

import { Encabezado } from '../Encabezado';
import { Seccion } from '../Seccion';

// Cuervo 360 · el marco de cada pantalla deja de ser un membrete de expediente (17/10/2026).
//
// Probado en un iPhone real, el rótulo en versalitas («REGISTRO DE MENSAJES»), el renglón de folio
// («14 REGISTROS · EMITIDO 17 OCT 2026») y la raya gruesa bajo el título hacían que cada pantalla se leyera como
// un formulario y no como un mercado. Ahora: un título grande, una descripción opcional y nada más. Y las
// secciones van en frase normal, sin raya.

describe('Encabezado', () => {
  it('pinta el título y la descripción', async () => {
    await render(<Encabezado titulo="Chats" descripcion="Tus conversaciones" />);
    expect(screen.getByText('Chats')).toBeTruthy();
    expect(screen.getByText('Tus conversaciones')).toBeTruthy();
  });

  it('no tiene rótulo de versalitas, folio ni raya gruesa', async () => {
    await render(<Encabezado titulo="Chats" />);
    // La raya era una View con `backgroundColor` y altura `Filete.grueso`; el rótulo y el folio, textos extra.
    expect(JSON.stringify(screen.toJSON())).not.toContain('backgroundColor');
    expect(screen.queryAllByText(/./)).toHaveLength(1);
  });

  it('sigue montando la acción a la derecha', async () => {
    const { Text } = require('react-native');
    await render(<Encabezado titulo="Chats" accion={<Text>ACCION</Text>} />);
    expect(screen.getByText('ACCION')).toBeTruthy();
  });
});

describe('Seccion', () => {
  it('pinta su título tal cual, en frase normal', async () => {
    await render(
      <Seccion titulo="Tus funciones">
        <></>
      </Seccion>
    );
    expect(screen.getByText('Tus funciones')).toBeTruthy();
  });

  it('no dibuja la raya bajo el título', async () => {
    await render(
      <Seccion titulo="Cuenta">
        <></>
      </Seccion>
    );
    expect(JSON.stringify(screen.toJSON())).not.toContain('backgroundColor');
  });
});
