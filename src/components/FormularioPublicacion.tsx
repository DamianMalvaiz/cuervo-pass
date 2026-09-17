import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { z } from 'zod';

import { AppColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FotoEntrada } from '@/services/publicaciones.service';
import { ThemedText } from './themed-text';

const MAX_FOTOS = 5;

const esquema = z.object({
  direccion: z.string().min(5, 'Escribe una dirección o zona'),
  precioRenta: z
    .string()
    .min(1, 'Escribe el precio')
    .regex(/^\d+$/, 'Solo números')
    .refine((v) => Number(v) > 0, 'Debe ser mayor a 0'),
  descripcion: z.string().optional(),
  whatsapp: z.string().regex(/^\d{10}$/, 'Agrega un número a 10 dígitos'),
});

export type ValoresFormularioPublicacion = z.infer<typeof esquema>;

export interface DatosGuardarPublicacion extends ValoresFormularioPublicacion {
  fotos: FotoEntrada[];
}

interface Props {
  valoresIniciales?: Partial<ValoresFormularioPublicacion>;
  fotosIniciales?: string[];
  textoBoton: string;
  onGuardar: (datos: DatosGuardarPublicacion) => Promise<void>;
}

// Fila de fotos con miniaturas que se pueden quitar y placeholder para agregar
// más — misma UI tanto para crear (fotosIniciales vacío) como para editar.
export function FormularioPublicacion({ valoresIniciales, fotosIniciales = [], textoBoton, onGuardar }: Props) {
  const theme = useTheme();
  const [fotos, setFotos] = useState<FotoEntrada[]>(
    fotosIniciales.map((url) => ({ url, esNueva: false }))
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ValoresFormularioPublicacion>({ resolver: zodResolver(esquema), defaultValues: valoresIniciales });

  const uriDeFoto = (foto: FotoEntrada) => (foto.esNueva ? foto.uri : foto.url);

  const onAgregarFotos = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setError('Necesitamos permiso para acceder a tus fotos');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_FOTOS - fotos.length,
      quality: 1,
    });
    if (resultado.canceled) return;
    const nuevas: FotoEntrada[] = resultado.assets.map((a) => ({ uri: a.uri, esNueva: true }));
    setFotos((prev) => [...prev, ...nuevas].slice(0, MAX_FOTOS));
  };

  const onQuitarFoto = (foto: FotoEntrada) => {
    setFotos((prev) => prev.filter((f) => uriDeFoto(f) !== uriDeFoto(foto)));
  };

  const onSubmit = async (valores: ValoresFormularioPublicacion) => {
    setError(null);
    setEnviando(true);
    try {
      await onGuardar({ ...valores, fotos });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la publicación');
    } finally {
      setEnviando(false);
    }
  };

  const estiloInput = [styles.input, { borderColor: theme.border, color: theme.text }];

  return (
    <View style={styles.container}>
      <Controller
        control={control}
        name="direccion"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={estiloInput}
            placeholder="Dirección o zona"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Dirección o zona"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.direccion && <ThemedText style={styles.error}>{errors.direccion.message}</ThemedText>}

      <Controller
        control={control}
        name="precioRenta"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={estiloInput}
            placeholder="Precio de renta (MXN/mes)"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            accessibilityLabel="Precio de renta mensual en pesos"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.precioRenta && <ThemedText style={styles.error}>{errors.precioRenta.message}</ThemedText>}

      <Controller
        control={control}
        name="descripcion"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[estiloInput, styles.descripcionInput]}
            placeholder="Descripción (amueblado, mascotas, servicios incluidos...)"
            placeholderTextColor={theme.textSecondary}
            multiline
            accessibilityLabel="Descripción de la publicación"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />

      <Controller
        control={control}
        name="whatsapp"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={estiloInput}
            placeholder="WhatsApp (10 dígitos)"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            accessibilityLabel="Número de WhatsApp, 10 dígitos"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.whatsapp && <ThemedText style={styles.error}>{errors.whatsapp.message}</ThemedText>}

      <ThemedText type="small" style={styles.etiqueta}>
        Fotos ({fotos.length}/{MAX_FOTOS})
      </ThemedText>
      <View style={styles.fotosFila}>
        {fotos.map((foto, indice) => (
          <View key={uriDeFoto(foto)} style={styles.fotoMiniContenedor}>
            <Image source={{ uri: uriDeFoto(foto) }} style={styles.fotoMini} contentFit="cover" />
            <Pressable
              onPress={() => onQuitarFoto(foto)}
              style={styles.fotoMiniQuitar}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Quitar foto ${indice + 1}`}
            >
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
        {fotos.length < MAX_FOTOS && (
          <Pressable
            onPress={onAgregarFotos}
            style={[styles.fotoMini, styles.fotoAgregar, { backgroundColor: theme.backgroundSelected }]}
            accessibilityRole="button"
            accessibilityLabel="Agregar foto"
          >
            <Ionicons name="add" size={28} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <Pressable
        style={styles.boton}
        onPress={handleSubmit(onSubmit)}
        disabled={enviando}
        accessibilityRole="button"
        accessibilityLabel={textoBoton}
        accessibilityState={{ disabled: enviando, busy: enviando }}
      >
        {enviando ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.botonTexto}>{textoBoton}</ThemedText>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  input: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three },
  descripcionInput: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: AppColors.destructiveRed },
  etiqueta: { marginTop: Spacing.two },
  fotosFila: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  fotoMiniContenedor: { position: 'relative' },
  fotoMini: { width: 80, height: 80, borderRadius: Spacing.two },
  fotoMiniQuitar: {
    position: 'absolute',
    top: -Spacing.half,
    right: -Spacing.half,
    backgroundColor: AppColors.destructiveRed,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoAgregar: { alignItems: 'center', justifyContent: 'center' },
  boton: {
    backgroundColor: AppColors.primary,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.three,
    minHeight: 44,
    justifyContent: 'center',
  },
  botonTexto: { color: '#fff', fontWeight: '600' },
});
