import { Platform } from 'react-native';

import { ConVistaPreviaApp } from '@/components/ConVistaPreviaApp';
import { FormularioNegocio, type VistaPreviaNegocio } from '@/components/FormularioNegocio';
import { GuardaPublicar } from '@/components/GuardaPublicar';
import { MarcoNegocioWeb } from '@/components/web/MarcoNegocioWeb';
import { VistaPreviaNegocioWeb } from '@/components/web/VistaPreviaNegocioWeb';

/** Publicar un negocio nuevo (migración 0052). La regla de quién puede la pone la base; esta pantalla es la puerta: sin la verificación hecha no se llena el formulario. En la web, con el marco de la web y una vista previa al lado. */
export default function NuevoNegocioScreen() {
  if (Platform.OS === 'web') {
    return (
      <MarcoNegocioWeb>
        {(alVistaPrevia) => (
          <GuardaPublicar>
            <FormularioNegocio onVistaPrevia={alVistaPrevia} />
          </GuardaPublicar>
        )}
      </MarcoNegocioWeb>
    );
  }
  // En la app no hay lugar al lado: una barra fija ofrece la vista previa en una hoja.
  return (
    <GuardaPublicar>
      <ConVistaPreviaApp<VistaPreviaNegocio> boton="Ver cómo se verá" titulo="Así se verá en Servicios" vista={(v) => <VistaPreviaNegocioWeb v={v} />}>
        {(alVistaPrevia) => <FormularioNegocio onVistaPrevia={alVistaPrevia} />}
      </ConVistaPreviaApp>
    </GuardaPublicar>
  );
}
