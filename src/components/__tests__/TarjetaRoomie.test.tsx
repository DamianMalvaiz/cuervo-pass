import { fireEvent, render, screen } from '@testing-library/react-native';

import { TarjetaRoomie, etiquetaCompatibilidad } from '../TarjetaRoomie';

// La tarjeta de un roomie sugerido. Lo que se fija: la etiqueta sale de la compatibilidad POR REGLAS (la que se puede explicar), las razones se leen
// en la propia tarjeta, lo que no tiene dato no se presenta como «baja», y una respuesta sin los campos nuevos (servidor sin la 0066) no rompe.

describe('etiquetaCompatibilidad', () => {
  it.each([[1, 'Alta'], [0.75, 'Alta'], [0.749, 'Media'], [0.5, 'Media'], [0.499, 'Baja'], [0, 'Baja']])('%s → %s', (v, esperado) => {
    expect(etiquetaCompatibilidad(v)).toBe(esperado);
  });
  it('sin dato no es «baja»: es «sin datos»', () => {
    expect(etiquetaCompatibilidad(null)).toBeNull();
    expect(etiquetaCompatibilidad(undefined)).toBeNull();
  });
});

const base = { nombreUsuario: 'Ana', descripcionBusqueda: 'Busco roomie tranquilo' };

describe('TarjetaRoomie', () => {
  it('muestra la etiqueta de compatibilidad y las razones de las dos clases', async () => {
    await render(<TarjetaRoomie {...base} compatibilidad={0.9} coincidencias={['Mismo nivel de ruido', 'Ninguno fuma']} diferencias={['Horarios opuestos']} />);
    expect(screen.getByText('COMPATIBILIDAD ALTA')).toBeTruthy();
    expect(screen.getByText('Mismo nivel de ruido')).toBeTruthy();
    expect(screen.getByText('Ninguno fuma')).toBeTruthy();
    expect(screen.getByText('Horarios opuestos')).toBeTruthy();
  });

  it('con muchas razones solo enseña las primeras (la tarjeta no es un informe)', async () => {
    await render(<TarjetaRoomie {...base} compatibilidad={0.9}
      coincidencias={['uno', 'dos', 'tres', 'cuatro', 'cinco']} diferencias={['d1', 'd2']} />);
    expect(screen.getByText('uno')).toBeTruthy();
    expect(screen.queryByText('cinco')).toBeNull();
  });

  it('sin datos para comparar lo dice, y NO lo presenta como baja compatibilidad', async () => {
    await render(<TarjetaRoomie {...base} compatibilidad={null} coincidencias={[]} diferencias={[]} />);
    expect(screen.getByText('SIN DATOS PARA COMPARAR')).toBeTruthy();
    expect(screen.queryByText(/BAJA/)).toBeNull();
  });

  it('un servidor sin los campos nuevos (0066 sin aplicar) no rompe y cae a la afinidad anterior', async () => {
    await render(<TarjetaRoomie {...base} afinidad={0.8} />);
    expect(screen.getByText('AFINIDAD ALTA')).toBeTruthy();
  });

  it('sin nada de nada dice que no hay datos', async () => {
    await render(<TarjetaRoomie {...base} />);
    expect(screen.getByText('SIN DATOS PARA COMPARAR')).toBeTruthy();
  });

  it('la etiqueta accesible lleva las razones (quien usa lector de pantalla no ve los íconos)', async () => {
    await render(<TarjetaRoomie {...base} compatibilidad={0.6} coincidencias={['Ninguno fuma']} diferencias={['Horarios opuestos']} />);
    expect(screen.getByLabelText(/Ana\. Busco roomie tranquilo\. compatibilidad media\. A favor: Ninguno fuma\. Ojo: Horarios opuestos/)).toBeTruthy();
  });

  it('tocarla la abre', async () => {
    const onPress = jest.fn();
    await render(<TarjetaRoomie {...base} compatibilidad={0.6} onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText(/Ana/));
    expect(onPress).toHaveBeenCalled();
  });
});
