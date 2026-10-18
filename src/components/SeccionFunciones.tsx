import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Seccion } from '@/components/ficha/Seccion';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAgregarFuncion, useMisRoles } from '@/hooks/queries/useRoles';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import { toast } from '@/lib/toast';
import type { EstadoRol, RolUsuario } from '@/types/database.types';

type FuncionPedible = 'comerciante' | 'arrendador';
const PEDIBLES: FuncionPedible[] = ['comerciante', 'arrendador'];

const TEXTO: Record<string, { etiqueta: string; oferta: string; pastilla: string }> = {
  comerciante: {
    etiqueta: 'Comerciante',
    oferta: 'Para negocios y servicios cerca de tu universidad. Requiere verificación.',
    pastilla: 'Ofrecer un servicio',
  },
  arrendador: {
    etiqueta: 'Arrendador',
    oferta: 'Para ofrecer un depa o un cuarto. Requiere verificación.',
    pastilla: 'Ofrecer un depa o cuarto',
  },
  admin: { etiqueta: 'Administrador', oferta: '', pastilla: '' },
};

/** El estado, corto, para la pastilla. */
function estadoCorto(r: RolUsuario): string {
  const estados: Record<EstadoRol, string> = {
    sin_verificar: 'Sin verificar',
    pendiente: 'En revisión',
    aprobado: r.origen === 'migracion' ? 'Heredada' : 'Verificada',
    rechazado: 'Rechazada',
  };
  return estados[r.estado];
}

/**
 * «Tus funciones» en Mi perfil · Cuervo 360, en pastillas (propuesta visual del 17/10/2026).
 *
 * Todo usuario es estudiante por defecto y eso no se guarda (migración 0043). Aquí se ven las funciones que se
 * AGREGAN, cada una con su estado, y las que se pueden pedir como pastillas con «+». Pedirla no da acceso: nace sin
 * verificar, y la confirmación lo dice antes de pedirla. Debajo de las pastillas va lo que hay que saber de cada
 * estado, dicho una sola vez: agregarla no da acceso, y una función «heredada» (de la migración) NO pasó por una
 * revisión — una insignia que no se ganó, rotulada como ganada, es el defecto que la 0026 evitó con el correo.
 * Los tres estados de la lectura se distinguen —cargando, falló, lista— porque «no pudimos mirar» no es «no tienes
 * ninguna» (END-11).
 */
export function SeccionFunciones({ usuarioId }: { usuarioId: string | undefined }) {
  const theme = useTheme();
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
  const hayHeredada = roles.some((r) => r.estado === 'aprobado' && r.origen === 'migracion');
  const haySinVerificar = roles.some((r) => r.estado === 'sin_verificar');

  return (
    <Seccion titulo="Tus funciones">
      <View style={estilos.pastillas}>
        {/* Estudiante: todas las cuentas lo son. Relleno lima con palomita, como lo ya ganado. */}
        <View style={[estilos.pastilla, { backgroundColor: theme.lima, borderColor: theme.lima }]}>
          <Ionicons name="checkmark" size={16} color={theme.limaTexto} />
          <ThemedText type="small" style={[Texto.pesoFuerte, { color: theme.limaTexto }]}>
            Estudiante
          </ThemedText>
        </View>

        {!cargando && !fallo
          ? roles.map((r) => (
              <View
                key={r.rol}
                style={[estilos.pastilla, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}
              >
                <ThemedText type="small" style={Texto.pesoFuerte}>
                  {TEXTO[r.rol].etiqueta}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {estadoCorto(r)}
                </ThemedText>
              </View>
            ))
          : null}

        {!cargando && !fallo
          ? porPedir.map((rol) => (
              <Pressable
                key={rol}
                onPress={() => pedir(rol)}
                accessibilityRole="button"
                accessibilityLabel={`Agregar función de ${TEXTO[rol].etiqueta.toLowerCase()}. ${TEXTO[rol].oferta}`}
                style={({ pressed }) => [
                  estilos.pastilla,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.filete },
                  pressed && estilos.presionada,
                ]}
              >
                <Ionicons name="add" size={16} color={theme.bosque} />
                <ThemedText type="small" style={Texto.pesoFuerte}>
                  {TEXTO[rol].pastilla}
                </ThemedText>
              </Pressable>
            ))
          : null}
      </View>

      {cargando && (
        <ThemedText type="small" themeColor="textSecondary">
          Cargando tus funciones…
        </ThemedText>
      )}

      {fallo && (
        <Pressable
          onPress={reintentar}
          accessibilityRole="button"
          accessibilityLabel="No pudimos cargar tus funciones. Reintentar"
          style={estilos.reintentar}
        >
          <Ionicons name="refresh" size={16} color={theme.acento} />
          <ThemedText type="small" themeColor="acento">
            No pudimos cargar tus funciones. Toca para reintentar.
          </ThemedText>
        </Pressable>
      )}

      {!cargando && !fallo && haySinVerificar && (
        <ThemedText type="small" themeColor="textSecondary" style={estilos.nota}>
          Una función sin verificar no te da acceso todavía: falta la verificación de vendedor.
        </ThemedText>
      )}
      {!cargando && !fallo && hayHeredada && (
        <ThemedText type="small" themeColor="textSecondary" style={estilos.nota}>
          Heredada por migración: ya publicabas antes de que existiera la verificación. No es una revisión.
        </ThemedText>
      )}
    </Seccion>
  );
}

const estilos = StyleSheet.create({
  pastillas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pastilla: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderWidth: Filete.fino,
    borderRadius: Radios.full,
  },
  presionada: { opacity: 0.6 },
  reintentar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, minHeight: 44 },
  nota: { lineHeight: 20 },
});
