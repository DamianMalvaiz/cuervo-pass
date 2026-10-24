import {
  agruparPorHoras, formatearHora, normalizarHora, lineasPorDia, resumenAcotado, parsearHorarioTexto, resumenDeTurnos, validarHorarioCompleto, validarTurnos, type Turno,
} from '../horario';

// El horario estructurado (migración 0070). Lo que se fija: el analizador de los textos que ya existen (para no perder los 24 horarios de ejemplo), el resumen legible
// que se enseña, y la validación que se hace ANTES de mandar (la base vuelve a validar).

const T = (dia: number, abre: string, cierra: string): Turno => ({ dia: dia as Turno['dia'], abre, cierra });
const semana = (de: number, a: number, abre: string, cierra: string) => Array.from({ length: a - de + 1 }, (_, i) => T(de + i, abre, cierra));

describe('formatearHora', () => {
  it.each([
    ['08:00', '8 am'], ['09:30', '9:30 am'], ['12:00', '12 pm'], ['00:00', '12 am'], ['13:05', '1:05 pm'], ['23:59', '11:59 pm'], ['18:00', '6 pm'], ['12:30', '12:30 pm'],
  ])('%s → %s', (hhmm, esperado) => expect(formatearHora(hhmm)).toBe(esperado));
  it('algo que no es hora se devuelve tal cual, sin inventar', () => expect(formatearHora('xx')).toBe('xx'));
});

describe('parsearHorarioTexto (los formatos que ya existen)', () => {
  it('lun a sáb · 8 am a 8 pm', () => {
    expect(parsearHorarioTexto('Lun a sáb · 8 am a 8 pm')).toEqual(semana(1, 6, '08:00', '20:00'));
  });
  it('mar a dom', () => expect(parsearHorarioTexto('Mar a dom · 10 am a 8 pm')).toEqual(semana(2, 7, '10:00', '20:00')));
  it('todos los días', () => expect(parsearHorarioTexto('Todos los días · 8 am a 10 pm')).toEqual(semana(1, 7, '08:00', '22:00')));
  it('lun a vie con nota «con cita»: las horas se toman, la nota se ignora', () => {
    expect(parsearHorarioTexto('Lun a vie · 10 am a 7 pm · con cita')).toEqual(semana(1, 5, '10:00', '19:00'));
  });
  it('mediodía y medianoche: 12 pm es las 12:00 y 12 am las 00:00', () => {
    expect(parsearHorarioTexto('Lun a sáb · 7 am a 12 pm')).toEqual(semana(1, 6, '07:00', '12:00'));
    expect(parsearHorarioTexto('Todos los días · 6 pm a 12 am')).toEqual(semana(1, 7, '18:00', '00:00'));
  });
  it('«24 horas» es 00:00–23:59', () => {
    expect(parsearHorarioTexto('Todos los días · 24 horas')).toEqual(semana(1, 7, '00:00', '23:59'));
  });
  it('con minutos', () => expect(parsearHorarioTexto('Lun a vie · 9:30 am a 6:15 pm')).toEqual(semana(1, 5, '09:30', '18:15')));
  it('el rango que cruza el domingo (vie a lun) da los cuatro días', () => {
    expect(parsearHorarioTexto('Vie a lun · 8 pm a 2 am')?.map((t) => t.dia)).toEqual([5, 6, 7, 1]);
  });
  it('un día suelto', () => expect(parsearHorarioTexto('Sáb · 10 am a 2 pm')).toEqual([T(6, '10:00', '14:00')]));
  it('nombres de día completos y con acento', () => {
    expect(parsearHorarioTexto('Lunes a Sábado · 9 am a 5 pm')).toEqual(semana(1, 6, '09:00', '17:00'));
  });

  it.each([
    ['sin horas: no se inventan', 'Lunes a Sábado'],
    ['vacío', ''],
    ['basura', 'cuando se pueda'],
    ['una hora inválida', 'Lun a vie · 13 pm a 5 pm'],
    ['abrir y cerrar igual', 'Lun a vie · 9 am a 9 am'],
    ['minutos inválidos', 'Lun a vie · 9:75 am a 5 pm'],
  ])('%s → null', (_n, texto) => expect(parsearHorarioTexto(texto)).toBeNull());

  it('nulo o no texto → null', () => {
    expect(parsearHorarioTexto(null)).toBeNull();
    expect(parsearHorarioTexto(undefined)).toBeNull();
  });
});

describe('agruparPorHoras', () => {
  it('une los días consecutivos con las mismas horas', () => {
    expect(agruparPorHoras(semana(1, 6, '08:00', '20:00'))).toEqual([{ dias: [1, 2, 3, 4, 5, 6], horas: [['08:00', '20:00']] }]);
  });
  it('separa días con horas distintas y conserva el orden de la semana', () => {
    const g = agruparPorHoras([...semana(1, 5, '09:00', '18:00'), T(6, '10:00', '14:00')]);
    expect(g.map((x) => x.dias)).toEqual([[1, 2, 3, 4, 5], [6]]);
  });
  it('varios turnos el mismo día van en el mismo grupo, ordenados por apertura', () => {
    const g = agruparPorHoras([T(1, '16:00', '20:00'), T(1, '09:00', '14:00')]);
    expect(g).toEqual([{ dias: [1], horas: [['09:00', '14:00'], ['16:00', '20:00']] }]);
  });
  it('sin turnos, sin grupos', () => expect(agruparPorHoras([])).toEqual([]));
});

describe('resumenDeTurnos', () => {
  it('lun a sáb', () => expect(resumenDeTurnos(semana(1, 6, '08:00', '20:00'))).toBe('Lunes a sábado · 8 am a 8 pm'));
  it('todos los días', () => expect(resumenDeTurnos(semana(1, 7, '08:00', '22:00'))).toBe('Todos los días · 8 am a 10 pm'));
  it('24 horas', () => expect(resumenDeTurnos(semana(1, 7, '00:00', '23:59'))).toBe('Todos los días · 24 horas'));
  it('días sueltos no consecutivos', () => expect(resumenDeTurnos([T(1, '09:00', '12:00'), T(3, '09:00', '12:00')])).toBe('Lunes y miércoles · 9 am a 12 pm'));
  it('un día', () => expect(resumenDeTurnos([T(6, '10:00', '14:00')])).toBe('Sábado · 10 am a 2 pm'));
  it('dos turnos el mismo día', () => expect(resumenDeTurnos([T(1, '09:00', '14:00'), T(1, '16:00', '20:00')])).toBe('Lunes · 9 am a 2 pm y 4 pm a 8 pm'));
  it('varios grupos separados por «; »', () => {
    expect(resumenDeTurnos([...semana(1, 5, '09:00', '18:00'), T(6, '10:00', '14:00')])).toBe('Lunes a viernes · 9 am a 6 pm; Sábado · 10 am a 2 pm');
  });
  it('lo que cruza la medianoche se dice igual', () => expect(resumenDeTurnos([T(5, '20:00', '02:00')])).toBe('Viernes · 8 pm a 2 am'));
  it('sin turnos, cadena vacía', () => expect(resumenDeTurnos([])).toBe(''));
  it('es el inverso del analizador para los textos regulares', () => {
    for (const t of ['Lunes a sábado · 8 am a 8 pm', 'Martes a domingo · 10 am a 8 pm', 'Todos los días · 8 am a 10 pm', 'Lunes a viernes · 9 am a 5 pm']) {
      expect(resumenDeTurnos(parsearHorarioTexto(t)!)).toBe(t);
    }
  });
});

describe('validarTurnos', () => {
  it('una lista sana no tiene errores', () => expect(validarTurnos(semana(1, 5, '09:00', '18:00'))).toBeNull());
  it('vacía es válida (significa «sin horario»)', () => expect(validarTurnos([])).toBeNull());
  it('más de 21 turnos', () => expect(validarTurnos(Array.from({ length: 22 }, () => T(1, '09:00', '10:00')))).toMatch(/21/));
  it('una hora mal formada', () => expect(validarTurnos([T(1, '9:00', '18:00')])).toMatch(/hora/i));
  it('abrir y cerrar a la misma hora', () => expect(validarTurnos([T(1, '09:00', '09:00')])).toMatch(/misma hora/i));
  it('un día fuera de rango', () => expect(validarTurnos([{ dia: 9 as never, abre: '09:00', cierra: '10:00' }])).toMatch(/día/i));
});

describe('normalizarHora', () => {
  it.each([
    ['9', '09:00'], ['09', '09:00'], ['9:30', '09:30'], ['930', '09:30'], ['0930', '09:30'], ['18:05', '18:05'], [' 7 ', '07:00'], ['0', '00:00'],
  ])('«%s» → %s', (entrada, salida) => expect(normalizarHora(entrada)).toBe(salida));
  it.each([['24:00'], ['9:60'], ['abc'], [''], ['9:3'], ['123456']])('«%s» se deja tal cual (no se adivina)', (entrada) => {
    expect(normalizarHora(entrada)).toBe(entrada);
  });
});

describe('resumenAcotado', () => {
  it('si cabe, es el resumen completo', () => {
    expect(resumenAcotado(semana(1, 5, '09:00', '18:00'), 120)).toBe('Lunes a viernes · 9 am a 6 pm');
  });
  it('si no cabe, corta por grupos completos y lo marca con «…»', () => {
    const t: Turno[] = [1, 2, 3, 4, 5, 6, 7].flatMap((d) => [T(d as 1, `0${d}:00`, `0${d}:30`), T(d as 1, `1${d}:00`, `1${d}:30`), T(d as 1, `2${d - 1}:00`, `2${d - 1}:45`)]);
    const r = resumenAcotado(t, 60);
    expect(r.length).toBeLessThanOrEqual(60);
    expect(r.endsWith('…')).toBe(true);
    expect(resumenDeTurnos(t).startsWith(r.slice(0, -1).replace(/; $/, ''))).toBe(true);
  });
  it('sin turnos, vacío', () => expect(resumenAcotado([], 120)).toBe(''));
});

describe('validarHorarioCompleto', () => {
  const todosMenos = (...abiertos: number[]) => ([1, 2, 3, 4, 5, 6, 7] as const).filter((d) => !abiertos.includes(d));

  it('lo completo (lunes abierto, el resto cerrado) no tiene errores', () => {
    expect(validarHorarioCompleto([T(1, '08:00', '20:00')], todosMenos(1))).toBeNull();
  });
  it('un día sin decidir se nombra completo, en minúsculas', () => {
    expect(validarHorarioCompleto([T(1, '08:00', '20:00')], [2, 3, 5, 6, 7])).toBe('Te falta decidir el jueves.');
  });
  it('sin ningún día decidido, el primero es el lunes', () => {
    expect(validarHorarioCompleto([], [])).toBe('Te falta decidir el lunes.');
  });
  it('todo cerrado: tiene que abrir al menos un día', () => {
    expect(validarHorarioCompleto([], [1, 2, 3, 4, 5, 6, 7])).toMatch(/al menos un día/);
  });
  it('un día abierto con horas mal escritas se rechaza como siempre', () => {
    expect(validarHorarioCompleto([T(1, '9', '20:00')], todosMenos(1))).toMatch(/Revisa las horas/);
  });
  it('un día no puede estar a la vez abierto y cerrado: gana lo abierto', () => {
    expect(validarHorarioCompleto([T(1, '08:00', '20:00')], [1, 2, 3, 4, 5, 6, 7])).toBeNull();
  });
});

describe('lineasPorDia', () => {
  it('siempre son siete, de lunes a domingo, con los nombres completos', () => {
    expect(lineasPorDia([]).map((l) => l.dia)).toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
  });
  it('un día con turno dice sus horas; uno sin turnos dice «Cerrado»', () => {
    const l = lineasPorDia([T(1, '08:00', '20:00'), T(6, '09:00', '14:00')]);
    expect(l[0]).toEqual({ dia: 'Lunes', horas: '8 am a 8 pm' });
    expect(l[1]).toEqual({ dia: 'Martes', horas: 'Cerrado' });
    expect(l[5]).toEqual({ dia: 'Sábado', horas: '9 am a 2 pm' });
    expect(l[6]).toEqual({ dia: 'Domingo', horas: 'Cerrado' });
  });
  it('dos turnos el mismo día se unen con «y», en orden', () => {
    expect(lineasPorDia([T(3, '16:00', '20:00'), T(3, '09:00', '14:00')])[2].horas).toBe('9 am a 2 pm y 4 pm a 8 pm');
  });
  it('de 00:00 a 23:59 se dice «24 horas»', () => {
    expect(lineasPorDia([T(2, '00:00', '23:59')])[1].horas).toBe('24 horas');
  });
});
