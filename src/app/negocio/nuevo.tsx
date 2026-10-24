import { FormularioNegocio } from '@/components/FormularioNegocio';
import { GuardaPublicar } from '@/components/GuardaPublicar';

/** Publicar un negocio nuevo (migración 0052). La regla de quién puede la pone la base; esta pantalla es la puerta: sin la verificación hecha no se llena el formulario. */
export default function NuevoNegocioScreen() {
  return (
    <GuardaPublicar>
      <FormularioNegocio />
    </GuardaPublicar>
  );
}
