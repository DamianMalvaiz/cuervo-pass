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
import { MAX_FOTOS_PRODUCTO, opcionesDeSeccion, validarProducto, type ErroresProducto, type ProductoEditable } from '@/lib/menu';
import { avisarPermisoDeFotosDenegado } from '@/lib/permisos';

/**
 * El editor de UN producto del menú, en una hoja modal · Cuervo 360 (0053).
 *
 * Trabaja sobre una COPIA: nada cambia en el menú hasta que se toca «Guardar producto». Ofrece las secciones que ya existen
 * como atajos (escribir una nueva también sirve) y hasta 5 fotos opcionales (la primera es la portada). `urlsFotos` trae las ya guardadas, ya firmadas
 * para mostrarlas.
 */
export function EditorProducto({
  producto,
  esNuevo,
  secciones,
  urlsFotos,
  onGuardar,
  onQuitar,
  onCerrar,
}: {
  producto: ProductoEditable;
  esNuevo: boolean;
  secciones: string[];
  /** Las rutas guardadas ya firmadas, para mostrarlas. */
  urlsFotos?: ReadonlyMap<string, string>;
  onGuardar: (p: ProductoEditable) => void;
  onQuitar: () => void;
  onCerrar: () => void;
}) {
  const theme = useTheme();
  const [p, setP] = useState(producto);
  const [errores, setErrores] = useState<ErroresProducto>({});
  const [listaAbierta, setListaAbierta] = useState(false);
  const [otra, setOtra] = useState(false);
  const opciones = opcionesDeSeccion(secciones);

  const cambiar = (c: Partial<ProductoEditable>) => setP((x) => ({ ...x, ...c }));

  const total = p.fotos.length + p.fotosNuevas.length;
  const restantes = MAX_FOTOS_PRODUCTO - total;

  const elegirFotos = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      avisarPermisoDeFotosDenegado(permiso.canAskAgain);
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true, selectionLimit: restantes });
    const uris = r.canceled ? [] : r.assets.map((a) => a.uri).slice(0, restantes);
    if (uris.length > 0) setP((x) => ({ ...x, fotosNuevas: [...x.fotosNuevas, ...uris].slice(0, MAX_FOTOS_PRODUCTO - x.fotos.length) }));
  };

  // Guardadas primero, luego las nuevas: el mismo orden con el que se guardan (la primera es la portada).
  const miniaturas = [
    ...p.fotos.map((ruta) => ({ clave: ruta, uri: urlsFotos?.get(ruta) ?? null })),
    ...p.fotosNuevas.map((uri) => ({ clave: uri, uri })),
  ];
  const quitarFoto = (indice: number) =>
    setP((x) =>
      indice < x.fotos.length
        ? { ...x, fotos: x.fotos.filter((_, i) => i !== indice) }
        : { ...x, fotosNuevas: x.fotosNuevas.filter((_, i) => i !== indice - x.fotos.length) }
    );

  const guardar = () => {
    const e = validarProducto(p);
    setErrores(e);
    if (Object.keys(e).length === 0) onGuardar(p);
  };

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

          {/* La sección se ELIGE de una lista (las predefinidas y las que el negocio ya usa); «Otra sección», siempre al final, abre un campo para escribirla. */}
          <View style={estilos.bloque}>
            <ThemedText type="smallBold" themeColor="textSecondary">Sección</ThemedText>
            <Pulsable
              onPress={() => setListaAbierta((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={`Sección: ${p.seccion.trim() || 'sin elegir'}`}
              accessibilityState={{ expanded: listaAbierta }}
              style={[estilos.selector, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText style={estilos.valorSelector} themeColor={p.seccion.trim() ? 'text' : 'textSecondary'}>
                {p.seccion.trim() || 'Elige una sección'}
              </ThemedText>
              <Ionicons name={listaAbierta ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
            </Pulsable>
            {listaAbierta ? (
              <View style={[estilos.lista, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
                {opciones.map((o) => {
                  const elegida = o.toLocaleLowerCase('es') === p.seccion.trim().toLocaleLowerCase('es');
                  return (
                    <Pulsable
                      key={o}
                      onPress={() => {
                        cambiar({ seccion: o });
                        setOtra(false);
                        setListaAbierta(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Sección ${o}`}
                      accessibilityState={{ selected: elegida }}
                      style={estilos.opcion}
                    >
                      <ThemedText style={elegida ? Texto.pesoFuerte : undefined}>{o}</ThemedText>
                      {elegida ? <Ionicons name="checkmark" size={18} color={theme.bosque} /> : null}
                    </Pulsable>
                  );
                })}
                <Pulsable
                  onPress={() => {
                    cambiar({ seccion: '' });
                    setOtra(true);
                    setListaAbierta(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Otra sección"
                  style={estilos.opcion}
                >
                  <ThemedText style={Texto.pesoFuerte}>Otra sección…</ThemedText>
                </Pulsable>
              </View>
            ) : null}
            {otra ? (
              <Campo etiqueta="Escribe la sección" value={p.seccion} onChangeText={(t) => cambiar({ seccion: t })} error={errores.seccion} maxLength={40} />
            ) : errores.seccion ? (
              <ThemedText type="small" style={{ color: theme.error }}>{errores.seccion}</ThemedText>
            ) : null}
          </View>

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
            <ThemedText type="smallBold" themeColor="textSecondary">
              Fotos ({total} de {MAX_FOTOS_PRODUCTO}) · la primera es la portada
            </ThemedText>
            {miniaturas.length > 0 ? (
              <View style={estilos.fotos}>
                {miniaturas.map((m, i) => (
                  <View key={m.clave} style={estilos.envolturaFoto}>
                    {m.uri ? (
                      <Image source={{ uri: m.uri }} style={estilos.miniatura} contentFit="cover" />
                    ) : (
                      <View style={[estilos.miniatura, { backgroundColor: theme.backgroundSelected }]} />
                    )}
                    <Pulsable
                      onPress={() => quitarFoto(i)}
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar la foto ${i + 1} del producto`}
                      hitSlop={8}
                      style={[estilos.quitarFoto, { backgroundColor: theme.background, borderColor: theme.filete }]}
                    >
                      <Ionicons name="close" size={16} color={theme.text} />
                    </Pulsable>
                  </View>
                ))}
              </View>
            ) : null}
            {restantes > 0 ? (
              <Pulsable
                onPress={() => void elegirFotos()}
                accessibilityRole="button"
                accessibilityLabel="Agregar una foto del producto"
                style={[estilos.agregar, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}
              >
                <Ionicons name="camera-outline" size={20} color={theme.bosque} />
                <ThemedText style={Texto.pesoFuerte}>{total === 0 ? 'Agregar fotos' : 'Agregar más fotos'}</ThemedText>
              </Pulsable>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">Llegaste al tope: hasta {MAX_FOTOS_PRODUCTO} fotos por producto.</ThemedText>
            )}
            {errores.fotos ? <ThemedText type="small" style={{ color: theme.error }}>{errores.fotos}</ThemedText> : null}
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
  selector: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, borderWidth: Filete.fino, borderRadius: Radios.control },
  valorSelector: { flex: 1 },
  lista: { borderWidth: Filete.fino, borderRadius: Radios.control, overflow: 'hidden' },
  opcion: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three },
  multilinea: { minHeight: 90, textAlignVertical: 'top', paddingTop: Spacing.three },
  bloque: { gap: Spacing.two },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  envolturaFoto: { width: 72, height: 72 },
  miniatura: { width: 72, height: 72, borderRadius: Radios.control },
  // toque-ok: el botón de quitar mide 28 pt visibles y llega a 44 con el hitSlop de 8 a cada lado.
  quitarFoto: { position: 'absolute', top: -Spacing.one, right: -Spacing.one, width: 28, height: 28, borderRadius: 14, borderWidth: Filete.fino, alignItems: 'center', justifyContent: 'center' },
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
