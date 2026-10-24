import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { Campo } from '@/components/Campo';
import { Pulsable } from '@/components/ficha/Pulsable';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { validarProducto, type ErroresProducto, type ProductoEditable } from '@/lib/menu';
import { avisarPermisoDeFotosDenegado } from '@/lib/permisos';

/**
 * El editor de UN producto del menú, en una hoja modal · Cuervo 360 (0053).
 *
 * Trabaja sobre una COPIA: nada cambia en el menú hasta que se toca «Guardar producto». Ofrece las secciones que ya existen
 * como atajos (escribir una nueva también sirve) y una foto opcional. `urlFoto` es la foto ya guardada, ya firmada para
 * mostrarla.
 */
export function EditorProducto({
  producto,
  esNuevo,
  secciones,
  urlFoto,
  onGuardar,
  onQuitar,
  onCerrar,
}: {
  producto: ProductoEditable;
  esNuevo: boolean;
  secciones: string[];
  urlFoto?: string | null;
  onGuardar: (p: ProductoEditable) => void;
  onQuitar: () => void;
  onCerrar: () => void;
}) {
  const theme = useTheme();
  const [p, setP] = useState(producto);
  const [errores, setErrores] = useState<ErroresProducto>({});

  const cambiar = (c: Partial<ProductoEditable>) => setP((x) => ({ ...x, ...c }));

  const elegirFoto = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      avisarPermisoDeFotosDenegado(permiso.canAskAgain);
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const uri = r.canceled ? null : (r.assets[0]?.uri ?? null);
    if (uri) cambiar({ fotoNueva: uri });
  };

  const guardar = () => {
    const e = validarProducto(p);
    setErrores(e);
    if (Object.keys(e).length === 0) onGuardar(p);
  };

  const miniatura = p.fotoNueva ?? (p.foto ? urlFoto : null);
  const hayFoto = Boolean(p.fotoNueva || p.foto);

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar} visible>
      <ThemedView style={estilos.hoja}>
        <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
          <View style={estilos.cabecera}>
            <ThemedText type="subtitle">{esNuevo ? 'Nuevo producto' : 'Editar producto'}</ThemedText>
            <Pulsable onPress={onCerrar} accessibilityRole="button" accessibilityLabel="Cancelar" style={estilos.cerrar}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pulsable>
          </View>

          <Campo etiqueta="Nombre del producto" value={p.nombre} onChangeText={(t) => cambiar({ nombre: t })} error={errores.nombre} maxLength={80} />
          <Campo
            etiqueta="Precio (déjalo vacío para «Consultar precio»)"
            value={p.precio}
            onChangeText={(t) => cambiar({ precio: t })}
            error={errores.precio}
            keyboardType="decimal-pad"
          />

          <Campo etiqueta="Sección (Tacos, Bebidas…)" value={p.seccion} onChangeText={(t) => cambiar({ seccion: t })} error={errores.seccion} maxLength={40} />
          {secciones.length > 0 ? (
            <View style={estilos.chips}>
              {secciones.map((s) => (
                <Pulsable
                  key={s}
                  onPress={() => cambiar({ seccion: s })}
                  accessibilityRole="button"
                  accessibilityLabel={`Usar la sección ${s}`}
                  style={[estilos.chip, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}
                >
                  <ThemedText type="small" style={Texto.pesoFuerte}>{s}</ThemedText>
                </Pulsable>
              ))}
            </View>
          ) : null}

          <Campo
            etiqueta="Descripción (opcional)"
            value={p.descripcion}
            onChangeText={(t) => cambiar({ descripcion: t })}
            error={errores.descripcion}
            multiline
            maxLength={200}
            style={estilos.multilinea}
          />

          <View style={estilos.bloque}>
            <ThemedText type="smallBold" themeColor="textSecondary">Foto (opcional)</ThemedText>
            {hayFoto ? (
              <View style={estilos.filaFoto}>
                {miniatura ? (
                  <Image source={{ uri: miniatura }} style={estilos.miniatura} contentFit="cover" />
                ) : (
                  <View style={[estilos.miniatura, { backgroundColor: theme.backgroundSelected }]} />
                )}
                <Pulsable
                  onPress={() => cambiar({ foto: null, fotoNueva: null })}
                  accessibilityRole="button"
                  accessibilityLabel="Quitar la foto del producto"
                  style={estilos.accion}
                >
                  <ThemedText type="small" themeColor="acento">Quitar foto</ThemedText>
                </Pulsable>
              </View>
            ) : null}
            <Pulsable
              onPress={() => void elegirFoto()}
              accessibilityRole="button"
              accessibilityLabel={hayFoto ? 'Cambiar la foto del producto' : 'Agregar una foto del producto'}
              style={[estilos.agregar, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}
            >
              <Ionicons name="camera-outline" size={20} color={theme.bosque} />
              <ThemedText style={Texto.pesoFuerte}>{hayFoto ? 'Cambiar foto' : 'Agregar foto'}</ThemedText>
            </Pulsable>
          </View>

          <Sello onPress={guardar} accessibilityLabel="Guardar producto">Guardar producto</Sello>

          {!esNuevo ? (
            <Pulsable onPress={onQuitar} accessibilityRole="button" accessibilityLabel="Quitar el producto del menú" style={estilos.accion}>
              <ThemedText type="small" style={{ color: theme.error }}>Quitar del menú</ThemedText>
            </Pulsable>
          ) : null}
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  hoja: { flex: 1 },
  contenido: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cerrar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderWidth: Filete.fino,
    borderRadius: Radios.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multilinea: { minHeight: 90, textAlignVertical: 'top', paddingTop: Spacing.three },
  bloque: { gap: Spacing.two },
  filaFoto: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  miniatura: { width: 72, height: 72, borderRadius: Radios.control },
  accion: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  agregar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: 48,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
  },
});
