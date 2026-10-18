import { MAX_FOTOS_LUGAR, esRolVendedor, validarVerificacion, type DatosVerificacion } from '../verificacion';

const completo: DatosVerificacion = {
  nombreLegal: 'Ana Prueba Ruiz',
  direccion: 'Calle 1, Lerma',
  ineFrente: 'file:///f.jpg',
  ineReverso: 'file:///r.jpg',
  fotosLugar: ['file:///1.jpg'],
  consiente: true,
};

describe('validarVerificacion', () => {
  it('con todo completo no falta nada', () => {
    expect(validarVerificacion(completo, 'comerciante')).toEqual({});
  });

  it('dice qué falta, campo por campo', () => {
    const e = validarVerificacion(
      { nombreLegal: '', direccion: '', ineFrente: null, ineReverso: null, fotosLugar: [], consiente: false },
      'comerciante'
    );
    expect(Object.keys(e).sort()).toEqual(['consiente', 'direccion', 'fotosLugar', 'ineFrente', 'ineReverso', 'nombreLegal']);
  });

  it('el nombre y la dirección cuentan sin espacios sobrantes', () => {
    expect(validarVerificacion({ ...completo, nombreLegal: '  ab  ' }, 'comerciante').nombreLegal).toBeTruthy();
    expect(validarVerificacion({ ...completo, direccion: '  1234  ' }, 'comerciante').direccion).toBeTruthy();
    expect(validarVerificacion({ ...completo, nombreLegal: ' abc ' }, 'comerciante').nombreLegal).toBeUndefined();
  });

  it('respeta los límites de la base: 120 y 200', () => {
    expect(validarVerificacion({ ...completo, nombreLegal: 'a'.repeat(121) }, 'comerciante').nombreLegal).toBeTruthy();
    expect(validarVerificacion({ ...completo, nombreLegal: 'a'.repeat(120) }, 'comerciante').nombreLegal).toBeUndefined();
    expect(validarVerificacion({ ...completo, direccion: 'a'.repeat(201) }, 'comerciante').direccion).toBeTruthy();
  });

  it('pide cada lado de la INE por separado', () => {
    expect(validarVerificacion({ ...completo, ineFrente: null }, 'comerciante').ineFrente).toBeTruthy();
    expect(validarVerificacion({ ...completo, ineReverso: null }, 'comerciante').ineReverso).toBeTruthy();
  });

  it('las fotos del lugar: al menos una y no más del máximo', () => {
    expect(validarVerificacion({ ...completo, fotosLugar: [] }, 'comerciante').fotosLugar).toMatch(/negocio/);
    expect(validarVerificacion({ ...completo, fotosLugar: [] }, 'arrendador').fotosLugar).toMatch(/inmueble/);
    const demasiadas = Array.from({ length: MAX_FOTOS_LUGAR + 1 }, (_, i) => `f${i}`);
    expect(validarVerificacion({ ...completo, fotosLugar: demasiadas }, 'comerciante').fotosLugar).toBeTruthy();
  });

  it('sin consentimiento no se envía', () => {
    expect(validarVerificacion({ ...completo, consiente: false }, 'comerciante').consiente).toBeTruthy();
  });
});

describe('esRolVendedor', () => {
  it('solo comerciante y arrendador', () => {
    expect(esRolVendedor('comerciante')).toBe(true);
    expect(esRolVendedor('arrendador')).toBe(true);
    expect(esRolVendedor('admin')).toBe(false);
    expect(esRolVendedor('estudiante')).toBe(false);
    expect(esRolVendedor(undefined)).toBe(false);
  });
});
