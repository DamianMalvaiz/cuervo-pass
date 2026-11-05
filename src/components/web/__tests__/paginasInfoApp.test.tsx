import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, Share } from 'react-native';

// Las páginas informativas EN LA APP (iOS/Android): sin el marco de la web (barra, pie), con la cabecera de la navegación, y lo que en la web usa el navegador (portapapeles, «ver en la búsqueda pública»)
// aquí usa lo del sistema o no se ofrece. Lo que se fija: que no dependan de `PaginaWeb` y que no prometan lo que la app no hace.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/use-tamano-pantalla', () => ({ useTamanoPantalla: () => ({ ancho: 390, alto: 844, clase: 'compacta' }) }));
// Si la app tocara el marco de la web, esto lo delataría.
jest.mock('../PaginaWeb', () => ({
  PaginaWeb: () => {
    throw new Error('la app no debe usar el marco de la web');
  },
}));
jest.mock('@/store/usePerfilStore', () => ({ usePerfilStore: (sel: (s: unknown) => unknown) => sel({ perfil: null }) }));
jest.mock('../EsqueletoWeb', () => ({ EsqueletoFilasWeb: () => require('react').createElement(require('react-native').Text, null, 'esqueleto') }));
jest.mock('@/hooks/queries/useExplorar', () => ({
  usePreciosPublicados: () => ({ precios: [{ precio_renta: 2200, tipo: 'cuarto' }, { precio_renta: 4200, tipo: 'depa' }], truncado: false, cargando: false, fallo: false, reintentar: jest.fn() }),
}));

import { AcuerdosWeb } from '../AcuerdosWeb';
import { AyudaWeb } from '../AyudaWeb';
import { ContratoWeb } from '../ContratoWeb';
import { GuiaVisitaWeb } from '../GuiaVisitaWeb';
import { PresupuestoWeb } from '../PresupuestoWeb';

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'ios');
});
afterEach(() => jest.restoreAllMocks());

it.each([
  ['Ayuda', AyudaWeb, /Lo que más nos preguntan/],
  ['Guía de visita', GuiaVisitaWeb, /Qué mirar y qué preguntar/],
  ['Contrato', ContratoWeb, /que no te falte nada/],
  ['Acuerdos', AcuerdosWeb, /Lo que se habla al inicio/],
  ['Presupuesto', PresupuestoWeb, /Elige un monto/],
] as const)('%s se pinta sin el marco de la web, con su subtítulo y los cruces a las otras cuatro', async (_nombre, Pagina, subtitulo) => {
  await render(<Pagina />);
  expect(screen.getByText(subtitulo)).toBeTruthy();
  expect(screen.getByText('También te puede servir')).toBeTruthy();
  expect(screen.getAllByRole('link')).toHaveLength(4);
});

it('un cruce lleva a la otra página', async () => {
  await render(<ContratoWeb />);
  await fireEvent.press(screen.getByLabelText('Ayuda y contacto'));
  expect(mockPush).toHaveBeenCalledWith('/ayuda');
});

describe('Acuerdos en la app', () => {
  it('comparte el resumen con el menú del sistema, no con el portapapeles', async () => {
    const compartir = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await render(<AcuerdosWeb />);
    expect(screen.queryByLabelText('Compartir con mis roomies')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Gastos: Partes iguales'));
    expect(screen.queryByLabelText('Copiar para mis roomies')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Compartir con mis roomies'));
    expect(compartir).toHaveBeenCalledWith({ message: 'Acuerdos de convivencia\n· Gastos: Partes iguales' });
  });
  it('si compartir falla lo dice y no afirma que se envió', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('sin app'));
    await render(<AcuerdosWeb />);
    await fireEvent.press(screen.getByLabelText('Gastos: Partes iguales'));
    await fireEvent.press(screen.getByLabelText('Compartir con mis roomies'));
    expect(await screen.findByText(/No se pudo copiar solo/)).toBeTruthy();
  });
  it('dice que se queda en el teléfono, no en el navegador', async () => {
    await render(<AcuerdosWeb />);
    expect(screen.getByText(/se queda en tu teléfono/)).toBeTruthy();
    expect(screen.queryByText(/navegador/)).toBeNull();
  });
});

describe('Presupuesto en la app', () => {
  it('cuenta los lugares, pero no ofrece «Ver los lugares que alcanzan» (esa búsqueda es de la web)', async () => {
    await render(<PresupuestoWeb />);
    expect(screen.getByText(/lugares? alcanzan?/)).toBeTruthy();
    expect(screen.queryByLabelText('Ver los lugares que alcanzan')).toBeNull();
  });
});

describe('Ayuda en la app', () => {
  it('dice dónde se guarda cada cosa EN LA APP: favoritos en la cuenta; vistos y comparar en el teléfono; sin hablar del navegador ni de búsquedas guardadas', async () => {
    await render(<AyudaWeb />);
    await fireEvent.press(screen.getByLabelText('¿Dónde se guardan mis favoritos y lo que comparo?'));
    expect(screen.getByText(/solo en este teléfono/)).toBeTruthy();
    expect(screen.queryByText(/navegador/)).toBeNull();
    expect(screen.queryByLabelText(/vistos y búsquedas/)).toBeNull();
  });
});
