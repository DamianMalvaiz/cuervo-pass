import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// Las piezas del diseño de TELÉFONO de la web (menos de 700 px): barra inferior fija, píldora de búsqueda, carrusel y tarjetas compactas. Lo que se fija: cada cosa lleva a donde dice, la página actual se anuncia
// (aria-current), y lo compacto no pierde lo importante (precio, zona, calificación, si está abierto).

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/queries/useExplorar', () => ({ useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }) }));

import { BarraInferiorWeb } from '../BarraInferiorWeb';
import { CarruselWeb } from '../CarruselWeb';
import { PildoraBusquedaWeb } from '../PildoraBusquedaWeb';
import { TarjetaNegocioWeb } from '../TarjetaNegocioWeb';
import { TarjetaPublicacionWeb } from '../TarjetaPublicacionWeb';
import type { NegocioExplorar, PublicacionExplorar } from '@/services/explorar.service';

const PUB = { id: 'p1', titulo_publico: 'Casa compartida en Santa María Atarasquillo', tipo: 'casa_compartida', precio_renta: 2200, zona: 'Santa María Atarasquillo, Lerma, México, CP 52044', num_fotos: 0, destacado: true, calificacion: 4.9, num_resenas: 3 } as PublicacionExplorar;
const NEG = { id: 'n1', nombre: 'Café La Parada', zona: 'Centro, Lerma, México, CP 52000', abierto_ahora: true, calificacion: 4.6, num_fotos: 0, destacado: false } as unknown as NegocioExplorar;

beforeEach(() => jest.clearAllMocks());

describe('BarraInferiorWeb', () => {
  it('cada botón lleva a su página', async () => {
    await render(<BarraInferiorWeb activa={null} />);
    const casos: [string, string][] = [['Inicio', '/'], ['Departamentos', '/departamentos'], ['Roomies', '/roomies'], ['Servicios', '/servicios'], ['Iniciar sesión', '/(auth)/login']];
    for (const [etiqueta, ruta] of casos) {
      await fireEvent.press(screen.getByLabelText(etiqueta));
      expect(mockPush).toHaveBeenLastCalledWith(ruta);
    }
  });

  it('la página actual se anuncia con aria-current, y solo esa', async () => {
    await render(<BarraInferiorWeb activa="roomies" />);
    expect(screen.getByLabelText('Roomies').props['aria-current']).toBe('page');
    expect(screen.getByLabelText('Inicio').props['aria-current']).toBeUndefined();
    expect(screen.getByLabelText('Servicios').props['aria-current']).toBeUndefined();
  });

  it('es una navegación con nombre, para el lector de pantalla', async () => {
    await render(<BarraInferiorWeb activa="inicio" />);
    expect(screen.getByLabelText('Navegación principal')).toBeTruthy();
  });
});

describe('PildoraBusquedaWeb', () => {
  it('dice qué se busca y avisa al tocarla', async () => {
    const alTocar = jest.fn();
    await render(<PildoraBusquedaWeb titulo="¿Dónde quieres vivir?" subtitulo="Zona · presupuesto · tipo" onPress={alTocar} />);
    expect(screen.getByText('¿Dónde quieres vivir?')).toBeTruthy();
    expect(screen.getByText('Zona · presupuesto · tipo')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('¿Dónde quieres vivir?. Zona · presupuesto · tipo'));
    expect(alTocar).toHaveBeenCalledTimes(1);
  });

  it('si se despliega, dice si está desplegada', async () => {
    await render(<PildoraBusquedaWeb titulo="Lerma" subtitulo="Hasta $4,000" onPress={jest.fn()} expandida />);
    // En las pruebas `aria-expanded` llega como `accessibilityState`; en el navegador se escribe el atributo (se comprueba allí).
    expect(screen.getByLabelText('Lerma. Hasta $4,000').props.accessibilityState).toMatchObject({ expanded: true });
  });
});

describe('CarruselWeb', () => {
  it('trae su título, sus tarjetas y una flecha que lleva a la página completa', async () => {
    const verTodo = jest.fn();
    await render(<CarruselWeb titulo="Departamentos y cuartos" etiquetaVerTodo="Ver todos los lugares" onVerTodo={verTodo}><Text>tarjeta uno</Text><Text>tarjeta dos</Text></CarruselWeb>);
    expect(screen.getByText('Departamentos y cuartos')).toBeTruthy();
    expect(screen.getByText('tarjeta uno')).toBeTruthy();
    expect(screen.getByText('tarjeta dos')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ver todos los lugares'));
    expect(verTodo).toHaveBeenCalledTimes(1);
  });
});

describe('TarjetaPublicacionWeb compacta', () => {
  it('conserva lo importante: título (hasta dos renglones), zona corta, precio y calificación', async () => {
    await render(<TarjetaPublicacionWeb p={PUB} ancho={164} compacta />);
    expect(screen.getByText('Casa compartida en Santa María Atarasquillo').props.numberOfLines).toBe(2);
    expect(screen.getByText('Santa María Atarasquillo, Lerma')).toBeTruthy();
    expect(screen.getByText(/2,200/)).toBeTruthy();
    expect(screen.getByLabelText('Calificación 4.9 de 5')).toBeTruthy();
    expect(screen.queryByText(/52044/)).toBeNull();
  });

  it('sigue llevando a su ficha y pidiendo entrar para guardar', async () => {
    await render(<TarjetaPublicacionWeb p={PUB} ancho={164} compacta />);
    await fireEvent.press(screen.getByLabelText(/Casa compartida en Santa María Atarasquillo, 2,200 pesos al mes/));
    expect(mockPush).toHaveBeenLastCalledWith('/departamentos/p1');
    await fireEvent.press(screen.getByLabelText('Guardar: inicia sesión para guardar'));
    expect(mockPush).toHaveBeenLastCalledWith('/(auth)/login');
  });

  it('la etiqueta «Destacado» sale sola, sin tapar el corazón: es más chica', async () => {
    await render(<TarjetaPublicacionWeb p={PUB} ancho={164} compacta />);
    expect(screen.getByText('Destacado')).toBeTruthy();
  });
});

describe('TarjetaNegocioWeb', () => {
  it('foto con el nombre debajo, la zona corta y si está abierto', async () => {
    await render(<TarjetaNegocioWeb n={NEG} ancho={164} />);
    expect(screen.getByText('Café La Parada')).toBeTruthy();
    expect(screen.getByText('Centro, Lerma')).toBeTruthy();
    expect(screen.getByText('Abierto ahora')).toBeTruthy();
    expect(screen.queryByText(/52000/)).toBeNull();
  });

  it('lleva a su ficha, y la etiqueta incluye si está abierto', async () => {
    await render(<TarjetaNegocioWeb n={NEG} ancho={164} />);
    await fireEvent.press(screen.getByLabelText('Café La Parada, Abierto ahora'));
    expect(mockPush).toHaveBeenLastCalledWith('/servicios/n1');
  });

  it('si no se sabe si está abierto, no lo afirma', async () => {
    await render(<TarjetaNegocioWeb n={{ ...NEG, abierto_ahora: null } as unknown as NegocioExplorar} ancho={164} />);
    expect(screen.queryByText(/ahora/)).toBeNull();
    expect(screen.getByLabelText('Café La Parada')).toBeTruthy();
  });
});
