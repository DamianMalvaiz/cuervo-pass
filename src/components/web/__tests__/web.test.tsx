import { fireEvent, render, screen } from '@testing-library/react-native';

// Las piezas de la web pública. Lo que se fija: el buscador es CONTROLADO y cada campo cambia el filtro; los chips de tipo son excluyentes entre sí y los de sí/no se prenden y apagan; las
// acciones que necesitan cuenta llevan a entrar; y nada de esto pide datos que un visitante sin cuenta no puede ver.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/queries/useExplorar', () => ({ useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }) }));

import { BarraWeb } from '../BarraWeb';
import { BuscadorWeb } from '../BuscadorWeb';
import { ChipsTiposWeb } from '../ChipsTiposWeb';
import { HeroWeb } from '../HeroWeb';
import { PieWeb } from '../PieWeb';
import { TarjetaPublicacionWeb } from '../TarjetaPublicacionWeb';
import { FILTROS_VACIOS } from '@/lib/filtrosWeb';
import type { PublicacionExplorar } from '@/services/explorar.service';

const PUB = { id: 'p1', titulo_publico: 'Cuarto en Capultitlán', tipo: 'cuarto', precio_renta: 3459, zona: 'Capultitlán, Toluca, México, CP 50296', num_fotos: 0, destacado: true, calificacion: 4.9, num_resenas: 3 } as PublicacionExplorar;

beforeEach(() => jest.clearAllMocks());

describe('BarraWeb', () => {
  it('lleva a entrar y a crear cuenta', async () => {
    await render(<BarraWeb escritorio />);
    await fireEvent.press(screen.getByLabelText('Iniciar sesión'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
    await fireEvent.press(screen.getByLabelText('Crear cuenta'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/registro');
  });

  it('las pestañas llevan cada una a SU página', async () => {
    await render(<BarraWeb escritorio />);
    await fireEvent.press(screen.getByLabelText('Roomies'));
    expect(mockPush).toHaveBeenLastCalledWith('/roomies');
    await fireEvent.press(screen.getByLabelText('Servicios'));
    expect(mockPush).toHaveBeenLastCalledWith('/servicios');
    await fireEvent.press(screen.getByLabelText('Departamentos'));
    expect(mockPush).toHaveBeenLastCalledWith('/departamentos');
  });

  it('el logo lleva al inicio', async () => {
    await render(<BarraWeb escritorio />);
    await fireEvent.press(screen.getByLabelText('Ir al inicio'));
    expect(mockPush).toHaveBeenLastCalledWith('/');
  });

  it('en pantalla angosta no hay pestañas (no caben) pero sí las dos cuentas', async () => {
    await render(<BarraWeb escritorio={false} />);
    expect(screen.queryByLabelText('Roomies')).toBeNull();
    expect(screen.getByLabelText('Iniciar sesión')).toBeTruthy();
    expect(screen.getByLabelText('Crear cuenta')).toBeTruthy();
  });
});

describe('BuscadorWeb', () => {
  it('cada campo cambia el filtro sin tocar los demás', async () => {
    const cambiar = jest.fn();
    await render(<BuscadorWeb filtros={{ ...FILTROS_VACIOS, zona: 'Lerma' }} onCambiar={cambiar} onBuscar={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Zona o colonia'), 'Toluca');
    expect(cambiar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, zona: 'Toluca' });
    await fireEvent.changeText(screen.getByLabelText('Presupuesto máximo al mes'), '4000');
    expect(cambiar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, zona: 'Lerma', presupuesto: '4000' });
  });

  it('el tipo recorre sus opciones y dice cuál es', async () => {
    const cambiar = jest.fn();
    await render(<BuscadorWeb filtros={FILTROS_VACIOS} onCambiar={cambiar} onBuscar={jest.fn()} />);
    expect(screen.getByLabelText(/Tipo: Todos/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/Tipo: Todos/));
    expect(cambiar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, tipo: 'cuarto' });
  });

  it('el presupuesto solo acepta lo que parece cifra (sin letras)', async () => {
    const cambiar = jest.fn();
    await render(<BuscadorWeb filtros={FILTROS_VACIOS} onCambiar={cambiar} onBuscar={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Presupuesto máximo al mes'), '4a0b00');
    expect(cambiar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, presupuesto: '4000' });
  });

  it('Buscar avisa, y Enter en un campo también', async () => {
    const buscar = jest.fn();
    await render(<BuscadorWeb filtros={FILTROS_VACIOS} onCambiar={jest.fn()} onBuscar={buscar} />);
    await fireEvent.press(screen.getByLabelText('Buscar'));
    expect(buscar).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByLabelText('Zona o colonia'), 'submitEditing');
    expect(buscar).toHaveBeenCalledTimes(2);
  });
});

describe('ChipsTiposWeb', () => {
  it('los tipos son excluyentes: tocar uno lo prende, tocarlo de nuevo lo apaga', async () => {
    const cambiar = jest.fn();
    const { rerender } = await render(<ChipsTiposWeb filtros={FILTROS_VACIOS} onCambiar={cambiar} />);
    await fireEvent.press(screen.getByLabelText('Filtrar por departamentos'));
    expect(cambiar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, tipo: 'depa' });
    await rerender(<ChipsTiposWeb filtros={{ ...FILTROS_VACIOS, tipo: 'depa' }} onCambiar={cambiar} />);
    // En la web `selected` no se escribe para botones: un filtro puesto es una casilla marcada.
    expect(screen.getByLabelText('Filtrar por departamentos').props.accessibilityRole).toBe('checkbox');
    expect(screen.getByLabelText('Filtrar por departamentos').props.accessibilityState).toEqual({ checked: true });
    // En el navegador, React Native Web ignora `accessibilityState` y escribe `aria-checked` (se pasa también como prop `aria-checked`); eso solo se comprueba en el navegador, no aquí.
    await fireEvent.press(screen.getByLabelText('Filtrar por departamentos'));
    expect(cambiar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, tipo: null });
  });

  it('amueblado, mascotas y servicios incluidos se prenden y apagan solos', async () => {
    const cambiar = jest.fn();
    await render(<ChipsTiposWeb filtros={{ ...FILTROS_VACIOS, mascotas: true }} onCambiar={cambiar} />);
    await fireEvent.press(screen.getByLabelText('Filtrar por amueblado'));
    expect(cambiar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, mascotas: true, amueblado: true });
    await fireEvent.press(screen.getByLabelText('Filtrar por acepta mascotas'));
    expect(cambiar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, mascotas: false });
    await fireEvent.press(screen.getByLabelText('Filtrar por servicios incluidos'));
    expect(cambiar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, mascotas: true, serviciosIncluidos: true });
  });
});

describe('TarjetaPublicacionWeb', () => {
  it('enseña el título armado, la zona corta, el precio y la calificación; nunca el CP ni la dirección', async () => {
    await render(<TarjetaPublicacionWeb p={PUB} />);
    expect(screen.getByText('Cuarto en Capultitlán')).toBeTruthy();
    expect(screen.getByText('Capultitlán, Toluca')).toBeTruthy();
    expect(screen.getByText(/3,459/)).toBeTruthy();
    expect(screen.getByLabelText('Calificación 4.9 de 5')).toBeTruthy();
    expect(screen.queryByText(/50296/)).toBeNull();
  });

  it('un destacado lo dice', async () => {
    const { unmount } = await render(<TarjetaPublicacionWeb p={PUB} />);
    expect(screen.getByText('Destacado')).toBeTruthy();
    await unmount();
    await render(<TarjetaPublicacionWeb p={{ ...PUB, destacado: false, id: 'p2' }} />);
    expect(screen.queryByText('Destacado')).toBeNull();
  });

  it('al tocarla va a su ficha pública; el corazón pide entrar (no guarda nada sin cuenta)', async () => {
    await render(<TarjetaPublicacionWeb p={PUB} />);
    await fireEvent.press(screen.getByLabelText(/Cuarto en Capultitlán, 3,459 pesos al mes/));
    expect(mockPush).toHaveBeenLastCalledWith('/departamentos/p1');
    await fireEvent.press(screen.getByLabelText('Guardar: inicia sesión para guardar'));
    expect(mockPush).toHaveBeenLastCalledWith('/(auth)/login');
  });

  it('sin calificación no pone una (ni un cero)', async () => {
    await render(<TarjetaPublicacionWeb p={{ ...PUB, calificacion: null, num_resenas: null }} />);
    expect(screen.queryByLabelText(/Calificación/)).toBeNull();
  });
});

describe('HeroWeb', () => {
  const props = { filtros: FILTROS_VACIOS, onCambiar: jest.fn(), onBuscar: jest.fn(), fotos: [] as string[] };

  it('dice qué es y trae el buscador y las dos cuentas', async () => {
    await render(<HeroWeb {...props} escritorio />);
    expect(screen.getByText(/Encuentra dónde/)).toBeTruthy();
    expect(screen.getByLabelText('Zona o colonia')).toBeTruthy();
    expect(screen.getByLabelText('Iniciar sesión')).toBeTruthy();
  });

  it('la tarjeta de ajuste es un EJEMPLO y lo dice (el ajuste real pide cuenta)', async () => {
    await render(<HeroWeb {...props} escritorio />);
    expect(screen.getByText('Ejemplo')).toBeTruthy();
  });

  it('las tres promesas de confianza están', async () => {
    await render(<HeroWeb {...props} escritorio />);
    for (const t of ['Vendedores verificados', 'No vendemos tus datos', 'Gratis para estudiantes']) expect(screen.getByText(t)).toBeTruthy();
  });
});

describe('PieWeb', () => {
  it('lleva al aviso de privacidad y a los términos', async () => {
    await render(<PieWeb />);
    await fireEvent.press(screen.getByLabelText('Aviso de privacidad'));
    expect(mockPush).toHaveBeenLastCalledWith('/aviso-privacidad');
    await fireEvent.press(screen.getByLabelText('Términos y condiciones'));
    expect(mockPush).toHaveBeenLastCalledWith('/terminos');
  });

  it('dice que es un proyecto académico', async () => {
    await render(<PieWeb />);
    expect(screen.getByText(/Proyecto académico de la UTVT/)).toBeTruthy();
  });
});
