// Quién se registra (0082). Estudiante entra con correo universitario; arrendador y negocio con el que tengan.
//
// Lo que la persona DECLARA lo manda el cliente, y cualquiera puede mandar lo que quiera: no protege nada. Lo que protege es la base: el hook de
// Auth y `cuenta_restringida` (una cuenta sin correo universitario no reporta, no reseña ni abre conversaciones). Aquí solo se decide qué
// pide el formulario y a dónde va cada quien al terminar.

export type TipoCuenta = 'estudiante' | 'arrendador' | 'comerciante';

export const OPCIONES_TIPO_CUENTA: { valor: TipoCuenta; etiqueta: string }[] = [
  { valor: 'estudiante', etiqueta: 'Estudiante' },
  { valor: 'arrendador', etiqueta: 'Arrendador' },
  { valor: 'comerciante', etiqueta: 'Negocio o servicio' },
];

export const esVendedor = (tipo: TipoCuenta): boolean => tipo !== 'estudiante';

/** El valor de `tipo_cuenta` que viaja en los metadatos del alta: solo los vendedores lo llevan. */
export const tipoParaElAlta = (tipo: TipoCuenta): 'arrendador' | 'comerciante' | undefined =>
  tipo === 'estudiante' ? undefined : tipo;

/** A dónde sigue la cuenta recién confirmada: el cuestionario es de quien BUSCA, y un vendedor no lo necesita. */
export const destinoTrasConfirmar = (tipo: TipoCuenta): '/(tabs)/inicio' | '/(auth)/cuestionario-inicial' =>
  esVendedor(tipo) ? '/(tabs)/inicio' : '/(auth)/cuestionario-inicial';
