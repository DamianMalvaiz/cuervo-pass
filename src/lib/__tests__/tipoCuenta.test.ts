import { destinoTrasConfirmar, esVendedor, tipoParaElAlta } from '../tipoCuenta';

describe('tipo de cuenta', () => {
  it('solo arrendador y comerciante son vendedores', () => {
    expect(esVendedor('estudiante')).toBe(false);
    expect(esVendedor('arrendador')).toBe(true);
    expect(esVendedor('comerciante')).toBe(true);
  });

  it('el estudiante no manda tipo en el alta; el vendedor sí', () => {
    expect(tipoParaElAlta('estudiante')).toBeUndefined();
    expect(tipoParaElAlta('arrendador')).toBe('arrendador');
    expect(tipoParaElAlta('comerciante')).toBe('comerciante');
  });

  it('el vendedor se salta el cuestionario de estudiante', () => {
    expect(destinoTrasConfirmar('estudiante')).toBe('/(auth)/cuestionario-inicial');
    expect(destinoTrasConfirmar('arrendador')).toBe('/(tabs)/panel');
    expect(destinoTrasConfirmar('comerciante')).toBe('/(tabs)/panel');
  });
});
