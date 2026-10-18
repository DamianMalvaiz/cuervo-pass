import { router } from 'expo-router';

import { FilaAjuste } from '@/components/ficha/FilaAjuste';
import { GrupoAjustes } from '@/components/ficha/GrupoAjustes';
import { useEsAdmin } from '@/hooks/queries/useAdmin';

/**
 * El renglón «Panel de administración» del perfil. Solo para una cuenta con el rol admin APROBADO. Que no aparezca es comodidad, no
 * seguridad: lo que de verdad decide es la Edge Function `admin`, que lo comprueba en la base en cada llamada.
 */
export function EntradaAdmin() {
  const { admin } = useEsAdmin();
  if (!admin) return null;
  return (
    <GrupoAjustes titulo="Administración">
      <FilaAjuste
        icono="construct-outline"
        etiqueta="Panel de administración"
        descripcion="Verificaciones, moderación y modo de demostración."
        onPress={() => router.push('/admin')}
      />
    </GrupoAjustes>
  );
}
