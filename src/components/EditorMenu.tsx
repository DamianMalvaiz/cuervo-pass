import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, TextInput, View } from 'react-native';

import { EditorProducto } from '@/components/EditorProducto';
import { Pulsable } from '@/components/ficha/Pulsable';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useGuardarMenu } from '@/hooks/queries/useMisNegocios';
import { useMiSuscripcion } from '@/hooks/queries/usePlanes';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useTheme } from '@/hooks/use-theme';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import {
  MAX_PRODUCTOS_TECNICO, agruparPorSeccion, buscarEnMenu, parsearPrecio, productoVacio, seccionesDe, validarMenu,
  type ProductoEditable,
} from '@/lib/menu';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/lib/toast';
import type { NegocioItem } from '@/types/database.types';

const formateadorPrecio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

const desdeItem = (i: NegocioItem): ProductoEditable => ({
  clave: i.id,
  id: i.id,
  nombre: i.nombre,
  precio: i.precio == null ? '' : String(i.precio),
  seccion: i.seccion ?? '',
  descripcion: i.descripcion ?? '',
  foto: i.foto,
  fotoNueva: null,
});

/**
 * El menú de un negocio, a escala real · Cuervo 360 (0053).
 *
 * Una lista por secciones (virtualizada: puede tener cientos de renglones), con búsqueda y un editor por producto. Todo el
 * trabajo es LOCAL hasta tocar «Guardar menú», que manda la lista entera en una sola llamada y una sola transacción: si algo
 * falla, el menú guardado no cambia. El orden de la lista es el orden del menú.
 */
export function EditorMenu({ negocioId, nombreNegocio, items }: { negocioId: string; nombreNegocio: string; items: NegocioItem[] }) {
  const theme = useTheme();
  const guardar = useGuardarMenu(negocioId);
  const miId = useAuthStore((s) => s.session?.user.id);
  // El límite REAL del plan; mientras no se sepa, rige la cota técnica y la base hace cumplir el plan (CP009).
  const { suscripcion } = useMiSuscripcion(miId, 'comerciante');
  const maxProductos = Math.min(suscripcion?.max_productos ?? MAX_PRODUCTOS_TECNICO, MAX_PRODUCTOS_TECNICO);
  const [productos, setProductos] = useState<ProductoEditable[]>(() => items.map(desdeItem));
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<{ producto: ProductoEditable; esNuevo: boolean } | null>(null);

  // Las fotos con que se CARGÓ el menú: sirven para saber cuáles ya no se usan al guardar.
  const fotosAnteriores = useMemo(() => items.map((i) => i.foto).filter((f): f is string => Boolean(f)), [items]);
  const { urls } = useFotosFirmadas(productos.map((p) => p.foto));

  const visibles = buscarEnMenu(productos, busqueda);
  const secciones = agruparPorSeccion(visibles).map((g) => ({
    titulo: g.seccion ?? 'Sin sección',
    data: g.productos,
  }));
  const sugeridas = seccionesDe(productos);

  const guardarProducto = (p: ProductoEditable) => {
    setProductos((xs) => (xs.some((x) => x.clave === p.clave) ? xs.map((x) => (x.clave === p.clave ? p : x)) : [...xs, p]));
    setEditando(null);
  };
  const quitarProducto = (clave: string) => {
    setProductos((xs) => xs.filter((x) => x.clave !== clave));
    setEditando(null);
  };

  const onGuardarMenu = () => {
    const problema = validarMenu(productos, maxProductos);
    if (problema) {
      toast.error(problema);
      return;
    }
    guardar.mutate(
      { productos, fotosAnteriores },
      {
        onSuccess: () => {
          toast.exito('Menú guardado');
          router.back();
        },
        onError: (err) =>
          toast.error(
            esCodigo(err, CP.LIMITE_ITEMS_MENU)
              ? 'Tu plan permite menos productos. Quita algunos para guardar el menú.'
              : 'No pudimos guardar el menú. Revisa tu conexión e intenta de nuevo.'
          ),
      }
    );
  };

  return (
    <ThemedView style={estilos.pantalla}>
      <View style={estilos.cabecera}>
        <ThemedText type="subtitle" numberOfLines={1}>Menú de {nombreNegocio}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {suscripcion ? `${productos.length} de ${maxProductos} productos` : productos.length === 1 ? '1 producto' : `${productos.length} productos`}
        </ThemedText>

        <View style={[estilos.buscador, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
          <Ionicons name="search-outline" size={20} color={theme.textSecondary} />
          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar en el menú"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Buscar en el menú"
            style={[estilos.campo, { color: theme.text }]}
          />
        </View>

        {productos.length < maxProductos ? (
          <Pulsable
            onPress={() => setEditando({ producto: productoVacio(), esNuevo: true })}
            accessibilityRole="button"
            accessibilityLabel="Agregar un producto"
            style={[estilos.agregar, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}
          >
            <Ionicons name="add" size={20} color={theme.bosque} />
            <ThemedText style={Texto.pesoFuerte}>Agregar producto</ThemedText>
          </Pulsable>
        ) : (
          <Pulsable
            onPress={() => router.push({ pathname: '/planes/[rol]', params: { rol: 'comerciante' } })}
            accessibilityRole="link"
            accessibilityLabel="Ver planes para agregar más productos"
            style={estilos.enlacePlan}
          >
            <ThemedText type="small" themeColor="acento">
              Llegaste al límite de tu plan ({maxProductos}). Ver planes
            </ThemedText>
          </Pulsable>
        )}
      </View>

      <SectionList
        sections={secciones}
        keyExtractor={(p) => p.clave}
        contentContainerStyle={estilos.lista}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <ThemedText type="smallBold" themeColor="textSecondary" style={estilos.seccion}>{section.titulo}</ThemedText>
        )}
        renderItem={({ item }) => {
          const precio = parsearPrecio(item.precio);
          const miniatura = item.fotoNueva ?? (item.foto ? urls.get(item.foto) : null);
          return (
            <Pulsable
              onPress={() => setEditando({ producto: item, esNuevo: false })}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${item.nombre || 'producto sin nombre'}`}
              style={[estilos.fila, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}
            >
              {miniatura ? (
                <Image source={{ uri: miniatura }} style={estilos.miniatura} contentFit="cover" />
              ) : (
                <View style={[estilos.miniatura, { backgroundColor: theme.backgroundSelected }]} />
              )}
              <View style={estilos.crece}>
                <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]} numberOfLines={1}>{item.nombre || 'Sin nombre'}</ThemedText>
                {item.descripcion ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{item.descripcion}</ThemedText>
                ) : null}
              </View>
              {precio != null && !Number.isNaN(precio) ? (
                <ThemedText style={Texto.pesoFuerte}>{`$${formateadorPrecio.format(precio)}`}</ThemedText>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">Consultar</ThemedText>
              )}
            </Pulsable>
          );
        }}
        ListEmptyComponent={
          <ThemedText type="small" themeColor="textSecondary" style={estilos.vacio}>
            {busqueda.trim() ? 'No hay productos con esa búsqueda.' : 'Todavía no hay productos. Toca «Agregar producto».'}
          </ThemedText>
        }
        ItemSeparatorComponent={Separador}
      />

      <View style={[estilos.pie, { borderTopColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
        <Sello onPress={onGuardarMenu} cargando={guardar.isPending} accessibilityLabel="Guardar menú">
          Guardar menú
        </Sello>
      </View>

      {editando ? (
        <EditorProducto
          producto={editando.producto}
          esNuevo={editando.esNuevo}
          secciones={sugeridas}
          urlFoto={editando.producto.foto ? urls.get(editando.producto.foto) : null}
          onGuardar={guardarProducto}
          onQuitar={() => quitarProducto(editando.producto.clave)}
          onCerrar={() => setEditando(null)}
        />
      ) : null}
    </ThemedView>
  );
}

function Separador() {
  return <View style={estilos.separador} />;
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  cabecera: { padding: Spacing.three, gap: Spacing.two },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 48,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    paddingHorizontal: Spacing.three,
  },
  campo: { flex: 1, ...Texto.cuerpo, paddingVertical: Spacing.two },
  agregar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: 48,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
  },
  lista: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five },
  seccion: { paddingTop: Spacing.three, paddingBottom: Spacing.one },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 64,
    padding: Spacing.two,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
  },
  miniatura: { width: 48, height: 48, borderRadius: Radios.casilla },
  crece: { flex: 1 },
  separador: { height: Spacing.two },
  vacio: { paddingVertical: Spacing.four, textAlign: 'center' },
  enlacePlan: { minHeight: 44, justifyContent: 'center' },
  pie: { padding: Spacing.three, borderTopWidth: Filete.fino },
});
