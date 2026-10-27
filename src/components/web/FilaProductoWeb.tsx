import { StyleSheet, View } from 'react-native';

import { FotoLista } from '@/components/FotoLista';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useFotosPublicas } from '@/hooks/queries/useExplorar';
import { useTheme } from '@/hooks/use-theme';
import type { ProductoExplorar } from '@/services/explorar.service';

const precioFormato = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/** Un producto del menú: su foto (si tiene), nombre, descripción (si la hay) y precio; sin precio dice «Consulta el precio» y nunca inventa uno. */
export function FilaProductoWeb({ p }: { p: ProductoExplorar }) {
  const theme = useTheme();
  const { fotos } = useFotosPublicas('producto', p.id, p.num_fotos);
  return (
    <View style={[estilos.fila, { borderBottomColor: theme.filete }]}>
      {p.num_fotos > 0 ? (
        <View style={[estilos.foto, { backgroundColor: theme.backgroundSelected }]}>
          <FotoLista completa={fotos[0]} style={estilos.imagen} accessibilityLabel={p.nombre} />
        </View>
      ) : null}
      <View style={estilos.texto}>
        <ThemedText style={Texto.subtitulo}>{p.nombre}</ThemedText>
        {p.descripcion ? <ThemedText style={Texto.pequeno} themeColor="textSecondary">{p.descripcion}</ThemedText> : null}
      </View>
      <ThemedText style={Texto.precioWeb}>{p.precio === null ? 'Consulta el precio' : `$${precioFormato.format(p.precio)}`}</ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three, borderBottomWidth: Filete.fino },
  foto: { width: 96, height: 96, borderRadius: Radios.tarjeta - Spacing.two, overflow: 'hidden' },
  imagen: { width: '100%', height: '100%' },
  texto: { flex: 1, minWidth: 0, gap: Spacing.half },
});
