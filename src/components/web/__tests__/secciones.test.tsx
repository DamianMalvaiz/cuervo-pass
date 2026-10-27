import { fireEvent, render, screen } from '@testing-library/react-native';

// Las secciones de la portada pública que enseñan lo que viene después de entrar. Lo que se fija: lo ilustrativo se DICE ilustrativo («Ejemplo»), lo que necesita cuenta lleva a entrar,
// y los textos de confianza afirman solo lo que el aviso de privacidad y la app sostienen.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/queries/useExplorar', () => ({ useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }) }));

import { ComoFuncionaWeb } from '../ComoFuncionaWeb';
import { ConfianzaWeb } from '../ConfianzaWeb';
import { MosaicoNegociosWeb } from '../MosaicoNegociosWeb';
import { RoomiesWeb } from '../RoomiesWeb';
import type { NegocioExplorar } from '@/services/explorar.service';

const neg = (i: number, extra: Partial<NegocioExplorar> = {}) =>
  ({ id: `n${i}`, nombre: `Negocio ${i}`, zona: 'Centro, Lerma, México, CP 52000', abierto_ahora: true, calificacion: null, num_fotos: 0, destacado: false, ...extra }) as unknown as NegocioExplorar;

beforeEach(() => jest.clearAllMocks());

describe('MosaicoNegociosWeb', () => {
  it('cada negocio es un mosaico con su nombre que lleva a su ficha pública', async () => {
    await render(<MosaicoNegociosWeb negocios={[neg(1), neg(2), neg(3), neg(4), neg(5)]} escritorio ancho={270} />);
    for (let i = 1; i <= 5; i++) expect(screen.getByText(`Negocio ${i}`)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/Negocio 3/));
    expect(mockPush).toHaveBeenCalledWith('/servicios/n3');
  });

  it('dice si está abierto o cerrado ahora, y no dice nada si no se sabe', async () => {
    await render(<MosaicoNegociosWeb negocios={[neg(1), neg(2, { abierto_ahora: false }), neg(3, { abierto_ahora: null })]} escritorio ancho={270} />);
    expect(screen.getByLabelText('Negocio 1, Abierto ahora')).toBeTruthy();
    expect(screen.getByLabelText('Negocio 2, Cerrado ahora')).toBeTruthy();
    expect(screen.getByLabelText('Negocio 3')).toBeTruthy();
  });

  it('con más de cinco, los demás también salen (ninguno se pierde)', async () => {
    await render(<MosaicoNegociosWeb negocios={Array.from({ length: 8 }, (_, i) => neg(i + 1))} escritorio ancho={270} />);
    for (let i = 1; i <= 8; i++) expect(screen.getByText(`Negocio ${i}`)).toBeTruthy();
  });

  it('con uno solo no rompe', async () => {
    await render(<MosaicoNegociosWeb negocios={[neg(1)]} escritorio={false} ancho={340} />);
    expect(screen.getByText('Negocio 1')).toBeTruthy();
  });
});

describe('RoomiesWeb', () => {
  it('explica de qué trata y dice que los perfiles solo se ven con cuenta', async () => {
    await render(<RoomiesWeb escritorio textoBoton="Ver roomies" alBoton={jest.fn()} />);
    expect(screen.getByText(/Con quién vives importa/)).toBeTruthy();
    expect(screen.getByText(/se ven al iniciar sesión/)).toBeTruthy();
  });

  it('el botón dice y hace lo que la página decida', async () => {
    const alBoton = jest.fn();
    await render(<RoomiesWeb escritorio textoBoton="Iniciar sesión para ver roomies" alBoton={alBoton} />);
    await fireEvent.press(screen.getByLabelText('Iniciar sesión para ver roomies'));
    expect(alBoton).toHaveBeenCalledTimes(1);
  });

  it('las personas de las tarjetas son EJEMPLOS y cada una lo dice (no hay perfiles reales a la vista)', async () => {
    await render(<RoomiesWeb escritorio textoBoton="Ver roomies" alBoton={jest.fn()} />);
    expect(screen.getAllByText('Ejemplo')).toHaveLength(3);
    expect(screen.getAllByLabelText(/compatible/).length).toBe(3);
  });

  it('en pantalla angosta también aparecen (y siguen marcadas como ejemplo)', async () => {
    await render(<RoomiesWeb escritorio={false} textoBoton="Ver roomies" alBoton={jest.fn()} />);
    expect(screen.getAllByText('Ejemplo').length).toBeGreaterThan(0);
  });
});

describe('ComoFuncionaWeb', () => {
  it('cuenta los tres pasos', async () => {
    await render(<ComoFuncionaWeb escritorio />);
    for (const t of ['Cuéntanos qué buscas', 'Ordenamos por ajuste', 'Escribe dentro de la app']) expect(screen.getByText(t)).toBeTruthy();
  });

  it('la tarjeta de ajuste es un EJEMPLO y no inventa cifras concretas (distancias, precios)', async () => {
    await render(<ComoFuncionaWeb escritorio titulo="Cuarto en Toluca Centro" />);
    expect(screen.getByText('Ejemplo')).toBeTruthy();
    expect(screen.getByText('Cuarto en Toluca Centro')).toBeTruthy();
    for (const c of ['Presupuesto', 'Distancia', 'Mascotas', 'Ruido']) expect(screen.getByText(c)).toBeTruthy();
    expect(screen.queryByText(/\d+(\.\d+)? km/)).toBeNull();
    expect(screen.queryByText(/\$\d/)).toBeNull();
  });
});

describe('ConfianzaWeb', () => {
  it('afirma solo lo que el aviso y la app sostienen', async () => {
    await render(<ConfianzaWeb escritorio />);
    expect(screen.getByText('Hecho para que confíes')).toBeTruthy();
    expect(screen.getByText(/revisión de identidad hecha por una persona/)).toBeTruthy();
    expect(screen.getByText(/No vendemos tus datos ni los usamos para publicidad/)).toBeTruthy();
    expect(screen.getByText(/borrar tu cuenta cuando quieras/)).toBeTruthy();
  });

  it('el sello dice qué es, con texto y no solo con dibujo', async () => {
    await render(<ConfianzaWeb escritorio />);
    expect(screen.getByText('Identidad revisada por una persona')).toBeTruthy();
  });
});
