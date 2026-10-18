import { router } from 'expo-router';

import { FilaAjuste } from '@/components/ficha/FilaAjuste';
import { GrupoAjustes } from '@/components/ficha/GrupoAjustes';
import { useMisRoles } from '@/hooks/queries/useRoles';
import { useMiSuscripcion } from '@/hooks/queries/usePlanes';
import { tieneFuncionAprobada } from '@/lib/funciones';
import { useAuthStore } from '@/store/useAuthStore';

function FilaPlan({ rol }: { rol: 'comerciante' | 'arrendador' }) {
  const miId = useAuthStore((s) => s.session?.user.id);
  const { suscripcion } = useMiSuscripcion(miId, rol);
  return (
    <FilaAjuste
      icono="ribbon-outline"
      etiqueta={rol === 'comerciante' ? 'Plan de comerciante' : 'Plan de arrendador'}
      descripcion="Qué incluye y cómo cambiarlo."
      detalle={suscripcion?.plan_nombre}
      onPress={() => router.push({ pathname: '/planes/[rol]', params: { rol } })}
    />
  );
}

/**
 * «Mi plan» en Configuración · Cuervo 360. Solo para quien tiene una función de vendedor APROBADA: sin ella no hay plan
 * que ver. Un renglón por función (con el nombre del plan a la derecha) y el acceso a Pagos y facturación.
 */
export function GrupoMiPlan() {
  const miId = useAuthStore((s) => s.session?.user.id);
  const { roles } = useMisRoles(miId);
  const comerciante = tieneFuncionAprobada(roles, 'comerciante');
  const arrendador = tieneFuncionAprobada(roles, 'arrendador');
  if (!comerciante && !arrendador) return null;

  return (
    <GrupoAjustes titulo="Mi plan">
      {comerciante ? <FilaPlan rol="comerciante" /> : null}
      {arrendador ? <FilaPlan rol="arrendador" /> : null}
      <FilaAjuste
        icono="receipt-outline"
        etiqueta="Pagos y facturación"
        descripcion="Tu historial de pagos y cuándo vence tu plan."
        onPress={() => router.push('/pagos')}
      />
    </GrupoAjustes>
  );
}
