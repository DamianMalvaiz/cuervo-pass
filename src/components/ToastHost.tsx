import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Filete, MaxContentWidth, Radios, Spacing } from '@/constants/theme';
import { useMovimientoReducido } from '@/hooks/use-movimiento-reducido';
import { aviso } from '@/lib/registro';
import { useTheme } from '@/hooks/use-theme';
import { useToastStore, type TipoToast } from '@/store/useToastStore';

const ICONO: Record<TipoToast, keyof typeof Ionicons.glyphMap> = {
  exito: 'checkmark-circle-outline',
  error: 'alert-circle-outline',
  info: 'information-circle-outline',
};

const MS_ANIMACION = 180;

/**
 * Pinta el aviso actual. Se monta UNA vez, en el layout raíz.
 *
 * ── Arriba y no abajo ──────────────────────────────────────────────────────
 * Abajo viven el pie fijo con el botón de guardar y las pestañas; un aviso
 * ahí taparía justo la acción que acaba de disparar el aviso. Respeta el inset
 * superior del dispositivo.
 *
 * ── Qué hace cada pieza ────────────────────────────────────────────────────
 *   · Se cierra solo, y el temporizador va ligado al ID del aviso: el de uno
 *     viejo no puede llevarse al nuevo (ver `descartar`).
 *   · Tocarlo lo cierra. Un aviso que no se puede quitar tapa el contenido.
 *   · Un error es una ALERTA para el lector de pantalla. Y todo se ANUNCIA a mano:
 *     `accessibilityLiveRegion` solo lo respeta Android, y sin el anuncio
 *     VoiceOver nunca se entera de que apareció algo.
 *   · Con «reducir movimiento» no hay animación de entrada ni de salida. Mientras
 *     no se sabe la preferencia (`null`) tampoco: es el mismo criterio de
 *     `useMovimientoReducido`, que lo explica.
 *
 * No hay sombra: este mundo separa con filete (ver `PieFijo`). El borde de color
 * dice el tipo, y el icono y el texto lo dicen también, para que no dependa del
 * color solo.
 */
export function ToastHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reducido = useMovimientoReducido();
  const actual = useToastStore((s) => s.actual);
  const descartar = useToastStore((s) => s.descartar);

  const id = actual?.id;
  const duracionMs = actual?.duracionMs;
  const mensaje = actual?.mensaje;
  const etiquetaAccion = actual?.accion?.etiqueta;

  useEffect(() => {
    if (id === undefined || duracionMs === undefined) return;
    const temporizador = setTimeout(() => descartar(id), duracionMs);
    return () => clearTimeout(temporizador);
  }, [id, duracionMs, descartar]);

  useEffect(() => {
    if (id === undefined || !mensaje) return;
    // Con acción, el anuncio lo dice: sin esto el botón existe pero quien usa un
    // lector de pantalla no sabe que hay algo que pulsar.
    AccessibilityInfo.announceForAccessibility(
      etiquetaAccion ? `${mensaje}. Acción disponible: ${etiquetaAccion}.` : mensaje
    );
  }, [id, mensaje, etiquetaAccion]);

  if (!actual) return null;

  const animar = reducido === false;

  // Se cierra PRIMERO y se ejecuta después: si la acción lanza, el aviso ya no está
  // colgado. Abrir los Ajustes del teléfono no es de fiar en todos los dispositivos.
  const ejecutarAccion = () => {
    const accion = actual.accion;
    descartar(actual.id);
    try {
      accion?.onPress();
    } catch (e) {
      aviso('La acción del aviso falló', { etiqueta: accion?.etiqueta }, e);
    }
  };
  const colorBorde =
    actual.tipo === 'exito' ? theme.exito : actual.tipo === 'error' ? theme.error : theme.border;

  return (
    <View
      pointerEvents="box-none"
      style={[estilos.capa, { top: insets.top + Spacing.two }]}
    >
      {/* La clave es el contenido y no el id: repetir el mismo mensaje reinicia el
          temporizador pero no vuelve a animar la entrada. */}
      <Animated.View
        key={`${actual.tipo}|${actual.mensaje}`}
        entering={animar ? FadeInDown.duration(MS_ANIMACION) : undefined}
        exiting={animar ? FadeOutUp.duration(MS_ANIMACION) : undefined}
        style={estilos.columna}
      >
        <View
          style={[
            estilos.aviso,
            { backgroundColor: theme.backgroundElement, borderColor: colorBorde },
          ]}
        >
          {/* El cuerpo y el botón son HERMANOS y no uno dentro del otro: un
              Pressable que agrupa a sus hijos para el lector de pantalla (iOS) deja
              el botón inalcanzable. Tocar el cuerpo cierra; solo el botón actúa. */}
          <Pressable
            onPress={() => descartar(actual.id)}
            accessibilityRole={actual.tipo === 'error' ? 'alert' : undefined}
            accessibilityLiveRegion={actual.tipo === 'error' ? 'assertive' : 'polite'}
            accessibilityHint="Toca para cerrar"
            style={estilos.cuerpo}
          >
            <Ionicons name={ICONO[actual.tipo]} size={22} color={colorBorde} />
            <ThemedText type="small" style={estilos.texto}>
              {actual.mensaje}
            </ThemedText>
          </Pressable>
          {actual.accion && (
            <Pressable
              onPress={ejecutarAccion}
              accessibilityRole="button"
              accessibilityLabel={actual.accion.etiqueta}
              style={estilos.accion}
            >
              <ThemedText type="smallBold" style={{ color: theme.acento }}>
                {actual.accion.etiqueta}
              </ThemedText>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  // Ocupa el ancho y no captura toques fuera del aviso (`box-none`): el
  // contenido de debajo sigue siendo tocable.
  capa: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
    zIndex: 1000,
  },
  columna: { width: '100%', maxWidth: MaxContentWidth },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
  },
  cuerpo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  texto: { flex: 1 },
  // 44 pt: Invariante 8. El padding no basta, el alto del texto es de 20.
  accion: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
});
