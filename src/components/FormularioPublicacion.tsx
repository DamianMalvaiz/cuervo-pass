import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { z } from 'zod';

import { Spacing } from '@/constants/theme';
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

  return (
    <View style={styles.container}>
      <Controller
        control={control}
        name="direccion"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput style={styles.input} placeholder="Dirección o zona" onBlur={onBlur} onChangeText={onChange} value={value} />
        )}
      />
      {errors.direccion && <ThemedText style={styles.error}>{errors.direccion.message}</ThemedText>}

      <Controller
        control={control}
        name="precioRenta"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Precio de renta (MXN/mes)"
            keyboardType="numeric"
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
            style={[styles.input, styles.descripcionInput]}
            placeholder="Descripción (amueblado, mascotas, servicios incluidos...)"
            multiline
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
            style={styles.input}
            placeholder="WhatsApp (10 dígitos)"
            keyboardType="numeric"
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
        {fotos.map((foto) => (
          <Pressable key={uriDeFoto(foto)} onPress={() => onQuitarFoto(foto)} style={styles.fotoMiniContenedor}>
            <Image source={{ uri: uriDeFoto(foto) }} style={styles.fotoMini} />
            <View style={styles.fotoMiniQuitar}>
              <ThemedText style={styles.fotoMiniQuitarTexto}>✕</ThemedText>
            </View>
          </Pressable>
        ))}
        {fotos.length < MAX_FOTOS && (
          <Pressable onPress={onAgregarFotos} style={[styles.fotoMini, styles.fotoAgregar]}>
            <ThemedText style={styles.fotoAgregarTexto}>+</ThemedText>
          </Pressable>
        )}
      </View>

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <Pressable style={styles.boton} onPress={handleSubmit(onSubmit)} disabled={enviando}>
        {enviando ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.botonTexto}>{textoBoton}</ThemedText>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: Spacing.two, padding: Spacing.three },
  descripcionInput: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: '#d92d20' },
  etiqueta: { marginTop: Spacing.two },
  fotosFila: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  fotoMiniContenedor: { position: 'relative' },
  fotoMini: { width: 80, height: 80, borderRadius: Spacing.two },
  fotoMiniQuitar: {
    position: 'absolute',
    top: -Spacing.half,
    right: -Spacing.half,
    backgroundColor: '#d92d20',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoMiniQuitarTexto: { color: '#fff', fontSize: 12, lineHeight: 14 },
  fotoAgregar: { backgroundColor: '#E0E1E6', alignItems: 'center', justifyContent: 'center' },
  fotoAgregarTexto: { fontSize: 28, lineHeight: 28, color: '#60646C' },
  boton: { backgroundColor: '#208AEF', borderRadius: Spacing.two, padding: Spacing.three, alignItems: 'center', marginTop: Spacing.three },
  botonTexto: { color: '#fff', fontWeight: '600' },
});
