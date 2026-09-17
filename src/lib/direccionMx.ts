import { buscaCP } from '@webrek/mx-cp';

export interface DatosCP {
  estado: string;
  municipio: string;
  localidad: string | null;
  colonias: string[];
}

// Datos oficiales de SEPOMEX/INEGI (@webrek/mx-cp, sin API key, sin llamada de
// red — el paquete trae el catálogo completo). Nunca bloquea el formulario si
// el CP no se encuentra: la persona puede seguir llenando todo a mano.
export async function buscarPorCodigoPostal(cp: string): Promise<DatosCP | null> {
  try {
    const resultado = await buscaCP(cp);
    if (!resultado) return null;
    return {
      estado: resultado.estado,
      municipio: resultado.municipio,
      localidad: resultado.ciudad && resultado.ciudad !== 'NULL' ? resultado.ciudad : null,
      colonias: resultado.asentamientos.map((a) => a.nombre),
    };
  } catch (e) {
    console.warn('Búsqueda de código postal falló:', e);
    return null;
  }
}
