import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useBorrarBusqueda, useBusquedasGuardadas, useGuardarBusqueda } from '@/hooks/queries/useBusquedasGuardadas';
import { useTheme } from '@/hooks/use-theme';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import { hayFiltros, resumenBusqueda, type FiltrosWeb } from '@/lib/filtrosWeb';
import { aParametros, deParametros } from '@/lib/rutasWeb';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';

/** El nombre con que se guarda una búsqueda: lo que la píldora diría de ella («Lerma · Cuarto · hasta $4,000»). */
export function nombreDeBusqueda(f: FiltrosWeb): string {
  const r = resumenBusqueda(f);
  return `${r.titulo} · ${r.subtitulo}`.slice(0, 80);
}

const mismos = (a: Record<string, string>, b: Record<string, string>) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

/**
 * Las búsquedas guardadas de quien tiene cuenta (0093), junto a los filtros de `/departamentos`: un toque vuelve a una búsqueda, la «x» la borra y «Guardar esta búsqueda» guarda la que está aplicada (solo si hay filtros y todavía no está
 * guardada). Sin cuenta no ocupa lugar. Lo guardado se vuelve filtro por `deParametros`, que valida todo (viene de la base, pero es texto). Cargando, FALLÓ y «no hay ninguna» son estados distintos.
 */
export function BusquedasGuardadasWeb({ aplicados, onAplicar }: { aplicados: FiltrosWeb; onAplicar: (f: FiltrosWeb) => void }) {
  const miId = useAuthStore((s) => s.session?.user.id);
  if (!miId) return null;
  return <ConCuenta miId={miId} aplicados={aplicados} onAplicar={onAplicar} />;
}

function ConCuenta({ miId, aplicados, onAplicar }: { miId: string; aplicados: FiltrosWeb; onAplicar: (f: FiltrosWeb) => void }) {
  const theme = useTheme();
  const { busquedas, cargando, fallo, reintentar } = useBusquedasGuardadas(miId);
  const guardar = useGuardarBusqueda(miId);
  const borrar = useBorrarBusqueda(miId);

  if (fallo) return <ErrorDeCarga etiqueta="No pudimos cargar tus búsquedas guardadas" onReintentar={reintentar} />;
  if (cargando) return null;

  const actual = aParametros(aplicados);
  const yaGuardada = busquedas.some((b) => mismos(b.filtros, actual));
  const puedeGuardar = hayFiltros(aplicados) && !yaGuardada;

  const alGuardar = () =>
    guardar.mutate(
      { nombre: nombreDeBusqueda(aplicados), filtros: actual },
      {
        onSuccess: () => toast.exito('Búsqueda guardada'),
        onError: (err) => toast.error(esCodigo(err, CP.FAVORITOS_LLENOS) ? 'Ya guardaste 20 búsquedas. Borra alguna para guardar otra.' : 'No pudimos guardar la búsqueda. Revisa tu conexión e intenta de nuevo.'),
      }
    );

  if (busquedas.length === 0 && !puedeGuardar) return null;
  return (
    <View style={estilos.fila} accessibilityRole="list" accessibilityLabel="Búsquedas guardadas">
      {busquedas.length > 0 ? <ThemedText style={Texto.pequenoFuerte} themeColor="textSecondary">Tus búsquedas</ThemedText> : null}
      {busquedas.map((b) => (
        <View key={b.id} style={[estilos.chip, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
          <Pulsable onPress={() => onAplicar(deParametros(b.filtros))} accessibilityRole="button" accessibilityLabel={`Buscar de nuevo: ${b.nombre}`} style={estilos.nombre}>
            <Ionicons name="bookmark-outline" size={16} color={theme.bosque} />
            <ThemedText style={Texto.pequenoFuerte} numberOfLines={1}>{b.nombre}</ThemedText>
          </Pulsable>
          <Pulsable
            onPress={() => borrar.mutate(b.id, { onError: () => toast.error('No pudimos borrar la búsqueda. Revisa tu conexión e intenta de nuevo.') })}
            accessibilityRole="button"
            accessibilityLabel={`Borrar la búsqueda guardada: ${b.nombre}`}
            style={estilos.borrar}
          >
            <Ionicons name="close" size={18} color={theme.textSecondary} />
          </Pulsable>
        </View>
      ))}
      {puedeGuardar ? (
        <Pulsable onPress={alGuardar} accessibilityRole="button" accessibilityLabel="Guardar esta búsqueda" style={[estilos.guardar, { borderColor: theme.bosque, backgroundColor: theme.tintedSurface }]}>
          <Ionicons name="bookmark-outline" size={16} color={theme.bosque} />
          <ThemedText style={Texto.pequenoFuerte}>{guardar.isPending ? 'Guardando…' : 'Guardar esta búsqueda'}</ThemedText>
        </Pulsable>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: Radios.full, borderWidth: Filete.fino, maxWidth: '100%' },
  nombre: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44, paddingLeft: Spacing.three, flexShrink: 1 },
  borrar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  guardar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: Radios.full, borderWidth: Filete.fino },
});
