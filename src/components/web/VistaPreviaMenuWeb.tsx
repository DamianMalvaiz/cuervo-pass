import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { VistaPreviaMenu } from '@/components/EditorMenu';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { agruparPorSeccion, parsearPrecio } from '@/lib/menu';

const precioFormato = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

/**
 * La vista previa del menú mientras se edita: cómo lo verán los estudiantes en la ficha del negocio, por secciones, con foto, descripción y precio. Refleja lo que hay AHORA, aunque todavía no se haya guardado (por eso lo dice).
 * Un producto sin nombre no se pinta (todavía no es un producto), y uno sin precio dice «Consulta el precio»: nunca se inventa un precio ni un cero. Sin productos, lo dice.
 */
export function VistaPreviaMenuWeb({ v }: { v: VistaPreviaMenu | null }) {
  const theme = useTheme();
  const productos = (v?.productos ?? []).filter((p) => p.nombre.trim() !== '');
  const grupos = agruparPorSeccion(productos);

  return (
    <View style={estilos.caja} accessibilityLabel="Vista previa de tu menú">
      <ThemedText accessibilityRole="header" style={Texto.titulo}>Así se verá tu menú</ThemedText>
      {productos.length === 0 ? (
        <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Cuando agregues productos, aquí verás cómo los ve quien entra a tu ficha.</ThemedText>
      ) : (
        grupos.map((g) => (
          <View key={g.seccion ?? 'sin-seccion'} style={estilos.grupo}>
            {g.seccion ? <ThemedText style={Texto.pequenoFuerte} themeColor="textSecondary">{g.seccion}</ThemedText> : null}
            {g.productos.map((p) => {
              const precio = parsearPrecio(p.precio);
              const foto = p.fotos[0] ? v?.urls.get(p.fotos[0]) : p.fotosNuevas[0];
              return (
                <View key={p.clave} style={[estilos.fila, { borderBottomColor: theme.filete }]}>
                  {foto ? <Image source={{ uri: foto }} style={estilos.foto} contentFit="cover" /> : null}
                  <View style={estilos.texto}>
                    <ThemedText style={Texto.pequenoFuerte}>{p.nombre.trim()}</ThemedText>
                    {p.descripcion.trim() ? <ThemedText style={Texto.pequeno} themeColor="textSecondary" numberOfLines={2}>{p.descripcion.trim()}</ThemedText> : null}
                  </View>
                  <ThemedText style={Texto.pequenoFuerte}>{precio != null && !Number.isNaN(precio) ? `$${precioFormato.format(precio)}` : 'Consulta el precio'}</ThemedText>
                </View>
              );
            })}
          </View>
        ))
      )}
      <ThemedText style={Texto.pequeno} themeColor="textSecondary">
        Es una vista aproximada de lo que tienes ahora, aunque aún no lo hayas guardado: los cambios se publican al tocar «Guardar menú».
      </ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { gap: Spacing.three },
  grupo: { gap: Spacing.one },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: Filete.fino },
  foto: { width: 48, height: 48, borderRadius: Radios.casilla },
  texto: { flex: 1, minWidth: 0, gap: Spacing.half },
});
