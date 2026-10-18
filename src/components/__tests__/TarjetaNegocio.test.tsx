import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { TarjetaNegocio, signosDePrecio } from '../TarjetaNegocio';

// La tarjeta de un negocio de Servicios. Lo que se fija: dice la distancia en lenguaje de persona, NUNCA enseña el puntaje del
// ranking, no inventa estrellas, y rotula lo de ejemplo.

const negocio = (extra: Record<string, unknown> = {}) => ({
  id: 'n1', categoria_id: 'comida', nombre: 'Tacos La Esquina', descripcion: null, direccion: 'Calle 1', latitud: null, longitud: null,
  rango_precio: 1, horario: 'Lun a sáb', fotos: [], destacado: false, origen: 'sembrado', ...extra,
});

describe('signosDePrecio', () => {
  it.each([[1, '$'], [2, '$$'], [3, '$$$']])('%s → %s', (n, t) => expect(signosDePrecio(n)).toBe(t));
  it('sin dato o fuera de rango no inventa nada', () => {
    expect(signosDePrecio(null)).toBeNull();
    expect(signosDePrecio(0)).toBeNull();
    expect(signosDePrecio(4)).toBeNull();
  });
});

describe('TarjetaNegocio', () => {
  it('dice la distancia a tu universidad con un decimal', async () => {
    await render(<TarjetaNegocio negocio={negocio({ distancia_km: 1.24 }) as never} onPress={() => {}} />);
    expect(screen.getByText(/a 1\.2 km/)).toBeTruthy();
  });

  it('sin dato de distancia no inventa una', async () => {
    await render(<TarjetaNegocio negocio={negocio({ distancia_km: null }) as never} onPress={() => {}} />);
    expect(screen.queryByText(/ km/)).toBeNull();
  });

  it('NO enseña el puntaje del ranking: es un interno del motor', async () => {
    await render(<TarjetaNegocio negocio={negocio({ distancia_km: 1, puntaje: 0.8123 }) as never} onPress={() => {}} />);
    expect(screen.queryByText(/0\.81/)).toBeNull();
    expect(screen.queryByText(/puntaje/i)).toBeNull();
  });

  it('con reseñas muestra la estrella compacta; sin ellas, nada', async () => {
    await render(<TarjetaNegocio negocio={negocio({ calificacion: 4.5, num_resenas: 12 }) as never} onPress={() => {}} />);
    expect(screen.getByText('(12)')).toBeTruthy();
  });

  it('sin reseñas no pinta estrellas', async () => {
    await render(<TarjetaNegocio negocio={negocio({ calificacion: null, num_resenas: 0 }) as never} onPress={() => {}} />);
    expect(screen.queryByLabelText(/de 5 estrellas/)).toBeNull();
  });

  it('un negocio de ejemplo se rotula; uno real no', async () => {
    await render(<TarjetaNegocio negocio={negocio() as never} onPress={() => {}} />);
    expect(screen.getByText('Negocio de ejemplo')).toBeTruthy();
  });

  it('un negocio real no lleva el rótulo', async () => {
    await render(<TarjetaNegocio negocio={negocio({ origen: 'solicitud' }) as never} onPress={() => {}} />);
    expect(screen.queryByText('Negocio de ejemplo')).toBeNull();
  });

  it('la etiqueta accesible lleva distancia, horario, precio y el rótulo de ejemplo', async () => {
    await render(<TarjetaNegocio negocio={negocio({ distancia_km: 0.8 }) as never} onPress={() => {}} />);
    expect(screen.getByLabelText('Tacos La Esquina. a 0.8 km · Lun a sáb · $. Negocio de ejemplo')).toBeTruthy();
  });

  it('tocarla la abre', async () => {
    const onPress = jest.fn();
    await render(<TarjetaNegocio negocio={negocio() as never} onPress={onPress} />);
    await act(async () => { fireEvent.press(screen.getByLabelText(/Tacos La Esquina/)); });
    expect(onPress).toHaveBeenCalled();
  });

  it('el destacado lleva su insignia solo en la forma ancha', async () => {
    await render(<TarjetaNegocio negocio={negocio({ destacado: true }) as never} forma="destacado" onPress={() => {}} />);
    expect(screen.getByText('Destacado')).toBeTruthy();
  });
});
