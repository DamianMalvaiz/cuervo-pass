import { Alert, StyleSheet, View } from 'react-native';

import { FileteHoja } from '@/components/ficha/CampoFicha';
import { FilaAjuste } from '@/components/ficha/FilaAjuste';
import { Seccion } from '@/components/ficha/Seccion';
import { ThemedText } from '@/components/themed-text';
import { useAgregarFuncion, useMisRoles } from '@/hooks/queries/useRoles';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import { toast } from '@/lib/toast';
import type { EstadoRol, RolUsuario } from '@/types/database.types';

type FuncionPedible = 'comerciante' | 'arrendador';
const PEDIBLES: FuncionPedible[] = ['comerciante', 'arrendador'];

const TEXTO: Record<string, { etiqueta: string; icono: React.ComponentProps<typeof FilaAjuste>['icono']; oferta: string }> = {
  comerciante: {
    etiqueta: 'Comerciante',
    icono: 'storefront-outline',
    oferta: 'Para negocios y servicios cerca de tu universidad. Requiere verificación.',
  },
  arrendador: {
    etiqueta: 'Arrendador',
    icono: 'home-outline',
    oferta: 'Para ofrecer un depa o un cuarto. Requiere verificación.',
  },
  admin: { etiqueta: 'Administrador', icono: 'shield-checkmark-outline', oferta: '' },
};

/**
 * Lo que dice cada estado. «Aprobada» por migración se dice como lo que es: se heredó al
 * introducir los roles y NO pasó por una revisión. Una insignia que no se ganó, rotulada como
 * ganada, es el mismo defecto que la 0026 evitó con el correo.
 */
function descripcionDe(r: RolUsuario): string {
  const estados: Record<EstadoRol, string> = {
    sin_verificar: 'Sin verificar. Agregarla no te da acceso: falta la verificación de vendedor.',
    pendiente: 'En revisión.',
    aprobado: r.origen === 'migracion'
      ? 'Aprobada por migración: ya publicabas antes de que existiera la verificación. No es una revisión.'
      : 'Verificada.',
    rechazado: 'Rechazada.',
  };
  return estados[r.estado];
}

/**
 * «Tus funciones» en Mi perfil · Cuervo 360.
 *
 * Todo usuario es estudiante por defecto y eso no se guarda (migración 0043). Aquí se ven las
 * funciones que se AGREGAN y se pide una nueva. Pedirla no da acceso: nace sin verificar, y la
 * confirmación lo dice antes de pedirla. Los tres estados de la lectura se distinguen
 * —cargando, falló, lista— porque «no pudimos mirar» no es «no tienes ninguna» (END-11).
 */
export function SeccionFunciones({ usuarioId }: { usuarioId: string | undefined }) {
  const { roles, cargando, fallo, reintentar } = useMisRoles(usuarioId);
  const agregar = useAgregarFuncion(usuarioId);

  const pedir = (rol: FuncionPedible) => {
    if (agregar.isPending) return;
    const { etiqueta } = TEXTO[rol];
    Alert.alert(
      `Agregar función de ${etiqueta.toLowerCase()}`,
      'Para publicar tendrás que verificar tu identidad (INE y fotos). Agregarla no te da acceso todavía: quedará sin verificar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Agregar',
          onPress: () =>
            agregar.mutate(rol, {
              onSuccess: () => toast.exito('Función agregada. Quedó sin verificar.'),
              onError: (e) =>
                toast.error(
                  esCodigo(e, CP.ROL_NO_PERMITIDO)
                    ? 'Esa función no se puede agregar.'
                    : 'No pudimos agregar la función. Revisa tu conexión e intenta de nuevo.'
                ),
            }),
        },
      ]
    );
  };

  const tengo = new Set(roles.map((r) => r.rol));
  const porPedir = PEDIBLES.filter((r) => !tengo.has(r));

  return (
    <Seccion titulo="Tus funciones">
      <View style={estilos.lista}>
        <FilaAjuste
          icono="school-outline"
          etiqueta="Estudiante"
          descripcion="Todas las cuentas lo son. Tu insignia de verificado depende de tu correo."
        />

        {cargando && (
          <ThemedText type="small" themeColor="textSecondary">
            Cargando tus funciones…
          </ThemedText>
        )}

        {fallo && (
          <>
            <FileteHoja />
            <FilaAjuste
              icono="refresh"
              etiqueta="No pudimos cargar tus funciones"
              descripcion="Revisa tu conexión y vuelve a intentar."
              onPress={reintentar}
            />
          </>
        )}

        {!cargando && !fallo && (
          <>
            {roles.map((r) => (
              <View key={r.rol}>
                <FileteHoja />
                <FilaAjuste
                  icono={TEXTO[r.rol].icono}
                  etiqueta={TEXTO[r.rol].etiqueta}
                  descripcion={descripcionDe(r)}
                />
              </View>
            ))}
            {porPedir.map((rol) => (
              <View key={rol}>
                <FileteHoja />
                <FilaAjuste
                  icono="add-circle-outline"
                  etiqueta={`Agregar función de ${TEXTO[rol].etiqueta.toLowerCase()}`}
                  descripcion={TEXTO[rol].oferta}
                  onPress={() => pedir(rol)}
                />
              </View>
            ))}
          </>
        )}
      </View>
    </Seccion>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: 0 },
});
