import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

// «¿Qué alcanza con tu presupuesto?»: todo sale de las rentas publicadas; cambiar el monto cambia la cuenta; abre en el presupuesto de la cuenta; cargando / falló / vacío son distintos; si se llegó al tope de filas, se dice.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('../PaginaWeb', () => ({ PaginaWeb: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/hooks/use-tamano-pantalla', () => ({ useTamanoPantalla: () => ({ ancho: 1440, alto: 900, clase: 'amplia' }) }));
const mockPerfil = { presupuesto_max: null as number | null };
jest.mock('@/store/usePerfilStore', () => ({ usePerfilStore: (sel: (s: unknown) => unknown) => sel({ perfil: mockPerfil.presupuesto_max === null ? null : { presupuesto_max: mockPerfil.presupuesto_max } }) }));
jest.mock('../EsqueletoWeb', () => ({ EsqueletoFilasWeb: () => require('react').createElement(require('react-native').Text, null, 'esqueleto') }));
const reintentar = jest.fn();
const mockPrecios = { precios: [] as { precio_renta: number; tipo: string }[], truncado: false, cargando: false, fallo: false, reintentar };
jest.mock('@/hooks/queries/useExplorar', () => ({ usePreciosPublicados: () => mockPrecios }));

import { PresupuestoWeb, montoInicial } from '../PresupuestoWeb';

const LISTA = [
  { precio_renta: 2200, tipo: 'cuarto' }, { precio_renta: 2900, tipo: 'cuarto' }, { precio_renta: 3600, tipo: 'casa_compartida' },
  { precio_renta: 4200, tipo: 'depa' }, { precio_renta: 5400, tipo: 'depa' }, { precio_renta: 7000, tipo: 'depa' },
];
beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'web');
  mockPerfil.presupuesto_max = null;
  Object.assign(mockPrecios, { precios: LISTA, truncado: false, cargando: false, fallo: false });
});

afterEach(() => jest.restoreAllMocks());

describe('montoInicial', () => {
  it('sin presupuesto, 4,000; con él, el monto de la lista más cercano', () => {
    expect(montoInicial(null)).toBe(4000);
    expect(montoInicial(undefined)).toBe(4000);
    expect(montoInicial(0)).toBe(4000);
    expect(montoInicial(Number.NaN)).toBe(4000);
    expect(montoInicial(4620)).toBe(4500);
    expect(montoInicial(900)).toBe(2000);
    expect(montoInicial(20000)).toBe(6000);
  });
});

describe('la cuenta', () => {
  it('dice cuántos alcanzan con el monto de arranque (4,000) y por tipo', async () => {
    await render(<PresupuestoWeb />);
    expect(screen.getByText('Hasta $4,000')).toBeTruthy();
    expect(screen.getByText('3 de 6 lugares alcanzan')).toBeTruthy();
    expect(screen.getByText('2 de 2')).toBeTruthy(); // cuartos
    expect(screen.getByText('1 de 1')).toBeTruthy(); // casa compartida
    expect(screen.getByText('0 de 3')).toBeTruthy(); // departamentos
  });

  it('cambiar el monto cambia la cuenta', async () => {
    await render(<PresupuestoWeb />);
    await fireEvent.press(screen.getByLabelText('Hasta $6,000'));
    expect(screen.getByText('5 de 6 lugares alcanzan')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Hasta $2,000'));
    expect(screen.getByText('0 de 6 lugares alcanzan')).toBeTruthy();
    expect(screen.getByLabelText('Hasta $2,000').props.accessibilityState.checked).toBe(true);
  });

  it('abre en el presupuesto de la cuenta', async () => {
    mockPerfil.presupuesto_max = 6100;
    await render(<PresupuestoWeb />);
    expect(screen.getByText('Hasta $6,000')).toBeTruthy();
  });

  it('con UN solo lugar dice «lugar alcanza» (singular)', async () => {
    mockPrecios.precios = [{ precio_renta: 3000, tipo: 'cuarto' }];
    await render(<PresupuestoWeb />);
    expect(screen.getByText('1 de 1 lugar alcanza')).toBeTruthy();
  });

  it('cada tramo de la gráfica dice cuántos hay y cuántos caben', async () => {
    await render(<PresupuestoWeb />);
    expect(screen.getByLabelText('$2,001 a $3,000: 2 lugares, 2 dentro de tu presupuesto')).toBeTruthy();
    expect(screen.getByLabelText('$3,001 a $4,000: 1 lugar, 1 dentro de tu presupuesto')).toBeTruthy();
    expect(screen.getByLabelText('$4,001 a $5,000: 1 lugar, 0 dentro de tu presupuesto')).toBeTruthy();
    expect(screen.getByLabelText('Más de $6,000: 1 lugar, 0 dentro de tu presupuesto')).toBeTruthy();
  });

  it('«Ver los lugares que alcanzan» abre /departamentos con ESE tope', async () => {
    await render(<PresupuestoWeb />);
    await fireEvent.press(screen.getByLabelText('Hasta $4,500'));
    await fireEvent.press(screen.getByLabelText('Ver los lugares que alcanzan'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/departamentos', params: { presupuesto: '4500' } });
  });
});

describe('estados', () => {
  it('falló ≠ vacío ≠ cargando', async () => {
    mockPrecios.fallo = true;
    const r = await render(<PresupuestoWeb />);
    expect(screen.getByText('No pudimos contar los lugares')).toBeTruthy();
    expect(screen.queryByText(/Todavía no hay lugares/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    expect(reintentar).toHaveBeenCalled();
    Object.assign(mockPrecios, { fallo: false, cargando: true });
    await r.rerender(<PresupuestoWeb />);
    expect(screen.getByText('esqueleto')).toBeTruthy();
    Object.assign(mockPrecios, { cargando: false, precios: [] });
    await r.rerender(<PresupuestoWeb />);
    expect(screen.getByText('Todavía no hay lugares publicados que contar.')).toBeTruthy();
  });

  it('si se llegó al tope de filas lo dice (la cifra puede ser parcial)', async () => {
    mockPrecios.truncado = true;
    await render(<PresupuestoWeb />);
    expect(screen.getByText(/Hay más lugares publicados de los que se pueden contar/)).toBeTruthy();
  });

  it('siempre aclara que es una foto de hoy', async () => {
    await render(<PresupuestoWeb />);
    expect(screen.getByText(/foto de los lugares publicados hoy/)).toBeTruthy();
  });
});
