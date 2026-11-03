import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

// Las páginas informativas (ayuda, guía de visita, contrato, acuerdos): contenido fijo, que se ve igual con o sin cuenta. Lo que se fija: lo que prometen lo cumplen (marcar, buscar, copiar) y no dicen más de lo que saben.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/use-tamano-pantalla', () => ({ useTamanoPantalla: () => ({ ancho: 1440, alto: 900, clase: 'amplia' }) }));
jest.mock('../PaginaWeb', () => ({ PaginaWeb: ({ children }: { children: React.ReactNode }) => children }));

import { AcuerdosWeb, TEMAS_ACUERDO, textoDelAcuerdo } from '../AcuerdosWeb';
import { AyudaWeb, PREGUNTAS, filtrarPreguntas } from '../AyudaWeb';
import { ContratoWeb, PUNTOS_CONTRATO } from '../ContratoWeb';
import { GuiaVisitaWeb, QUE_MIRAR, QUE_PREGUNTAR } from '../GuiaVisitaWeb';
import { CORREO_RESPONSABLE } from '@/lib/avisoPrivacidad';

beforeEach(() => jest.clearAllMocks());

describe('en todas: cruces y encabezado', () => {
  it('cada página enseña su título y enlaza a las OTRAS tres (no a sí misma)', async () => {
    await render(<ContratoWeb />);
    expect(screen.getByText('Entiende tu contrato')).toBeTruthy();
    expect(screen.getByLabelText('Ayuda y contacto')).toBeTruthy();
    expect(screen.getByLabelText('Guía para visitar un lugar')).toBeTruthy();
    expect(screen.getByLabelText('Acuerdos de convivencia')).toBeTruthy();
    expect(screen.queryByLabelText('Entiende tu contrato')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Ayuda y contacto'));
    expect(mockPush).toHaveBeenCalledWith('/ayuda');
  });
});

describe('Guía para visitar un lugar', () => {
  it('cuenta lo revisado, deja marcar y desmarcar, y quitar todas las marcas', async () => {
    await render(<GuiaVisitaWeb />);
    const total = QUE_MIRAR.length + QUE_PREGUNTAR.length;
    expect(screen.getByText(`0 de ${total} revisadas`)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(QUE_MIRAR[0]));
    await fireEvent.press(screen.getByLabelText(QUE_PREGUNTAR[0]));
    expect(screen.getByText(`2 de ${total} revisadas`)).toBeTruthy();
    expect(screen.getByLabelText(QUE_MIRAR[0]).props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByLabelText(QUE_MIRAR[0]));
    expect(screen.getByText(`1 de ${total} revisadas`)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Quitar todas las marcas'));
    expect(screen.getByText(`0 de ${total} revisadas`)).toBeTruthy();
    expect(screen.queryByLabelText('Quitar todas las marcas')).toBeNull();
  });
  it('aconseja no pagar antes de ver el lugar y tener el acuerdo por escrito', async () => {
    await render(<GuiaVisitaWeb />);
    expect(screen.getByText(/No pagues nada antes de ver el lugar/)).toBeTruthy();
  });
});

describe('Entiende tu contrato', () => {
  it('enseña los seis puntos y dice que es orientación, no asesoría legal', async () => {
    await render(<ContratoWeb />);
    for (const p of PUNTOS_CONTRATO) expect(screen.getByText(p.titulo)).toBeTruthy();
    expect(PUNTOS_CONTRATO).toHaveLength(6);
    expect(screen.getByText(/no asesoría legal/)).toBeTruthy();
  });
  it('no cita leyes ni cifras legales (solo orientación)', () => {
    const todo = PUNTOS_CONTRATO.map((p) => p.texto).join(' ');
    expect(todo).not.toMatch(/\bley\b|código civil|artículo|\d+ ?%|por ley/i);
  });
});

describe('Acuerdos de convivencia', () => {
  it('sin nada elegido no hay resumen que copiar', async () => {
    expect(textoDelAcuerdo({})).toBeNull();
    await render(<AcuerdosWeb />);
    expect(screen.queryByLabelText('Copiar para mis roomies')).toBeNull();
    expect(screen.getByText(/aquí va quedando el resumen/)).toBeTruthy();
  });
  it('lo elegido forma el resumen, uno por renglón y en el orden de los temas; elegir de nuevo lo quita', async () => {
    expect(textoDelAcuerdo({ ruido: 'Silencio de 11 pm a 7 am', gastos: 'Partes iguales' })).toBe('Acuerdos de convivencia\n· Gastos: Partes iguales\n· Ruido: Silencio de 11 pm a 7 am');
    await render(<AcuerdosWeb />);
    await fireEvent.press(screen.getByLabelText('Gastos: Partes iguales'));
    expect(screen.getByText(/· Gastos: Partes iguales/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Gastos: Según el cuarto'));
    expect(screen.queryByText(/· Gastos: Partes iguales/)).toBeNull();
    expect(screen.getByText(/· Gastos: Según el cuarto/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Gastos: Según el cuarto'));
    expect(screen.queryByLabelText('Copiar para mis roomies')).toBeNull();
  });
  it('copia el resumen; si el portapapeles falla NO dice «copiado»', async () => {
    const g = globalThis as unknown as { navigator?: unknown };
    const escribir = jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('sin permiso'));
    g.navigator = { clipboard: { writeText: escribir } };
    await render(<AcuerdosWeb />);
    await fireEvent.press(screen.getByLabelText(`${TEMAS_ACUERDO[0].titulo}: ${TEMAS_ACUERDO[0].opciones[0]}`));
    await fireEvent.press(screen.getByLabelText('Copiar para mis roomies'));
    expect(escribir).toHaveBeenCalledWith('Acuerdos de convivencia\n· Gastos: Partes iguales');
    expect(await screen.findByText(/Copiado\. Pégalo/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Copiar para mis roomies'));
    expect(await screen.findByText(/No se pudo copiar solo/)).toBeTruthy();
    expect(screen.queryByText(/Copiado\. Pégalo/)).toBeNull();
    delete g.navigator;
  });
});

describe('Ayuda y contacto', () => {
  it('la búsqueda ignora acentos y mayúsculas', () => {
    expect(filtrarPreguntas('DIRECCION').map((x) => x.p)).toContain('¿Por qué no veo la dirección exacta?');
    expect(filtrarPreguntas('')).toHaveLength(PREGUNTAS.length);
    expect(filtrarPreguntas('   ')).toHaveLength(PREGUNTAS.length);
    expect(filtrarPreguntas('zzzzzz')).toHaveLength(0);
  });
  it('una pregunta se abre y se cierra, y solo hay una abierta', async () => {
    await render(<AyudaWeb />);
    expect(screen.queryByText(/nadie recibe tu teléfono antes de tiempo/)).toBeNull();
    await fireEvent.press(screen.getByLabelText(PREGUNTAS[0].p));
    expect(screen.getByText(PREGUNTAS[0].r)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(PREGUNTAS[1].p));
    expect(screen.queryByText(PREGUNTAS[0].r)).toBeNull();
    expect(screen.getByText(PREGUNTAS[1].r)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(PREGUNTAS[1].p));
    expect(screen.queryByText(PREGUNTAS[1].r)).toBeNull();
  });
  it('buscar filtra la lista; si nada coincide lo dice con salida (escribirnos)', async () => {
    await render(<AyudaWeb />);
    await fireEvent.changeText(screen.getByLabelText('Busca una pregunta'), 'mercado pago');
    expect(screen.getByLabelText('¿Cuánto cuesta publicar?')).toBeTruthy();
    expect(screen.queryByLabelText('¿Cómo borro mi cuenta?')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Busca una pregunta'), 'zzzzzz');
    expect(screen.getByText(/Ninguna pregunta coincide/)).toBeTruthy();
    expect(screen.getByLabelText('Escribir al equipo')).toBeTruthy();
  });
  it('muestra el correo de contacto como texto y el botón lo intenta abrir', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<AyudaWeb />);
    expect(screen.getByText(CORREO_RESPONSABLE)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Escribir al equipo'));
    expect(abrir).toHaveBeenCalledWith(`mailto:${CORREO_RESPONSABLE}`);
    abrir.mockRestore();
  });
  it('no promete lo que no cumple: sin «gratis para siempre», sin «seguridad total», y dice que los pagos son de prueba', () => {
    const todo = PREGUNTAS.map((x) => x.r).join(' ');
    expect(todo).not.toMatch(/para siempre|100 ?%|garantiz/i);
    expect(todo).toMatch(/modo de pruebas/);
  });
});
