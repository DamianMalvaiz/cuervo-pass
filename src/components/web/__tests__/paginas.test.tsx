import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// El armazón de las páginas interiores de la web (`/departamentos`, `/roomies`, `/servicios`): barra de navegación con la sección activa, el contenido de la página y el pie. Lo que se fija: cada pestaña lleva a SU
// página, la activa se anuncia como seleccionada, y cada página pone su propio título de pestaña del navegador.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
const mockHead = jest.fn();
jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockHead(props);
    return null;
  },
}));
jest.mock('@/hooks/use-tamano-pantalla', () => ({
  useTamanoPantalla: () => ({ clase: 'amplia', ancho: 1280, alto: 900, anchoContenido: 480, anchoLista: 800, altoApretado: false, escalaTitulo: 1 }),
}));

import { EncabezadoWeb } from '../EncabezadoWeb';
import { PaginaWeb } from '../PaginaWeb';

beforeEach(() => jest.clearAllMocks());

describe('EncabezadoWeb', () => {
  it('cada pestaña lleva a su página', async () => {
    await render(<EncabezadoWeb activa="depas" escritorio />);
    await fireEvent.press(screen.getByLabelText('Roomies'));
    expect(mockPush).toHaveBeenLastCalledWith('/roomies');
    await fireEvent.press(screen.getByLabelText('Servicios'));
    expect(mockPush).toHaveBeenLastCalledWith('/servicios');
    await fireEvent.press(screen.getByLabelText('Departamentos'));
    expect(mockPush).toHaveBeenLastCalledWith('/departamentos');
  });

  it('la pestaña de la página en que se está se anuncia como la actual, y solo esa', async () => {
    await render(<EncabezadoWeb activa="roomies" escritorio />);
    // `aria-current="page"` es lo que anuncia el lector de pantalla para el enlace de la página actual (`selected` no se escribe para enlaces en la web).
    expect(screen.getByLabelText('Roomies').props['aria-current']).toBe('page');
    expect(screen.getByLabelText('Servicios').props['aria-current']).toBeUndefined();
    expect(screen.getByLabelText('Departamentos').props['aria-current']).toBeUndefined();
  });

  it('el logo lleva al inicio y las dos cuentas a entrar y registrarse', async () => {
    await render(<EncabezadoWeb activa={null} escritorio />);
    await fireEvent.press(screen.getByLabelText('Ir al inicio'));
    expect(mockPush).toHaveBeenLastCalledWith('/');
    await fireEvent.press(screen.getByLabelText('Iniciar sesión'));
    expect(mockPush).toHaveBeenLastCalledWith('/(auth)/login');
    await fireEvent.press(screen.getByLabelText('Crear cuenta'));
    expect(mockPush).toHaveBeenLastCalledWith('/(auth)/registro');
  });

  it('en pantalla angosta las pestañas siguen ahí (no se pierde la navegación)', async () => {
    await render(<EncabezadoWeb activa="servicios" escritorio={false} />);
    for (const t of ['Departamentos', 'Roomies', 'Servicios']) expect(screen.getByLabelText(t)).toBeTruthy();
  });
});

describe('PaginaWeb', () => {
  it('trae la barra, el contenido de la página y el pie', async () => {
    await render(<PaginaWeb activa="servicios" titulo="Negocios y servicios"><Text>contenido de la página</Text></PaginaWeb>);
    expect(screen.getByLabelText('Servicios')).toBeTruthy();
    expect(screen.getByText('contenido de la página')).toBeTruthy();
    expect(screen.getByText(/Proyecto académico de la UTVT/)).toBeTruthy();
  });

  it('pone el título de la pestaña del navegador con el nombre del sitio', async () => {
    await render(<PaginaWeb activa="depas" titulo="Departamentos y cuartos"><Text>x</Text></PaginaWeb>);
    expect(mockHead).toHaveBeenCalled();
    const hijo = (mockHead.mock.calls[0][0] as { children: { props: { children: string } } }).children;
    expect(hijo.props.children).toBe('Departamentos y cuartos · Cuervo 360');
  });
});
