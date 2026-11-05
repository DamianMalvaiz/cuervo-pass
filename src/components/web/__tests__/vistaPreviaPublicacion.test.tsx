import { fireEvent, render, screen } from '@testing-library/react-native';

// La vista previa: la MISMA tarjeta que verán los estudiantes, con lo que se va escribiendo; no es una vivienda real (no navega, no se guarda) y no inventa lo que falta.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/queries/useExplorar', () => ({ useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }) }));

import { VistaPreviaPublicacionWeb, tituloPublicoDe } from '../VistaPreviaPublicacionWeb';

const V = { tipo: 'cuarto' as const, colonia: 'Capultitlán', municipio: 'Toluca', precioRenta: '3200', recamaras: '2', amueblado: true };

beforeEach(() => jest.clearAllMocks());

describe('tituloPublicoDe', () => {
  it('arma el título como la base: tipo y colonia', () => {
    expect(tituloPublicoDe({ tipo: 'cuarto', colonia: 'Capultitlán' })).toBe('Cuarto en Capultitlán');
    expect(tituloPublicoDe({ tipo: 'casa_compartida', colonia: '  Centro ' })).toBe('Casa compartida en Centro');
  });
  it('sin colonia todavía, solo el tipo', () => {
    expect(tituloPublicoDe({ tipo: 'depa', colonia: ' ' })).toBe('Departamento');
  });
});

describe('VistaPreviaPublicacionWeb', () => {
  it('enseña título público, municipio con detalles y precio', async () => {
    await render(<VistaPreviaPublicacionWeb v={V} />);
    expect(screen.getByText('Cuarto en Capultitlán')).toBeTruthy();
    expect(screen.getByText('Toluca · 2 recámaras · Amueblado')).toBeTruthy();
    expect(screen.getByText(/3,200/)).toBeTruthy();
  });

  it('sin datos todavía no inventa nada: «Tu publicación» y «Falta el precio»', async () => {
    await render(<VistaPreviaPublicacionWeb v={null} />);
    expect(screen.getByText('Tu publicación')).toBeTruthy();
    expect(screen.getByText('Falta el precio')).toBeTruthy();
    expect(screen.queryByText(/\$0/)).toBeNull();
  });

  it('no es una vivienda real: no navega, no se puede guardar, y no trae «Destacado» ni calificación', async () => {
    await render(<VistaPreviaPublicacionWeb v={V} />);
    await fireEvent.press(screen.getByLabelText(/Cuarto en Capultitlán/));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/Guardar/)).toBeNull();
    expect(screen.queryByText('Destacado')).toBeNull();
    expect(screen.queryByLabelText(/Calificación/)).toBeNull();
  });

  it('dice que es aproximada', async () => {
    await render(<VistaPreviaPublicacionWeb v={V} />);
    expect(screen.getByText(/vista aproximada/i)).toBeTruthy();
  });
});
