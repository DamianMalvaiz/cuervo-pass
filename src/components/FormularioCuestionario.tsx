import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Filete, Radios, Spacing, Tipografia } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { OPCION_OTRA_UNIVERSIDAD, UNIVERSIDADES } from '@/lib/universidades';
import { Campo } from './Campo';
import { Casilla } from './Casilla';
import { FileteHoja } from './ficha/CampoFicha';
import { FilaAjuste } from './ficha/FilaAjuste';
import { Seccion } from './ficha/Seccion';
import { Sello } from './ficha/Sello';
import { ThemedText } from './themed-text';

// Documento maestro v5 · §25 (pantallas) y §29 (consentimiento para la IA).

const NIVELES_RUIDO = [
  { valor: 'bajo', etiqueta: 'Silencio', ayuda: 'Necesito tranquilidad casi siempre' },
  { valor: 'medio', etiqueta: 'Normal', ayuda: 'Ruido de convivencia, sin fiestas' },
  { valor: 'alto', etiqueta: 'Animado', ayuda: 'Me da igual el ruido, hay visitas seguido' },
] as const;

const esquema = z
  .object({
    universidadId: z.string().min(1, 'Elige tu universidad'),
    universidadOtroNombre: z.string().optional(),
    presupuestoMin: z.string().regex(/^\d+$/, 'Solo números'),
    presupuestoMax: z.string().regex(/^\d+$/, 'Solo números'),
    // §17: el radio de búsqueda dejó de estar fijo en 5 km dentro del código.
    // Es del usuario, y el filtro duro de las sugerencias lo usa como corte real.
    distanciaMaxKm: z
      .string()
      .regex(/^\d+(\.\d+)?$/, 'Solo números')
      .refine((v) => Number(v) > 0 && Number(v) <= 50, 'Entre 1 y 50 km'),
    mascotas: z.boolean(),
    fuma: z.boolean(),
    nivelRuido: z.enum(['bajo', 'medio', 'alto']),
    buscaRoomie: z.boolean(),
    textoLibre: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
    consienteIa: z.boolean(),
  })
  .refine((v) => Number(v.presupuestoMax) >= Number(v.presupuestoMin), {
    message: 'El máximo debe ser mayor o igual al mínimo',
    path: ['presupuestoMax'],
  })
  .refine((v) => v.universidadId !== OPCION_OTRA_UNIVERSIDAD || (v.universidadOtroNombre?.trim().length ?? 0) >= 3, {
    message: 'Escribe el nombre completo de tu universidad',
    path: ['universidadOtroNombre'],
  });

type FormCuestionario = z.infer<typeof esquema>;

export interface RespuestasCuestionario {
  universidad: string;
  // Coordenadas ya verificadas (universidad conocida) — si es null, hay que
  // geocodificar `universidad` como texto libre (con las limitaciones de eso).
  universidadCoords: { lat: number; lng: number } | null;
  presupuestoMin: number;
  presupuestoMax: number;
  distanciaMaxKm: number;
  mascotas: boolean;
  fuma: boolean;
  // Se pregunta directo, además de inferirse del texto libre. v3 solo lo
  // infería, así que quien no escribía texto no tenía nivel de ruido — y ese
  // sumando del score valía cero para esa persona de por vida.
  nivelRuido: 'bajo' | 'medio' | 'alto';
  buscaRoomie: boolean;
  textoLibre?: string;
  // §29 · AUD-23: sin esto marcado no se llama al modelo, no se genera el
  // vector, y las sugerencias se calculan solo con el cuestionario.
  consienteIa: boolean;
}

interface Props {
  valoresIniciales?: Partial<RespuestasCuestionario>;
  textoBoton?: string;
  onCompletar: (respuestas: RespuestasCuestionario) => Promise<void>;
}

export function FormularioCuestionario({ valoresIniciales, textoBoton = 'Guardar y continuar', onCompletar }: Props) {
  const theme = useTheme();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const universidadInicial =
    UNIVERSIDADES.find((u) => u.nombre === valoresIniciales?.universidad)?.id ?? UNIVERSIDADES[0]?.id;

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormCuestionario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      universidadId: universidadInicial,
      presupuestoMin: valoresIniciales?.presupuestoMin?.toString(),
      presupuestoMax: valoresIniciales?.presupuestoMax?.toString(),
      distanciaMaxKm: (valoresIniciales?.distanciaMaxKm ?? 5).toString(),
      mascotas: valoresIniciales?.mascotas ?? false,
      fuma: valoresIniciales?.fuma ?? false,
      nivelRuido: valoresIniciales?.nivelRuido ?? 'medio',
      buscaRoomie: valoresIniciales?.buscaRoomie ?? false,
      textoLibre: valoresIniciales?.textoLibre,
      // NO viene premarcada: §29. Una casilla premarcada no es consentimiento.
      consienteIa: valoresIniciales?.consienteIa ?? false,
    },
  });

  const universidadIdSeleccionada = watch('universidadId');
  const esOtra = universidadIdSeleccionada === OPCION_OTRA_UNIVERSIDAD;

  const onSubmit = async (valores: FormCuestionario) => {
    setError(null);
    setEnviando(true);
    try {
      const universidadConocida = UNIVERSIDADES.find((u) => u.id === valores.universidadId);
      await onCompletar({
        universidad: universidadConocida?.nombre ?? valores.universidadOtroNombre?.trim() ?? '',
        universidadCoords: universidadConocida ? { lat: universidadConocida.lat, lng: universidadConocida.lng } : null,
        presupuestoMin: Number(valores.presupuestoMin),
        presupuestoMax: Number(valores.presupuestoMax),
        distanciaMaxKm: Number(valores.distanciaMaxKm),
        mascotas: valores.mascotas,
        fuma: valores.fuma,
        nivelRuido: valores.nivelRuido,
        buscaRoomie: valores.buscaRoomie,
        textoLibre: valores.textoLibre?.trim() || undefined,
        consienteIa: valores.consienteIa,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el cuestionario');
    } finally {
      setEnviando(false);
    }
  };

  /** Atajos de distancia. Teclear "5" en un campo numérico es peor que tocarlo,
   *  y el campo sigue ahí para quien quiera otro valor. */
  const ATAJOS_KM = ['1', '3', '5', '10'];

  return (
    <View style={estilos.contenedor}>
      {/* ── Dónde estudias ───────────────────────────────────────────── */}
      <Seccion titulo="TU UNIVERSIDAD">
        <Controller
          control={control}
          name="universidadId"
          render={({ field: { onChange, value } }) => (
            <View style={estilos.opciones}>
              {UNIVERSIDADES.map((u) => (
                <OpcionRadio
                  key={u.id}
                  etiqueta={u.nombre}
                  seleccionado={value === u.id}
                  onPress={() => onChange(u.id)}
                />
              ))}
              <OpcionRadio
                etiqueta="Otra (escribir)"
                seleccionado={esOtra}
                onPress={() => onChange(OPCION_OTRA_UNIVERSIDAD)}
              />
            </View>
          )}
        />
        {errors.universidadId && (
          <ThemedText type="small" style={{ color: theme.error }}>
            {errors.universidadId.message}
          </ThemedText>
        )}

        {esOtra && (
          <Controller
            control={control}
            name="universidadOtroNombre"
            render={({ field: { onChange, onBlur, value } }) => (
              <Campo
                etiqueta="NOMBRE DE TU UNIVERSIDAD"
                placeholder="Universidad Tecnológica del Valle de Toluca"
                error={errors.universidadOtroNombre?.message}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
        )}
      </Seccion>

      {/* ── Los filtros DUROS ────────────────────────────────────────── */}
      {/* Estos dos no son preferencias suaves: son el corte real que aplica el
          filtro de la migración 0015. Lo que quede fuera NO se muestra, y
          decirlo evita la pregunta "¿por qué no aparece tal departamento?". */}
      <Seccion titulo="PRESUPUESTO Y DISTANCIA">
        <View style={estilos.fila}>
          <View style={estilos.mitad}>
            <Controller
              control={control}
              name="presupuestoMin"
              render={({ field: { onChange, onBlur, value } }) => (
                <Campo
                  etiqueta="MÍNIMO (MXN)"
                  placeholder="2000"
                  keyboardType="numeric"
                  error={errors.presupuestoMin?.message}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
          </View>
          <View style={estilos.mitad}>
            <Controller
              control={control}
              name="presupuestoMax"
              render={({ field: { onChange, onBlur, value } }) => (
                <Campo
                  etiqueta="MÁXIMO (MXN)"
                  placeholder="5000"
                  keyboardType="numeric"
                  error={errors.presupuestoMax?.message}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="distanciaMaxKm"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={estilos.bloqueDistancia}>
              <Campo
                etiqueta="DISTANCIA MÁXIMA (KM)"
                placeholder="5"
                keyboardType="numeric"
                error={errors.distanciaMaxKm?.message}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
              <View style={estilos.atajos}>
                {ATAJOS_KM.map((km) => {
                  const activo = value === km;
                  return (
                    <Pressable
                      key={km}
                      onPress={() => onChange(km)}
                      style={[
                        estilos.atajo,
                        {
                          borderColor: activo ? theme.acento : theme.border,
                          backgroundColor: activo ? theme.tintedSurface : 'transparent',
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${km} kilómetros`}
                      accessibilityState={{ selected: activo }}
                    >
                      <ThemedText type="small" themeColor={activo ? 'acento' : 'textSecondary'}>
                        {km} km
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={estilos.ayuda}>
                Es un corte real: no te mostramos publicaciones más lejos que esto.
              </ThemedText>
            </View>
          )}
        />
      </Seccion>

      {/* ── Convivencia ──────────────────────────────────────────────── */}
      <Seccion titulo="CONVIVENCIA">
        <View style={estilos.grupo}>
          <ThemedText type="etiqueta" themeColor="textSecondary">
            ¿CÓMO TE GUSTA TU CASA?
          </ThemedText>
          <Controller
            control={control}
            name="nivelRuido"
            render={({ field: { onChange, value } }) => (
              <View style={estilos.opciones}>
                {NIVELES_RUIDO.map((n) => (
                  <OpcionRadio
                    key={n.valor}
                    etiqueta={n.etiqueta}
                    ayuda={n.ayuda}
                    seleccionado={value === n.valor}
                    onPress={() => onChange(n.valor)}
                  />
                ))}
              </View>
            )}
          />
        </View>

        <Controller
          control={control}
          name="mascotas"
          render={({ field: { onChange, value } }) => (
            <FilaAjuste
              icono="paw-outline"
              etiqueta="Tengo mascotas"
              descripcion="Es un filtro DURO: si lo activas, solo verás publicaciones que las aceptan."
              valor={value}
              onCambiar={onChange}
            />
          )}
        />
        <FileteHoja />
        <Controller
          control={control}
          name="fuma"
          render={({ field: { onChange, value } }) => (
            <FilaAjuste
              icono="flame-outline"
              etiqueta="Fumo"
              descripcion="Se usa para calcular afinidad con otros roomies, no para descartar publicaciones."
              valor={value}
              onCambiar={onChange}
            />
          )}
        />
        <FileteHoja />
        <Controller
          control={control}
          name="buscaRoomie"
          render={({ field: { onChange, value } }) => (
            <FilaAjuste
              icono="people-outline"
              etiqueta="Ya tengo depa y busco roomie"
              descripcion="Si lo activas, apareces en la pestaña de Roomies para que te encuentren."
              valor={value}
              onCambiar={onChange}
            />
          )}
        />
      </Seccion>

      {/* ── Texto libre ──────────────────────────────────────────────── */}
      <Seccion titulo="SOBRE TI">
        <Controller
          control={control}
          name="textoLibre"
          render={({ field: { onChange, onBlur, value } }) => (
            <Campo
              etiqueta="CUÉNTANOS DE TI (OPCIONAL)"
              placeholder="Ej. soy tranquilo, tengo un gato, estudio en las mañanas…"
              multiline
              maxLength={2000}
              style={estilos.textoLibre}
              error={errors.textoLibre?.message}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
        />
      </Seccion>

      {/* ── Consentimiento de IA ─────────────────────────────────────── */}
      {/* §29 · AUD-23. Va en su propio bloque y no perdido entre las demás
          preguntas: es el único ajuste que cambia lo que la app HACE, y el
          único que la ley exige que no venga premarcado. */}
      <View style={[estilos.bloqueIa, { borderColor: theme.tintedBorder, backgroundColor: theme.tintedSurface }]}>
        <View style={estilos.tituloIa}>
          <Ionicons name="sparkles-outline" size={18} color={theme.acento} />
          <ThemedText type="etiqueta" themeColor="acento">
            ANÁLISIS CON INTELIGENCIA ARTIFICIAL
          </ThemedText>
        </View>
        <Controller
          control={control}
          name="consienteIa"
          render={({ field: { onChange, value } }) => (
            <Casilla
              valor={value}
              onCambiar={onChange}
              etiqueta="Quiero que la app analice mi descripción con inteligencia artificial para sugerirme mejores opciones."
              ayuda="Si no la marcas, tus sugerencias se calculan solo con el cuestionario y tu texto no sale de esta app. Puedes cambiarlo cuando quieras; al retirarlo se borra el vector."
            />
          )}
        />
      </View>

      {error && (
        <View style={[estilos.errorBloque, { borderColor: theme.error }]}>
          <Ionicons name="alert-circle-outline" size={18} color={theme.error} />
          <ThemedText type="small" style={[{ color: theme.error }, estilos.flexible]} accessibilityLiveRegion="assertive">
            {error}
          </ThemedText>
        </View>
      )}

      <Sello onPress={handleSubmit(onSubmit)} cargando={enviando} accessibilityLabel={textoBoton}>
        {textoBoton}
      </Sello>
    </View>
  );
}

/**
 * Una opción de lista.
 *
 * La versión anterior rellenaba de ámbar la opción elegida. Eso gastaba la
 * tinta del sello en algo que no compromete nada —elegir una universidad es
 * reversible— y con cuatro opciones dejaba la pantalla llena de ámbar. Ahora la
 * selección se marca como en un formulario: lavado suave, filete del acento, y
 * una PALOMA. Tres señales, ninguna dependiente solo del color.
 */
function OpcionRadio({
  etiqueta,
  ayuda,
  seleccionado,
  onPress,
}: {
  etiqueta: string;
  ayuda?: string;
  seleccionado: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: seleccionado }}
      accessibilityLabel={ayuda ? `${etiqueta}. ${ayuda}` : etiqueta}
      style={({ pressed }) => [
        estilos.opcion,
        {
          borderColor: seleccionado ? theme.acento : theme.border,
          backgroundColor: seleccionado ? theme.tintedSurface : 'transparent',
        },
        pressed && estilos.presionado,
      ]}
    >
      <View style={estilos.flexible}>
        <ThemedText style={seleccionado ? estilos.textoElegido : undefined}>{etiqueta}</ThemedText>
        {ayuda ? (
          <ThemedText type="small" themeColor="textSecondary">
            {ayuda}
          </ThemedText>
        ) : null}
      </View>
      {seleccionado && <Ionicons name="checkmark-circle" size={20} color={theme.acento} />}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: Spacing.four },
  flexible: { flex: 1 },
  presionado: { opacity: 0.7 },
  fila: { flexDirection: 'row', gap: Spacing.three },
  mitad: { flex: 1 },
  grupo: { gap: Spacing.two },
  opciones: { gap: Spacing.two },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    padding: Spacing.three,
    minHeight: 52,
  },
  textoElegido: { fontFamily: Tipografia.semibold },
  bloqueDistancia: { gap: Spacing.two },
  atajos: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  atajo: {
    borderWidth: Filete.fino,
    borderRadius: Radios.full,
    paddingHorizontal: Spacing.three,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ayuda: { lineHeight: 20 },
  textoLibre: { minHeight: 100, textAlignVertical: 'top', paddingTop: Spacing.three },
  bloqueIa: {
    borderWidth: Filete.fino,
    borderRadius: Radios.hoja,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  tituloIa: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  errorBloque: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    padding: Spacing.three,
  },
});
