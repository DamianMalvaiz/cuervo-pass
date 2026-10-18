import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { Encabezado } from '@/components/ficha/Encabezado';
import { ListaEsqueleto } from '@/components/ficha/FichaEsqueleto';
import { Pulsable } from '@/components/ficha/Pulsable';
import { Sello } from '@/components/ficha/Sello';
import { TarjetaNegocio } from '@/components/TarjetaNegocio';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useCategoriasServicio, useNegocios } from '@/hooks/queries/useServicios';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useMiniaturas } from '@/hooks/use-miniaturas';
import { ANCHOS } from '@/lib/miniaturas';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { toque } from '@/lib/tacto';
import type { Negocio } from '@/types/database.types';

/**
 * El módulo «Servicios» de Inicio · Cuervo 360 (propuesta visual del 17/10/2026).
 *
 * Categorías, destacados y la lista de negocios. La categoría y la búsqueda se piden al SERVIDOR (argumentos del
 * hook): filtrar en el teléfono una página ya recortada haría que la app dijera «no hay nada» cuando sí lo hay. La
 * búsqueda se envía al terminar de escribir, no en cada letra. «Falló» y «no hay» se pintan distinto.
 */
export function VistaServicios({ selector }: { selector?: ReactNode }) {
  const theme = useTheme();
  const { anchoLista } = useTamanoPantalla();
  const margenSuperior = useMargenSuperior();
  const [categoriaId, setCategoriaId] = useState<string | undefined>(undefined);
  const [borrador, setBorrador] = useState('');
  const [texto, setTexto] = useState('');

  const { categorias } = useCategoriasServicio();
  const { negocios, cargando, fallo, reintentar } = useNegocios({ categoriaId, texto });
  const { urls } = useFotosFirmadas(negocios.map((n) => n.fotos[0]));
  // Miniaturas sin red (lib/miniaturas.ts): la tarjeta destacada pide más ancho que la fila.
  const miniDestacadas = useMiniaturas(negocios.map((n) => n.fotos[0]), ANCHOS.media);
  const miniFilas = useMiniaturas(negocios.map((n) => n.fotos[0]), ANCHOS.fila);

  const filtrando = Boolean(categoriaId) || texto.trim() !== '';
  const destacados = filtrando ? [] : negocios.filter((n) => n.destacado);
  const abrir = (n: Negocio) => router.push({ pathname: '/negocio/[id]', params: { id: n.id } });
  const foto = (n: Negocio) => (n.fotos[0] ? urls.get(n.fotos[0]) : null);
  const mini = (n: Negocio, destacado: boolean) => (destacado ? miniDestacadas : miniFilas)(n.fotos[0]);

  const cabecera = (
    <View style={estilos.cabecera}>
      {selector}
      <Encabezado titulo="¿Qué necesitas hoy?" />

      <View style={[estilos.buscador, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
        <Ionicons name="search-outline" size={20} color={theme.textSecondary} />
        <TextInput
          value={borrador}
          onChangeText={setBorrador}
          onSubmitEditing={() => setTexto(borrador)}
          returnKeyType="search"
          placeholder="Busca comida, lavandería, reparaciones…"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Buscar un negocio o servicio"
          style={[estilos.campo, { color: theme.text }]}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.categorias}>
        {categorias.map((c) => {
          const activa = c.id === categoriaId;
          const icono = (c.icono in Ionicons.glyphMap ? c.icono : 'storefront-outline') as keyof typeof Ionicons.glyphMap;
          return (
            <Pulsable
              key={c.id}
              onPress={() => {
                toque();
                setCategoriaId(activa ? undefined : c.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={c.nombre}
              accessibilityState={{ selected: activa }}
              style={estilos.categoria}
            >
              <View
                style={[
                  estilos.iconoCategoria,
                  { backgroundColor: activa ? theme.lima : theme.backgroundElement, borderColor: activa ? theme.lima : theme.filete },
                ]}
              >
                <Ionicons name={icono} size={26} color={activa ? theme.limaTexto : theme.bosque} />
              </View>
              <ThemedText type="small" style={activa ? Texto.pesoFuerte : undefined} numberOfLines={1}>
                {c.nombre}
              </ThemedText>
            </Pulsable>
          );
        })}
      </ScrollView>

      {destacados.length > 0 ? (
        <View style={estilos.bloque}>
          <ThemedText type="subtitle">Destacados cerca de ti</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.carril}>
            {destacados.map((n) => (
              <TarjetaNegocio key={n.id} negocio={n} fotoUrl={foto(n)} fotoMini={mini(n, true)} forma="destacado" onPress={() => abrir(n)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <ThemedText type="subtitle">{filtrando ? 'Resultados' : 'Todos los negocios'}</ThemedText>
    </View>
  );

  return (
    <ThemedView style={estilos.pantalla}>
      <FlatList
        data={cargando ? [] : negocios}
        keyExtractor={(n) => n.id}
        contentContainerStyle={[estilos.lista, { paddingTop: margenSuperior, maxWidth: anchoLista }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={cabecera}
        ItemSeparatorComponent={Separador}
        renderItem={({ item }) => (
          <View style={estilos.margen}>
            <TarjetaNegocio negocio={item} fotoUrl={foto(item)} fotoMini={mini(item, false)} onPress={() => abrir(item)} />
          </View>
        )}
        ListEmptyComponent={
          <View style={estilos.margen}>
            {cargando ? (
              <ListaEsqueleto variante="renglon" filas={4} />
            ) : fallo ? (
              <View style={estilos.estado}>
                <BloqueEstado
                  tono="alerta"
                  icono="cloud-offline-outline"
                  etiqueta="No pudimos cargar los negocios"
                  mensaje="Revisa tu conexión e intenta de nuevo."
                />
                <Sello variante="contorno" icono="refresh" onPress={reintentar} accessibilityLabel="Reintentar">
                  Reintentar
                </Sello>
              </View>
            ) : (
              <BloqueEstado
                icono="search-outline"
                etiqueta="Sin resultados"
                mensaje="No encontramos negocios con esa búsqueda. Prueba con otra palabra o quita la categoría."
              />
            )}
          </View>
        }
      />
    </ThemedView>
  );
}

function Separador() {
  return <View style={estilos.separador} />;
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  lista: { width: '100%', alignSelf: 'center', paddingBottom: Spacing.six },
  margen: { paddingHorizontal: Spacing.three },
  cabecera: { gap: Spacing.three, paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 52,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    paddingHorizontal: Spacing.three,
  },
  campo: { flex: 1, ...Texto.cuerpo, paddingVertical: Spacing.two },
  categorias: { gap: Spacing.three, paddingVertical: Spacing.one },
  categoria: { width: 68, alignItems: 'center', gap: Spacing.one },
  iconoCategoria: {
    width: 56,
    height: 56,
    borderRadius: Radios.tarjeta,
    borderWidth: Filete.fino,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloque: { gap: Spacing.two },
  carril: { gap: Spacing.three },
  separador: { height: Spacing.two },
  estado: { gap: Spacing.three },
});
