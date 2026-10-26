import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Sello } from '@/components/ficha/Sello';
import { FotoLista } from '@/components/FotoLista';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AltoFotoTarjeta, Filete, Radios, Spacing } from '@/constants/theme';
import { useFotosPublicas, usePublicacionPublica } from '@/hooks/queries/useExplorar';
import { useTheme } from '@/hooks/use-theme';

// Ficha pública de un depa · tramo 1 de la web. Datos REDUCIDOS (migración 0090): la zona y no la dirección, sin teléfono ni quién publica. Escribir o guardar pide cuenta.

const precio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const NOMBRE_TIPO: Record<string, string> = { depa: 'Departamento', cuarto: 'Cuarto', casa_compartida: 'Casa compartida' };

export default function FichaPublica() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { publicacion: p, cargando, fallo, reintentar } = usePublicacionPublica(id);
  const { fotos } = useFotosPublicas('publicacion', id, p?.num_fotos ?? 0);

  if (fallo) {
    return (
      <ThemedView style={estilos.centro}>
        <ErrorDeCarga etiqueta="No pudimos cargar este lugar" onReintentar={reintentar} />
      </ThemedView>
    );
  }
  if (cargando) {
    return (
      <ThemedView style={estilos.centro}>
        <ThemedText type="small" themeColor="textSecondary">Cargando…</ThemedText>
      </ThemedView>
    );
  }
  if (!p) {
    return (
      <ThemedView style={estilos.centro}>
        <BloqueEstado etiqueta="Ya no está disponible" mensaje="Este lugar se retiró o dejó de estar publicado." icono="home-outline" />
        <Sello variante="contorno" onPress={() => router.push('/explorar')} accessibilityLabel="Ver más lugares">Ver más lugares</Sello>
      </ThemedView>
    );
  }

  const caracteristicas = [
    NOMBRE_TIPO[p.tipo] ?? p.tipo,
    p.recamaras ? `${p.recamaras} ${p.recamaras === 1 ? 'recámara' : 'recámaras'}` : null,
    p.amueblado ? 'Amueblado' : null,
    p.permite_mascotas ? 'Acepta mascotas' : null,
  ].filter((x): x is string => Boolean(x));

  return (
    <ThemedView style={estilos.raiz}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={[estilos.foto, { backgroundColor: theme.backgroundSelected }]}>
          <FotoLista completa={fotos[0]} style={estilos.fotoImagen} accessibilityLabel={p.titulo} />
        </View>

        <View style={estilos.linea}>
          <ThemedText type="title" accessibilityRole="header" style={estilos.titulo}>{p.titulo}</ThemedText>
          {p.calificacion ? <ThemedText type="smallBold">★ {p.calificacion.toFixed(1)}</ThemedText> : null}
        </View>
        {p.zona ? <ThemedText themeColor="textSecondary">{p.zona}</ThemedText> : null}
        <ThemedText>
          <ThemedText type="subtitle">${precio.format(p.precio_renta)}</ThemedText> al mes
        </ThemedText>

        <View style={estilos.caracteristicas}>
          {caracteristicas.map((c) => (
            <View key={c} style={[estilos.pastilla, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">{c}</ThemedText>
            </View>
          ))}
        </View>
        {p.servicios_incluidos && p.servicios_incluidos.length > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">Incluye: {p.servicios_incluidos.join(', ')}</ThemedText>
        ) : null}

        <View style={[estilos.cuenta, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
          <ThemedText type="subtitle" accessibilityRole="header">¿Te interesa?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            La dirección exacta y la conversación con quien publica están dentro de la cuenta: así nadie recibe tu teléfono antes de tiempo.
          </ThemedText>
          <Sello onPress={() => router.push('/(auth)/login')} accessibilityLabel="Iniciar sesión para escribir">Iniciar sesión para escribir</Sello>
          <Sello variante="contorno" onPress={() => router.push('/(auth)/registro')} accessibilityLabel="Crear cuenta">Crear cuenta</Sello>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  centro: { flex: 1, padding: Spacing.three, gap: Spacing.three, justifyContent: 'center', width: '100%', maxWidth: 560, alignSelf: 'center' },
  contenido: { padding: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: 800, alignSelf: 'center' },
  foto: { height: AltoFotoTarjeta * 1.6, borderRadius: Radios.tarjeta, overflow: 'hidden' },
  fotoImagen: { width: '100%', height: '100%' },
  linea: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  titulo: { flex: 1 },
  caracteristicas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pastilla: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radios.full, borderWidth: Filete.fino },
  cuenta: { gap: Spacing.two, padding: Spacing.four, borderRadius: Radios.hoja, borderWidth: Filete.fino },
});
